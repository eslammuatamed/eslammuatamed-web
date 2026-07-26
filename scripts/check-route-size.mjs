#!/usr/bin/env node
/**
 * Per-public-route size gate for the doc 20 §1 JavaScript budgets:
 *
 *     JS transferred per public route   ≤ 250 KB gz total          (D20-11)
 *     App-owned rendered bytes          ≤ 101 KiB (103,424 B)      (D20-12, frozen)
 *     CSS                               ≤ 30 KB gz
 *
 * WHY THIS BOOTS A SERVER. §1 budgets "per public route", which no static glob can express: a glob
 * also sums the lazily-loaded dashboard SPA chunks that no public route fetches (measured 260.7 KB
 * gz whole-bundle vs 221.8 KB gz actually referenced by `/`). So the asset set comes from each
 * route's rendered HTML, and only from `<script src>` / `<link rel=modulepreload|stylesheet>` —
 * `rel=prefetch` hints are for OTHER routes and are excluded (see lib/route-assets.mjs).
 *
 * WHY GZIP FOR THE TOTAL. §1 states that budget in `gz`. Cloudflare serves brotli, which is smaller,
 * so gzip is the conservative reading and the only unit comparable to the documented number.
 *
 * WHY renderedLength FOR THE APP BUDGET (D20-12). The predecessor budget was stated in gzip, and
 * gzip CANNOT be attributed per module inside a chunk that mixes app and vendor code — compression
 * is shared across one stream. That budget was therefore unprovable, not merely unmet: this gate
 * used to report lower/estimate/upper bounds and return INDETERMINATE on all six public routes. An
 * authorised `manualChunks` experiment to make gzip attributable was built, measured and REVERTED
 * (+10.3–11.5 % per route, dashboard isolation broken — doc 20 §5), so the metric was replaced
 * rather than the gate weakened.
 *
 * Rollup reports `renderedLength` per module per chunk: an exact integer, no estimation, no
 * apportioning, no chunking change required. Its honest limitation is stated rather than hidden —
 * these are POST-tree-shaking, PRE-minification source bytes, so 101 KiB app-owned is NOT 101 KiB
 * on the wire. It measures what the budget governs: growth in project-owned payload.
 *
 * Module→chunk provenance comes from Rollup (`ANALYZE_BUNDLE=1`, config/bundle-analysis.ts), never
 * from filenames, hashes or naming conventions. Ownership follows doc 08 §1 (`app/` is the Nuxt
 * srcDir) via an ORDERED ALLOWLIST — see `classifyModuleId`. Nothing becomes app-owned by falling
 * through, and unrecognised module shapes are reported as `unclassified` and fail the gate rather
 * than being absorbed into a number they may not belong in.
 *
 * Run `npm run size:routes` after `ANALYZE_BUNDLE=1 npm run build`.
 *
 * BUDGETS ARE doc 20 §1 VERBATIM. Re-baselining requires an owner decision plus a decision-log
 * entry in doc 20 — never an edit here. The app limit is FROZEN: this gate never recalculates it
 * from the build it is measuring.
 *
 * Exit codes are distinguishable on purpose:
 *   0 — every enforceable budget passed and no required classification was indeterminate
 *   1 — a genuine budget breach (total, app-owned, or material unclassified bytes in a valid build)
 *   2 — infrastructure/measurement failure (no build, missing/corrupt/empty/stale metadata,
 *       asset-to-metadata mismatch, preview would not start, route not served, HTML with no assets,
 *       timeout, internal error). Never conflated with a breach: one means "fix the code", the
 *       other means "the gate could not measure".
 */
