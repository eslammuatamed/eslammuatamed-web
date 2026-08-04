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
import { DASHBOARD_ROUTES, resolveDashboardClosure } from './lib/dashboard-closure.mjs'
import {
  BUDGET,
  DASHBOARD_ACCEPTED_BASELINE_BYTES,
  DASHBOARD_BUDGET,
  dashboardTotalVerdict,
  attributeRenderedBytes,
  budgetVerdict,
  collectRouteAssets,
  kb,
  vendorPackage
} from './lib/route-assets.mjs'

/**
 * The public surface. The Projects routes shipped with the Projects slice and are measured here.
 * Detail slugs are the Prism contract examples — the preview serves the committed contract, so the
 * gate never depends on staging data.
 *
 * With `/contact` added by the Contact slice (D20-22), doc 20 §5's four-page matrix is COMPLETE:
 * no mandatory public route is left unmeasured, and the deferral this comment carried since D20-8
 * is closed.
 */
const ROUTES = [
  '/',
  '/ar',
  '/blog',
  '/ar/blog',
  '/blog/staying-inside-performance-budget-nuxt',
  '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt',
  '/projects',
  '/ar/projects',
  '/projects/content-platform-api',
  '/ar/projects/content-platform-api',
  '/experience',
  '/ar/experience',
  // web-005 Profile, About slice (009) — D20-19. Measured here for the same reason as every other
  // public route: a route that is never measured is a budget that silently does not apply to it.
  '/about',
  '/ar/about',
  // web-005 Profile, Resume slice (010) — D20-21.
  '/resume',
  '/ar/resume',
  // web-005 Contact slice (011) — D20-22, completing §5's four-page matrix. This is the one route
  // whose payload risk was known before it was built (a validation library entering a public client
  // bundle), so the per-route byte budget is the measurement that matters most here. Existing
  // thresholds, no Contact-specific relaxation.
  '/contact',
  '/ar/contact'
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
  // The dashboard closure (D20-23) needs the chunk GRAPH — imports/dynamicImports/isEntry — which
  // the per-asset attribution map deliberately drops. Carried as a non-enumerable property so the
  // existing `[...byAsset.keys()]` staleness check and every other consumer are untouched.
  Object.defineProperty(byAsset, 'rawChunks', { value: parsed.chunks, enumerable: false })
  return byAsset
}

/**
 * Measure one authenticated dashboard route by the doc 20 §1.2 client-build closure.
 *
 * The HTML path above cannot see these routes: `/dashboard/**` is `ssr: false`, so the server sends
 * a bare SPA shell and every dashboard route would report the same shared entry. Same gate, same
 * exit-code contract, different METHOD — chosen by what can actually observe the route.
 */
