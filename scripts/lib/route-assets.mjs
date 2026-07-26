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
 * Split module ids into app / vendor / generated (doc 20 §5 classification contract, D20-11).
 *
 * Resolved from build provenance, never filenames. The three categories, with the cases the
 * production client build actually emits:
 *   - vendor    → `node_modules/**` — external dependency code.
 *   - app       → project-owned source in the repo. That means srcDir (`app/**`), INCLUDING Vue SFC
 *                 compiled output (`?vue&type=script…`) and `definePageMeta` route-metadata
 *                 extraction (`?macro=true`), plus project-authored content that Nuxt convention
 *                 places outside srcDir — notably `i18n/locales/*.json`, which is translation
 *                 content this repo authors, not a dependency. Excluding it would let translation
 *                 growth escape the only budget governing project-owned payload.
 *   - generated → Nuxt/Vite/Rollup glue authored by neither side (`\0…`, `virtual:*`, `#build/*`,
 *                 `.nuxt/*`), e.g. `vite/preload-helper`. Reported as its OWN category and never
 *                 folded into app or vendor, because classifying generated glue to suit the
 *                 outcome is precisely the convenience the budget interpretation must avoid.
 * `config/**` is build-time only (nuxt.config inputs) and is verified absent from every client
 * chunk, so it needs no rule here.
 * @param {string} id
 * @returns {'vendor'|'app'|'virtual'}
 */
export function classifyModuleId(id) {
  const normalised = id.replace(/\\/g, '/')
  if (normalised.includes('node_modules')) return 'vendor'
  if (
    normalised.startsWith('\0')
    || normalised.startsWith('virtual:')
    || normalised.includes('/virtual:')
    || normalised.startsWith('#build')
    || normalised.includes('/.nuxt/')
    || normalised.startsWith('.nuxt/')
  ) return 'virtual'
  return 'app'
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
 * App-code verdict from attribution BOUNDS, never from a single fabricated number.
 *
 * gzip cannot be split byte-exactly inside a chunk that mixes app and vendor modules — compression
 * is shared across the stream — so compliance is only asserted when it holds for every possible
 * split:
 *   PASS          upper ≤ budget  → compliant however the mixed bytes divide
 *   FAIL          lower > budget  → non-compliant however they divide
 *   INDETERMINATE otherwise       → NOT a pass; the gate fails rather than guess
 *
 * @param {{lower: number, upper: number}} bounds
 * @returns {'PASS'|'FAIL'|'INDETERMINATE'}
 */
export function appCodeVerdict({ lower, upper }, budgetBytes) {
  if (upper <= budgetBytes) return 'PASS'
  if (lower > budgetBytes) return 'FAIL'
  return 'INDETERMINATE'
}
