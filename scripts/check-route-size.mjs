#!/usr/bin/env node
/**
 * Per-public-route transfer-size gate for BOTH doc 20 §1 JavaScript budgets:
 *
 *     JS transferred per public route  ≤ 90 KB gz total,  ≤ 35 KB app-code
 *
 * WHY THIS BOOTS A SERVER. §1 budgets "per public route", which no static glob can express: a glob
 * also sums the lazily-loaded dashboard SPA chunks that no public route fetches (measured 260.7 KB
 * gz whole-bundle vs 223.7 KB gz actually referenced by `/`). So the asset set comes from each
 * route's rendered HTML, and only from `<script src>` / `<link rel=modulepreload|stylesheet>` —
 * `rel=prefetch` hints are for OTHER routes and are excluded (see lib/route-assets.mjs).
 *
 * WHY GZIP. §1 states the budgets in `gz`. Cloudflare serves brotli, which is smaller, so gzip is
 * the conservative reading and the only unit comparable to the documented number.
 *
 * APP-CODE ATTRIBUTION — and its honest limit. "app-code" is used exactly once in doc 20 (the §1
 * table) and is never defined; "vendor" appears nowhere in the docs. The boundary used here follows
 * doc 08 §1 (`app/` is the Nuxt srcDir, project-owned source lives in the repo, packages live in
 * `node_modules`): project source = app, `node_modules` = vendor, Nuxt/Vite generated glue =
 * virtual, reported separately rather than folded into whichever side suits the outcome.
 *
 * Module→chunk provenance comes from Rollup (`ANALYZE_BUNDLE=1`, config/bundle-analysis.ts), never
 * from filenames. But a chunk containing BOTH app and vendor modules cannot have its gzip split
 * byte-exactly — compression is shared across the whole stream. So instead of inventing a number,
 * this reports three values and only claims a PASS when it is provable:
 *
 *   lower bound  Σ gz of chunks that are 100 % app            (certainly app)
 *   estimate     lower bound + Σ gz(mixed) × app-byte-share   (proportional, LABELLED as such)
 *   upper bound  lower bound + Σ gz(mixed) in full            (if every mixed byte were app)
 *
 *   PASS          upper bound ≤ 35 KB   → compliant no matter how the mixed chunks split
 *   FAIL          lower bound > 35 KB   → non-compliant no matter how they split
 *   INDETERMINATE otherwise             → NOT a pass; exits non-zero and says why
 *
 * Run `npm run size:routes` after a production build. Without bundle metadata the total-JS budget
 * is still enforced and the app-code budget reports as unmeasurable rather than silently passing.
 *
 * BUDGETS ARE doc 20 §1 VERBATIM. Re-baselining requires an owner decision plus a decision-log
 * entry in doc 20 — never an edit here.
 *
 * Exit codes are distinguishable on purpose:
 *   0 — every enforced budget passed
 *   1 — a genuine budget breach (or an unprovable app-code result)
 *   2 — infrastructure/measurement failure (no build, preview would not start, route not served,
 *       HTML with no assets). Never conflated with a breach: one means "fix the code", the other
 *       means "the gate could not measure".
 */
import { spawn } from 'node:child_process'
import { readFile, access } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import process from 'node:process'
import {
  KB,
  appCodeVerdict,
  budgetVerdict,
  classifyModuleId,
  collectRouteAssets,
  kb,
  vendorPackage
} from './lib/route-assets.mjs'

// doc 20 §1, 1024-based KB (the convention is stated in §1 because size-limit prints decimal kB).
// Budgets are INCLUSIVE ("≤"), so exactly-at-budget passes.
const BUDGET = {
  totalJsBytes: 250 * KB, // D20-11 re-baseline (was 90 KB — below this stack's measured floor)
  appJsBytes: 35 * KB, // unchanged
  cssBytes: 30 * KB // unchanged; also enforced statically by `npm run size`
}

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
 * Rollup chunk→module provenance. REQUIRED — app-code enforcement is not optional, so a missing or
 * corrupt sidecar is an infrastructure failure (exit 2), not a budget verdict. Reporting it as a
 * breach would blame the code for a broken measurement; reporting it as a pass would be worse.
 */