async function measureDashboardRoute(meta, pageModule, html) {
  const { files, seed, missing } = resolveDashboardClosure(meta.rawChunks, pageModule)
  if (missing.length > 0) {
    throw new InfraError(
      `dashboard closure for ${pageModule} could not be resolved (${missing.join('; ')}) — `
      + 'refusing to report a number the method cannot justify. '
      + 'Rebuild with: ANALYZE_BUNDLE=1 npm run build'
    )
  }

  const js = { assets: [], raw: 0, gz: 0 }
  const assetPaths = []
  for (const file of files) {
    const assetPath = `/${file}`
    const sizes = await assetSizes(assetPath)
    if (!sizes) throw new InfraError(`chunk in the dashboard closure is missing from the build: ${assetPath}`)
    if (!meta.has(assetPath)) {
      throw new InfraError(`no Rollup provenance for ${assetPath} — ${META_PATH} is stale; rebuild with ANALYZE_BUNDLE=1 npm run build`)
    }
    assetPaths.push(assetPath)
    js.assets.push({ asset: assetPath, ...sizes })
    js.raw += sizes.raw
    js.gz += sizes.gz
  }

  // CSS comes from THIS ROUTE'S rendered shell, exactly as the public gate does it.
  //
  // A `ssr: false` route still returns an app-shell document carrying its stylesheet links — the
  // part of the HTML that IS trustworthy here — even though its JS is fetched after hydration.
  // The earlier version instead summed every `.css` file in the build on the assumption that there
  // is "one global stylesheet". That assumption is not enforced anywhere: the moment the build emits
  // a second stylesheet the dashboard CSS figure silently becomes a whole-bundle total attributed to
  // one route, which is the confidently-wrong number this gate exists to refuse.
  const cssAssets = collectRouteAssets(html, 'css')
  let css = { raw: 0, gz: 0, count: cssAssets.length }
  for (const asset of cssAssets) {
    const sizes = await assetSizes(asset)
    if (!sizes) throw new InfraError(`stylesheet referenced by the route is missing from the build: ${asset}`)
    css = { ...css, raw: css.raw + sizes.raw, gz: css.gz + sizes.gz }
  }

  const attribution = attributeRenderedBytes(assetPaths, meta)
  return {
    js,
    css,
    seed,
    ...attribution,
    appVerdict: budgetVerdict(attribution.totals.app, DASHBOARD_BUDGET.appRenderedBytes),
    // Three-valued on purpose (D20-24): PASS / WARN / FAIL. WARN passes the gate but obliges the
    // attribution block below — see `reportDashboardWarning`.
    totalVerdict: dashboardTotalVerdict(js.gz),
    cssVerdict: budgetVerdict(css.gz, DASHBOARD_BUDGET.cssBytes)
  }
}

/**
 * The D20-24 warning band (route above the 300 KB gz quality target, at or below the 320 KB gz hard
 * ceiling). The route PASSES — this prints on a green run and does not touch the exit code.
 *
 * WHY THIS FUNCTION IS THE POINT OF D20-24. Raising a ceiling without adding an obligation would
 * just move the cliff. The warning is what keeps growth in the top 20 KB explained rather than
 * merely tolerated, so doc 20 §1.1 names six things that must appear and this prints all six:
 * exact route size · delta from the previous accepted baseline · framework/vendor attribution ·
 * app-owned attribution · newly introduced components or dependencies · public-isolation
 * confirmation. Dropping any of them silently downgrades a governed warning into an ordinary pass,
 * which is the exact failure mode the two-tier policy exists to prevent.
 *
 * @param {object} row              the measured dashboard route
 * @param {Map<string, object>} meta Rollup chunk metadata by asset path
 * @param {Set<string>} publicAssetPaths every asset referenced by any measured PUBLIC route
 */
