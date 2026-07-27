/**
 * Pure helpers for the per-public-route transfer-size gate (doc 20 §1).
 *
 * Split out of `check-route-size.mjs` so the measurement logic is unit-testable: a size gate that
 * silently measures the wrong set is worse than no gate, and the failure modes here (counting a
 * prefetch hint as a first-view transfer, matching the `.js` inside `.js.map`, double-counting a URL
 * that appears in both a preload and a script tag) are all invisible in the final number.
 */

/**
 * Attribute-aware asset extraction.
 *
 * Deliberately NOT a blind `/_nuxt/[^"]+\.js/g` sweep of the HTML. That would also pick up
 * `<link rel="prefetch">` hints, which the browser fetches at idle for OTHER routes and are
 * therefore not part of this route's first-view transfer, plus any asset path that happens to
 * appear inside the SSR payload JSON. Only two things are fetched eagerly for the current
 * document, so only those two count:
 *   - `<script src="…">`               (executed)
 *   - `<link rel="modulepreload" href>` (fetched immediately, at high priority)
 *
 * @param {string} html rendered document
 * @param {'js'|'css'} kind extension to collect
 * @returns {string[]} unique, sorted, root-relative `/_nuxt/...` paths
 */
export function collectRouteAssets(html, kind) {
  const wanted = kind === 'js' ? 'js' : 'css'
  const found = new Set()

  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const isScript = /^<script/i.test(tag)
    const rel = attr(tag, 'rel')?.toLowerCase()

    // `stylesheet` is the CSS equivalent of an eager fetch; `modulepreload` the JS one.
    // `prefetch`/`preload`-as-fetch for other routes, `prerender`, `dns-prefetch` etc. are excluded.
    const eager = isScript
      ? Boolean(attr(tag, 'src'))
      : rel === 'modulepreload' || rel === 'stylesheet'
    if (!eager) continue

    const url = isScript ? attr(tag, 'src') : attr(tag, 'href')
    if (!url) continue

    const asset = localNuxtAsset(url, wanted)
    if (asset) found.add(asset)
  }

  // Sorted so the report is byte-stable across runs of the same build.
  return [...found].sort()
}

/** Reads one HTML attribute out of a single tag string. */
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))
  if (!m) return null
  return m[2] ?? m[3] ?? m[4] ?? null
}

/**
 * Accepts only local build output of the requested type.
 *
 * The extension test is anchored to the END of the path so `foo.js.map` cannot match `js` — an
 * unanchored `\.js` would match its prefix and quietly fold source maps into the budget. Absolute
 * URLs (a CDN, or Cloudflare's `/cdn-cgi/...` injection) are rejected because the budget measures
 * the application's own build output.
 */