import { spawn } from 'node:child_process'
import { readFile, access, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import process from 'node:process'
import {
  BUDGET,
  attributeRenderedBytes,
  budgetVerdict,
  collectRouteAssets,
  kb,
  vendorPackage
} from './lib/route-assets.mjs'

/** The public surface. `/projects` + `/contact` are the accepted web-005 404s (spec.md:36). */
const ROUTES = [
  '/',
  '/ar',
  '/blog',
  '/ar/blog',
  '/blog/staying-inside-performance-budget-nuxt',
  '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt'
]

const BASE = process.env.ROUTE_SIZE_BASE ?? 'http://127.0.0.1:3000'
// Overridable so the failure paths (missing build, missing/corrupt metadata) can be exercised in
// tests without disturbing the real build output. Defaults are the production locations.
const PUBLIC_DIR = process.env.ROUTE_SIZE_PUBLIC_DIR ?? '.output/public'
const META_PATH = process.env.ROUTE_SIZE_META ?? '.bundle-analysis/client-chunks.json'

const EXIT_OK = 0
const EXIT_BREACH = 1
const EXIT_INFRA = 2

// ─────────────────────────────────────────────────────────────── build inputs

async function requireBuild() {
  try {
    await access(`${PUBLIC_DIR}/_nuxt`)
  } catch {
    throw new InfraError(`no client build at ${PUBLIC_DIR}/_nuxt — run \`npm run build\` first.`)
  }
}

class InfraError extends Error {}

/**
 * Rollup chunk→module provenance. REQUIRED — app-owned enforcement is not optional, so a missing,
 * corrupt, malformed or STALE sidecar is an infrastructure failure (exit 2), not a budget verdict.
 * Reporting it as a breach would blame the code for a broken measurement; reporting it as a pass
 * would be worse.
 */
async function loadChunkMeta() {
  const raw = await readFile(META_PATH, 'utf8').catch(() => null)
  if (raw === null) {
    throw new InfraError(
      `${META_PATH} is missing — the app-owned budget cannot be measured without Rollup provenance.\n`
      + '  Rebuild with: ANALYZE_BUNDLE=1 npm run build'
    )
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new InfraError(`${META_PATH} is not valid JSON (${error.message}) — regenerate it with ANALYZE_BUNDLE=1 npm run build`)
  }
  if (!parsed || !Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
    throw new InfraError(`${META_PATH} contains no chunk records — regenerate it with ANALYZE_BUNDLE=1 npm run build`)
  }

  // Schema validation. An exact byte sum built from records of the wrong shape would be exactly as
  // wrong as an estimate, but would LOOK authoritative — so the shape is checked rather than assumed.
  const byAsset = new Map()
  for (const chunk of parsed.chunks) {
    if (!chunk || typeof chunk.fileName !== 'string' || !Array.isArray(chunk.modules)) {
      throw new InfraError(`${META_PATH} has a malformed chunk record (expected {fileName: string, modules: []}) — regenerate it with ANALYZE_BUNDLE=1 npm run build`)
    }
    for (const mod of chunk.modules) {
      if (!mod || typeof mod.id !== 'string' || !Number.isFinite(mod.renderedLength) || mod.renderedLength < 0) {
        throw new InfraError(`${META_PATH}: chunk ${chunk.fileName} has a malformed module record (expected {id: string, renderedLength: number ≥ 0}) — regenerate it with ANALYZE_BUNDLE=1 npm run build`)
      }
    }
    byAsset.set(`/${chunk.fileName}`, { modules: chunk.modules })
  }
  return byAsset
}

/**
 * Build provenance: the metadata must describe THE BUILD BEING MEASURED, not a previous one.
 *
 * The per-asset lookup in `measureRoute` already catches a referenced chunk with no record, but only
 * for assets some route happens to reference. Comparing the whole emitted JS set against the whole
 * metadata set catches the stale sidecar directly — including the case where a rebuild changed
 * chunks that no measured route loads, which is exactly when a silently-stale file would survive.
 */
async function assertMetaMatchesBuild(byAsset) {
  const emitted = (await readdir(`${PUBLIC_DIR}/_nuxt`).catch(() => {
    throw new InfraError(`cannot read ${PUBLIC_DIR}/_nuxt — run \`npm run build\` first.`)
  })).filter(name => name.endsWith('.js')).sort()

  const described = [...byAsset.keys()]
    .filter(path => path.endsWith('.js'))
    .map(path => path.replace('/_nuxt/', ''))
    .sort()

  const onlyEmitted = emitted.filter(name => !described.includes(name))
  const onlyDescribed = described.filter(name => !emitted.includes(name))
  if (onlyEmitted.length || onlyDescribed.length) {
    throw new InfraError(
      `${META_PATH} does not describe the build in ${PUBLIC_DIR} — it is STALE.\n`
      + (onlyEmitted.length ? `  built but not described (${onlyEmitted.length}): ${onlyEmitted.slice(0, 5).join(', ')}\n` : '')
      + (onlyDescribed.length ? `  described but not built (${onlyDescribed.length}): ${onlyDescribed.slice(0, 5).join(', ')}\n` : '')
      + '  Rebuild both together with: ANALYZE_BUNDLE=1 npm run build'
    )
  }
}

const gzCache = new Map()
async function assetSizes(assetPath) {
  if (gzCache.has(assetPath)) return gzCache.get(assetPath)
  const buf = await readFile(`${PUBLIC_DIR}${assetPath}`).catch(() => null)
  if (!buf) return null
  const sizes = { raw: buf.length, gz: gzipSync(buf, { level: 9 }).length }
  gzCache.set(assetPath, sizes)
  return sizes
}

// ─────────────────────────────────────────────────────────────── preview

let preview = null
function startPreview() {
  return new Promise((resolve, reject) => {
    // `detached` makes the child a process-group leader so teardown can signal the WHOLE group
    // (prism + nitro are its children). Killing only the direct child leaves those two holding the
    // ports and this script's piped stdout open — which is how an earlier version hung for 10 min.
    preview = spawn('node', ['scripts/ci-preview.mjs'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env }
    })
    let out = ''
    const timer = setTimeout(
      () => reject(new InfraError('preview did not report readiness within 120 s')),
      120_000
    )
    preview.stdout.on('data', (chunk) => {
      out += String(chunk)
      if (process.env.ROUTE_SIZE_VERBOSE === '1') process.stdout.write(chunk)
      if (out.includes('[ci-preview] listening')) { clearTimeout(timer); resolve() }
    })
    preview.stderr.on('data', (chunk) => { if (process.env.ROUTE_SIZE_VERBOSE === '1') process.stderr.write(chunk) })
    preview.on('exit', (code) => { clearTimeout(timer); reject(new InfraError(`preview exited early (code ${code})`)) })
    preview.on('error', (error) => reject(new InfraError(`preview failed to start: ${error.message}`)))
  })
}

