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
import { classifyModuleId, collectRouteAssets, kb, vendorPackage } from './lib/route-assets.mjs'

const BUDGET = {
  totalJsBytes: 90 * 1024, // doc 20 §1
  appJsBytes: 35 * 1024, // doc 20 §1
  cssBytes: 30 * 1024 // doc 20 §1
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
const PUBLIC_DIR = '.output/public'
const META_PATH = '.bundle-analysis/client-chunks.json'

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

/** Rollup chunk→module provenance, or null when the analysis build has not been run. */
async function loadChunkMeta() {
  const raw = await readFile(META_PATH, 'utf8').catch(() => null)
  if (!raw) return null
  /** @type {{chunks: Array<{fileName: string, modules: Array<{id: string, renderedLength: number}>}>}} */
  const parsed = JSON.parse(raw)
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
  const app = { pureGz: 0, mixedGz: 0, estimateGz: 0, unknownGz: 0 }

  for (const asset of jsAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    js.assets.push({ asset, ...sizes })
    js.raw += sizes.raw
    js.gz += sizes.gz

    const info = meta?.get(asset)
    if (!info) { app.unknownGz += sizes.gz; continue }
    if (info.appRatio >= 0.9999) app.pureGz += sizes.gz
    else if (info.appRatio <= 0.0001) { /* pure vendor/virtual — contributes nothing to app */ }
    else {
      app.mixedGz += sizes.gz
      app.estimateGz += sizes.gz * info.appRatio
    }
  }

  let css = { raw: 0, gz: 0, count: cssAssets.length }
  for (const asset of cssAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`asset referenced by the route is missing from the build: ${asset}`)
    css = { ...css, raw: css.raw + sizes.raw, gz: css.gz + sizes.gz }
  }

  const appLower = app.pureGz
  const appEstimate = app.pureGz + app.estimateGz
  const appUpper = app.pureGz + app.mixedGz + app.unknownGz

  let appVerdict
  if (!meta) appVerdict = 'UNMEASURABLE'
  else if (appUpper <= BUDGET.appJsBytes) appVerdict = 'PASS'
  else if (appLower > BUDGET.appJsBytes) appVerdict = 'FAIL'
  else appVerdict = 'INDETERMINATE'

  return { js, css, app: { lower: appLower, estimate: appEstimate, upper: appUpper, verdict: appVerdict } }
}

// ─────────────────────────────────────────────────────────────── report

function packageRanking(meta, routeAssets, limit = 12) {
  if (!meta) return []
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

  console.log('\nPer-route transfer budgets — doc 20 §1, gzip, from the production build')
  if (!meta) {
    console.log(
      `  ! ${META_PATH} absent: the total-JS and CSS budgets are enforced, but the app-code budget\n`
      + '    cannot be measured. Regenerate with: ANALYZE_BUNDLE=1 npm run build'
    )
  }
  console.log()

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

  const header = `${'route'.padEnd(46)}${'assets'.padStart(7)}${'raw'.padStart(11)}${'gz'.padStart(11)}${'≤90KB'.padStart(8)}${'app gz (est)'.padStart(14)}${'≤35KB'.padStart(15)}`
  console.log(header)
  console.log('─'.repeat(header.length))

  for (const row of rows) {
    const totalOk = row.js.gz <= BUDGET.totalJsBytes
    if (!totalOk) breach = true
    if (row.app.verdict === 'FAIL' || row.app.verdict === 'INDETERMINATE' || row.app.verdict === 'UNMEASURABLE') breach = true

    console.log(
      row.route.padEnd(46)
      + String(row.js.assets.length).padStart(7)
      + kb(row.js.raw).padStart(11)
      + kb(row.js.gz).padStart(11)
      + (totalOk ? '✓' : '✗').padStart(8)
      + kb(row.app.estimate).padStart(14)
      + `  ${row.app.verdict}`.padEnd(15)
    )
  }

  console.log('\nCSS per route (one global stylesheet, so this is also the per-route figure):')
  for (const row of rows) {
    const ok = row.css.gz <= BUDGET.cssBytes
    if (!ok) breach = true
    console.log(`  ${ok ? '✓' : '✗'} ${row.route.padEnd(46)} ${kb(row.css.gz).padStart(9)} gz / ${kb(BUDGET.cssBytes)}  (${row.css.count} file)`)
  }

  console.log('\nApp-code attribution bounds (gzip cannot be split byte-exactly inside a mixed chunk):')
  for (const row of rows) {
    console.log(
      `  ${row.route.padEnd(46)} lower ${kb(row.app.lower).padStart(9)}`
      + `  estimate ${kb(row.app.estimate).padStart(9)}`
      + `  upper ${kb(row.app.upper).padStart(9)}   → ${row.app.verdict}`
    )
  }

  const widest = rows[0]
  console.log(`\nLargest referenced JS assets on ${widest.route} :`)
  for (const a of [...widest.js.assets].sort((x, y) => y.gz - x.gz).slice(0, 6)) {
    const info = meta?.get(a.asset)
    const mix = info ? ` app≈${(info.appRatio * 100).toFixed(1)}%` : ''
    console.log(`  ${kb(a.gz).padStart(9)} gz  ${kb(a.raw).padStart(10)} raw  ${a.asset}${mix}`)
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
      if (row.js.gz > BUDGET.totalJsBytes) {
        console.error(`  ${row.route}: total JS ${kb(row.js.gz)} gz exceeds ${kb(BUDGET.totalJsBytes)} by ${kb(row.js.gz - BUDGET.totalJsBytes)}`)
      }
      if (row.app.verdict === 'INDETERMINATE') {
        console.error(
          `  ${row.route}: app-code ${kb(row.app.lower)}–${kb(row.app.upper)} gz straddles the ${kb(BUDGET.appJsBytes)} budget`
          + ' — compliance is not provable while app and vendor modules share a chunk, so this is NOT reported as a pass.'
        )
      }
      if (row.app.verdict === 'UNMEASURABLE') {
        console.error(`  ${row.route}: app-code budget unmeasurable without ${META_PATH}.`)
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