function localNuxtAsset(url, kind) {
  if (!url.startsWith('/_nuxt/')) return null
  const path = url.split(/[?#]/)[0]
  return path.endsWith(`.${kind}`) ? path : null
}

/**
 * Normalise a Rollup module id to a comparable form before classifying it.
 *
 * Rollup ids arrive in more shapes than they look: Windows separators, `file://` URLs, percent
 * encoding, and a `?query` suffix on every Vue SFC sub-module. Normalising first means one ordered
 * rule set can decide all of them, instead of each rule re-implementing its own tolerance.
 *
 * The query is kept on `id` and stripped only from `path`, because the two answer different
 * questions: extension tests want the path, while the generated/vendor markers can legitimately
 * appear inside a query.
 * @param {string} rawId
 */
export function normaliseModuleId(rawId) {
  let id = String(rawId).replace(/\\/g, '/')
  if (id.startsWith('file://')) id = id.slice('file://'.length)
  try {
    id = decodeURIComponent(id)
  } catch {
    // A lone `%` is not an encoding error worth failing a build over — classify the raw form.
  }
  return { id, path: id.split('?')[0] }
}

/**
 * Classify a module id as app / vendor / generated / unclassified (doc 20 §5, D20-12).
 *
 * ORDERED AND ALLOWLIST-BASED. The previous version ended in `return 'app'`, so any unrecognised id
 * silently became app-owned. Under a bounds-based verdict that was harmless; under an EXACT budget it
 * would let an unknown module shape quietly inflate — or, worse, be silently absorbed into — the
 * number the gate exists to police. Nothing becomes `app` by falling through any more.
 *
 *   1. vendor       `node_modules/**` (including nested) — external dependency code.
 *   2. generated    `\0…` anywhere, `virtual:*`, `#build/*`, `.nuxt/*` — Nuxt/Vite/Rollup glue
 *                   authored by neither side. Tested BEFORE the srcDir rule because these ids
 *                   routinely EMBED a srcDir path (`\0virtual:nuxt:/repo/app/…`); matching `app/`
 *                   first would misattribute framework glue to the project.
 *   3. generated    `.css`/`.scss`/… by extension, or a Vue `?…type=style…` sub-module (where the
 *                   style extension lives in the QUERY, e.g. `Foo.vue?vue&type=style&lang.css`, so a
 *                   path-only extension test would miss it and hand it to the app budget). Vite
 *                   extracts these to a real CSS asset governed by the separate CSS budget; what
 *                   remains in the JS graph is a zero-byte stub.
 *   4. app          srcDir `app/**` — including Vue SFC compiled output (`?vue&type=script…`) and
 *                   `definePageMeta` extraction (`?macro=true`), which are compiled FROM project
 *                   source. Query variants are DISTINCT modules with distinct bytes and are counted
 *                   separately; collapsing them would undercount.
 *   5. app          `i18n/locales/**` — project-authored translation content, not a dependency.
 *                   `i18n/` sits outside srcDir because it is the Nuxt i18n restructure dir
 *                   (doc 08 §1), so the boundary reads as "project-owned source in the repo".
 *   6. unclassified everything else, including `config/**` (build-time only, verified absent from
 *                   every client chunk). Reported as its own category; non-zero unclassified bytes
 *                   in a referenced chunk FAIL the gate rather than being absorbed into a number
 *                   they may not belong in.
 * @param {string} rawId
 * @returns {'vendor'|'app'|'generated'|'unclassified'}
 */
export function classifyModuleId(rawId) {
  const { id, path } = normaliseModuleId(rawId)

  if (id.includes('node_modules/')) return 'vendor'
  if (
    id.includes('\0')
    || id.includes('virtual:')
    || id.startsWith('#build/')
    || id.includes('/.nuxt/')
    || id.startsWith('.nuxt/')
  ) return 'generated'
  if (/\.(css|scss|sass|less|styl)$/i.test(path) || /[?&]type=style(&|$)/.test(id)) return 'generated'
  if (path === 'app' || path.startsWith('app/')) return 'app'
  if (path.startsWith('i18n/locales/')) return 'app'
  return 'unclassified'
}

/**
 * Exact app-owned attribution for one route's initially-referenced JS assets (doc 20 §5, D20-12).
 *
 * Sums Rollup `renderedLength` over app-classified modules in the chunks the route actually
 * downloads. Every app module in a downloaded chunk counts even when the chunk is SHARED with
 * another route — the route pays for the whole chunk either way — but a module id is counted once
 * per route, because appearing in two of the route's chunks does not mean it was downloaded twice
 * in a form the budget should double-charge.
 *
 * Unlike the gzip form this replaces, nothing here is apportioned, estimated, or divided: each
 * module contributes an exact integer that Rollup reports directly.
 *
 * @param {string[]} assetPaths route-relative `/_nuxt/*.js` paths
 * @param {Map<string, {modules: {id: string, renderedLength: number}[]}>} metaByAsset
 */
export function attributeRenderedBytes(assetPaths, metaByAsset) {
  const totals = { app: 0, vendor: 0, generated: 0, unclassified: 0 }
  const appModules = []
  const unclassifiedModules = []
  const duplicates = []
  const seen = new Map()

  for (const asset of assetPaths) {
    const chunk = metaByAsset.get(asset)
    if (!chunk) throw new Error(`no Rollup provenance for ${asset}`)
    for (const mod of chunk.modules) {
      if (seen.has(mod.id)) {
        // Recorded rather than silently collapsed: a module landing in two of one route's chunks is
        // duplicated payload worth surfacing, even though it is charged once.
        duplicates.push({ id: mod.id, assets: [seen.get(mod.id), asset] })
        continue
      }
      seen.set(mod.id, asset)
      const category = classifyModuleId(mod.id)
      const bytes = mod.renderedLength
      totals[category] += bytes
      if (category === 'app') appModules.push({ id: mod.id, bytes })
      if (category === 'unclassified' && bytes > 0) unclassifiedModules.push({ id: mod.id, bytes })
    }
  }

  appModules.sort((a, b) => b.bytes - a.bytes)
  return { totals, appModules, unclassifiedModules, duplicates }
}

/**
 * Owning package for a vendor module id, e.g. `.../node_modules/@nuxt/ui/dist/x.js` → `@nuxt/ui`.
 * Returns null for non-vendor ids. Handles scoped packages and nested `node_modules`.
 */
export function vendorPackage(id) {
  const normalised = id.replace(/\\/g, '/')
  const idx = normalised.lastIndexOf('node_modules/')
  if (idx === -1) return null
  const rest = normalised.slice(idx + 'node_modules/'.length)
  const parts = rest.split('/')
  if (!parts[0]) return null
  return parts[0].startsWith('@') && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0]
}

/**
 * One KB is 1024 bytes throughout this gate — doc 20 §1 states the convention explicitly, because
 * `size-limit` prints decimal `kB` while this gate prints 1024-based `KB` and the same file
 * otherwise reads as two different numbers. Thresholds in both tools have always been 1024-based
 * (`bytes.parse('30 KB') === 30720`); only the printed figures differed.
 */
export const KB = 1024

/** `1536` → `"1.5 KB"`. Fixed one decimal so columns line up in CI logs. */
export function kb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`
}

/**
 * Budgets are INCLUSIVE — doc 20 §1 writes "≤", so exactly-at-budget passes.
 * @returns {'PASS'|'FAIL'}
 */
export function budgetVerdict(actualBytes, budgetBytes) {
  return actualBytes <= budgetBytes ? 'PASS' : 'FAIL'
}

/**
 * doc 20 §1 budgets, 1024-based, INCLUSIVE ("≤", so exactly-at-budget passes).
 *
 * These are doc 20 §1 VERBATIM. Re-baselining any of them requires an owner decision plus a
 * decision-log entry in `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 */
export const BUDGET = {
  /** D20-11 re-baseline (was 90 KB — below this stack's measured bilingual floor). */
  totalJsBytes: 250 * KB,
  /**
   * D20-12. App-owned Rollup `renderedLength`, FROZEN — derived once from the Web `138cef5`
   * baseline and never recomputed from a build:
   *
   *   per-route baselines  89,201 / 89,201 / 50,960 / 50,960 / 39,074 / 39,074 B
   *   baselineMaxBytes     89,201 B  (`/` and `/ar`)
   *   ceil((89201 × 1.15) / 1024) × 1024  =  ceil(102581.15 / 1024) × 1024
   *                                       =  101 × 1024  =  103,424 B  =  101 KiB
   *
   * Integer arithmetic (× 115 / 100) on purpose: `89201 * 1.15` carries float residue that would
   * round an exact-KiB result up by a whole KiB.
   *
   * A future baseline above this FAILS the gate and needs a new owner decision. CI must never
   * recalculate or raise it — a budget refitted to each build measures nothing.
   */
  appRenderedBytes: 101 * KB,
  /** Unchanged; also enforced statically by `npm run size`. */
  cssBytes: 30 * KB
}

/**
 * The frozen limit, re-derived from its inputs so the constant above cannot drift from the
 * documented formula unnoticed. Exported for the test that pins it.
 * @param {number} baselineMaxBytes
 */
export function approvedAppLimitBytes(baselineMaxBytes) {
  return Math.ceil((baselineMaxBytes * 115) / (100 * KB)) * KB
}

/** The baseline the frozen limit was derived from (Web commit `138cef5`). */
export const APP_BASELINE_MAX_BYTES = 89_201
