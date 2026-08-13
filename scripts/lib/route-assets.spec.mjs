import { describe, expect, it } from 'vitest'
import {
  APP_BASELINE_MAX_BYTES,
  BUDGET,
  DASHBOARD_ACCEPTED_BASELINE_BYTES,
  DASHBOARD_APP_OWNED_BASELINE_BYTES,
  DASHBOARD_APP_OWNED_CAP_BYTES,
  DASHBOARD_BUDGET,
  KB,
  approvedAppLimitBytes,
  attributeRenderedBytes,
  budgetVerdict,
  classifyModuleId,
  collectRouteAssets,
  assertGovernedRouteCoverage,
  dashboardAppCapFor,
  dashboardTotalVerdict,
  kb,
  vendorPackage
} from './route-assets.mjs'
import { DASHBOARD_ROUTES } from './dashboard-closure.mjs'

/**
 * These guard the ways a size gate can silently measure the WRONG set — every one of which is
 * invisible in the final number, which is why they are tested rather than eyeballed.
 */
describe('collectRouteAssets', () => {
  it('collects eagerly-fetched module scripts and modulepreloads', () => {
    const html = `
      <link rel="modulepreload" as="script" crossorigin href="/_nuxt/vendor.js">
      <script type="module" src="/_nuxt/entry.js"></script>
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/entry.js', '/_nuxt/vendor.js'])
  })

  // The regression that motivated attribute-aware parsing: `rel="prefetch"` is Nuxt's hint for
  // OTHER routes, fetched at idle. Counting it inflates every route's first-view budget.
  it('EXCLUDES rel=prefetch — those are other routes, not this route\'s first view', () => {
    const html = `
      <script type="module" src="/_nuxt/entry.js"></script>
      <link rel="prefetch" as="script" href="/_nuxt/some-other-route.js">
      <link rel="prerender" href="/_nuxt/nope.js">
      <link rel="dns-prefetch" href="/_nuxt/nope2.js">
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/entry.js'])
  })

  // The other regression: an unanchored `\.js` matches the prefix of `foo.js.map`, quietly folding
  // source maps into the budget.
  it('does not mistake a .js.map reference for JavaScript', () => {
    const html = '<link rel="modulepreload" href="/_nuxt/entry.js.map">'
    expect(collectRouteAssets(html, 'js')).toEqual([])
  })

  it('counts a URL referenced twice only once', () => {
    const html = `
      <link rel="modulepreload" href="/_nuxt/entry.js">
      <script type="module" src="/_nuxt/entry.js"></script>
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/entry.js'])
  })

  it('ignores non-local assets, including Cloudflare edge injection', () => {
    const html = `
      <script src="/cdn-cgi/scripts/x/cloudflare-static/email-decode.min.js"></script>
      <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"></script>
      <script type="module" src="https://cdn.example.com/_nuxt/remote.js"></script>
      <script type="module" src="/_nuxt/entry.js"></script>
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/entry.js'])
  })

  it('ignores inline scripts (no src) such as the SSR payload', () => {
    const html = '<script type="application/json" id="__NUXT_DATA__">{"a":"/_nuxt/decoy.js"}</script>'
    expect(collectRouteAssets(html, 'js')).toEqual([])
  })

  it('collects stylesheets for css and never mixes the two kinds', () => {
    const html = `
      <link rel="stylesheet" href="/_nuxt/entry.css">
      <script type="module" src="/_nuxt/entry.js"></script>
    `
    expect(collectRouteAssets(html, 'css')).toEqual(['/_nuxt/entry.css'])
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/entry.js'])
  })

  it('tolerates single quotes, unquoted values and attribute-order variation', () => {
    const html = `
      <link href='/_nuxt/a.js' rel='modulepreload'>
      <link rel=modulepreload href=/_nuxt/b.js>
      <script src="/_nuxt/c.js" type="module"></script>
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/a.js', '/_nuxt/b.js', '/_nuxt/c.js'])
  })

  it('strips query strings and fragments so one asset is not counted twice', () => {
    const html = `
      <link rel="modulepreload" href="/_nuxt/a.js?v=1">
      <script type="module" src="/_nuxt/a.js"></script>
    `
    expect(collectRouteAssets(html, 'js')).toEqual(['/_nuxt/a.js'])
  })

  it('returns a deterministic sorted order regardless of document order', () => {
    const a = '<script type="module" src="/_nuxt/z.js"></script><script type="module" src="/_nuxt/a.js"></script>'
    const b = '<script type="module" src="/_nuxt/a.js"></script><script type="module" src="/_nuxt/z.js"></script>'
    expect(collectRouteAssets(a, 'js')).toEqual(collectRouteAssets(b, 'js'))
    expect(collectRouteAssets(a, 'js')).toEqual(['/_nuxt/a.js', '/_nuxt/z.js'])
  })

  it('returns an empty list for HTML with no assets, so the caller can treat it as a failure', () => {
    expect(collectRouteAssets('<html><body>error</body></html>', 'js')).toEqual([])
  })
})

/**
 * The classification contract (doc 20 §5, D20-12). Under the superseded bounds-based verdict a
 * misclassified module only widened an interval; under the EXACT renderedLength budget it changes
 * the enforced number directly, so every rule — and every near-miss — is pinned here.
 */
describe('classifyModuleId — ordered allowlist (D20-12)', () => {
  it.each([
    ['node_modules/vue/dist/runtime.mjs'],
    ['/repo/node_modules/@nuxt/ui/dist/index.mjs'],
    ['/repo/node_modules/a/node_modules/b/index.js']
  ])('treats %s as vendor', (id) => {
    expect(classifyModuleId(id)).toBe('vendor')
  })

  it.each([
    ['app/composables/useSiteSettings.ts'],
    ['app/utils/format.ts'],
    ['app/stores/auth.ts'],
    ['app/middleware/preview-locale.ts']
  ])('treats srcDir source %s as app', (id) => {
    expect(classifyModuleId(id)).toBe('app')
  })

  // A Vue SFC yields SEVERAL Rollup modules. Each is a distinct module with distinct bytes, so all
  // of them must classify as app — and the sum must not be collapsed by stripping the query.
  it.each([
    ['app/components/layout/Header.vue'],
    ['app/components/layout/Header.vue?vue&type=script&setup=true&lang.ts'],
    ['app/pages/dashboard/login.vue?macro=true&vue&type=script&setup=true&lang.ts']
  ])('treats SFC output and its query variants %s as app', (id) => {
    expect(classifyModuleId(id)).toBe('app')
  })

  it('treats project-authored locale content as app even though i18n/ sits outside srcDir', () => {
    expect(classifyModuleId('i18n/locales/ar.json')).toBe('app')
    expect(classifyModuleId('i18n/locales/en.json')).toBe('app')
  })

  // Generated glue is reported separately rather than folded into whichever side flatters the
  // number — classification by convenience is exactly what the budget interpretation must avoid.
  it.each([
    ['\0virtual:nuxt:/repo/.nuxt/entry.js'],
    ['\0vite/preload-helper.js'],
    ['virtual:nuxt:plugins'],
    ['#build/components'],
    ['.nuxt/components.plugin.mjs'],
    ['/repo/.nuxt/dist/client/entry.js']
  ])('treats generated glue %s as generated', (id) => {
    expect(classifyModuleId(id)).toBe('generated')
  })

  // THE ORDERING RULE. Virtual ids routinely embed a srcDir path; matching `app/` first would
  // hand framework glue to the project's budget.
  it.each([
    ['\0virtual:nuxt:/repo/app/router.options.js'],
    ['virtual:nuxt:/repo/app/app.config.ts'],
    ['/repo/.nuxt/app/entry.js']
  ])('classifies %s as generated even though it embeds a srcDir path', (id) => {
    expect(classifyModuleId(id)).toBe('generated')
  })

  // Vite extracts CSS to a real asset governed by the separate CSS budget; the JS-graph entry is a
  // zero-byte stub. Counting it as app would double-govern CSS.
  it.each([
    ['app/assets/css/main.css'],
    ['app/components/Thing.vue?vue&type=style&index=0&lang.css'],
    ['app/assets/css/x.scss']
  ])('treats CSS wrapper %s as generated', (id) => {
    expect(classifyModuleId(id)).toBe('generated')
  })

  // Nothing becomes app by falling through — this is the rule that keeps the metric exact as the
  // build evolves. `config/**` is build-time only and verified absent from every client chunk.
  it.each([
    ['config/site-url.ts'],
    ['config/bundle-analysis.ts'],
    ['server/api/prose.post.ts'],
    ['some/unknown/shape.js']
  ])('treats %s as unclassified — never app by fallthrough', (id) => {
    expect(classifyModuleId(id)).toBe('unclassified')
  })

  // Substring false positives: a prefix match on `app` would sweep unrelated directories into the
  // budget. The rule is an exact path SEGMENT.
  it.each([
    ['application/legacy.ts'],
    ['apps/other/index.ts'],
    ['vendor/app-shim.ts'],
    ['packages/app/index.ts'],
    ['i18n/locales-backup/en.json']
  ])('does not treat lookalike path %s as app', (id) => {
    expect(classifyModuleId(id)).toBe('unclassified')
  })

  it('resolves the srcDir root itself, but not a traversal that escapes it', () => {
    expect(classifyModuleId('app')).toBe('app')
    expect(classifyModuleId('app/x.ts')).toBe('app')
    expect(classifyModuleId('../app/x.ts')).toBe('unclassified')
    expect(classifyModuleId('/abs/app/x.ts')).toBe('unclassified')
  })

  it('normalises Windows separators before classifying', () => {
    expect(classifyModuleId('app\\components\\layout\\Header.vue')).toBe('app')
    expect(classifyModuleId('C:\\repo\\node_modules\\vue\\index.js')).toBe('vendor')
    expect(classifyModuleId('i18n\\locales\\ar.json')).toBe('app')
  })

  it('normalises file:// URLs and percent-encoding', () => {
    expect(classifyModuleId('file://app/pages/index.vue')).toBe('app')
    expect(classifyModuleId('app/components/My%20Component.vue')).toBe('app')
    expect(classifyModuleId('file://app/components/My%20Component.vue?vue&type=script')).toBe('app')
    // A lone `%` is not valid percent-encoding; classification must still resolve, not throw.
    expect(() => classifyModuleId('app/weird%.ts')).not.toThrow()
    expect(classifyModuleId('app/weird%.ts')).toBe('app')
  })

  // The analysis plugin relativises ids under the repo root, so a resolved/symlinked path that
  // lands OUTSIDE the root stays absolute — and must not be guessed into the app budget.
  it('does not classify a resolved path outside the repo root as app', () => {
    expect(classifyModuleId('/elsewhere/linked-pkg/app/index.ts')).toBe('unclassified')
    expect(classifyModuleId('/elsewhere/linked-pkg/node_modules/vue/index.js')).toBe('vendor')
  })
})

describe('vendorPackage', () => {
  it.each([
    ['/repo/node_modules/vue/dist/vue.mjs', 'vue'],
    ['/repo/node_modules/@nuxt/ui/dist/index.mjs', '@nuxt/ui'],
    ['/repo/node_modules/@intlify/message-compiler/dist/x.mjs', '@intlify/message-compiler'],
    ['/repo/node_modules/a/node_modules/@scope/b/i.js', '@scope/b']
  ])('resolves %s to %s', (id, expected) => {
    expect(vendorPackage(id)).toBe(expected)
  })

  it('returns null for project-owned ids', () => {
    expect(vendorPackage('app/pages/index.vue')).toBeNull()
  })
})

describe('kb', () => {
  it('formats to one decimal for stable column alignment', () => {
    expect(kb(1024)).toBe('1.0 KB')
    expect(kb(1536)).toBe('1.5 KB')
    expect(kb(0)).toBe('0.0 KB')
  })
})


describe('budgetVerdict — threshold boundaries', () => {
  const BUDGET = 250 * KB

  // doc 20 §1 writes "≤", so the budget is INCLUSIVE: exactly-at-budget must pass. Getting this
  // backwards silently fails a compliant build (or passes a one-byte breach).
  it.each([
    ['one byte below', BUDGET - 1, 'PASS'],
    ['exactly at the budget', BUDGET, 'PASS'],
    ['one byte above', BUDGET + 1, 'FAIL']
  ])('%s → %s', (_label, bytes, expected) => {
    expect(budgetVerdict(bytes, BUDGET)).toBe(expected)
  })

  it('uses 1024-based KB, matching doc 20 §1 and size-limit thresholds', () => {
    expect(KB).toBe(1024)
    expect(250 * KB).toBe(256_000)
    // 250 decimal kB would be 250_000 — a 6 KB difference, hence the documented convention.
    expect(budgetVerdict(250_000, 250 * KB)).toBe('PASS')
  })

  it('formats using the same 1024 base it compares with', () => {
    expect(kb(250 * KB)).toBe('250.0 KB')
  })
})

/** Builds a metadata map of the shape `attributeRenderedBytes` consumes. */
function meta(chunks) {
  return new Map(Object.entries(chunks).map(([file, modules]) => [
    file,
    { modules: modules.map(([id, renderedLength]) => ({ id, renderedLength })) }
  ]))
}

describe('attributeRenderedBytes — exact, never estimated (D20-12)', () => {
  // THE POINT OF THE WHOLE CHANGE: a chunk mixing app and vendor modules used to make the budget
  // unprovable, because gzip cannot be divided per module inside one stream. renderedLength can.
  it('measures a MIXED chunk exactly, with no proportional split anywhere', () => {
    const m = meta({
      '/_nuxt/entry.js': [
        ['app/pages/index.vue?vue&type=script&setup=true&lang.ts', 4754],
        ['node_modules/vue/dist/runtime.mjs', 189_400],
        ['\0vite/preload-helper.js', 3303]
      ]
    })
    const { totals } = attributeRenderedBytes(['/_nuxt/entry.js'], m)
    expect(totals).toEqual({ app: 4754, vendor: 189_400, generated: 3303, unclassified: 0 })
  })

  it('counts a SHARED chunk in full for every route that downloads it', () => {
    const m = meta({
      '/_nuxt/shared.js': [['app/components/layout/Header.vue', 7978]],
      '/_nuxt/home.js': [['app/pages/index.vue', 4754]],
      '/_nuxt/blog.js': [['app/pages/blog/index.vue', 2000]]
    })
    // The route pays for the whole chunk regardless of who else uses it.
    expect(attributeRenderedBytes(['/_nuxt/shared.js', '/_nuxt/home.js'], m).totals.app).toBe(12_732)
    expect(attributeRenderedBytes(['/_nuxt/shared.js', '/_nuxt/blog.js'], m).totals.app).toBe(9978)
  })

  it('charges a duplicated module id once per route, but REPORTS the duplication', () => {
    const m = meta({
      '/_nuxt/a.js': [['app/utils/format.ts', 500]],
      '/_nuxt/b.js': [['app/utils/format.ts', 500], ['app/utils/api-error.ts', 300]]
    })
    const result = attributeRenderedBytes(['/_nuxt/a.js', '/_nuxt/b.js'], m)
    expect(result.totals.app).toBe(800)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0].id).toBe('app/utils/format.ts')
  })

  it('keeps SFC query variants distinct — collapsing them would undercount', () => {
    const m = meta({
      '/_nuxt/a.js': [
        ['app/components/layout/Header.vue', 120],
        ['app/components/layout/Header.vue?vue&type=script&setup=true&lang.ts', 7978]
      ]
    })
    const result = attributeRenderedBytes(['/_nuxt/a.js'], m)
    expect(result.totals.app).toBe(8098)
    expect(result.duplicates).toHaveLength(0)
  })

  it('excludes chunks the route does not reference (dynamic, dashboard-only, locale)', () => {
    const m = meta({
      '/_nuxt/home.js': [['app/pages/index.vue', 4754]],
      '/_nuxt/dashboard.js': [['app/pages/dashboard/index.vue', 50_000]],
      '/_nuxt/locale-en.js': [['i18n/locales/en.json', 10_407]]
    })
    // Only what this route initially references is measured — that is the whole per-route premise.
    expect(attributeRenderedBytes(['/_nuxt/home.js'], m).totals.app).toBe(4754)
  })

  it('counts a dashboard chunk only when a public route actually references it', () => {
    const m = meta({ '/_nuxt/dashboard.js': [['app/pages/dashboard/index.vue', 50_000]] })
    expect(attributeRenderedBytes(['/_nuxt/dashboard.js'], m).totals.app).toBe(50_000)
  })

  it('handles zero-length modules without inventing or losing bytes', () => {
    const m = meta({
      '/_nuxt/a.js': [['app/assets/css/main.css', 0], ['app/utils/format.ts', 0], ['app/x.ts', 10]]
    })
    const result = attributeRenderedBytes(['/_nuxt/a.js'], m)
    expect(result.totals.app).toBe(10)
    expect(result.totals.generated).toBe(0)
  })

  it('surfaces unclassified modules with bytes, and does not fold them into app', () => {
    const m = meta({ '/_nuxt/a.js': [['app/x.ts', 100], ['some/unknown/shape.js', 42]] })
    const result = attributeRenderedBytes(['/_nuxt/a.js'], m)
    expect(result.totals.app).toBe(100)
    expect(result.totals.unclassified).toBe(42)
    expect(result.unclassifiedModules).toEqual([{ id: 'some/unknown/shape.js', bytes: 42 }])
  })

  it('does not flag a ZERO-byte unclassified module — it cannot affect the budget', () => {
    const m = meta({ '/_nuxt/a.js': [['some/unknown/shape.js', 0]] })
    expect(attributeRenderedBytes(['/_nuxt/a.js'], m).unclassifiedModules).toEqual([])
  })

  it('throws for an asset with no provenance record rather than assuming a category', () => {
    expect(() => attributeRenderedBytes(['/_nuxt/ghost.js'], meta({}))).toThrow(/no Rollup provenance/)
  })

  it('ranks app modules largest-first so a failure report is actionable', () => {
    const m = meta({ '/_nuxt/a.js': [['app/small.ts', 10], ['app/big.ts', 900], ['app/mid.ts', 100]] })
    expect(attributeRenderedBytes(['/_nuxt/a.js'], m).appModules.map(x => x.id))
      .toEqual(['app/big.ts', 'app/mid.ts', 'app/small.ts'])
  })
})

describe('the frozen app-owned limit (D20-12)', () => {
  // The limit is a CONSTANT derived once from Web 138cef5 and never recomputed from a build. This
  // test is what makes changing it a deliberate act rather than a drifting side effect.
  it('is exactly 101 KiB = 103,424 bytes', () => {
    expect(BUDGET.appRenderedBytes).toBe(103_424)
    expect(BUDGET.appRenderedBytes).toBe(101 * KB)
  })

  it('matches the approved formula applied to the recorded baseline', () => {
    expect(APP_BASELINE_MAX_BYTES).toBe(89_201)
    expect(approvedAppLimitBytes(APP_BASELINE_MAX_BYTES)).toBe(BUDGET.appRenderedBytes)
  })

  // `baselineMax * 1.15` carries float residue (89201 * 1.15 === 102581.15000000001), which would
  // push an exact-KiB result up a whole KiB. The integer path is required, not stylistic.
  it('retains an exact KiB boundary instead of rounding past it', () => {
    const exact = (100 * KB * 100) / 115 // a baseline whose +15 % lands exactly on 100 KiB
    expect(approvedAppLimitBytes(exact)).toBe(100 * KB)
    expect(approvedAppLimitBytes(0)).toBe(0)
  })

  it('rounds a fractional KiB result upward', () => {
    expect(approvedAppLimitBytes(1)).toBe(KB)
    expect(approvedAppLimitBytes(89_201)).toBe(101 * KB) // 102581.15 B → 101 KiB
  })

  it('leaves the other two budgets at their documented, unchanged values', () => {
    expect(BUDGET.totalJsBytes).toBe(250 * KB)
    expect(BUDGET.cssBytes).toBe(30 * KB)
  })
})

describe('app-owned budget boundaries — inclusive, exact bytes', () => {
  const LIMIT = BUDGET.appRenderedBytes

  it.each([
    ['one byte below the limit', LIMIT - 1, 'PASS'],
    ['exactly at the limit', LIMIT, 'PASS'],
    ['one byte above the limit', LIMIT + 1, 'FAIL']
  ])('%s → %s', (_label, bytes, expected) => {
    expect(budgetVerdict(bytes, LIMIT)).toBe(expected)
  })

  it('passes the recorded 138cef5 worst route with the approved headroom', () => {
    expect(budgetVerdict(APP_BASELINE_MAX_BYTES, LIMIT)).toBe('PASS')
    expect(LIMIT - APP_BASELINE_MAX_BYTES).toBe(14_223)
  })
})

/**
 * The D20-24 two-tier dashboard ceiling.
 *
 * These bands are the reason the ceiling could be raised at all, and the WARN band is the one that
 * will not execute on a normal green run — `/dashboard/messages` sits at 295.5 KB gz, below the
 * 300 KB target — so without these tests the warning path would ship unexercised and be reported as
 * green. Every boundary is asserted on the exact byte, because "≤" is the whole contract.
 */
describe('dashboardTotalVerdict — doc 20 §1.1 two-tier ceiling (D20-24)', () => {
  const TARGET = DASHBOARD_BUDGET.totalJsQualityTargetBytes
  const CEILING = DASHBOARD_BUDGET.totalJsCeilingBytes

  it('pins both documented tiers', () => {
    expect(TARGET).toBe(300 * KB)
    expect(CEILING).toBe(320 * KB)
  })

  it('no longer exposes a single-value total budget that a caller could read as the ceiling', () => {
    // A lone `totalJsBytes` on a two-tier policy is how a caller silently enforces the wrong tier.
    expect(DASHBOARD_BUDGET.totalJsBytes).toBeUndefined()
  })

  it.each([
    ['far below the quality target', 1, 'PASS'],
    ['one byte below the quality target', TARGET - 1, 'PASS'],
    ['exactly at the quality target', TARGET, 'PASS'],
    ['one byte above the quality target', TARGET + 1, 'WARN'],
    ['mid-warning band', TARGET + (CEILING - TARGET) / 2, 'WARN'],
    ['one byte below the hard ceiling', CEILING - 1, 'WARN'],
    ['exactly at the hard ceiling', CEILING, 'WARN'],
    ['one byte above the hard ceiling', CEILING + 1, 'FAIL'],
    ['far above the hard ceiling', CEILING * 2, 'FAIL']
  ])('%s → %s', (_label, bytes, expected) => {
    expect(dashboardTotalVerdict(bytes)).toBe(expected)
  })

  it('treats the warning band as passing, not as a breach', () => {
    // The distinction the exit-code contract depends on: WARN must never reach the breach path.
    expect(dashboardTotalVerdict(TARGET + 1)).not.toBe('FAIL')
    expect(dashboardTotalVerdict(CEILING)).not.toBe('FAIL')
  })

  it('keeps the CSS limit unchanged — D20-24 moved only the total ceiling', () => {
    expect(DASHBOARD_BUDGET.cssBytes).toBe(BUDGET.cssBytes)
    expect(DASHBOARD_BUDGET.cssBytes).toBe(30 * KB)
  })

  it('no longer carries a class-wide app-owned budget — D20-29 made it per route', () => {
    // Superseded assertion: this used to require DASHBOARD_BUDGET.appRenderedBytes === 101 KiB for
    // the whole class. D20-29 replaced that single number with a frozen cap per governed route, so
    // the key is deliberately absent and callers must go through dashboardAppCapFor(route).
    // The PUBLIC app-owned budget is untouched and stays one frozen number for all public routes.
    expect(DASHBOARD_BUDGET.appRenderedBytes).toBeUndefined()
    expect(BUDGET.appRenderedBytes).toBe(101 * KB)
  })

  it('does not disturb the public total budget', () => {
    // D20-24 changes a dashboard number only. A public regression here is the failure that would
    // matter most and is the easiest to introduce by editing the shared module.
    expect(BUDGET.totalJsBytes).toBe(250 * KB)
  })

  it('classifies the measured routes under the CORRECTED closure', () => {
    expect(dashboardTotalVerdict(256_497)).toBe('PASS') // /dashboard/login   250.5 KB gz
    expect(dashboardTotalVerdict(229_657)).toBe('PASS') // /dashboard         224.3 KB gz
    // The correction moved this route from an unqualified pass into the governed warning band.
    // It still PASSES the gate; it may no longer be reported as if it were under the target.
    expect(dashboardTotalVerdict(308_718)).toBe('WARN') // /dashboard/messages 301.5 KB gz
  })

  it('would have warned, not blocked, had the zod/mini variant shipped', () => {
    // ≈290.3 KB gz — under the new target, and the measurement that showed the old 280 KB ceiling
    // could not have been met by that substitution either.
    expect(dashboardTotalVerdict(Math.round(290.3 * KB))).toBe('PASS')
  })
})

describe('DASHBOARD_ACCEPTED_BASELINE_BYTES — reporting input, never a gate', () => {
  it('records the accepted baselines re-measured under the corrected closure', () => {
    expect(DASHBOARD_ACCEPTED_BASELINE_BYTES['/dashboard/login']).toBe(256_497)
    expect(DASHBOARD_ACCEPTED_BASELINE_BYTES['/dashboard']).toBe(229_657)
    expect(DASHBOARD_ACCEPTED_BASELINE_BYTES['/dashboard/messages']).toBe(308_718)
  })

  it('every recorded baseline is itself within the hard ceiling', () => {
    // A baseline above the ceiling would mean an accepted-but-blocking figure was recorded.
    for (const bytes of Object.values(DASHBOARD_ACCEPTED_BASELINE_BYTES)) {
      expect(dashboardTotalVerdict(bytes)).not.toBe('FAIL')
    }
  })

  it('has no entry for an unmeasured route, so an absent baseline stays absent', () => {
    // The warning block must report "no accepted baseline" rather than invent one — an invented
    // baseline makes a real regression look like a first measurement.
    expect(DASHBOARD_ACCEPTED_BASELINE_BYTES['/dashboard/settings']).toBeUndefined()
  })
})

/**
 * D20-29 — per-route FROZEN app-owned caps for the dashboard.
 *
 * The point of these is not that the numbers are large enough; it is that they are FIXED, that
 * every governed route has exactly one, and that the gate cannot invent, drift from, or silently
 * drop one. Each of those failures is invisible in a green exit code.
 */
describe('dashboard app-owned caps — frozen, per route (D20-29)', () => {
  const D20_23_ROUTES = ['/dashboard/login', '/dashboard', '/dashboard/messages']
  const D20_29_ROUTES = [
    '/dashboard/media',
    '/dashboard/profile',
    '/dashboard/projects',
    '/dashboard/projects/new',
    '/dashboard/projects/00000000-0000-0000-0000-000000000000'
  ]

  it('governs exactly the eight routes doc 20 §1.1 names — no more, no fewer', () => {
    expect(Object.keys(DASHBOARD_APP_OWNED_CAP_BYTES).sort())
      .toEqual([...D20_23_ROUTES, ...D20_29_ROUTES].sort())
  })

  it('pins every cap to the exact byte value doc 20 §1.1 publishes', () => {
    // Written as literals on purpose: a cap computed here from the same helper the source uses
    // would pass no matter what either side drifted to.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES).toEqual({
      '/dashboard/login': 103_424,
      '/dashboard': 103_424,
      '/dashboard/messages': 103_424,
      '/dashboard/media': 110_592,
      '/dashboard/profile': 123_904,
      '/dashboard/projects': 109_568,
      '/dashboard/projects/new': 175_104,
      '/dashboard/projects/00000000-0000-0000-0000-000000000000': 176_128
    })
  })

  it('derives each D20-29 cap from its recorded baseline by D20-12 methodology', () => {
    for (const route of D20_29_ROUTES) {
      const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES[route]
      expect(baseline, `${route} must record the baseline its cap was derived from`).toBeTypeOf('number')
      expect(approvedAppLimitBytes(baseline), `${route} cap must equal ceil((baseline x 1.15)/KiB) x KiB`)
        .toBe(DASHBOARD_APP_OWNED_CAP_BYTES[route])
    }
  })

  it('does NOT re-derive the three D20-23 routes — D20-29 never raises an existing cap', () => {
    for (const route of D20_23_ROUTES) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route]).toBe(101 * KB)
      expect(DASHBOARD_APP_OWNED_BASELINE_BYTES[route]).toBeUndefined()
    }
    // The specific trap: the formula would RAISE /dashboard/messages, so a future "consistency"
    // fix that re-derives all eight would quietly loosen a governed budget.
    expect(approvedAppLimitBytes(92_442)).toBe(106_496)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/messages']).toBeLessThan(106_496)
  })

  it('exposes no single class-wide app-owned budget for a caller to read by mistake', () => {
    expect(DASHBOARD_BUDGET.appRenderedBytes).toBeUndefined()
  })

  it('these are absolute caps, not accepted baselines — the two maps are unrelated', () => {
    // DASHBOARD_ACCEPTED_BASELINE_BYTES is a D20-24 REPORTING input and must never be a threshold.
    for (const route of Object.keys(DASHBOARD_ACCEPTED_BASELINE_BYTES)) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route]).not.toBe(DASHBOARD_ACCEPTED_BASELINE_BYTES[route])
    }
  })

  describe('dashboardAppCapFor', () => {
    it('returns the frozen cap for each governed route', () => {
      for (const [route, cap] of Object.entries(DASHBOARD_APP_OWNED_CAP_BYTES)) {
        expect(dashboardAppCapFor(route)).toBe(cap)
      }
    })

    it('THROWS for an ungoverned route rather than defaulting to a number nobody decided', () => {
      expect(() => dashboardAppCapFor('/dashboard/analytics')).toThrow(/no frozen app-owned cap/)
    })

    it('does not fall back to the public budget for an unknown route', () => {
      // The tempting default. It would let a new dashboard route ship measured-but-ungoverned.
      expect(() => dashboardAppCapFor('/dashboard/unknown')).toThrow()
    })
  })

  describe('budgetVerdict against a per-route cap', () => {
    it('passes exactly AT the cap and fails one byte over it', () => {
      const cap = DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/projects/new']
      expect(budgetVerdict(cap, cap)).toBe('PASS')
      expect(budgetVerdict(cap + 1, cap)).toBe('FAIL')
    })

    it("charges a route against ITS OWN cap, not the widest one", () => {
      // /dashboard/profile at the projects/new size must FAIL; a shared ceiling would pass it.
      const profileCap = DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/profile']
      const projectsNew = DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/projects/new']
      expect(projectsNew).toBeGreaterThan(profileCap)
      expect(budgetVerdict(projectsNew, profileCap)).toBe('FAIL')
    })
  })
})

