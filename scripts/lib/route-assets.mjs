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
 * Split module ids into app-owned vs vendor.
 *
 * Boundary (doc 08 §1: `app/` is the Nuxt srcDir; project-owned source lives in the repo, packages
 * live in `node_modules`):
 *   - vendor  → anything resolved from `node_modules`, plus Vite/Rollup internal helper modules
 *   - app     → project-owned source in the repo (`app/`, `config/`, `i18n/`, `shared/`, …)
 *   - virtual → Nuxt/Vite generated glue (`virtual:`, `\0`, `#build/...`). Reported SEPARATELY
 *               rather than folded into either side, because calling generated glue "app code"
 *               or "vendor" to suit the outcome is exactly the classification-by-convenience the
 *               budget interpretation must avoid.
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

/** `1536` → `"1.5 KB"`. Fixed one decimal so columns line up in CI logs. */
export function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}