function reportDashboardWarning(row, meta, publicAssetPaths) {
  const target = DASHBOARD_BUDGET.totalJsQualityTargetBytes
  const ceiling = DASHBOARD_BUDGET.totalJsCeilingBytes

  console.log(`\n${'!'.repeat(78)}`)
  console.log(`! D20-24 QUALITY-TARGET WARNING — ${row.route}`)
  console.log('!'.repeat(78))
  console.log(
    `\n  This route is ABOVE the ${kb(target)} gz quality target and AT OR BELOW the ${kb(ceiling)} gz\n`
    + '  hard ceiling. It PASSES the release gate, but doc 20 §1.1 (D20-24) forbids reporting it as\n'
    + '  an ordinary green result. The attribution below is REQUIRED in the verification report.'
  )

  // 1 — exact route size.
  console.log(`\n  1. Exact route size:  ${row.js.gz} B  (${kb(row.js.gz)} gz)   raw ${row.js.raw} B (${kb(row.js.raw)})`)
  console.log(`     Over quality target by ${row.js.gz - target} B (${kb(row.js.gz - target)}) · headroom to hard ceiling ${ceiling - row.js.gz} B (${kb(ceiling - row.js.gz)})`)

  // 2 — delta from the previous ACCEPTED baseline. Never fabricated when absent.
  const baseline = DASHBOARD_ACCEPTED_BASELINE_BYTES[row.route]
  if (typeof baseline === 'number') {
    const delta = row.js.gz - baseline
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
    console.log(
      `\n  2. Delta from previous accepted baseline:  ${sign}${Math.abs(delta)} B (${sign}${kb(Math.abs(delta))})`
      + `\n     baseline ${baseline} B (${kb(baseline)} gz)  →  now ${row.js.gz} B (${kb(row.js.gz)} gz)`
    )
  } else {
    console.log(
      '\n  2. Delta from previous accepted baseline:  NO ACCEPTED BASELINE RECORDED for this route.'
      + '\n     Reported as absent rather than estimated — an invented baseline would make a real'
      + '\n     regression look like a first measurement. Record one in DASHBOARD_ACCEPTED_BASELINE_BYTES'
      + '\n     when the owner accepts this figure.'
    )
  }

  // 3 — framework/vendor attribution.
  const assetPaths = row.js.assets.map(a => a.asset)
  const ranking = packageRanking(meta, assetPaths)
  console.log(`\n  3. Framework/vendor attribution (Rollup renderedLength — PRE-minification, relative weight):`)
  console.log(`     vendor total ${row.totals.vendor} B (${kb(row.totals.vendor)}) · generated ${row.totals.generated} B (${kb(row.totals.generated)})`)
  for (const [pkg, bytes] of ranking.slice(0, 10)) {
    console.log(`     ${kb(bytes).padStart(10)}  ${pkg}`)
  }

  // 4 — app-owned attribution.
  console.log(`\n  4. App-owned attribution:  ${row.totals.app} B (${kb(row.totals.app)}) / ${DASHBOARD_BUDGET.appRenderedBytes} B (${kb(DASHBOARD_BUDGET.appRenderedBytes)})  — ${row.appVerdict}`)
  for (const mod of row.appModules.slice(0, 10)) {
    console.log(`     ${String(mod.bytes).padStart(7)} B  ${mod.id}`)
  }

  // 5 — newly introduced components or dependencies. Derived from the build, not from a hand-kept
  // list: any vendor package in this route's closure that no measured public route pulls in is what
  // "new to this route" can be proven to mean here. A hand-maintained list would rot silently.
  const publicPackages = new Set(packageRanking(meta, [...publicAssetPaths]).map(([pkg]) => pkg))
  const dashboardOnly = ranking.filter(([pkg]) => !publicPackages.has(pkg))
  console.log('\n  5. Components/dependencies in this route that no measured public route loads:')
  if (dashboardOnly.length) {
    for (const [pkg, bytes] of dashboardOnly) console.log(`     ${kb(bytes).padStart(10)}  ${pkg}`)
  } else {
    console.log('     (none — every vendor package on this route is also loaded by a public route)')
  }

  // 6 — public-route isolation confirmation. Isolation is release-blocking (D20-23, unchanged by
  // D20-24), so the warning states it explicitly rather than leaving the reader to assume it.
  const dashboardOwnedModules = new Set()
  for (const asset of assetPaths) {
    if (publicAssetPaths.has(asset)) continue
    for (const mod of meta.get(asset)?.modules ?? []) {
      if (/(^|\/)app\/(pages|components|layouts|middleware|stores|composables)\/dashboard\//.test(mod.id.replace(/\\/g, '/'))) {
        dashboardOwnedModules.add(mod.id)
      }
    }
  }
  const leaked = []
  for (const asset of publicAssetPaths) {
    for (const mod of meta.get(asset)?.modules ?? []) {
      if (dashboardOwnedModules.has(mod.id)) leaked.push({ asset, id: mod.id })
    }
  }
  if (leaked.length === 0) {
    console.log(
      `\n  6. Public-route isolation:  INTACT — ${dashboardOwnedModules.size} dashboard-owned module(s) in this`
      + '\n     route\'s closure, and none of them appears in any measured public route\'s asset set.'
    )
  } else {
    console.log(`\n  6. Public-route isolation:  ✗ VIOLATED — ${leaked.length} dashboard-owned module(s) reached a public route:`)
    for (const { asset, id } of leaked.slice(0, 10)) console.log(`     ${asset}  ←  ${id}`)
  }
  console.log(`\n${'!'.repeat(78)}\n`)
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

  // Authenticated dashboard routes — doc 20 §1.1/§1.2 (D20-23). JS comes from the client-build
  // closure (rendered HTML cannot see a `ssr: false` route's chunks); CSS comes from that route's
  // own shell document, as for public routes.
  //
  // There is NO skip path. D20-23 names these three routes, so each one must produce a number:
  // an unresolvable closure raises an InfraError and the gate exits 2. The earlier version caught
  // "no page chunk" and skipped with a log line, which was written when `/dashboard/messages` did
  // not exist yet — but it cannot distinguish "route not built yet" from "chunking changed and the
  // page chunk can no longer be found", so it would have dropped a governed route from measurement
  // while the gate still exited 0. A route that is never measured has no effective budget.
  const dashboardRows = []
  for (const { route, pageModule } of DASHBOARD_ROUTES) {
    let res
    try {
      res = await fetch(`${BASE}${route}`, { signal: AbortSignal.timeout(20_000) })
    } catch (error) {
      throw new InfraError(`${route} could not be fetched: ${error.message}`)
    }
    if (!res.ok) throw new InfraError(`${route} returned HTTP ${res.status}; cannot measure`)
    const dashHtml = await res.text()
    dashboardRows.push({ route, ...(await measureDashboardRoute(meta, pageModule, dashHtml)) })
  }

  // Every asset any measured PUBLIC route fetches. Used only by the D20-24 warning block, to prove
  // isolation and to name what is dashboard-exclusive from the build rather than from a hand-kept
  // list that would rot without anyone noticing.
  const publicAssetPaths = new Set(rows.flatMap(r => r.js.assets.map(a => a.asset)))

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

  if (dashboardRows.length > 0) {
    console.log(`\nAuthenticated dashboard routes — doc 20 §1.1/§1.2 (D20-23; ceiling per D20-24), client-build closure`)
    console.log(
      `Budget: total JS ≤ ${kb(DASHBOARD_BUDGET.totalJsQualityTargetBytes)} gz quality target`
      + ` · ≤ ${kb(DASHBOARD_BUDGET.totalJsCeilingBytes)} gz hard ceiling`
      + `  ·  app-owned ≤ ${kb(DASHBOARD_BUDGET.appRenderedBytes)}  ·  CSS ≤ ${kb(DASHBOARD_BUDGET.cssBytes)} gz`
    )
    const dashHeader = `${'route'.padEnd(44)}${'assets'.padStart(7)}${'raw'.padStart(11)}${'gz'.padStart(10)}${'300/320'.padStart(8)}${'app rendered'.padStart(14)}${'≤101KB'.padStart(8)}`
    console.log(dashHeader)
    console.log('─'.repeat(dashHeader.length))
    for (const row of dashboardRows) {
      if (row.totalVerdict === 'FAIL') breach = true
      if (row.cssVerdict === 'FAIL') breach = true
      if (row.appVerdict === 'FAIL') breach = true
      if (row.unclassifiedModules.length) breach = true

      // '!' is deliberately NOT '✓': D20-24 forbids reporting a route above the quality target as
      // an ordinary green result, and a reader scanning this column is exactly who that protects.
      const totalMark = { PASS: '✓', WARN: '!', FAIL: '✗' }[row.totalVerdict]
      console.log(
        row.route.padEnd(44)
        + String(row.js.assets.length).padStart(7)
        + kb(row.js.raw).padStart(11)
        + kb(row.js.gz).padStart(10)
        + totalMark.padStart(8)
        + `${row.totals.app} B`.padStart(14)
        + (row.appVerdict === 'PASS' ? '✓' : '✗').padStart(8)
      )
    }

    // D20-24 warning band. This block is the whole reason the ceiling could be raised safely, so it
    // runs before any success message and prints on a PASSING run.
    for (const row of dashboardRows.filter(r => r.totalVerdict === 'WARN')) {
      reportDashboardWarning(row, meta, publicAssetPaths)
    }
    console.log('\n  CSS per dashboard route (from the route\'s own shell document, not a build-wide glob):')
    for (const row of dashboardRows) {
      console.log(
        `  ${row.cssVerdict === 'PASS' ? '✓' : '✗'} ${row.route.padEnd(24)} ${kb(row.css.gz)} gz / ${kb(DASHBOARD_BUDGET.cssBytes)}  (${row.css.count} file${row.css.count === 1 ? '' : 's'})`
      )
    }

    console.log('\n  Closure seed per route (entry · layout · page · auth) — provenance, not filenames:')
    for (const row of dashboardRows) {
      console.log(`  ${row.route.padEnd(24)} entry=${row.seed.entry}  layout=${row.seed.layout}  page=${row.seed.page}`)
      if (row.seed.auth.length) console.log(`  ${''.padEnd(24)} auth=${row.seed.auth.join(', ')}`)
    }
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
    // Dashboard rows are a separate collection with a separate budget class, so their breach detail
    // has to be printed separately too. Without this, a dashboard-only breach set `breach = true`
    // and exited 1 while every printed reason line came from the public loop above — a correct
    // exit code with no stated cause.
    for (const row of dashboardRows) {
      if (row.totalVerdict === 'FAIL') {
        const ceiling = DASHBOARD_BUDGET.totalJsCeilingBytes
        console.error(
          `  ${row.route}: total JS ${kb(row.js.gz)} gz (${row.js.gz} B) exceeds the D20-24 HARD CEILING`
          + ` ${kb(ceiling)} gz by ${kb(row.js.gz - ceiling)} (${row.js.gz - ceiling} B).`
          + '\n      This is release-blocking. The ceiling is NEVER raised automatically — a hard-ceiling'
          + '\n      failure requires owner review with bundle attribution (doc 20 §1.1, D20-24).'
        )
        // The owner review this failure demands needs attribution, so print exactly the block the
        // warning band prints rather than making someone re-run the gate to obtain it.
        reportDashboardWarning(row, meta, publicAssetPaths)
      }
      if (row.cssVerdict === 'FAIL') {
        console.error(`  ${row.route}: CSS ${kb(row.css.gz)} gz exceeds ${kb(DASHBOARD_BUDGET.cssBytes)}`)
      }
      if (row.appVerdict === 'FAIL') {
        const over = row.totals.app - DASHBOARD_BUDGET.appRenderedBytes
        console.error(
          `  ${row.route}: app-owned rendered bytes ${row.totals.app} B exceeds the frozen ${DASHBOARD_BUDGET.appRenderedBytes} B limit by ${over} B (${kb(over)}).`
          + '\n      Unchanged by D20-24 — only the total-JS ceiling moved.'
        )
      }
      if (row.unclassifiedModules.length) {
        console.error(
          `  ${row.route}: ${row.unclassifiedModules.length} module(s) totalling ${row.totals.unclassified} B do not match any`
          + '\n      rule in the doc 20 §5 classification contract, so app ownership cannot be proven.'
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

  const warned = dashboardRows.filter(r => r.totalVerdict === 'WARN')
  if (warned.length) {
    // Passing, but never as an ordinary green line: the last thing printed must not read as
    // unqualified success when a governed route is over the quality target (D20-24).
    console.log(
      `\n! Budgets satisfied, WITH ${warned.length} D20-24 quality-target warning(s): `
      + warned.map(r => `${r.route} at ${kb(r.js.gz)} gz`).join(', ')
      + `\n  Above the ${kb(DASHBOARD_BUDGET.totalJsQualityTargetBytes)} gz quality target, at or below the ${kb(DASHBOARD_BUDGET.totalJsCeilingBytes)} gz hard ceiling.`
      + '\n  The attribution block above is REQUIRED in the verification report — this is not an'
      + '\n  ordinary green result.'
    )
    return EXIT_OK
  }

  console.log('\n✓ All public routes within the doc 20 §1 transfer budgets.')
  console.log('✓ All dashboard routes at or below the doc 20 §1.1 quality target (D20-24).')
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
