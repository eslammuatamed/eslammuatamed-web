import { describe, expect, it } from 'vitest'
import {
  KB,
  appCodeVerdict,
  budgetVerdict,
  classifyModuleId,
  collectRouteAssets,
  kb,
  vendorPackage
} from './route-assets.mjs'

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

describe('classifyModuleId', () => {
  it.each([
    ['node_modules/vue/dist/runtime.mjs'],
    ['/repo/node_modules/@nuxt/ui/dist/index.mjs'],
    ['/repo/node_modules/a/node_modules/b/index.js']
  ])('treats %s as vendor', (id) => {
    expect(classifyModuleId(id)).toBe('vendor')
  })

  it.each([
    ['app/components/layout/Header.vue'],
    ['app/composables/useSiteSettings.ts'],
    ['config/site-url.ts'],
    ['i18n/locales/ar.json']
  ])('treats project-owned %s as app', (id) => {
    expect(classifyModuleId(id)).toBe('app')
  })

  // Generated glue is reported separately rather than folded into whichever side flatters the
  // number — classification by convenience is exactly what the budget interpretation must avoid.
  it.each([
    ['\0virtual:nuxt:/repo/.nuxt/entry.js'],
    ['virtual:nuxt:plugins'],
    ['#build/components'],
    ['.nuxt/components.plugin.mjs']
  ])('treats generated glue %s as virtual', (id) => {
    expect(classifyModuleId(id)).toBe('virtual')
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

describe('appCodeVerdict — bounds, never a fabricated single number', () => {
  const BUDGET = 35 * KB

  it('PASSES only when the UPPER bound clears the budget (true for every possible split)', () => {
    expect(appCodeVerdict({ lower: 1 * KB, upper: BUDGET }, BUDGET)).toBe('PASS')
    expect(appCodeVerdict({ lower: 1 * KB, upper: BUDGET - 1 }, BUDGET)).toBe('PASS')
  })

  it('FAILS only when the LOWER bound breaches (true for every possible split)', () => {
    expect(appCodeVerdict({ lower: BUDGET + 1, upper: 200 * KB }, BUDGET)).toBe('FAIL')
  })

  it('is INDETERMINATE when the bounds straddle the budget — and that is not a pass', () => {
    const verdict = appCodeVerdict({ lower: 4.5 * KB, upper: 221 * KB }, BUDGET)
    expect(verdict).toBe('INDETERMINATE')
    expect(verdict).not.toBe('PASS')
  })

  it('treats exactly-at-budget bounds inclusively on both edges', () => {
    expect(appCodeVerdict({ lower: 0, upper: BUDGET }, BUDGET)).toBe('PASS')
    expect(appCodeVerdict({ lower: BUDGET, upper: BUDGET }, BUDGET)).toBe('PASS')
  })
})