describe('assertGovernedRouteCoverage — both directions (D20-29)', () => {
  const CAPS = { '/a': 1024, '/b': 2048 }

  it('passes when the measured set and the governed set match exactly', () => {
    expect(() => assertGovernedRouteCoverage(['/a', '/b'], CAPS)).not.toThrow()
  })

  it('is order-independent', () => {
    expect(() => assertGovernedRouteCoverage(['/b', '/a'], CAPS)).not.toThrow()
  })

  it('FAILS when a measured route has no governed cap', () => {
    expect(() => assertGovernedRouteCoverage(['/a', '/b', '/c'], CAPS))
      .toThrow(/measured but NOT governed.*\/c/s)
  })

  it('FAILS when a governed route is silently dropped from measurement', () => {
    // The direction a one-way check misses: the cap still exists, the route just stops being
    // measured, and without this the gate exits 0 while the budget stops applying.
    expect(() => assertGovernedRouteCoverage(['/a'], CAPS))
      .toThrow(/governed but NOT measured.*\/b/s)
  })

  it('reports BOTH divergences at once rather than only the first', () => {
    let message = ''
    try {
      assertGovernedRouteCoverage(['/a', '/c'], CAPS)
    } catch (error) {
      message = error.message
    }
    expect(message).toMatch(/measured but NOT governed/)
    expect(message).toMatch(/governed but NOT measured/)
  })

  it('the REAL gate inventory matches the REAL governed caps, both ways', () => {
    // The assertion that actually protects production: the routes the gate MEASURES
    // (DASHBOARD_ROUTES) against the routes doc 20 GOVERNS. Comparing the cap map to itself would
    // be trivially true and would protect nothing.
    const measured = DASHBOARD_ROUTES.map(r => r.route)
    expect(measured).toHaveLength(8)
    expect(() => assertGovernedRouteCoverage(measured)).not.toThrow()
  })

  it('detects a route added to the gate without a doc 20 cap', () => {
    const measured = [...DASHBOARD_ROUTES.map(r => r.route), '/dashboard/analytics']
    expect(() => assertGovernedRouteCoverage(measured)).toThrow(/measured but NOT governed/)
  })
})
