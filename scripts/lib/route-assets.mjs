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
 * MEASURED offset between a shared-floor reading taken locally and the same reading taken on the
 * GitHub-hosted runner, for identical sources.
 *
 * ⚠ WHY THIS EXISTS. The floor report compares a live reading against a FROZEN calibration constant
 * and then labels the difference. Before this constant existed it labelled the WHOLE difference
 * "shared framework/ecosystem growth" — so hosted CI printed `+6 B ← shared framework/ecosystem
 * growth` on every run forever, describing RUNNER VARIANCE as framework growth (ledger §33.4). That
 * is a false drift signal of exactly the kind this repo keeps being bitten by
 * (`reference-web-build-output-nondeterministic`).
 *
 * DERIVED FROM MEASUREMENT, campaign 026 Phase 6, at candidate `fd56aaa`:
 *   - build nondeterminism contributes ZERO. Two builds of identical sources on one machine produced
 *     DIFFERENT `.output` hashes (bbaf9df9… vs 4f9ae9a9…) yet byte-identical floors — public 254,593
 *     and dashboard 259,911 both times. So floor movement is not build-to-build noise.
 *   - the local↔hosted offset is +6 B on BOTH floors independently: public 254,593 local vs 254,599
 *     hosted, dashboard 259,911 local vs 259,917 hosted (hosted run 32039342735, ledger §33.3).
 *     Two independent floors agreeing on the same offset is what makes it an environment property
 *     rather than a coincidence.
 *
 * ⚠ THIS IS A REPORTING TOLERANCE, NOT A BUDGET. It never enters a cap, never changes a verdict, and
 * never suppresses a number — the measured floor and the signed delta are always printed in full. It
 * governs only whether the line is allowed to assert a CAUSE. It is deliberately tight: the public
 * floor's real +39 B of growth since its calibration SHA sits far outside it and still reports as
 * growth, which is the discriminating property the spec pins.
 */
export const FLOOR_ENVIRONMENT_VARIANCE_BYTES = 6

/**
 * Classify a floor delta into a cause the report is entitled to claim.
 *
 * The delta a run prints is the SUM of two unrelated quantities: real movement since the calibration
 * SHA, and the environment offset between the calibration machine and the measuring machine. Only
 * the first is growth. Attributing the sum to growth is the §33.4 defect.
 *
 * @returns {{kind: 'growth'|'shrink'|'variance', note: string}}
 */
export function classifyFloorDelta(deltaBytes, calibrationSha) {
  const at = calibrationSha ? ` (calibrated at \`${calibrationSha}\`)` : ''
  if (deltaBytes > FLOOR_ENVIRONMENT_VARIANCE_BYTES) {
    return {
      kind: 'growth',
      note: `  ← shared framework/ecosystem growth${at}; this is NOT owned by any page`
    }
  }
  if (deltaBytes < -FLOOR_ENVIRONMENT_VARIANCE_BYTES) {
    return {
      kind: 'shrink',
      note: `  ← floor shrank${at}; claim it through a recalibration decision, not silently`
    }
  }
  return {
    kind: 'variance',
    note:
      `  ← within the ±${FLOOR_ENVIRONMENT_VARIANCE_BYTES} B MEASURED local↔hosted environment`
      + ` variance band${at}; NOT attributable to growth`
  }
}

/**
 * doc 20 §1 budgets, 1024-based, INCLUSIVE ("≤", so exactly-at-budget passes).
 *
 * These are doc 20 §1 VERBATIM. Re-baselining any of them requires an owner decision plus a
 * decision-log entry in `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 */