async function loadChunkMeta() {
  const raw = await readFile(META_PATH, 'utf8').catch(() => null)
  if (raw === null) {
    throw new InfraError(
      `${META_PATH} is missing — the app-code budget cannot be measured without Rollup provenance.\n`
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
  const byAsset = new Map()
  for (const chunk of parsed.chunks) {
    const share = { app: 0, vendor: 0, virtual: 0 }
    for (const mod of chunk.modules) share[classifyModuleId(mod.id)] += mod.renderedLength
    const totalRendered = share.app + share.vendor + share.virtual
    byAsset.set(`/${chunk.fileName}`, {
      share,
      totalRendered,
      appRatio: totalRendered === 0 ? 0 : share.app / totalRendered,
      modules: chunk.modules
    })
  }
  return byAsset
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
 * The single category a chunk belongs to, or null when it mixes categories.
 * Purity is required for the REPORTED split: a 99.6 %-vendor chunk is still mixed, and rounding it
 * to "vendor" would hide that it carries app bytes the ≤35 KB budget governs.
 */
function dominantCategory(info) {
  const { app, vendor, virtual } = info.share
  const total = app + vendor + virtual
  if (total === 0) return 'generated' // an empty chunk carries no attributable weight
  if (app === total) return 'app'
  if (vendor === total) return 'vendor'
  if (virtual === total) return 'generated'
  return null
}

/**
 * Does this chunk carry ANY project-owned bytes?
 *
 * This — not chunk purity — is what bounds the app budget. A chunk built solely from vendor and
 * generated modules contains no app code, so no amount of shared compression can put app bytes in
 * it and it contributes exactly 0 to the upper bound. Treating such a chunk as "mixed" (because it
 * spans two NON-app categories) would inflate the bound for no reason and could turn a provable
 * PASS into a spurious INDETERMINATE.
 */
function carriesAppBytes(info) {
  return info.share.app > 0
}

/**
 * @param {string} html
 * @param {Map<string, any>|null} meta
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
  // Bytes are only attributed to a category when a chunk is PURE. Mixed chunks are held in their
  // own bucket rather than divided, because gzip cannot be split per-module inside one stream.
  const pure = { app: { raw: 0, gz: 0 }, vendor: { raw: 0, gz: 0 }, generated: { raw: 0, gz: 0 } }
  const mixed = { raw: 0, gz: 0, appEstimateGz: 0 }

  for (const asset of jsAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    js.assets.push({ asset, ...sizes })
    js.raw += sizes.raw
    js.gz += sizes.gz

    const info = meta.get(asset)
    if (!info) {
      // A route referenced a chunk with no provenance record: the metadata does not describe this
      // build. Treat as infrastructure rather than guessing which category it belongs to.
      throw new InfraError(`no Rollup provenance for ${asset} — ${META_PATH} is stale; rebuild with ANALYZE_BUNDLE=1 npm run build`)
    }
    const category = dominantCategory(info)
    if (category) {
      pure[category].raw += sizes.raw
      pure[category].gz += sizes.gz
    } else {
      mixed.raw += sizes.raw
      mixed.gz += sizes.gz
      mixed.appEstimateGz += sizes.gz * info.appRatio
    }
  }

  let css = { raw: 0, gz: 0, count: cssAssets.length }
  for (const asset of cssAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    css = { ...css, raw: css.raw + sizes.raw, gz: css.gz + sizes.gz }
  }

  const bounds = { lower: 0, estimate: 0, upper: 0 }
  for (const { asset, gz } of js.assets) {
    const info = meta.get(asset)
    if (info.appRatio >= 0.9999) bounds.lower += gz // certainly all app
    if (carriesAppBytes(info)) bounds.upper += gz // could contain app bytes; nothing else can
    bounds.estimate += gz * info.appRatio
  }

  return {
    js,
    css,
    pure,
    mixed,
    app: { ...bounds, verdict: appCodeVerdict(bounds, BUDGET.appJsBytes) },
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
  await startPreview()

  console.log('\nPer-route transfer budgets — doc 20 §1 (D20-11), gzip, KB = 1024 B, from the production build')
  console.log(`Budgets: total ≤ ${kb(BUDGET.totalJsBytes)}  ·  app-code ≤ ${kb(BUDGET.appJsBytes)}  ·  CSS ≤ ${kb(BUDGET.cssBytes)}  (inclusive)\n`)

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

  const header = `${'route'.padEnd(44)}${'assets'.padStart(7)}${'raw'.padStart(11)}${'gz'.padStart(10)}${'≤250KB'.padStart(9)}${'app gz'.padStart(10)}${'≤35KB'.padStart(16)}`
  console.log(header)
  console.log('─'.repeat(header.length))

  for (const row of rows) {
    if (row.totalVerdict === 'FAIL') breach = true
    if (row.cssVerdict === 'FAIL') breach = true
    // INDETERMINATE is a deliberate policy failure: compliance could not be proven, so the gate
    // must not report a pass.
    if (row.app.verdict !== 'PASS') breach = true

    console.log(
      row.route.padEnd(44)
      + String(row.js.assets.length).padStart(7)
      + kb(row.js.raw).padStart(11)
      + kb(row.js.gz).padStart(10)
      + (row.totalVerdict === 'PASS' ? '✓' : '✗').padStart(9)
      + kb(row.app.estimate).padStart(10)
      + `  ${row.app.verdict}`.padEnd(16)
    )
  }

  console.log('\nProvable category split (only PURE chunks are attributed; mixed chunks cannot have')
  console.log('their gzip divided per module, so they are held separately rather than guessed):')
  console.log(
    `  ${'route'.padEnd(44)}${'app'.padStart(20)}${'vendor'.padStart(20)}${'generated'.padStart(20)}${'mixed'.padStart(20)}`
  )
  for (const row of rows) {
    const cell = (c) => `${kb(c.raw)}/${kb(c.gz)}`.padStart(20)
    console.log(
      `  ${row.route.padEnd(44)}${cell(row.pure.app)}${cell(row.pure.vendor)}${cell(row.pure.generated)}${cell(row.mixed)}`
    )
  }
  console.log('  (raw/gz per cell)')

  console.log('\nCSS per route (one global stylesheet, so this is also the per-route figure):')
  for (const row of rows) {
    console.log(`  ${row.cssVerdict === 'PASS' ? '✓' : '✗'} ${row.route.padEnd(44)} ${kb(row.css.gz).padStart(9)} gz / ${kb(BUDGET.cssBytes)}  (${row.css.count} file)`)
  }

  console.log('\nApp-code attribution bounds:')
  for (const row of rows) {
    console.log(
      `  ${row.route.padEnd(44)} lower ${kb(row.app.lower).padStart(9)}`
      + `  estimate ${kb(row.app.estimate).padStart(9)}`
      + `  upper ${kb(row.app.upper).padStart(9)}   → ${row.app.verdict}`
    )
  }

  const widest = rows[0]
  console.log(`\nLargest referenced JS assets on ${widest.route} :`)
  for (const a of [...widest.js.assets].sort((x, y) => y.gz - x.gz).slice(0, 6)) {
    const info = meta.get(a.asset)
    const cat = dominantCategory(info) ?? `MIXED (app≈${(info.appRatio * 100).toFixed(1)}%)`
    console.log(`  ${kb(a.gz).padStart(9)} gz  ${kb(a.raw).padStart(10)} raw  ${a.asset}  ${cat}`)
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
      if (row.app.verdict === 'FAIL') {
        console.error(`  ${row.route}: app-code at least ${kb(row.app.lower)} gz exceeds ${kb(BUDGET.appJsBytes)} — a real breach however the mixed bytes divide.`)
      }
      if (row.app.verdict === 'INDETERMINATE') {
        console.error(
          `  ${row.route}: app-code ${kb(row.app.lower)}–${kb(row.app.upper)} gz straddles the ${kb(BUDGET.appJsBytes)} budget.`
          + '\n      Compliance is NOT PROVABLE while app and vendor modules share a chunk, so this is not reported'
          + '\n      as a pass. The estimate suggests it is comfortably met; proving it needs a deterministic'
          + '\n      app/vendor chunk split (doc 20 §5, D20-11).'
        )
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