function stopPreview() {
  if (!preview || preview.exitCode !== null) return
  try {
    process.kill(-preview.pid, 'SIGTERM') // negative pid → whole process group
  } catch {
    try { preview.kill('SIGTERM') } catch { /* already gone */ }
  }
}

// ─────────────────────────────────────────────────────────────── measurement

/**
 * @param {string} html
 * @param {Map<string, any>} meta
 */
async function measureRoute(html, meta) {
  const jsAssets = collectRouteAssets(html, 'js')
  const cssAssets = collectRouteAssets(html, 'css')

  // An HTML document that references no JS is not a passing route — it is a failed measurement
  // (error page, truncated response, or a selector that stopped matching after a Nuxt upgrade).
  if (jsAssets.length === 0) {
    throw new InfraError('rendered HTML referenced no /_nuxt JS assets — refusing to report a pass')
  }

  const js = { assets: [], raw: 0, gz: 0 }
  for (const asset of jsAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    if (!meta.has(asset)) {
      // A route referenced a chunk with no provenance record: the metadata does not describe this
      // build. Infrastructure, rather than guessing which category the chunk belongs to.
      throw new InfraError(`no Rollup provenance for ${asset} — ${META_PATH} is stale; rebuild with ANALYZE_BUNDLE=1 npm run build`)
    }
    js.assets.push({ asset, ...sizes })
    js.raw += sizes.raw
    js.gz += sizes.gz
  }

  let css = { raw: 0, gz: 0, count: cssAssets.length }
  for (const asset of cssAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    css = { ...css, raw: css.raw + sizes.raw, gz: css.gz + sizes.gz }
  }

  // Exact per-module attribution over the chunks this route actually downloads. No bounds, no
  // estimate, no proportional split — `renderedLength` is an integer Rollup reports directly.
  const attribution = attributeRenderedBytes(jsAssets, meta)

  return {
    js,
    css,
    ...attribution,
    appVerdict: budgetVerdict(attribution.totals.app, BUDGET.appRenderedBytes),
    totalVerdict: budgetVerdict(js.gz, BUDGET.totalJsBytes),
    cssVerdict: budgetVerdict(css.gz, BUDGET.cssBytes)
  }
}

// ─────────────────────────────────────────────────────────────── report