export const BUDGET = {
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
 * D20-31 — the PUBLIC per-route delivery model. **REPLACES D20-11's flat `totalJsBytes`.**
 *
 * WHY THE FLAT NUMBER WAS RETIRED. A single per-route total re-charges every byte of shared
 * framework growth to every page. Campaign 026 measured the consequence exactly: the shared floor
 * reached 254,554 B gz — 99.4 % of the old 256,000 B total — leaving 1,446 B for a whole page, which
 * is less than the lightest page in this application actually needs (2,599 B). Six of nine route
 * families could not reach the old budget **with their entire page deleted**. A budget no compliant
 * page can satisfy does not govern anything; it only mis-names the owner of a regression.
 *
 * WHAT REPLACES IT — two independent readings instead of one conflated number:
 *
 *   1. `sharedFloorBytes`  caps the SHARED FLOOR itself, so framework/ecosystem growth trips ONE
 *                          gate with the correct owner named, instead of nine gates naming nine
 *                          innocent pages.
 *   2. `incrementalBytes`  caps what each page adds ON TOP of the floor, by FUNCTIONAL TIER.
 *
 * `appRenderedBytes` (D20-12) is untouched and remains an INDEPENDENT guard: a route can fail
 * either, and passing one never excuses the other.
 *
 * ⚠ THE GATED QUANTITY IS THE DELTA, NEVER THE TOTAL. Read `incrementalBytes` against
 * `route_total − shared_floor`. Comparing a route TOTAL against these numbers reinstates exactly the
 * defect D20-31 exists to remove.
 *
 * ⚠ TIERS ARE DEFINED BY WHAT THE PAGE DOES, NOT BY WHAT IT CURRENTLY MEASURES. The measurements
 * corroborate the boundaries; they do not set them. Tiering because figures cluster would be a
 * budget refitted to each build, which measures nothing — the same reasoning that freezes D20-12.
 *
 * ⚠ These are doc 20 VERBATIM (D20-31). Re-baselining any of them requires an owner decision plus a
 * decision-log entry in `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 */
export const PUBLIC_DELIVERY_BUDGET = {
  /**
   * Hard cap on the shared public floor (D20-31).
   *
   * DERIVATION, recorded because "rounded to a nice number" is not a derivation. D20-12's
   * `x115/100` idiom yields 292,864 B here — 38,310 B of headroom, i.e. 2.4x the ENTIRE allowance of
   * the heaviest route. That is precisely the "a framework upgrade must not silently gain unlimited
   * shared headroom" failure, so the percentage idiom was REJECTED for this cap: D20-12's 15 % was
   * calibrated against an ~89 KB app-owned baseline and does not transfer to a 254 KB floor.
   *
   * Derived instead from a MEASURED framework movement — OD-26-7's `@nuxtjs/i18n` 10.6.0 adoption
   * cost +1,946 B gz on every route:
   *
   *   254,554 + (4 x 1,946) = 262,338  ->  ceil to whole KiB  =  257 KiB  =  263,168 B
   *
   * i.e. roughly four routine ecosystem adoptions of headroom. A structural regression (another
   * Unhead-scale duplication) trips it immediately.
   */
  sharedFloorBytes: 257 * KB,
  /**
   * Per-route INCREMENTAL delivery caps, by functional tier. Derived with D20-12's idiom
   * (`ceil((measuredMax x 115 / 100) / 1024) x 1024`) from the campaign-026 calibration:
   *
   *   content                7 KiB   <- ceil((5,597  x 1.15)/1024)x1024
   *   collection            12 KiB   <- ceil((10,073 x 1.15)/1024)x1024
   *   interactive-subsystem 18 KiB   <- ceil((15,876 x 1.15)/1024)x1024
   */
  incrementalBytes: {
    /** Single-purpose content page: renders prose/structured content and chrome only. */
    content: 7 * KB,
    /** Collection/composite page: presents multiple content collections or previews. */
    collection: 12 * KB,
    /** Page embedding a third-party interactive subsystem (carousel, form control set, editor). */
    'interactive-subsystem': 18 * KB
  },
  /**
   * The floor measured at D20-31 calibration (campaign 026, Web `8067ec8`). NOT a gate — the gate is
   * `sharedFloorBytes`. This exists so the report can show the DIRECTION and SIZE of floor movement,
   * which is the early warning that makes the cap safe. A drop below it is a real win, but it is
   * claimed through recalibration rather than absorbed silently.
   */
  sharedFloorCalibrationBytes: 254_554,
  /**
   * The SHA the calibration above was measured at, so a reader can tell REAL movement since that
   * tree from environment variance. ⚠ Load-bearing: at candidate `fd56aaa` this floor reads 254,593
   * locally — **+39 B of genuine growth accrued between `8067ec8` and `fd56aaa`**, well outside the
   * ±6 B environment band, so it correctly still reports as growth.
   */
  sharedFloorCalibrationSha: '8067ec8',
  /**
   * Attribution obligation threshold. At or above this fraction of its tier cap, a route must print
   * full attribution. Carried from D20-24's lesson: a high ceiling is only safe because growth must
   * be EXPLAINED long before it is allowed to BLOCK, and silence in the warning band is a gate
   * defect rather than a pass.
   */
  attributionThreshold: 0.85
}

/**
 * FUNCTIONAL TIER per governed public route (D20-31).
 *
 * ⚠ Assigning a route to a tier is a GOVERNANCE act, not a convenience: moving a route to a roomier
 * tier is a budget change and needs an owner decision plus a doc-20 entry, exactly like re-baselining
 * a number. Tier-shopping — filing a page under `interactive-subsystem` because it is over `content`
 * — is the failure mode this table exists to make visible, which is why each entry carries the
 * FUNCTIONAL reason rather than a byte figure.
 *
 * ⚠ There is deliberately NO per-route byte exception table. If the functional tiers are ever proven
 * insufficient by evidence, that is a new owner decision, not a local edit here.
 */
export const PUBLIC_ROUTE_TIERS = {
  // Composite landing page: hero plus previews of several content collections.
  '/': 'collection',
  '/ar': 'collection',
  // Index pages over a content collection.
  '/blog': 'collection',
  '/ar/blog': 'collection',
  '/projects': 'collection',
  '/ar/projects': 'collection',
  // Article pages: prose and chrome only.
  '/blog/staying-inside-performance-budget-nuxt': 'content',
  '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt': 'content',
  // Structured-content pages: no interactive subsystem, no collection rendering.
  '/experience': 'content',
  '/ar/experience': 'content',
  '/about': 'content',
  '/ar/about': 'content',
  '/resume': 'content',
  '/ar/resume': 'content',
  // Embeds the Nuxt UI carousel (`UCarousel` -> `embla-carousel`) for the project gallery.
  '/projects/content-platform-api': 'interactive-subsystem',
  '/ar/projects/content-platform-api': 'interactive-subsystem',
  // Embeds the Nuxt UI form control set (`UForm`/`UFormField`/`UInput`/`UTextarea`).
  '/contact': 'interactive-subsystem',
  '/ar/contact': 'interactive-subsystem'
}

/**
 * FROZEN reference route set — the shared floor is the intersection over THESE routes only (D20-31).
 *
 * ⚠ THIS IS THE "FROZEN SHARED SET" MITIGATION, AND WHAT IT FREEZES MATTERS. It is deliberately NOT
 * a frozen list of asset filenames: Nuxt asset names are content-hashed, so a filename list would be
 * invalidated by the very next build and could never be enforced.
 *
 * ⚠ THE FAILURE MODE IT PREVENTS. Adding a governed public route can shrink the floor BY
 * CONSTRUCTION: a new page that does not load a currently-shared asset ejects that asset from the
 * intersection for EVERY route, so the floor drops, every route's delta rises by the same amount,
 * and every delta gate can trip at once — because a page was added. Freezing the reference set makes
 * that impossible rather than merely unlikely: a new route is MEASURED against the floor, but does
 * not PARTICIPATE in defining it.
 *
 * ⚠ Changing this list is a deliberate recalibration and requires an owner decision plus a doc-20
 * entry. It is the "when the frozen shared set genuinely changes" case, and it must never be edited
 * to make a failing gate pass.
 */
export const FLOOR_REFERENCE_ROUTES = Object.freeze([
  '/', '/ar',
  '/blog', '/ar/blog',
  '/blog/staying-inside-performance-budget-nuxt', '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt',
  '/projects', '/ar/projects',
  '/projects/content-platform-api', '/ar/projects/content-platform-api',
  '/experience', '/ar/experience',
  '/about', '/ar/about',
  '/resume', '/ar/resume',
  '/contact', '/ar/contact'
])

/**
 * The tier a governed public route is filed under. Throws rather than defaulting: an unfiled route
 * would otherwise silently inherit whichever cap the caller happened to pick, which is the same
 * class of defect as a route that is never measured.
 */
export function publicTierFor(route) {
  const tier = PUBLIC_ROUTE_TIERS[route]
  if (!tier) {
    throw new Error(
      `public route ${route} has no D20-31 functional tier. Add it to PUBLIC_ROUTE_TIERS with its ` +
      'functional reason (an owner decision + doc 20 entry), rather than defaulting it to a cap.'
    )
  }
  return tier
}

/**
 * Governance coverage: every measured public route must be filed under a tier, and every filed route
 * must still be measured. The second direction matters — a tier entry left behind for a deleted
 * route reads as governance that is no longer enforced.
 */
export function assertPublicTierCoverage(measuredRoutes) {
  const measured = new Set(measuredRoutes)
  const unfiled = measuredRoutes.filter(r => !PUBLIC_ROUTE_TIERS[r])
  const orphaned = Object.keys(PUBLIC_ROUTE_TIERS).filter(r => !measured.has(r))
  if (unfiled.length > 0) {
    throw new Error(`public routes measured but not filed under a D20-31 tier: ${unfiled.join(', ')}`)
  }
  if (orphaned.length > 0) {
    throw new Error(`D20-31 tiers name routes that are not measured: ${orphaned.join(', ')}`)
  }
}

/**
 * The shared public floor: assets present on EVERY route of the FROZEN reference set.
 *
 * @param assetsByRoute Map<route, Set<assetPath>> — must contain every `FLOOR_REFERENCE_ROUTES` entry.
 * @returns {{assets: Set<string>}}
 */
export function resolveSharedFloor(assetsByRoute) {
  const missing = FLOOR_REFERENCE_ROUTES.filter(r => !assetsByRoute.has(r))
  if (missing.length > 0) {
    throw new Error(
      `cannot derive the D20-31 shared floor: reference routes were not measured: ${missing.join(', ')}`
    )
  }
  let shared = null
  for (const route of FLOOR_REFERENCE_ROUTES) {
    const assets = assetsByRoute.get(route)
    if (shared === null) { shared = new Set(assets); continue }
    for (const asset of [...shared]) if (!assets.has(asset)) shared.delete(asset)
  }
  return { assets: shared }
}

/**
 * Authenticated dashboard routes — doc 20 §1.1 (D20-23, ceiling superseded by **D20-24**). A
 * separate budget CLASS, not a relaxation of the public one: the dashboard is a single-operator
 * tool behind a login, never indexed, not a conversion surface, and legitimately carries
 * interaction weight (data tables, overlays) no public route may.
 *
 * THE TOTAL-JS BUDGET IS TWO-TIER (D20-24), and the two tiers do different jobs:
 *
 *   ≤ 300 KB gz   quality target      an ordinary green result
 *   ≤ 320 KB gz   hard release ceiling  PASSES, but only with full attribution printed
 *   > 320 KB gz   release-blocking    genuine breach, exit 1, owner review required
 *
 * WHY TWO TIERS RATHER THAN ONE HIGHER NUMBER. D20-23's single 280 KB gz ceiling was derived at
 * Web `76f8fa6`, before the owner confirmed the long-term dashboard architecture (Nuxt UI-first,
 * regular-Zod-first). At Web `80ee17ba` `/dashboard/messages` measured 295.5 KB gz — 277.7 baseline
 * + ≈0.4 `UCard` + ≈17.4 regular Zod — with app-owned at 54,993 B of 101 KiB, i.e. barely half its
 * project-owned budget. The route was not bloated; the only ways under 280 KB were to drop a
 * standard Nuxt UI component or swap to `zod/mini` (itself ≈290.3 KB gz — still a breach). A
 * threshold whose binding constraint is framework policy rather than application bloat is not
 * detecting what it was built to detect.
 *
 * A lone 320 KB ceiling would have thrown away all early warning, so the warning tier is what makes
 * the higher ceiling safe: growth must be EXPLAINED (exact size, delta from the previous accepted
 * baseline, framework/vendor attribution, app-owned attribution, new components/dependencies,
 * public-isolation confirmation) long before it is permitted to BLOCK. Silence in the 300–320 band
 * is a gate defect, not a pass.
 *
 * There is deliberately NO `totalJsBytes` key any more: a single name for a two-tier policy is
 * exactly how a caller silently reads the wrong tier.
 *
 * `cssBytes` is §1's number UNCHANGED — the dashboard shares the one global stylesheet.
 *
 * THERE IS DELIBERATELY NO `appRenderedBytes` KEY HERE ANY MORE (D20-29). App-owned is now a
 * FROZEN PER-ROUTE cap, and a single class-wide name is exactly how a caller silently charges one
 * route against another route's ceiling — the same reasoning that removed `totalJsBytes` above.
 * Use `dashboardAppCapFor(route)`.
 *
 * Like the public limits, these are doc 20 verbatim. Re-baselining requires an owner decision and a
 * decision-log entry there — never an edit here.
 */
export const DASHBOARD_BUDGET = {
  /**
   * D20-24 quality target and warning boundary. At or below this is an ordinary green result.
   *
   * ⚠ THIS SURVIVES D20-32 UNCHANGED, AND IT IS NOW THE ONLY THING THE ROUTE TOTAL IS COMPARED
   * AGAINST. D20-32 replaced the flat 320 KB gz HARD CEILING with the floor + incremental model in
   * `DASHBOARD_DELIVERY_BUDGET`; it deliberately did NOT touch this number. The warning tier is what
   * keeps growth EXPLAINED (the six-part attribution block) and it is what keeps D20-30's attributed
   * acceptance of `/dashboard/messages` visible on every run instead of letting the route become an
   * ordinary green line once the hard ceiling stopped applying to it.
   */
  totalJsQualityTargetBytes: 300 * KB,
  cssBytes: BUDGET.cssBytes
}

/**
 * INTERIM Dashboard delivery model — doc 20 §1.1 (**D20-32**), replacing D20-24's flat total-JS HARD
 * CEILING. The 300 KB gz quality target above is UNCHANGED and still governs warnings.
 *
 * ⚠ WHY THE FLAT CEILING WAS REPLACED RATHER THAN RAISED. Measured across all eight governed routes,
 * the shared dashboard floor is 259,911 B gz — **96.9 % of the old 320 KB ceiling** — leaving about
 * 10 KB for any page's own delivery while the lightest real page already needs 449 B and the heaviest
 * needs 77,549 B. A flat per-route TOTAL therefore charged every page for shared framework delivery it
 * does not own, which is the identical structural unfitness D20-31 established for the public surface
 * and cured the same way. No number was raised to fit: the quantity being gated changed.
 *
 * ⚠ THE GATED QUANTITY IS THE DELTA ABOVE THE SHARED FLOOR, NEVER THE ROUTE TOTAL. Comparing a
 * dashboard route TOTAL against `incrementalBytes` reinstates exactly the defect D20-32 removes.
 *
 * ⚠ ONE GENERIC ALLOWANCE, DELIBERATELY — NO TIERS AND NO PER-ROUTE TABLE. A two-tier split
 * (`operator-page` 60 KiB / `data-table` 84 KiB) was derived and **REJECTED**: the single cap already
 * governs every route honestly, so the split bought 24,576 B of tightness on the six lighter routes
 * and nothing on the route that actually motivated this decision. A second tier whose only member is
 * `/dashboard/messages`, sized from that member's own current measurement, is arithmetically
 * indistinguishable from a per-route allowance — i.e. the named waiver D20-30 forbids, reached by a
 * different route. If a second page ever adopts the data-table subsystem, the tier question reopens
 * with a real distribution behind it.
 *
 * ⚠ THESE ARE INTERIM LIMITS. They govern the CURRENT production Dashboard architecture until the
 * post-campaign Dashboard UI/UX performance pass (D11-8), which is responsible for reviewing and, if
 * appropriate, superseding both the model and this calibration. Interim is not provisional-forever:
 * it means the review is owed, not that the numbers are soft.
 *
 * ⚠ These are doc 20 VERBATIM. Re-baselining any of them requires an owner decision plus a
 * decision-log entry in `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 */
export const DASHBOARD_DELIVERY_BUDGET = {
  /**
   * Hard cap on the shared dashboard floor.
   *
   * DERIVATION — from a MEASURED framework movement, not a percentage. D20-31 already rejected
   * D20-12's `x115/100` idiom for a floor-scale number (15 % was calibrated against an ~89 KB
   * app-owned baseline and does not transfer), and reusing an unrelated budget's percentage here
   * would be the same error. The unit is OD-26-7's measured `@nuxtjs/i18n` 10.6.0 adoption, which
   * cost **+1,946 B gz on every route**:
   *
   *   259,911 + (4 x 1,946) = 267,695  ->  ceil to whole KiB  =  262 KiB  =  268,288 B
   *
   * i.e. roughly four routine ecosystem adoptions of headroom (8,377 B). ⚠ That leaves the floor at
   * **96.9 % utilisation**, which is TIGHT and is stated rather than smoothed: the next framework
   * bump of Unhead scale plausibly trips this gate. That is the intended behaviour — shared growth
   * should surface here, once, instead of being charged to every page.
   */
  sharedFloorBytes: 262 * KB,
  /**
   * Per-route INCREMENTAL delivery cap above the shared floor — ONE allowance for every governed
   * dashboard route.
   *
   * DERIVATION — the same measured unit as the floor cap, applied consistently:
   *
   *   77,549 + (4 x 1,946) = 85,333  ->  ceil to whole KiB  =  84 KiB  =  86,016 B
   *
   * where 77,549 B gz is the measured maximum route-specific delivery across the eight governed
   * routes (`/dashboard/messages`). Headroom 8,467 B, i.e. **90.2 % utilisation for the heaviest
   * route** — explicit and bounded, and deliberately NOT equal to the current maximum.
   *
   * ⚠ A candidate 16,416 B unit was REJECTED: it was obtained by subtracting one route's delta from
   * another's, and D20-12/D20-31 establish that gzip is not decomposable per module that way, so it
   * would have been a fabricated input to a governed cap. A 12,945 B candidate was also rejected as
   * INFERRED rather than measured.
   *
   * ⚠ `/dashboard` sits at 0.6 % of this cap, and that is CORRECT rather than absurd: it is the
   * dashboard overview and legitimately ships almost nothing of its own. Do not "fix" the apparent
   * slack by inventing a tier for it — the app-owned cap and the floor still govern that route.
   */
  incrementalBytes: 84 * KB,
  /**
   * The dashboard floor measured at D20-32 calibration (campaign 026, Web `da83531`). NOT a gate —
   * the gate is `sharedFloorBytes`. This exists so the report can show the DIRECTION and SIZE of
   * floor movement, which is the early warning that makes the cap safe. A drop below it is a real
   * win, but it is claimed through recalibration rather than absorbed silently.
   */
  sharedFloorCalibrationBytes: 259_911,
  /**
   * The SHA the calibration above was measured at.
   *
   * ⚠ This constant is NOT reporting-only — it is the stated MEASURED INPUT from which
   * `sharedFloorBytes` is derived (`ceilKiB(259_911 + 4 × 1_946) = 262 KiB`), and the spec pins that
   * derivation. Ledger §33.4 proposed re-stamping it to the hosted 259,917 to silence the `+6 B`
   * label; Phase 6 REJECTED that on evidence, because it would repurpose a governed cap's measured
   * input to fix a print label, and would merely mirror the false signal (local would then read
   * −6 B). The reporting defect is fixed in the REPORT — see `classifyFloorDelta` — and this number
   * stays frozen at what was actually measured.
   */
  sharedFloorCalibrationSha: 'da83531',
  /**
   * Attribution obligation threshold on the INCREMENTAL cap, carried from D20-24/D20-31: growth must
   * be EXPLAINED long before it is allowed to BLOCK, and silence near a cap is a gate defect.
   */
  attributionThreshold: 0.85
}

/**
 * FROZEN dashboard floor reference set — the shared dashboard floor is the intersection over THESE
 * routes only (D20-32).
 *
 * ⚠ THIS IS DELIBERATELY A SEPARATE LIST FROM `DASHBOARD_ROUTES`, AND THAT SEPARATION IS THE WHOLE
 * MITIGATION. If the floor were derived over "whatever is governed today", adding a governed
 * dashboard route could shrink the floor BY CONSTRUCTION: a new page that does not load a currently
 * shared asset ejects that asset from the intersection for EVERY route, the floor drops, and every
 * route's delta rises by the same amount at once — every delta gate can then trip because a page was
 * added. Freezing the reference set makes that impossible rather than merely unlikely: a newly
 * governed route is MEASURED against the floor but does not PARTICIPATE in defining it.
 *
 * ⚠ As in D20-31, what is frozen is the ROUTE LIST, never asset filenames — Nuxt names are
 * content-hashed, so a filename freeze would be invalidated by the very next build.
 *
 * ⚠ Changing this list is a deliberate recalibration requiring an owner decision plus a doc-20
 * entry. It must never be edited to make a failing gate pass.
 */
export const DASHBOARD_FLOOR_REFERENCE_ROUTES = Object.freeze([
  '/dashboard/login',
  '/dashboard',
  '/dashboard/messages',
  '/dashboard/media',
  '/dashboard/profile',
  '/dashboard/projects',
  '/dashboard/projects/new',
  '/dashboard/projects/00000000-0000-0000-0000-000000000000'
])

/**
 * The shared dashboard floor: assets present in the closure of EVERY route of the FROZEN dashboard
 * reference set.
 *
 * @param assetsByRoute Map<route, Set<assetPath>> — must contain every
 *   `DASHBOARD_FLOOR_REFERENCE_ROUTES` entry.
 * @returns {{assets: Set<string>}}
 */
export function resolveDashboardSharedFloor(assetsByRoute) {
  const missing = DASHBOARD_FLOOR_REFERENCE_ROUTES.filter(r => !assetsByRoute.has(r))
  if (missing.length > 0) {
    throw new Error(
      `cannot derive the D20-32 shared dashboard floor: reference routes were not measured: ${missing.join(', ')}`
    )
  }
  let shared = null
  for (const route of DASHBOARD_FLOOR_REFERENCE_ROUTES) {
    const assets = assetsByRoute.get(route)
    if (shared === null) { shared = new Set(assets); continue }
    for (const asset of [...shared]) if (!assets.has(asset)) shared.delete(asset)
  }
  return { assets: shared }
}

/**
 * App-owned baselines: the HISTORICAL DERIVATION INPUT each frozen cap below was computed from.
 *
 * ⚠ EACH VALUE BELONGS TO THE TREE IT WAS MEASURED ON — see `DASHBOARD_APP_OWNED_BASELINE_PROVENANCE`
 * for which tree that is, per route. They are NOT current-tree reproduction targets, and the gate
 * never compares a build against them. A baseline that does not equal today's measurement is
 * EXPECTED once the route's source has changed; that is the routes growing, not the record decaying.
 *
 * ⚠ SCOPE OF WHAT IS PROVEN, stated narrowly on purpose. Reproduction-by-rebuild has been performed
 * for exactly ONE of the eleven: `/dashboard/experiences` at `fd4e9df`, measured 85,551 B, exact.
 * The other ten are recorded from their decision provenance and have NOT been re-verified by
 * rebuild. Do not read the sentence above as a measured claim about all eleven — it is the rule the
 * record follows, evidenced once, and one attempt to extend it (Articles) FAILED to reproduce.
 *
 * An earlier revision of this comment said these were recorded "so each frozen cap below can be
 * re-derived from its stated input rather than taken on trust", with no tree named. That sentence is
 * true of the DERIVATION and false of any REPRODUCTION, and the campaign ledger §9.5 opened a finding
 * ("the recorded baselines no longer reproduce") on the strength of the second reading. Measured
 * 2026-08-19, that finding's premise did not survive:
 *
 *   - `/dashboard/experiences` was rebuilt at its own provenance tree `fd4e9df` (`M1·U2`) and
 *     measured **85,551 B — exact, to the byte**. The baseline reproduces perfectly where it was taken.
 *   - Rebuilt at `7e6d11a` (`M1·U3`) the same route measures 87,404 B, and the +1,853 B attributes
 *     EXACTLY, per module: `useAdminExperiences.ts` +1,345, `admin-experience-fields.ts` +187, and
 *     the editor's two new route modules +161/+160. Four modules, summing to the delta with no
 *     remainder. The editor's composable growth is charged to the COLLECTION route because both
 *     share one composable inside the route's static closure.
 *   - The ledger's candidate explanation — "~50 new i18n keys x 2 locales" — is REFUTED. The key
 *     count was right (50 net new keys per locale) but the byte path is not: `i18n/locales/**` has
 *     ZERO module records in the entire client build, because nuxt-i18n loads locale messages
 *     outside the Rollup module graph this gate measures. Translation growth cannot move this number.
 *
 * So the comparison that produced the finding was a category error — a historical derivation input
 * read against a later tree — and the fix belongs here, in the record, not in the numbers. Nothing
 * below was re-stamped: re-stamping the Experiences collection 85,551 -> 87,404 would silently
 * re-derive its cap 99,328 -> 101,376, a budget change performed to correct a report label.
 *
 * The three D20-23 routes are deliberately ABSENT: their cap is D20-12's constant and was not
 * derived from a dashboard measurement, so inventing a baseline for them here would be a fiction.
 */
export const DASHBOARD_APP_OWNED_BASELINE_BYTES = {
  '/dashboard/media': 96_084,
  '/dashboard/profile': 106_990,
  // Measured on the SHIPPED tree. The owner decision D20-33 quotes 89,016 B, taken one revision
  // earlier — before the page dropped its bespoke error block in favour of reusing `UiStateError`.
  // Both derive the SAME cap (102,400 B), so the decision is unaffected; the value recorded here is
  // the one the artifact actually produces, because that is what provenance means.
  '/dashboard/articles': 88_344,
  '/dashboard/articles/new': 106_095,
  '/dashboard/articles/00000000-0000-0000-0000-000000000000': 106_203,
  // D20-34 — FE-3 module 1's collection, measured on the tree that ships it.
  //
  // ⚠ THIS VALUE NO LONGER REPRODUCES ON THE CURRENT TREE, AND IS DELIBERATELY LEFT ALONE. `M1·U3`
  // re-measured the same route at 87,404 B. It still PASSES its 99,328 B cap with 11,924 B spare, so
  // this is provenance drift and not a breach. The owner ruled that historical derivation inputs are
  // NOT re-stamped merely because they stop reproducing: re-stamping 85,551 → 87,404 would re-derive
  // this route's cap from 99,328 B to 101,376 B — a budget change performed to fix a report label.
  // The finding is recorded in the campaign ledger §9.5; deriving a new cap from a later tree would
  // require a separate, explicitly governed recalibration.
  '/dashboard/experiences': 85_551,
  // D20-35 (owner decision, 2026-08-18) — FE-3 module 1's TWO EDITOR routes, measured on the tree
  // that ships them (`M1·U3`, `7e6d11a`). Measured FIRST and escalated as one batched decision, which
  // is what D20-34's standing instruction required: the collection's 99,328 B was NOT inherited.
  '/dashboard/experiences/new': 105_051,
  '/dashboard/experiences/00000000-0000-0000-0000-000000000000': 105_159,
  // D20-36 — FE-3 module 2's three Skills routes, measured on the completed integrated tree
  // (`M2·U3` cherry-picked as `5c7db16`, isolation fix `785d1b8`) via the §1.2 closure workflow.
  // All three numbers come from the SAME build, so they form one comparable batch.
  '/dashboard/skills': 83_997,
  '/dashboard/skills/new': 96_571,
  '/dashboard/skills/00000000-0000-0000-0000-000000000000': 96_679,
  // D20-37 — FE-3 module 3's Testimonials collection, measured at the `T·U2` checkpoint via the
  // §1.2 closure workflow and REPRODUCED on a clean, stamped build of the governance commit before
  // registration. One route, one number from one build.
  '/dashboard/testimonials': 86_069,
  // D20-38 — FE-3 module 3's two Testimonials EDITOR routes, measured at the completed integrated
  // `T·U3` checkpoint via the §1.2 closure workflow and REPRODUCED on a clean, stamped build of the
  // governance commit before registration. Two routes, two numbers, one build — one comparable batch.
  '/dashboard/testimonials/new': 125_465,
  '/dashboard/testimonials/00000000-0000-0000-0000-000000000000': 125_573,
  // D20-39 — FE-3's Taxonomy destination (ONE route hosting the Categories + Tags collections),
  // measured at the completed `U2` checkpoint via the §1.2 closure workflow on the implementation
  // commit itself (blob sha256 verified against the registered provenance tree below).
  // ⚠ SUPERSEDED by D20-40: U3b added the approved create/edit/delete overlays to this SAME route,
  // so the completed surface re-measured at 135,345 B. The 92,160 B pre-overlay reading is kept as
  // historical evidence of the D20-39 decision chain, not as a live derivation input.
  '/dashboard/taxonomy': 135_345,
  '/dashboard/projects': 95_029,
  '/dashboard/projects/new': 152_208,
  '/dashboard/projects/00000000-0000-0000-0000-000000000000': 152_393
}

/**
 * The TREE each baseline above was measured on. Values carry no bytes and derive no cap — this map
 * exists so "the baseline does not reproduce" can never again be raised without first asking
 * "reproduce WHERE?", which is the question that dissolved the §9.5 finding.
 *
 * Keys must match `DASHBOARD_APP_OWNED_BASELINE_BYTES` exactly; the spec asserts it, so a future
 * baseline added without its provenance fails rather than inheriting a neighbour's tree by proximity.
 *
 * ⚠ Adding an entry here is a RECORD-KEEPING act and must never be paired with an edit to the bytes
 * above. Changing a baseline changes a cap.
 */
export const DASHBOARD_APP_OWNED_BASELINE_PROVENANCE = {
  // D20-29 — measured at Web `origin/dev` by the §1.2 closure.
  '/dashboard/media': 'd53af111168ffff56eadaacc0c1d7fdd6c2c635c3',
  '/dashboard/profile': 'd53af111168ffff56eadaacc0c1d7fdd6c2c635c3',
  '/dashboard/projects': 'd53af111168ffff56eadaacc0c1d7fdd6c2c635c3',
  '/dashboard/projects/new': 'd53af111168ffff56eadaacc0c1d7fdd6c2c635c3',
  '/dashboard/projects/00000000-0000-0000-0000-000000000000': 'd53af111168ffff56eadaacc0c1d7fdd6c2c635c3',
  // D20-33 — "the FE-2c shipped tree", which is how the decision's own record names it, and it is
  // NOT one of the campaign's unit commits. ⚠ UNRESOLVED to a SHA, and deliberately left so rather
  // than guessed: rebuilding `944443f` (FE-2c's last commit) measured 91,022 / 106,776 / 106,884
  // against the recorded 88,344 / 106,095 / 106,203, so `944443f` is RULED OUT. The recorded values
  // are LOWER than that tree produces, so the measurement predates it. Resolving these needs an
  // FE-2c bisect; until someone does that, a string that admits it is unactionable beats a SHA that
  // would reproduce nothing.
  '/dashboard/articles': 'FE-2c shipped tree (UNRESOLVED; ruled out: 944443f)',
  '/dashboard/articles/new': 'FE-2c shipped tree (UNRESOLVED; ruled out: 944443f)',
  '/dashboard/articles/00000000-0000-0000-0000-000000000000': 'FE-2c shipped tree (UNRESOLVED; ruled out: 944443f)',
  // D20-34 — `M1·U2`. VERIFIED by rebuild 2026-08-19: this tree reproduces 85,551 B exactly.
  '/dashboard/experiences': 'fd4e9df',
  // D20-35 — `M1·U3`, the commit that created the two editor routes.
  '/dashboard/experiences/new': '7e6d11a',
  '/dashboard/experiences/00000000-0000-0000-0000-000000000000': '7e6d11a',
  // D20-36 — `M2·U3` integrated on the campaign branch; the measurement build's stamped HEAD
  // (the docs-only ledger commit that followed shares this tree for all build inputs).
  '/dashboard/skills': '785d1b83c4f249d3af175bc081b7c2ebda5d97c4',
  '/dashboard/skills/new': '785d1b83c4f249d3af175bc081b7c2ebda5d97c4',
  '/dashboard/skills/00000000-0000-0000-0000-000000000000': '785d1b83c4f249d3af175bc081b7c2ebda5d97c4',
  // D20-37 — `T·U2`, the commit that created the collection route. The checkpoint build's closure
  // reading was reproduced byte-for-byte on a clean, stamped build of the governance commit.
  '/dashboard/testimonials': '474b2501dbee7d0999b5e3a6292d2ed7556bd0b9',
  // D20-38 — `T·U3`, the commit that created the two editor routes; same reproduction protocol as
  // D20-37: checkpoint reading confirmed byte-for-byte on the clean, stamped governance build.
  '/dashboard/testimonials/new': '7f22ce775e4cc96bad3f50fa605398d8ec692fcd',
  '/dashboard/testimonials/00000000-0000-0000-0000-000000000000': '7f22ce775e4cc96bad3f50fa605398d8ec692fcd',
  // D20-39 — `U2` (0de9b54), the commit that created the route. Superseded by D20-40.
  '/dashboard/taxonomy': '4fe9cfe7086260411854cbb8789f8d223a6eeb14'
}

/**
 * The FROZEN absolute app-owned hard cap for every governed dashboard route (doc 20 §1.1, D20-29).
 *
 * These are doc 20 VERBATIM. This map is an ENFORCEMENT mechanism, never the authority: a new cap,
 * or a change to one, requires an owner decision plus a decision-log entry in
 * `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 *
 * ABSOLUTE CEILINGS, NOT REGRESSION BASELINES. Nothing here is recomputed from a build, and the
 * gate may never raise one. A route that grows past its cap FAILS (exit 1) and is fixed by
 * optimizing the implementation or by a further decision in doc 20 — exactly as D20-12 intended.
 *
 * TWO PROVENANCE CLASSES, and the difference is deliberate:
 *
 *   D20-23 routes  — keep D20-12's 101 KiB constant, UNCHANGED and NOT re-derived. Applying the
 *                    D20-29 formula to `/dashboard/messages` (92,442 B) would yield 106,496 B,
 *                    which is HIGHER than the 103,424 B it already carries; D20-29 never raises an
 *                    existing governed cap. Do not "fix" these to match the formula.
 *   D20-29 routes  — derived once from DASHBOARD_APP_OWNED_BASELINE_BYTES via
 *                    `approvedAppLimitBytes`, i.e. D20-12's headroom, rounding and units verbatim.
 */
export const DASHBOARD_APP_OWNED_CAP_BYTES = {
  // D20-23 / D20-12 — preserved unchanged.
  '/dashboard/login': 101 * KB,
  '/dashboard': 101 * KB,
  '/dashboard/messages': 101 * KB,
  // D20-29 — derived from the baselines above.
  //
  // `/dashboard/articles` is D20-33 (owner decision, 2026-08-18): the cap is D20-29's formula
  // applied to this route's own measured baseline, and the decision registers the SAME cap for the
  // module's two editor routes, which inherit it rather than deriving their own. That is a
  // deliberate registration of governance coverage, NOT a waiver and NOT a budget raised to excuse
  // a failing route — the measured route fits the model with 13,384 B to spare. If an editor route
  // later cannot meet it, the cause is attributed and escalated; the cap is not silently raised.
  '/dashboard/articles': 100 * KB,
  // D20-33 as AMENDED 2026-08-18. These two were first registered at the collection's 100 KiB,
  // INHERITED before the editor surface existed. It now exists and has been measured, so the cap is
  // derived from their own baselines by D20-29's formula — which is a CORRECTION of a provisional
  // ceiling, not a waiver, not a floor change, and not a D20-32 recalibration.
  //
  // The gap is attributable to real authoring functionality rather than to waste: an editor carries
  // the media-authoring subsystem (MediaBrowser + MediaPicker + MediaCard = 20,352 B) that a list
  // route does not, and 24,769 B were removed by moving it off the critical path before the cap was
  // ever questioned. For scale, the Projects editor's governed cap is 176,128 B.
  //
  // NO generic authoring-route class: the owner held that back for FE-5, when Projects, the
  // remaining content modules and the system modules have stabilised and there is repeated evidence
  // to generalise from. Two routes is not that evidence.
  '/dashboard/articles/new': 120 * KB,
  '/dashboard/articles/00000000-0000-0000-0000-000000000000': 120 * KB,
  // D20-34 (owner decision, 2026-08-18) — FE-3 module 1's collection.
  //
  // Derived by D20-29's formula from THIS route's own measured baseline (85,551 B), not inherited
  // from a sibling: ceil(85,551 × 115 / 102,400) × 1024 = 99,328 B, leaving 13,777 B of headroom.
  // The owner declined rounding it up to the Articles 100 KiB cap for visual consistency — a cap
  // set by a sibling is a cap set by something other than evidence.
  //
  // The decision is explicitly NOT a waiver, NOT a shared-floor change, NOT a change to the generic
  // incremental allowance, and NOT a D20-32 recalibration.
  //
  // ⚠ THE EDITOR ROUTES DO NOT INHERIT THIS. They are measured first and escalated as one batched
  // decision when `M1·U3` creates them. That is the D20-33 amendment's lesson applied in advance:
  // Articles' two editor routes were first registered at the collection's cap INHERITED before the
  // editor surface existed, and had to be corrected to 120 KiB once measured.
  '/dashboard/experiences': 97 * KB,
  // D20-35 (owner decision, 2026-08-18) — the Experiences editor routes, each derived from its OWN
  // measured baseline by D20-29's formula. The owner declined rounding them up to the Articles
  // editor's 122,880 B for consistency: "use each route's own measured baseline under the
  // already-governed D20-29 formula".
  //
  // Explicitly NOT a waiver, NOT a shared-floor change, NOT a generic incremental-allowance change,
  // and NOT a D20-32 recalibration. Both surfaces are materially LEANER than the governed Articles
  // (122,880 B) and Projects (176,128 B) editors, so nothing was loosened by precedent.
  //
  // Still no generic authoring-route class — D20-33's amendment held that back for FE-5, and four
  // routes is not the repeated evidence it asked for.
  '/dashboard/experiences/new': 118 * KB,
  '/dashboard/experiences/00000000-0000-0000-0000-000000000000': 119 * KB,
  // D20-36 (owner decision, 2026-08-22) — FE-3 module 2's THREE Skills routes, each derived from
  // its OWN measured baseline by D20-29's formula on the completed integrated Skills tree
  // (`785d1b83c4f249d3af175bc081b7c2ebda5d97c4`). Measured FIRST and escalated as ONE batched
  // decision — the D20-33 amendment's lesson, and the reason `M2·U2` registered the collection as
  // deliberately ungoverned instead of inheriting a sibling's number.
  //
  // Explicitly NOT a waiver, NOT a shared-floor change, NOT a generic incremental-allowance change,
  // and NOT a D20-32 recalibration. The owner declined consistency-rounding toward Articles
  // (100/120 KiB), Experiences (97/118/119 KiB) or Projects (107/171/172 KiB): each route carries
  // the cap its own baseline derives.
  '/dashboard/skills': 95 * KB,
  '/dashboard/skills/new': 109 * KB,
  '/dashboard/skills/00000000-0000-0000-0000-000000000000': 109 * KB,
  // D20-37 (owner decision, 2026-08-22) — FE-3 module 3's Testimonials COLLECTION, derived from its
  // OWN measured baseline (86,069 B at `T·U2`, Web `474b2501`) by D20-29's formula, registered after
  // measurement exactly as D20-34 did for the Experiences collection. Its editor routes are
  // deliberately NOT registered here — they do not exist yet and will be measured first, per the
  // standing instruction every module has followed since the D20-33 amendment.
  //
  // Explicitly NOT a waiver, NOT a shared-floor change, NOT a generic incremental-allowance change,
  // and NOT a D20-32 recalibration. The resulting number, 99,328 B (97 KiB), is NUMERICALLY EQUAL to
  // the Experiences collection's cap by COINCIDENCE of similar baselines (86,069 vs 85,551 B) — it
  // is not inherited from it, not rounded toward it, and carries its own derivation; both numbers
  // are just what the same frozen formula yields from two different measurements.
  '/dashboard/testimonials': 97 * KB,
  // D20-38 (owner decision, 2026-08-22) — FE-3 module 3's TWO Testimonials editor routes, each
  // derived INDEPENDENTLY from its OWN measured baseline by D20-29's formula on the completed
  // integrated T·U3 tree (`7f22ce775e4cc96bad3f50fa605398d8ec692fcd`). Measured FIRST and escalated
  // as ONE batched decision — the D20-33 amendment's lesson, and the reason `T·U3` registered both
  // routes as deliberately ungoverned instead of inheriting the collection's cap or a sibling's.
  //
  // Explicitly NOT a waiver, NOT a shared-floor change, NOT a generic incremental-allowance change,
  // and NOT a D20-32 recalibration. The two caps are deliberately NOT one common number: the owner
  // declined rounding either route toward the other or toward any sibling editor (Articles
  // 122,880 B, Experiences 120,832/121,856 B, Skills 111,616 B). The collection's governed 99,328 B
  // (D20-37) is untouched and was NOT re-derived.
  '/dashboard/testimonials/new': 141 * KB,
  '/dashboard/testimonials/00000000-0000-0000-0000-000000000000': 142 * KB,
  // D20-39 (owner decision, 2026-08-23) — FE-3's Taxonomy destination: ONE route hosting BOTH the
  // Categories and Tags collections (plan §7.1 groups them as one destination; they share this one
  // route and therefore one budget line). Derived by D20-29's formula from the route's OWN measured
  // baseline — `ceil(92,160 × 115 / 102,400) × 1024` = 106,496 B (104 KiB) on the U2 tree
  // (`0de9b54d2efdb28191be7b0e66ae8171e7fd3d2b`). Route-specific: not inherited from Articles,
  // Experiences, Skills or Testimonials, and no sibling number was rounded toward.
  //
  // ⚠ SUPERSEDED by D20-40 (owner decision, 2026-08-23) — U3b landed the approved create/edit/
  // delete overlays ON this same route (no editor route exists), so the completed surface
  // re-measured at 135,345 B and the owner re-derived the cap by the same frozen formula:
  // ceil((135,345 × 115) / 102,400) × 1024 = 155,648 B (152 KiB), headroom 20,303 B. Route-specific,
  // not inherited from any sibling, not rounded upward. Still explicitly NOT a waiver, NOT a
  // shared-floor change, NOT an incremental-allowance change, and NOT a D20-32 recalibration; the
  // frozen floor set is untouched.
  '/dashboard/taxonomy': 152 * KB,
  '/dashboard/media': 108 * KB,
  '/dashboard/profile': 121 * KB,
  '/dashboard/projects': 107 * KB,
  '/dashboard/projects/new': 171 * KB,
  '/dashboard/projects/00000000-0000-0000-0000-000000000000': 172 * KB
}

/**
 * Governance coverage must hold in BOTH directions, and each direction is a different failure:
 *
 *   measured but ungoverned  — a dashboard route is measured against no cap anybody decided
 *   governed but unmeasured  — a route carries a doc 20 cap while quietly not being measured
 *
 * Asserting only the first is how the second becomes invisible: delete a route from
 * DASHBOARD_ROUTES and the gate still exits 0 while a governed budget silently stops applying.
 * Pure and exported so both directions can be tested independently — an inverse invariant added
 * without its own test is how a one-way check turns into a false positive.
 *
 * @param {string[]} measuredRoutes routes the gate will actually measure
 * @param {Record<string, number>} [caps] governed cap map; defaults to the real one
 * @throws {Error} if the two sets differ in either direction
 */
export function assertGovernedRouteCoverage(measuredRoutes, caps = DASHBOARD_APP_OWNED_CAP_BYTES) {
  const measured = new Set(measuredRoutes)
  const governed = new Set(Object.keys(caps))
  const ungoverned = [...measured].filter(r => !governed.has(r))
  const unmeasured = [...governed].filter(r => !measured.has(r))
  if (!ungoverned.length && !unmeasured.length) return

  const detail = [
    ungoverned.length ? `measured but NOT governed (no frozen cap in doc 20): ${ungoverned.join(', ')}` : null,
    unmeasured.length ? `governed but NOT measured (cap exists, route dropped from the gate): ${unmeasured.join(', ')}` : null
  ].filter(Boolean).join('\n  ')
  throw new Error(
    'dashboard route governance and measurement have diverged (doc 20 §1.1, D20-29):\n  '
    + detail
    + '\n  DASHBOARD_ROUTES and DASHBOARD_APP_OWNED_CAP_BYTES must name exactly the same routes.'
  )
}

/**
 * The governed cap for one dashboard route.
 *
 * THROWS for an unknown route rather than defaulting. A default would let a dashboard route ship
 * measured-but-ungoverned — charged against a number nobody decided — which is the precise defect
 * D20-29 exists to correct. The caller turns this into an infrastructure failure (exit 2): the gate
 * refuses to report a verdict it cannot justify, rather than inventing one.
 *
 * @param {string} route
 * @returns {number} frozen cap in bytes
 */
export function dashboardAppCapFor(route) {
  const cap = DASHBOARD_APP_OWNED_CAP_BYTES[route]
  if (cap === undefined) {
    throw new Error(
      `governed dashboard route ${route} has no frozen app-owned cap in doc 20 §1.1 (D20-29). `
      + 'Add the route to the governed inventory in eslammuatamed-docs/docs/20-performance.md and '
      + 'mirror it in DASHBOARD_APP_OWNED_CAP_BYTES — the gate may not invent a budget.'
    )
  }
  return cap
}

/**
 * Last owner-ACCEPTED total-JS measurement per governed dashboard route, in gzip bytes.
 *
 * This exists solely to satisfy D20-24's "delta from its previous accepted baseline" reporting
 * requirement in the warning band. It is a REPORTING input, never a gate: nothing passes or fails
 * because of it, so it can never quietly become a second threshold.
 *
 * RE-MEASURED under the CORRECTED closure. The previous figures (250_011 / 223_553 / 302_582) were
 * produced by a seed that omitted the shell's layout and middleware maps, so they understated every
 * dashboard route — `/dashboard/messages` by 6,114 B gz. Leaving them here would have made the
 * correction itself look like a 6 KB regression, which is the opposite of what this map is for.
 * The measurement method changed; no threshold did.
 *
 * A route absent from this map is reported as having no previously accepted baseline rather than
 * being given a fabricated one.
 */
export const DASHBOARD_ACCEPTED_BASELINE_BYTES = {
  '/dashboard/login': 256_497,
  '/dashboard': 229_657,
  '/dashboard/messages': 308_718
}

/**
 * The dashboard total-JS verdict against the D20-24 QUALITY TARGET. Inclusive ("≤", exactly-at-target
 * passes).
 *
 * ⚠ TWO-VALUED SINCE D20-32, AND THE MISSING THIRD VALUE IS THE POINT. There is deliberately NO
 * `'FAIL'` return any more: D20-32 replaced the flat total-JS hard ceiling with the shared-floor +
 * incremental model, so a route TOTAL can no longer fail anything. Hard failure now comes from
 * `DASHBOARD_DELIVERY_BUDGET` (floor, incremental) and the frozen app-owned caps — three independent
 * guards, none of them a route total.
 *
 * Leaving a reachable `'FAIL'` here would have been worse than dead code: it would have kept a second,
 * contradictory ceiling alive in the one function that is supposed to be the single reading of this
 * policy. `WARN` still PASSES the gate and still obliges the six-part attribution block, which is what
 * keeps a route above the quality target from ever printing as an ordinary green result.
 *
 * @param {number} actualBytes gzip bytes for the route's closure
 * @returns {'PASS' | 'WARN'} WARN passes the gate, but obliges the attribution block
 */
export function dashboardTotalVerdict(actualBytes) {
  return actualBytes <= DASHBOARD_BUDGET.totalJsQualityTargetBytes ? 'PASS' : 'WARN'
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
