import { describe, expect, it } from 'vitest'
import {
  APP_BASELINE_MAX_BYTES,
  BUDGET,
  DASHBOARD_ACCEPTED_BASELINE_BYTES,
  DASHBOARD_APP_OWNED_BASELINE_BYTES,
  DASHBOARD_APP_OWNED_BASELINE_PROVENANCE,
  DASHBOARD_APP_OWNED_CAP_BYTES,
  DASHBOARD_BUDGET,
  KB,
  approvedAppLimitBytes,
  attributeRenderedBytes,
  budgetVerdict,
  classifyFloorDelta,
  FLOOR_ENVIRONMENT_VARIANCE_BYTES,
  classifyModuleId,
  collectRouteAssets,
  assertGovernedRouteCoverage,
  dashboardAppCapFor,
  dashboardTotalVerdict,
  kb,
  vendorPackage,
  PUBLIC_DELIVERY_BUDGET,
  PUBLIC_ROUTE_TIERS,
  FLOOR_REFERENCE_ROUTES,
  publicTierFor,
  assertPublicTierCoverage,
  resolveSharedFloor,
  DASHBOARD_DELIVERY_BUDGET,
  DASHBOARD_FLOOR_REFERENCE_ROUTES,
  resolveDashboardSharedFloor
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

  it('leaves the other budgets at their documented, unchanged values', () => {
    // `totalJsBytes` is deliberately GONE (D20-31): a per-route total re-charged shared framework
    // growth to every page. Public total delivery is now floor + per-tier increment.
    expect(BUDGET.totalJsBytes).toBeUndefined()
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
 * The D20-24 dashboard QUALITY TARGET — now the only threshold a dashboard route TOTAL is compared
 * against (D20-32 replaced the flat hard ceiling with the shared-floor + incremental model).
 *
 * The WARN band will not execute on a green run for most routes, so without these tests the warning
 * path would ship unexercised and be reported as green. Every boundary is asserted on the exact byte,
 * because "≤" is the whole contract.
 */
describe('dashboardTotalVerdict — doc 20 §1.1 quality target (D20-24, ceiling removed by D20-32)', () => {
  const TARGET = DASHBOARD_BUDGET.totalJsQualityTargetBytes

  it('pins the documented quality target', () => {
    expect(TARGET).toBe(300 * KB)
  })

  it('no longer exposes a single-value total budget that a caller could read as the ceiling', () => {
    // A lone `totalJsBytes` on a two-tier policy is how a caller silently enforces the wrong tier.
    expect(DASHBOARD_BUDGET.totalJsBytes).toBeUndefined()
  })

  it('no longer exposes a flat total-JS hard ceiling at all (D20-32)', () => {
    // The whole point of D20-32: a dashboard route TOTAL does not gate any more. Leaving this key in
    // place — even unused — would keep a second, contradictory ceiling alive for the next reader.
    expect(DASHBOARD_BUDGET.totalJsCeilingBytes).toBeUndefined()
  })

  it.each([
    ['far below the quality target', 1, 'PASS'],
    ['one byte below the quality target', TARGET - 1, 'PASS'],
    ['exactly at the quality target', TARGET, 'PASS'],
    ['one byte above the quality target', TARGET + 1, 'WARN'],
    ['well above the old 320 KB ceiling', 320 * KB + 1, 'WARN'],
    ['at the measured /dashboard/messages figure', 337_460, 'WARN'],
    ['absurdly high', TARGET * 4, 'WARN']
  ])('%s → %s', (_label, bytes, expected) => {
    expect(dashboardTotalVerdict(bytes)).toBe(expected)
  })

  it('can NEVER return FAIL — the route total no longer gates (D20-32)', () => {
    // Guards the exact regression that would silently restore the flat ceiling: a `FAIL` here would
    // reach the breach path in check-route-size.mjs and re-block a route the new model passes.
    for (const bytes of [1, TARGET, TARGET + 1, 320 * KB, 320 * KB + 1, 337_460, 10 * 1024 * KB]) {
      expect(dashboardTotalVerdict(bytes)).not.toBe('FAIL')
      expect(['PASS', 'WARN']).toContain(dashboardTotalVerdict(bytes))
    }
  })

  it('treats the warning band as passing, not as a breach', () => {
    // The distinction the exit-code contract depends on: WARN must never reach the breach path.
    expect(dashboardTotalVerdict(TARGET + 1)).not.toBe('FAIL')
    expect(dashboardTotalVerdict(320 * KB)).not.toBe('FAIL')
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

  it('does not disturb the public delivery budget', () => {
    // D20-24 changes a dashboard number only. A public regression here is the failure that would
    // matter most and is the easiest to introduce by editing the shared module.
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorBytes).toBe(257 * KB)
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes.content).toBe(7 * KB)
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes.collection).toBe(12 * KB)
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes['interactive-subsystem']).toBe(18 * KB)
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

  /**
   * D20-33's routes, ALL derived from their own measured baselines.
   *
   * The two editor routes were first registered at the collection's 100 KiB, inherited before the
   * editor surface existed. The amendment of 2026-08-18 derives them from their own baselines once
   * measured, which is why this class no longer has an "inherited, no baseline" member — the
   * provenance changed, so the assertion changed with it rather than being left to describe a state
   * that no longer holds.
   */
  const D20_33_ROUTES = [
    '/dashboard/articles',
    '/dashboard/articles/new',
    '/dashboard/articles/00000000-0000-0000-0000-000000000000'
  ]

  /**
   * D20-34 (2026-08-18) — FE-3 module 1's collection, and ONLY the collection.
   *
   * The editor routes are deliberately absent: they are measured and escalated when `M1·U3` creates
   * them. Registering them here at this cap would repeat exactly what the D20-33 amendment had to
   * correct — two editor routes carrying a collection's inherited number before the editor existed.
   */
  const D20_34_ROUTES = ['/dashboard/experiences']

  /**
   * D20-35 (2026-08-18) — the Experiences EDITOR routes, measured then escalated as one batched
   * decision, exactly as D20-34's standing instruction required.
   */
  const D20_35_ROUTES = [
    '/dashboard/experiences/new',
    '/dashboard/experiences/00000000-0000-0000-0000-000000000000'
  ]

  /**
   * D20-36 (2026-08-22) — FE-3 module 2's THREE Skills routes, measured then escalated as ONE
   * batched decision on the completed integrated tree. This is why M2·U2 left the collection
   * deliberately ungoverned instead of inheriting a sibling's number.
   */
  const D20_36_ROUTES = [
    '/dashboard/skills',
    '/dashboard/skills/new',
    '/dashboard/skills/00000000-0000-0000-0000-000000000000'
  ]

  /**
   * D20-37 (2026-08-22) — FE-3 module 3's Testimonials COLLECTION, registered after measurement
   * exactly as D20-34 did for Experiences: measured first, then governed from its OWN baseline. Its
   * editor routes are deliberately absent until they exist and are measured (D20-35's precedent).
   */
  const D20_37_ROUTES = ['/dashboard/testimonials']

  it('governs exactly the eighteen routes doc 20 §1.1 names — no more, no fewer', () => {
    expect(Object.keys(DASHBOARD_APP_OWNED_CAP_BYTES).sort())
      .toEqual([...D20_23_ROUTES, ...D20_29_ROUTES, ...D20_33_ROUTES, ...D20_34_ROUTES, ...D20_35_ROUTES, ...D20_36_ROUTES, ...D20_37_ROUTES].sort())
  })

  it('derives the D20-37 cap from its OWN recorded baseline, not from a sibling', () => {
    for (const route of D20_37_ROUTES) {
      const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES[route]
      expect(baseline, `${route} must record the baseline its cap was derived from`).toBeTypeOf('number')
      expect(approvedAppLimitBytes(baseline), `${route} cap must equal ceil((baseline x 1.15)/KiB) x KiB`)
        .toBe(DASHBOARD_APP_OWNED_CAP_BYTES[route])
    }
    // The owner's exact numbers, pinned so a later "tidy" cannot drift them silently.
    expect(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/testimonials']).toBe(86_069)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/testimonials']).toBe(99_328)
  })

  it('records the D20-37 equality with the Experiences collection cap as COINCIDENCE, not inheritance', () => {
    // The two caps are numerically equal because the two BASELINES are close (86,069 vs 85,551 B)
    // and the formula is frozen — not because one number was copied. The derivation assertion above
    // is what makes that true; this pins the baselines' independence so a later edit cannot quietly
    // turn coincidence into coupling.
    const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/testimonials']
    const experiences = DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/experiences']
    expect(baseline).not.toBe(experiences)
    expect(approvedAppLimitBytes(baseline)).toBe(approvedAppLimitBytes(experiences))
  })

  it('derives every D20-36 cap from its OWN recorded baseline, not from a sibling', () => {
    for (const route of D20_36_ROUTES) {
      const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES[route]
      expect(baseline, `${route} must record the baseline its cap was derived from`).toBeTypeOf('number')
      expect(approvedAppLimitBytes(baseline), `${route} cap must equal ceil((baseline x 1.15)/KiB) x KiB`)
        .toBe(DASHBOARD_APP_OWNED_CAP_BYTES[route])
    }
    // The owner's exact numbers, pinned so a later "tidy" cannot drift them silently.
    expect(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/skills']).toBe(83_997)
    expect(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/skills/new']).toBe(96_571)
    expect(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/skills/00000000-0000-0000-0000-000000000000']).toBe(96_679)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/skills']).toBe(97_280)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/skills/new']).toBe(111_616)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/skills/00000000-0000-0000-0000-000000000000']).toBe(111_616)
  })

  it('keeps the Skills routes on their OWN caps, not rounded toward a sibling module', () => {
    // The discriminating half of the decision: the owner declined consistency-rounding, so edits
    // that "tidied" these to any Articles/Experiences/Projects number would be budget changes made
    // without a decision.
    for (const route of D20_36_ROUTES) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .not.toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new'])
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .not.toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences/new'])
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .not.toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/projects/new'])
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .toBeLessThan(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new'])
    }
    // And above the collection they were forbidden to inherit — an editor is a heavier surface.
    for (const route of D20_36_ROUTES.slice(1)) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .toBeGreaterThan(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/skills'])
    }
  })

  it('derives every D20-35 cap from its OWN recorded baseline, not from a sibling', () => {
    for (const route of D20_35_ROUTES) {
      const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES[route]
      expect(baseline, `${route} must record the baseline its cap was derived from`).toBeTypeOf('number')
      expect(approvedAppLimitBytes(baseline), `${route} cap must equal ceil((baseline x 1.15)/KiB) x KiB`)
        .toBe(DASHBOARD_APP_OWNED_CAP_BYTES[route])
    }
    // The owner's exact numbers, pinned so a later "tidy" cannot drift them silently.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences/new']).toBe(120_832)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences/00000000-0000-0000-0000-000000000000'])
      .toBe(121_856)
  })

  it('keeps the Experiences editors on their OWN caps, not rounded up to the Articles editor', () => {
    // The discriminating half of the decision: the owner declined consistency-rounding, so an edit
    // that "tidied" these to 122,880 B would be a budget change made without a decision.
    for (const route of D20_35_ROUTES) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .not.toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new'])
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .toBeLessThan(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new'])
    }
    // And above the collection they were forbidden to inherit — an editor is a heavier surface.
    for (const route of D20_35_ROUTES) {
      expect(DASHBOARD_APP_OWNED_CAP_BYTES[route])
        .toBeGreaterThan(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences'])
    }
  })

  it('records the provenance TREE of every baseline, so "does not reproduce" always has a "where"', () => {
    // The §9.5 finding ("the recorded baselines no longer reproduce") rested on comparing a
    // historical derivation input against a LATER tree. Rebuilding `/dashboard/experiences` at its
    // own provenance tree `fd4e9df` measured 85,551 B exactly, which is what dissolved it. This
    // assertion exists so a baseline can never again be added without the tree that answers the
    // question — a bare number invites the same category error.
    expect(Object.keys(DASHBOARD_APP_OWNED_BASELINE_PROVENANCE).sort())
      .toEqual(Object.keys(DASHBOARD_APP_OWNED_BASELINE_BYTES).sort())
    for (const [route, tree] of Object.entries(DASHBOARD_APP_OWNED_BASELINE_PROVENANCE)) {
      expect(tree, `${route} must name the tree its baseline was measured on`).toBeTypeOf('string')
      expect(tree.length, `${route} provenance must not be blank`).toBeGreaterThan(0)
    }
  })

  it('keeps provenance a RECORD, not a second derivation input', () => {
    // The discriminating half: provenance must never acquire the power to move a cap. If a future
    // edit made a cap depend on this map, that cap would change when a SHA was corrected — which is
    // exactly the "budget changed to fix a label" failure the whole finding is about.
    expect(DASHBOARD_APP_OWNED_BASELINE_PROVENANCE['/dashboard/experiences']).toBe('fd4e9df')
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences'])
      .toBe(approvedAppLimitBytes(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/experiences']))
  })

  it('leaves the D20-34 collection baseline UNCHANGED despite it no longer reproducing', () => {
    // The owner ruled historical derivation inputs are not re-stamped when they stop reproducing.
    // `M1·U3` re-measured this route at 87,404 B; re-stamping would move the cap 99,328 -> 101,376.
    expect(DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/experiences']).toBe(85_551)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences']).toBe(99_328)
  })

  it('derives the D20-34 cap from its own recorded baseline, not from the Articles collection', () => {
    const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES['/dashboard/experiences']
    expect(baseline).toBe(85_551)
    expect(approvedAppLimitBytes(baseline)).toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences'])
    // The discriminating half: it is NOT the sibling collection's number. The owner declined
    // rounding it up to 100 KiB for consistency, so a later edit that "tidied" it would be a
    // budget change made without a decision.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/experiences'])
      .not.toBe(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles'])
  })

  it('derives every D20-33 cap from its own recorded baseline, like D20-29 does', () => {
    for (const route of D20_33_ROUTES) {
      const baseline = DASHBOARD_APP_OWNED_BASELINE_BYTES[route]
      expect(baseline, `${route} must record the baseline its cap was derived from`).toBeTypeOf('number')
      expect(approvedAppLimitBytes(baseline), `${route} cap must equal ceil((baseline x 1.15)/KiB) x KiB`)
        .toBe(DASHBOARD_APP_OWNED_CAP_BYTES[route])
    }
  })

  it('keeps the two editor routes ABOVE the collection route, which is the whole correction', () => {
    // An editor carries the media-authoring subsystem a list route does not. Collapsing them back
    // to one number is what produced the failing gate this amendment resolves.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles']).toBe(102_400)
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new']).toBe(122_880)
    // And still far below the comparable governed surface, so nothing was loosened by precedent.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/articles/new'])
      .toBeLessThan(DASHBOARD_APP_OWNED_CAP_BYTES['/dashboard/projects/new'])
  })

  it('pins every cap to the exact byte value doc 20 §1.1 publishes', () => {
    // Written as literals on purpose: a cap computed here from the same helper the source uses
    // would pass no matter what either side drifted to.
    expect(DASHBOARD_APP_OWNED_CAP_BYTES).toEqual({
      '/dashboard/login': 103_424,
      '/dashboard': 103_424,
      '/dashboard/messages': 103_424,
      '/dashboard/articles': 102_400,
      '/dashboard/articles/new': 122_880,
      '/dashboard/articles/00000000-0000-0000-0000-000000000000': 122_880,
      '/dashboard/experiences': 99_328,
      '/dashboard/experiences/new': 120_832,
      '/dashboard/experiences/00000000-0000-0000-0000-000000000000': 121_856,
      // D20-36 — the three Skills routes, each from its own baseline (83,997 / 96,571 / 96,679 B).
      '/dashboard/skills': 97_280,
      '/dashboard/skills/new': 111_616,
      '/dashboard/skills/00000000-0000-0000-0000-000000000000': 111_616,
      // D20-37 — the Testimonials collection, from its own baseline (86,069 B). Numerically equal to
      // the Experiences collection's cap by coincidence of close baselines, not by inheritance.
      '/dashboard/testimonials': 99_328,
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
    // 12 -> 14: D20-35 registers the two Experiences editor routes (`M1·U3`).
    // 14 -> 17: D20-36 governs all three Skills routes (`M2·U2` collection + `M2·U3` editors).
    // 17 -> 18: D20-37 governs the Testimonials collection (`T·U2` registered it deliberately
    // ungoverned; the owner's cap arrived after measurement, as D20-34 prescribed).
    expect(measured).toHaveLength(18)
    expect(() => assertGovernedRouteCoverage(measured)).not.toThrow()
  })

  it('detects a route added to the gate without a doc 20 cap', () => {
    const measured = [...DASHBOARD_ROUTES.map(r => r.route), '/dashboard/analytics']
    expect(() => assertGovernedRouteCoverage(measured)).toThrow(/measured but NOT governed/)
  })
})

describe('D20-31 — public delivery model (shared floor + functional tiers)', () => {
  it('holds the OWNER-APPROVED numbers exactly', () => {
    // These are doc 20 verbatim. If this test fails, either a budget was edited here instead of
    // through a decision-log entry, or a decision changed and this test was not updated with it.
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorBytes).toBe(263_168) // 257 KiB
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes.content).toBe(7_168) // 7 KiB
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes.collection).toBe(12_288) // 12 KiB
    expect(PUBLIC_DELIVERY_BUDGET.incrementalBytes['interactive-subsystem']).toBe(18_432) // 18 KiB
  })

  it('reproduces the tier derivation from the calibration measurements', () => {
    // D20-12's idiom: ceil((measuredMax x 115 / 100) / 1024) x 1024. Asserting the DERIVATION rather
    // than only the result is what stops a future number being rounded to something convenient.
    const derive = (measured) => Math.ceil((measured * 115 / 100) / 1024) * 1024
    expect(derive(5_597)).toBe(PUBLIC_DELIVERY_BUDGET.incrementalBytes.content)
    expect(derive(10_073)).toBe(PUBLIC_DELIVERY_BUDGET.incrementalBytes.collection)
    expect(derive(15_876)).toBe(PUBLIC_DELIVERY_BUDGET.incrementalBytes['interactive-subsystem'])
  })

  it('does NOT derive the floor cap from the percentage idiom, on purpose', () => {
    // The x1.15 idiom yields 292,864 B here — 38,310 B of headroom, 2.4x the heaviest route's whole
    // allowance. It was rejected for this cap; this test pins that it stays rejected.
    const percentageIdiom = Math.ceil((254_554 * 115 / 100) / 1024) * 1024
    expect(percentageIdiom).toBe(292_864)
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorBytes).toBeLessThan(percentageIdiom)
    // Derived instead from 4 x the measured i18n 10.6.0 adoption (+1,946 B/route), ceil to KiB.
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorBytes)
      .toBe(Math.ceil((254_554 + 4 * 1_946) / 1024) * 1024)
  })

  it('files every governed public route under a known functional tier', () => {
    const tiers = Object.keys(PUBLIC_DELIVERY_BUDGET.incrementalBytes)
    expect(Object.keys(PUBLIC_ROUTE_TIERS)).toHaveLength(18)
    for (const [route, tier] of Object.entries(PUBLIC_ROUTE_TIERS)) {
      expect(tiers, `${route} is filed under an unknown tier '${tier}'`).toContain(tier)
    }
  })

  it('gives a locale pair the same tier — a page does not change function by language', () => {
    for (const route of Object.keys(PUBLIC_ROUTE_TIERS)) {
      if (route.startsWith('/ar')) continue
      const ar = route === '/' ? '/ar' : `/ar${route}`
      // The AR blog slug is translated, so pair it explicitly rather than by string surgery.
      const twin = route === '/blog/staying-inside-performance-budget-nuxt'
        ? '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt'
        : ar
      expect(PUBLIC_ROUTE_TIERS[twin], `${route} and ${twin} disagree`).toBe(PUBLIC_ROUTE_TIERS[route])
    }
  })

  it('refuses to default an unfiled route to a cap', () => {
    expect(() => publicTierFor('/not-governed')).toThrow(/no D20-31 functional tier/)
  })

  it('asserts tier coverage in BOTH directions', () => {
    expect(() => assertPublicTierCoverage(Object.keys(PUBLIC_ROUTE_TIERS))).not.toThrow()
    expect(() => assertPublicTierCoverage([...Object.keys(PUBLIC_ROUTE_TIERS), '/new']))
      .toThrow(/measured but not filed/)
    // A tier entry left behind for a deleted route reads as governance that is no longer enforced.
    expect(() => assertPublicTierCoverage(Object.keys(PUBLIC_ROUTE_TIERS).slice(1)))
      .toThrow(/not measured/)
  })
})

describe('D20-31 — resolveSharedFloor and the FROZEN reference set', () => {
  const refMap = (extra = {}) => {
    const m = new Map()
    for (const r of FLOOR_REFERENCE_ROUTES) m.set(r, new Set(['/a.js', '/b.js', '/c.js', `/own-${r}.js`]))
    for (const [k, v] of Object.entries(extra)) m.set(k, new Set(v))
    return m
  }

  it('returns exactly the assets common to every reference route', () => {
    const { assets } = resolveSharedFloor(refMap())
    expect([...assets].sort()).toEqual(['/a.js', '/b.js', '/c.js'])
  })

  it('⚠ a NEW governed route CANNOT redefine the shared baseline', () => {
    // The failure this prevents: a new page that does not load a currently-shared asset would eject
    // it from the intersection for EVERY route — the floor drops, every route's delta rises by the
    // same amount, and every delta gate can trip at once because a page was added.
    const withNewRoute = refMap({ '/brand-new': ['/a.js'] })
    const { assets } = resolveSharedFloor(withNewRoute)
    expect([...assets].sort()).toEqual(['/a.js', '/b.js', '/c.js'])
  })

  it('refuses to derive a floor when a reference route was not measured', () => {
    const incomplete = refMap()
    incomplete.delete(FLOOR_REFERENCE_ROUTES[3])
    expect(() => resolveSharedFloor(incomplete)).toThrow(/reference routes were not measured/)
  })

  it('shrinks the floor when a reference route genuinely stops loading a shared asset', () => {
    // The legitimate case: this is a real change in shared delivery, and it must be visible rather
    // than absorbed — the gate reports the movement against the calibration figure.
    const m = refMap()
    m.set(FLOOR_REFERENCE_ROUTES[0], new Set(['/a.js', '/b.js']))
    const { assets } = resolveSharedFloor(m)
    expect([...assets].sort()).toEqual(['/a.js', '/b.js'])
  })

  it('freezes the reference set against accidental mutation', () => {
    expect(Object.isFrozen(FLOOR_REFERENCE_ROUTES)).toBe(true)
    expect(FLOOR_REFERENCE_ROUTES).toHaveLength(18)
  })
})

/**
 * D20-32 — the INTERIM Dashboard delivery model.
 *
 * ⚠ WHY EVERY NUMBER IS RE-DERIVED HERE RATHER THAN COPIED. These caps were introduced to make an
 * owner-accepted condition (D20-30) mechanically governable. A test that merely asserted
 * `sharedFloorBytes === 262 * KB` would pass equally well against a cap someone had quietly raised to
 * make a failing gate green — which is the exact move D20-32's own text forbids. So each cap is
 * recomputed from its stated measured input, and the derivation is what is pinned.
 */
describe('D20-32 — interim dashboard delivery budget', () => {
  /** OD-26-7's MEASURED `@nuxtjs/i18n` 10.6.0 adoption cost, the one unit both caps are built from. */
  const ADOPTION_UNIT = 1946
  const ADOPTIONS = 4
  const ceilKiB = bytes => Math.ceil(bytes / KB) * KB

  it('derives the shared-floor cap from the measured floor plus four measured adoptions', () => {
    const measuredFloor = DASHBOARD_DELIVERY_BUDGET.sharedFloorCalibrationBytes
    expect(measuredFloor).toBe(259_911)
    expect(DASHBOARD_DELIVERY_BUDGET.sharedFloorBytes)
      .toBe(ceilKiB(measuredFloor + ADOPTIONS * ADOPTION_UNIT))
    expect(DASHBOARD_DELIVERY_BUDGET.sharedFloorBytes).toBe(262 * KB)
  })

  it('derives the incremental cap from the measured worst route plus the SAME unit', () => {
    // 77,549 B gz — the measured maximum route-specific delivery (`/dashboard/messages`).
    expect(DASHBOARD_DELIVERY_BUDGET.incrementalBytes)
      .toBe(ceilKiB(77_549 + ADOPTIONS * ADOPTION_UNIT))
    expect(DASHBOARD_DELIVERY_BUDGET.incrementalBytes).toBe(84 * KB)
  })

  it('leaves BOUNDED headroom — never a cap equal to the current maximum', () => {
    // "Do not simply set a number equal to the current maximum" is the requirement; both directions
    // are asserted, because a cap far ABOVE the maximum governs nothing either.
    const floorHeadroom = DASHBOARD_DELIVERY_BUDGET.sharedFloorBytes - 259_911
    const incrHeadroom = DASHBOARD_DELIVERY_BUDGET.incrementalBytes - 77_549
    expect(floorHeadroom).toBe(8377)
    expect(incrHeadroom).toBe(8467)
    for (const h of [floorHeadroom, incrHeadroom]) expect(h).toBeGreaterThan(0)
    // Bounded: neither cap grants more than one further "four adoptions" of slack.
    expect(floorHeadroom).toBeLessThanOrEqual(2 * ADOPTIONS * ADOPTION_UNIT)
    expect(incrHeadroom).toBeLessThanOrEqual(2 * ADOPTIONS * ADOPTION_UNIT)
  })

  it('is ONE generic allowance — no tier map and no per-route exception table', () => {
    // The structural guarantee against a named waiver: there is nothing here keyed by route.
    expect(typeof DASHBOARD_DELIVERY_BUDGET.incrementalBytes).toBe('number')
    for (const key of Object.keys(DASHBOARD_DELIVERY_BUDGET)) {
      expect(key).not.toMatch(/dashboard\//)
    }
    expect(JSON.stringify(DASHBOARD_DELIVERY_BUDGET)).not.toMatch(/\/dashboard/)
  })

  it('keeps the measured worst route INSIDE the cap but still ABOVE the attribution threshold', () => {
    // This is the pair that preserves D20-30: `/dashboard/messages` is genuinely green on the model,
    // and it still cannot print as an ordinary green line. If a future recalibration raised the cap
    // enough to drop it under 85 %, the route's accepted-and-attributed status would go silent.
    const cap = DASHBOARD_DELIVERY_BUDGET.incrementalBytes
    expect(budgetVerdict(77_549, cap)).toBe('PASS')
    expect(77_549).toBeGreaterThanOrEqual(cap * DASHBOARD_DELIVERY_BUDGET.attributionThreshold)
  })
})

/**
 * The §33.4 reporting defect: the floor line labelled the WHOLE delta against a frozen calibration
 * "shared framework/ecosystem growth", so hosted CI printed `+6 B ← shared framework/ecosystem
 * growth` forever — runner variance reported as framework growth.
 *
 * ⚠ THE DISCRIMINATING PAIR is the point of this block. A fix that simply silenced small deltas
 * would also silence real growth, and a fix that widened the band until CI went quiet would hide
 * the thing the floor exists to catch. So both directions are pinned against MEASURED values:
 * the +6 B environment offset must NOT read as growth, and the public floor's real +39 B must.
 */
describe('§33.4 — floor delta attribution separates environment variance from growth', () => {
  it('does NOT call the measured local↔hosted offset growth', () => {
    // Both floors independently measured +6 B hosted vs local at `fd56aaa` (run 32039342735).
    const v = classifyFloorDelta(6, 'da83531')
    expect(v.kind).toBe('variance')
    // Match the AFFIRMATIVE claim, not the bare word: the correct note denies growth, so it
    // legitimately contains "NOT attributable to growth". A `/growth/` assertion fails on the fix.
    expect(v.note).not.toMatch(/← shared framework\/ecosystem growth/)
    expect(v.note).toMatch(/variance band/)
  })

  it('STILL calls real accrued growth growth', () => {
    // The public floor really did move +39 B between `8067ec8` and `fd56aaa`. If this ever stops
    // reporting as growth, the band has been widened until the gate's early warning is deaf.
    const v = classifyFloorDelta(39, '8067ec8')
    expect(v.kind).toBe('growth')
    expect(v.note).toMatch(/shared framework\/ecosystem growth/)
  })

  it('is symmetric — a shrink inside the band is variance, outside it is a claimable win', () => {
    expect(classifyFloorDelta(-6, 'da83531').kind).toBe('variance')
    expect(classifyFloorDelta(-39, 'da83531').kind).toBe('shrink')
    expect(classifyFloorDelta(-39, 'da83531').note).toMatch(/recalibration decision/)
  })

  it('reports the exact band boundaries — inclusive inside, growth one byte out', () => {
    const b = FLOOR_ENVIRONMENT_VARIANCE_BYTES
    expect(b).toBe(6)
    expect(classifyFloorDelta(b, 'x').kind).toBe('variance')
    expect(classifyFloorDelta(b + 1, 'x').kind).toBe('growth')
    expect(classifyFloorDelta(-b, 'x').kind).toBe('variance')
    expect(classifyFloorDelta(-b - 1, 'x').kind).toBe('shrink')
  })

  it('names the calibration SHA, so a delta can be read against the tree it was measured on', () => {
    expect(classifyFloorDelta(39, '8067ec8').note).toContain('8067ec8')
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorCalibrationSha).toBe('8067ec8')
    expect(DASHBOARD_DELIVERY_BUDGET.sharedFloorCalibrationSha).toBe('da83531')
  })

  it('leaves the GOVERNED derivation input untouched — the fix is reporting-only', () => {
    // Ledger §33.4 proposed re-stamping the calibration to the hosted 259,917. That constant is the
    // stated measured input for `sharedFloorBytes`, so moving it would edit a governed cap's
    // derivation to fix a print label. This asserts the number stayed where it was measured.
    expect(DASHBOARD_DELIVERY_BUDGET.sharedFloorCalibrationBytes).toBe(259_911)
    expect(PUBLIC_DELIVERY_BUDGET.sharedFloorCalibrationBytes).toBe(254_554)
  })
})

describe('D20-32 — resolveDashboardSharedFloor and its FROZEN reference set', () => {
  const refMap = (extra = {}) => {
    const m = new Map()
    for (const r of DASHBOARD_FLOOR_REFERENCE_ROUTES) {
      m.set(r, new Set(['/_nuxt/shell.js', '/_nuxt/vendor.js', '/_nuxt/layout.js', `/_nuxt/own-${r}.js`]))
    }
    for (const [k, v] of Object.entries(extra)) m.set(k, v)
    return m
  }

  it('returns exactly the assets common to every frozen reference route', () => {
    const { assets } = resolveDashboardSharedFloor(refMap())
    expect([...assets].sort()).toEqual(['/_nuxt/layout.js', '/_nuxt/shell.js', '/_nuxt/vendor.js'])
  })

  it('CONTROL — a newly governed route does NOT redefine the frozen floor', () => {
    // The shrink-on-add hazard, stated as a test: a new dashboard route that does not carry a
    // currently-shared asset must not eject it from the floor for every other route. If the floor
    // were derived over "whatever is governed today", `vendor.js` would drop out here and every
    // route's delta would jump at once — because a page was added.
    const withNewRoute = refMap({
      '/dashboard/brand-new': new Set(['/_nuxt/shell.js', '/_nuxt/own-new.js'])
    })
    const { assets } = resolveDashboardSharedFloor(withNewRoute)
    expect([...assets].sort()).toEqual(['/_nuxt/layout.js', '/_nuxt/shell.js', '/_nuxt/vendor.js'])
    expect(assets.has('/_nuxt/vendor.js')).toBe(true)
  })

  it('refuses to derive a floor when a frozen reference route was not measured', () => {
    const incomplete = refMap()
    incomplete.delete(DASHBOARD_FLOOR_REFERENCE_ROUTES[2])
    expect(() => resolveDashboardSharedFloor(incomplete)).toThrow(/reference routes were not measured/)
  })

  it('is a SEPARATE list from DASHBOARD_ROUTES, not an alias of it', () => {
    // If these were the same array, the control above could not pass — the floor would be derived
    // over the governed set and a new governed route would participate in defining it.
    expect(DASHBOARD_FLOOR_REFERENCE_ROUTES).not.toBe(DASHBOARD_ROUTES)
    expect(Object.isFrozen(DASHBOARD_FLOOR_REFERENCE_ROUTES)).toBe(true)

    // THE TWO LISTS HAVE NOW DIVERGED, AND THAT IS THE DESIGN WORKING.
    //
    // They covered the same routes at calibration time, and an earlier revision of this test
    // asserted that equality — which recorded a COINCIDENCE as if it were the contract. D20-33
    // registered `/dashboard/articles` as a ninth governed route while the frozen reference set
    // stayed at the eight routes D20-32 was calibrated over, which is exactly the shrink-on-add
    // hazard the CONTROL above describes: a new page must never participate in defining the floor
    // that every other route is measured against.
    //
    // So the assertion is inverted rather than deleted: the governed set is a strict superset, and
    // the frozen set still holds precisely its eight calibration routes.
    const governed = DASHBOARD_ROUTES.map(r => r.route)
    expect(DASHBOARD_FLOOR_REFERENCE_ROUTES).toHaveLength(8)
    for (const route of DASHBOARD_FLOOR_REFERENCE_ROUTES) {
      expect(governed, `${route} is a floor reference and must still be governed`).toContain(route)
    }
    expect(
      governed.filter(route => !DASHBOARD_FLOOR_REFERENCE_ROUTES.includes(route)).sort(),
      'a route governed AFTER calibration must not be in the frozen floor set'
    ).toEqual([
      '/dashboard/articles',
      '/dashboard/articles/00000000-0000-0000-0000-000000000000',
      '/dashboard/articles/new',
      // D20-34 joins the governed set and stays OUT of the frozen floor set, which is the same
      // shrink-on-add protection working a second time: FE-3 adds five more modules, so this is the
      // list that must keep growing while the eight calibration routes stay put.
      '/dashboard/experiences',
      // D20-35 — the two editor routes, joining for the same reason and with the same protection.
      '/dashboard/experiences/00000000-0000-0000-0000-000000000000',
      '/dashboard/experiences/new',
      // D20-36 — all three Skills routes, joining under the same shrink-on-add protection.
      '/dashboard/skills',
      '/dashboard/skills/00000000-0000-0000-0000-000000000000',
      '/dashboard/skills/new',
      // T·U2 — the Testimonials collection, registered measured-but-ungoverned and, like every
      // route above, staying OUT of the frozen floor set.
      '/dashboard/testimonials'
    ])
  })

  it('freezes a ROUTE LIST, never content-hashed asset filenames', () => {
    for (const route of DASHBOARD_FLOOR_REFERENCE_ROUTES) {
      expect(route).toMatch(/^\/dashboard/)
      expect(route).not.toMatch(/\.js$/)
      expect(route).not.toMatch(/_nuxt/)
    }
  })
})

describe('D20-32 — the three guards fail INDEPENDENTLY', () => {
  const FLOOR_CAP = DASHBOARD_DELIVERY_BUDGET.sharedFloorBytes
  const INCR_CAP = DASHBOARD_DELIVERY_BUDGET.incrementalBytes

  it('CONTROL — shared framework growth alone trips the FLOOR gate', () => {
    // Route-specific delivery held at a comfortable value; only the shared floor moves.
    expect(budgetVerdict(FLOOR_CAP, FLOOR_CAP)).toBe('PASS')
    expect(budgetVerdict(FLOOR_CAP + 1, FLOOR_CAP)).toBe('FAIL')
    expect(budgetVerdict(40_000, INCR_CAP)).toBe('PASS')
  })

  it('CONTROL — excessive route-specific delivery alone trips the ROUTE gate', () => {
    // Floor held at exactly its cap (passing); only the route's own delta moves.
    expect(budgetVerdict(FLOOR_CAP, FLOOR_CAP)).toBe('PASS')
    expect(budgetVerdict(INCR_CAP, INCR_CAP)).toBe('PASS')
    expect(budgetVerdict(INCR_CAP + 1, INCR_CAP)).toBe('FAIL')
  })

  it('CONTROL — app-owned remains a third, independent guard', () => {
    // A route can be green on floor AND incremental and still fail on app-owned, which is the whole
    // reason D20-29's frozen per-route caps are preserved rather than folded into the new model.
    const cap = dashboardAppCapFor('/dashboard/messages')
    expect(budgetVerdict(INCR_CAP - 1, INCR_CAP)).toBe('PASS')
    expect(budgetVerdict(cap + 1, cap)).toBe('FAIL')
    // And the caps really are per-route, so one route's breach cannot be hidden by another's slack.
    expect(dashboardAppCapFor('/dashboard/projects/new')).not.toBe(cap)
  })

  it('gates the DELTA, not the route total — the defect D20-32 removes', () => {
    // `/dashboard/messages` measured 337,460 B total and 77,549 B of its own delivery. Under the old
    // flat model the total failed; under D20-32 the delta passes. Asserting both directions is what
    // proves the quantity changed rather than a number having been raised.
    expect(337_460).toBeGreaterThan(320 * KB) // would have FAILED the removed flat ceiling
    expect(budgetVerdict(77_549, INCR_CAP)).toBe('PASS') // PASSES on what the page actually owns
    // The route total is not even comparable to the incremental cap — a caller that confused them
    // would get a wildly wrong verdict, which is why the two live under different names.
    expect(budgetVerdict(337_460, INCR_CAP)).toBe('FAIL')
  })
})