function packageRanking(meta, routeAssets, limit = 12) {
  const totals = new Map()
  for (const asset of routeAssets) {
    const info = meta.get(asset)
    if (!info) continue
    for (const mod of info.modules) {
      const pkg = vendorPackage(mod.id) ?? '(app + generated)'
      totals.set(pkg, (totals.get(pkg) ?? 0) + mod.renderedLength)
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

let breach = false

async function main() {
  await requireBuild()
  const meta = await loadChunkMeta()
  await assertMetaMatchesBuild(meta)
  await startPreview()

  console.log('\nPer-route size budgets — doc 20 §1, KB = 1024 B, from the production build')
  console.log(`Budgets: total JS ≤ ${kb(BUDGET.totalJsBytes)} gz (D20-11)  ·  app-owned rendered ≤ ${kb(BUDGET.appRenderedBytes)} (D20-12, frozen)  ·  CSS ≤ ${kb(BUDGET.cssBytes)} gz  (inclusive)`)
  console.log('App-owned bytes are Rollup renderedLength — post-tree-shaking, PRE-minification source')
  console.log('bytes. Exact per module; NOT gzip transfer bytes and not final chunk bytes.\n')

  const rows = []
  for (const route of ROUTES) {
    let res
    try {
      res = await fetch(`${BASE}${route}`, { signal: AbortSignal.timeout(20_000) })
    } catch (error) {
      throw new InfraError(`${route} could not be fetched: ${error.message}`)
    }
    if (!res.ok) throw new InfraError(`${route} returned HTTP ${res.status}; cannot measure`)
    const html = await res.text()
    rows.push({ route, ...(await measureRoute(html, meta)) })
  }

  const header = `${'route'.padEnd(44)}${'assets'.padStart(7)}${'raw'.padStart(11)}${'gz'.padStart(10)}${'≤250KB'.padStart(8)}${'app rendered'.padStart(14)}${'≤101KB'.padStart(8)}`
  console.log(header)
  console.log('─'.repeat(header.length))

  for (const row of rows) {
    if (row.totalVerdict === 'FAIL') breach = true
    if (row.cssVerdict === 'FAIL') breach = true
    if (row.appVerdict === 'FAIL') breach = true
    // An unrecognised module shape with real bytes means the classification contract no longer
    // covers what the build emits, so app ownership cannot be proven. That is a policy failure
    // (exit 1) on a perfectly valid build — NOT an infrastructure failure, and never a pass.
    if (row.unclassifiedModules.length) breach = true

    console.log(
      row.route.padEnd(44)
      + String(row.js.assets.length).padStart(7)
      + kb(row.js.raw).padStart(11)
      + kb(row.js.gz).padStart(10)
      + (row.totalVerdict === 'PASS' ? '✓' : '✗').padStart(8)
      + `${row.totals.app} B`.padStart(14)
      + (row.appVerdict === 'PASS' ? '✓' : '✗').padStart(8)
    )
  }

  console.log('\nExact rendered-byte ownership per route (Rollup renderedLength, integer bytes —')
  console.log('a chunk shared between routes is counted in full for every route that downloads it):')
  console.log(
    `  ${'route'.padEnd(44)}${'app'.padStart(12)}${'vendor'.padStart(12)}${'generated'.padStart(12)}${'unclassified'.padStart(14)}`
  )
  for (const row of rows) {
    console.log(
      `  ${row.route.padEnd(44)}${String(row.totals.app).padStart(12)}${String(row.totals.vendor).padStart(12)}`
      + `${String(row.totals.generated).padStart(12)}${String(row.totals.unclassified).padStart(14)}`
    )
  }

  console.log('\nApp-owned budget (frozen at doc 20 §1 / D20-12 — never recalculated from a build):')
  for (const row of rows) {
    console.log(
      `  ${row.appVerdict === 'PASS' ? '✓' : '✗'} ${row.route.padEnd(44)}`
      + ` ${String(row.totals.app).padStart(7)} B (${kb(row.totals.app).padStart(9)})`
      + ` / ${BUDGET.appRenderedBytes} B (${kb(BUDGET.appRenderedBytes)})`
      + `   ${row.duplicates.length ? `· ${row.duplicates.length} duplicate module id(s)` : ''}`
    )
  }

  console.log('\nCSS per route (one global stylesheet, so this is also the per-route figure):')
  for (const row of rows) {
    console.log(`  ${row.cssVerdict === 'PASS' ? '✓' : '✗'} ${row.route.padEnd(44)} ${kb(row.css.gz).padStart(9)} gz / ${kb(BUDGET.cssBytes)}  (${row.css.count} file)`)
  }

  const widest = rows[0]
  console.log(`\nLargest referenced JS assets on ${widest.route} :`)
  for (const a of [...widest.js.assets].sort((x, y) => y.gz - x.gz).slice(0, 6)) {
    const { totals } = attributeRenderedBytes([a.asset], meta)
    const parts = Object.entries(totals).filter(([, b]) => b > 0).map(([c, b]) => `${c} ${b} B`)
    console.log(`  ${kb(a.gz).padStart(9)} gz  ${kb(a.raw).padStart(10)} raw  ${a.asset}  [${parts.join(', ') || 'empty'}]`)
  }

  console.log(`\nLargest app-owned modules on ${widest.route} :`)
  for (const mod of widest.appModules.slice(0, 8)) {
    console.log(`  ${String(mod.bytes).padStart(7)} B  ${mod.id}`)
  }

  const ranking = packageRanking(meta, widest.js.assets.map(a => a.asset))
  if (ranking.length) {
    console.log(`\nTop contributors on ${widest.route} (Rollup renderedLength — PRE-minification, so`)
    console.log('relative weight, not final bytes):')
    for (const [pkg, bytes] of ranking) console.log(`  ${kb(bytes).padStart(10)}  ${pkg}`)
  }

  if (breach) {
    console.error('\n✗ doc 20 §1 budget not satisfied.')
    for (const row of rows) {
      if (row.totalVerdict === 'FAIL') {
        console.error(`  ${row.route}: total JS ${kb(row.js.gz)} gz exceeds ${kb(BUDGET.totalJsBytes)} by ${kb(row.js.gz - BUDGET.totalJsBytes)}`)
      }
      if (row.cssVerdict === 'FAIL') {
        console.error(`  ${row.route}: CSS ${kb(row.css.gz)} gz exceeds ${kb(BUDGET.cssBytes)}`)
      }
      if (row.appVerdict === 'FAIL') {
        const over = row.totals.app - BUDGET.appRenderedBytes
        console.error(
          `  ${row.route}: app-owned rendered bytes ${row.totals.app} B exceeds the frozen ${BUDGET.appRenderedBytes} B limit by ${over} B (${kb(over)}).`
          + '\n      The limit is FROZEN at doc 20 §1 / D20-12 and is never refitted to a build. Either reduce'
          + '\n      project-owned payload on this route, or take a new owner decision in doc 20. The largest'
          + '\n      app-owned modules are listed above — start there.'
        )
      }
      if (row.unclassifiedModules.length) {
        console.error(
          `  ${row.route}: ${row.unclassifiedModules.length} module(s) totalling ${row.totals.unclassified} B do not match any`
          + '\n      rule in the doc 20 §5 classification contract, so app ownership cannot be proven for this route.'
          + '\n      This is a VALID build whose module shapes the contract no longer covers — extend the contract'
          + '\n      in doc 20 §5 and `classifyModuleId`, deliberately, rather than defaulting them to app:'
        )
        for (const mod of row.unclassifiedModules.slice(0, 10)) {
          console.error(`        ${String(mod.bytes).padStart(7)} B  ${mod.id}`)
        }
      }
    }
    console.error(
      '\n  These budgets are normative. They are re-baselined ONLY by a decision-log entry in\n'
      + '  eslammuatamed-docs/docs/20-performance.md — never by editing this file.'
    )
    return EXIT_BREACH
  }

  console.log('\n✓ All public routes within the doc 20 §1 transfer budgets.')
  return EXIT_OK
}

/** Defaults to the infrastructure code only if an unexpected throw escapes below. */
let code
try {
  code = await main()
} catch (error) {
  if (error instanceof InfraError) {
    console.error(`\n✗ MEASUREMENT FAILURE (not a budget verdict): ${error.message}`)
    code = EXIT_INFRA
  } else {
    console.error(`\n✗ MEASUREMENT FAILURE (not a budget verdict): ${error?.stack ?? error}`)
    code = EXIT_INFRA
  }
} finally {
  stopPreview()
}
// Explicit exit: the torn-down preview's pipes can still hold handles open, and this must never
// stall CI waiting for the event loop to drain.
process.exit(code)
