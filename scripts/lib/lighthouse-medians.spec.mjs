import { describe, expect, it } from 'vitest'
import {
  ARABIC_FONT_BUDGET,
  CATEGORY_THRESHOLDS,
  LCP_LIMITS,
  LCP_QUALITY_TARGETS,
  LCP_ROUTE_CEILINGS,
  METRIC_LIMITS,
  RUNS_REQUIRED,
  ceilingFor,
  classifyFontResource,
  fontTotalsByScript,
  groupRuns,
  isArabicRoute,
  limitFor,
  median,
  overallVerdict,
  qualityTargetFor,
  readReport,
  summariseGroup
} from './lighthouse-medians.mjs'

/** Real asset names from this project's build output — the classifier is tested against the
 *  filenames it actually meets, not invented ones. */
const ASSET = 'http://127.0.0.1:3000/_nuxt'
export const FONTS = {
  geistLatin: `${ASSET}/geist-latin-wght-normal.BgDaEnEv.woff2`,
  geistLatinExt: `${ASSET}/geist-latin-ext-wght-normal.DC-KSUi6.woff2`,
  spaceGroteskLatin: `${ASSET}/space-grotesk-latin-wght-normal.BhU9QXUp.woff2`,
  jetbrainsMono: `${ASSET}/jetbrains-mono-latin-400-normal.V6pRDFza.woff2`,
  cairoArabic: `${ASSET}/cairo-arabic-wght-normal.CJWMIGCx.woff2`,
  cairoLatin: `${ASSET}/cairo-latin-wght-normal.PfPtmrPZ.woff2`,
  reemKufiArabic: `${ASSET}/reem-kufi-arabic-wght-normal.DEc70LOo.woff2`,
  reemKufiLatin: `${ASSET}/reem-kufi-latin-wght-normal.D4haMHFz.woff2`,
  plexArabic400: `${ASSET}/ibm-plex-sans-arabic-arabic-400-normal.CyU-ddYS.woff2`,
  plexArabic600: `${ASSET}/ibm-plex-sans-arabic-arabic-600-normal.0pRdybE_.woff2`,
  /** Same family, LATIN subset. The family name itself ends in "arabic", so this is the case a
   *  substring test gets wrong — it must NOT count against the Arabic budget. */
  plexLatin400: `${ASSET}/ibm-plex-sans-arabic-latin-400-normal.CyU-ddYS.woff2`
}

/** The default font set: a Latin-only route, as `/` actually loads. */
const LATIN_FONTS = [
  { url: FONTS.geistLatin, transferSize: 29715 },
  { url: FONTS.spaceGroteskLatin, transferSize: 22603 },
  { url: FONTS.jetbrainsMono, transferSize: 21483 }
]

/**
 * A synthetic Lighthouse report. Scores are given 0–100 for readability and converted to the 0–1
 * floats Lighthouse actually emits, so the tests exercise the same precision path as production.
 *
 * Fonts are emitted through BOTH `network-requests` (per resource, which is what the per-script
 * budget is computed from) and `resource-summary` (the script-blind total, which the gate reads back
 * as a cross-check). They agree by construction unless `summaryFonts` overrides the summary, which
 * is how the cross-check itself is tested.
 */
function lhr({
  formFactor = 'mobile',
  url = 'http://127.0.0.1:3000/',
  version = '12.0.0',
  performance = 70,
  accessibility = 100,
  bestPractices = 100,
  seo = 100,
  lcp = 1000,
  cls = 0.01,
  tbt = 200,
  speedIndex = 1500,
  fonts = LATIN_FONTS,
  summaryFonts = null,
  networkRequests = undefined
} = {}) {
  const total = fonts.reduce((sum, f) => sum + f.transferSize, 0)
  const requests = networkRequests ?? [
    { url, resourceType: 'Document', transferSize: 8000 },
    { url: `${ASSET}/entry.dgAW-O-E.css`, resourceType: 'Stylesheet', transferSize: 22609 },
    ...fonts.map(f => ({ ...f, resourceType: 'Font' }))
  ]
  return {
    lighthouseVersion: version,
    requestedUrl: url,
    configSettings: { formFactor },
    categories: {
      performance: { score: performance / 100 },
      accessibility: { score: accessibility / 100 },
      'best-practices': { score: bestPractices / 100 },
      seo: { score: seo / 100 }
    },
    audits: {
      'largest-contentful-paint': { numericValue: lcp },
      'cumulative-layout-shift': { numericValue: cls },
      'total-blocking-time': { numericValue: tbt },
      'speed-index': { numericValue: speedIndex },
      'network-requests': { details: { items: requests } },
      'resource-summary': {
        details: { items: [{ resourceType: 'font', transferSize: summaryFonts ?? total }] }
      }
    }
  }
}

const read = (opts) => readReport(lhr(opts), 'test.json')
const summarise = (optsList) => summariseGroup({
  formFactor: optsList[0]?.formFactor ?? 'mobile',
  url: optsList[0]?.url ?? 'http://127.0.0.1:3000/',
  runs: optsList.map(read)
})

describe('median — a true median, never the best and never the mean', () => {
  it('takes the middle of three values', () => {
    expect(median([1, 2, 3])).toBe(2)
  })

  it('sorts first — input order must not decide the result', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([2, 3, 1])).toBe(2)
    expect(median([95, 60, 72])).toBe(72)
  })

  // The three properties D20-13 explicitly rules out, pinned so a "simplification" cannot
  // reintroduce them.
  it('is not the best run', () => {
    expect(median([59, 60, 99])).toBe(60)
    expect(median([59, 60, 99])).not.toBe(99)
  })

  it('is not the mean — one catastrophic outlier must not drag a healthy pair under', () => {
    expect(median([96, 97, 3])).toBe(96)
    expect(median([96, 97, 3])).not.toBeCloseTo((96 + 97 + 3) / 3)
  })

  it('rejects non-finite input rather than producing a number from it', () => {
    expect(() => median([1, NaN, 3])).toThrow()
    expect(() => median([])).toThrow()
  })
})

describe('readReport — profile and URL come from run configuration, never filenames', () => {
  it('reads the form factor from configSettings', () => {
    expect(read({ formFactor: 'desktop' }).formFactor).toBe('desktop')
    expect(read({ formFactor: 'mobile' }).formFactor).toBe('mobile')
  })

  it('refuses a report whose profile cannot be determined', () => {
    expect(() => readReport({ ...lhr(), configSettings: {} }, 'x.json')).toThrow(/formFactor/)
  })

  it('refuses a report with no requestedUrl', () => {
    const broken = lhr()
    delete broken.requestedUrl
    expect(() => readReport(broken, 'x.json')).toThrow(/requestedUrl/)
  })

  it('refuses a report with a non-numeric category score instead of scoring it zero', () => {
    const broken = lhr()
    broken.categories.performance.score = null
    expect(() => readReport(broken, 'x.json')).toThrow(/no numeric score/)
  })

  // THE PRECISION RULE (D20-13): compare the raw float × 100. 0.9451 DISPLAYS as 95 in the
  // Lighthouse UI; rounding it up to pass ≥ 95 is exactly what a gate must not do.
  it('keeps the raw score precision rather than the displayed rounding', () => {
    expect(read({ performance: 94.51 }).categories.performance).toBeCloseTo(94.51, 6)
    expect(read({ performance: 94.99 }).categories.performance).toBeCloseTo(94.99, 6)
  })
})

describe('grouping — profile × URL never share a median', () => {
  it('separates desktop from mobile for the same URL', () => {
    const groups = groupRuns([
      read({ formFactor: 'mobile' }),
      read({ formFactor: 'desktop' }),
      read({ formFactor: 'mobile' })
    ])
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.runs.length).sort()).toEqual([1, 2])
  })

  it('separates different URLs within the same profile', () => {
    const groups = groupRuns([
      read({ url: 'http://127.0.0.1:3000/' }),
      read({ url: 'http://127.0.0.1:3000/ar' })
    ])
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.url)).toEqual(['http://127.0.0.1:3000/', 'http://127.0.0.1:3000/ar'])
  })

  it('keeps all four EN/AR × desktop/mobile configurations distinct', () => {
    const runs = []
    for (const formFactor of ['mobile', 'desktop']) {
      for (const url of ['http://127.0.0.1:3000/', 'http://127.0.0.1:3000/ar']) {
        for (let i = 0; i < RUNS_REQUIRED; i++) runs.push(read({ formFactor, url }))
      }
    }
    const groups = groupRuns(runs)
    expect(groups).toHaveLength(4)
    expect(groups.every(g => g.runs.length === RUNS_REQUIRED)).toBe(true)
  })
})

describe('summariseGroup — thresholds and boundaries', () => {
  it('passes at exactly the threshold (≥ is inclusive)', () => {
    const s = summarise([
      { formFactor: 'desktop', performance: 95 },
      { formFactor: 'desktop', performance: 95 },
      { formFactor: 'desktop', performance: 95 }
    ])
    expect(s.categories.performance.median).toBe(95)
    expect(s.categories.performance.pass).toBe(true)
    expect(s.failures).toHaveLength(0)
  })

  it('fails one unit below the threshold', () => {
    const s = summarise([
      { formFactor: 'desktop', performance: 94 },
      { formFactor: 'desktop', performance: 94 },
      { formFactor: 'desktop', performance: 94 }
    ])
    expect(s.categories.performance.pass).toBe(false)
    expect(s.failures.join(' ')).toMatch(/performance median 94.0 < required 95/)
  })

  // The rounding trap: 94.99 displays as 95 but is not ≥ 95.
  it('does not round a sub-threshold score up to make it pass', () => {
    const s = summarise([
      { formFactor: 'desktop', performance: 94.99 },
      { formFactor: 'desktop', performance: 94.99 },
      { formFactor: 'desktop', performance: 94.99 }
    ])
    expect(s.categories.performance.pass).toBe(false)
  })

  it('applies the mobile Performance threshold to mobile runs', () => {
    const pass = summarise([{ performance: 60 }, { performance: 60 }, { performance: 60 }])
    expect(pass.categories.performance.pass).toBe(true)
    const fail = summarise([{ performance: 59 }, { performance: 59 }, { performance: 59 }])
    expect(fail.categories.performance.pass).toBe(false)
  })

  it('requires exactly 100 for accessibility, best practices and SEO', () => {
    const s = summarise([
      { accessibility: 100, bestPractices: 100, seo: 100 },
      { accessibility: 99, bestPractices: 100, seo: 100 },
      { accessibility: 100, bestPractices: 100, seo: 100 }
    ])
    // Median of [100, 99, 100] is 100 — a single bad run does not fail the build.
    expect(s.categories.accessibility.median).toBe(100)
    expect(s.categories.accessibility.pass).toBe(true)

    const bad = summarise([{ seo: 99 }, { seo: 99 }, { seo: 100 }])
    expect(bad.categories.seo.median).toBe(99)
    expect(bad.categories.seo.pass).toBe(false)
  })

  it('asserts the UNCHANGED CLS limit on the median', () => {
    expect(METRIC_LIMITS['cumulative-layout-shift'].limit).toBe(0.05)
    const pass = summarise([{ cls: 0.05 }, { cls: 0.05 }, { cls: 0.05 }])
    expect(pass.metrics['cumulative-layout-shift'].pass).toBe(true)
    const fail = summarise([{ cls: 0.06 }, { cls: 0.06 }, { cls: 0.02 }])
    expect(fail.metrics['cumulative-layout-shift'].median).toBe(0.06)
    expect(fail.metrics['cumulative-layout-shift'].pass).toBe(false)
  })

  it('asserts the LCP limit of the DEVICE the run was collected on (D20-14)', () => {
    // The same 1500 ms median is a desktop failure and a mobile pass. Before D20-14 one flat
    // number judged both, which compared an emulated mid-tier phone against a desktop budget.
    const desktop = summarise([
      { formFactor: 'desktop', lcp: 1500 },
      { formFactor: 'desktop', lcp: 1500 },
      { formFactor: 'desktop', lcp: 900 }
    ])
    expect(desktop.metrics['largest-contentful-paint'].limit).toBe(1200)
    expect(desktop.metrics['largest-contentful-paint'].median).toBe(1500)
    expect(desktop.metrics['largest-contentful-paint'].pass).toBe(false)

    const mobile = summarise([{ lcp: 1500 }, { lcp: 1500 }, { lcp: 900 }])
    expect(mobile.metrics['largest-contentful-paint'].limit).toBe(4000)
    expect(mobile.metrics['largest-contentful-paint'].pass).toBe(true)
  })

  it('holds each device to its own LCP boundary, inclusively', () => {
    const at = (formFactor, lcp) => summarise([{ formFactor, lcp }, { formFactor, lcp }, { formFactor, lcp }])
      .metrics['largest-contentful-paint'].pass

    expect(at('desktop', 1200)).toBe(true)
    expect(at('desktop', 1201)).toBe(false)
    expect(at('mobile', 4000)).toBe(true)
    expect(at('mobile', 4001)).toBe(false)
    // The mobile budget must never be borrowed by a desktop run, nor the reverse.
    expect(at('desktop', 3900)).toBe(false)
    expect(at('mobile', 1300)).toBe(true)
  })

  // doc 20 §1 states no TBT or Speed Index budget, and inventing budgets is not permitted.
  it('records TBT and Speed Index without asserting them', () => {
    const s = summarise([{ tbt: 9999 }, { tbt: 9999 }, { tbt: 9999 }])
    expect(s.metrics['total-blocking-time'].median).toBe(9999)
    expect(s.metrics['total-blocking-time'].pass).toBeNull()
    expect(s.failures).toHaveLength(0)
  })

  it('preserves every individual run alongside the median', () => {
    const s = summarise([{ performance: 61 }, { performance: 70 }, { performance: 65 }])
    expect(s.categories.performance.values).toEqual([61, 70, 65])
    expect(s.categories.performance.median).toBe(65)
    expect(s.runs).toHaveLength(3)
  })
})

describe('incomplete or incomparable collections are INFRASTRUCTURE, not scores', () => {
  it('rejects fewer than three runs rather than asserting over what is there', () => {
    const s = summarise([{ performance: 99 }, { performance: 99 }])
    expect(s.problems.join(' ')).toMatch(/expected 3 comparable runs, found 2/)
    // Crucially it does not report a passing verdict from an under-sampled group.
    expect(s.categories).toEqual({})
    expect(overallVerdict([s]).code).toBe(2)
  })

  it('rejects more than three runs — a duplicated report is not extra evidence', () => {
    const s = summarise([{}, {}, {}, {}])
    expect(s.problems.join(' ')).toMatch(/found 4/)
    expect(overallVerdict([s]).code).toBe(2)
  })

  it('refuses to compare runs from different Lighthouse versions', () => {
    const s = summarise([{ version: '12.0.0' }, { version: '12.0.0' }, { version: '11.7.1' }])
    expect(s.problems.join(' ')).toMatch(/different Lighthouse versions/)
    expect(overallVerdict([s]).code).toBe(2)
  })

  it('reports infrastructure ahead of a threshold breach when both could apply', () => {
    const broken = summarise([{ performance: 1 }, { performance: 1 }])
    const failing = summarise([{ performance: 1 }, { performance: 1 }, { performance: 1 }])
    expect(overallVerdict([broken, failing]).code).toBe(2)
    expect(overallVerdict([failing]).code).toBe(1)
  })
})

describe('overallVerdict', () => {
  it('passes only when every configuration passes', () => {
    const ok = summarise([{ performance: 70 }, { performance: 70 }, { performance: 70 }])
    expect(overallVerdict([ok]).code).toBe(0)
    const bad = summarise([{ performance: 10 }, { performance: 10 }, { performance: 10 }])
    expect(overallVerdict([ok, bad]).code).toBe(1)
  })

  it('treats no reports at all as infrastructure', () => {
    expect(overallVerdict([]).code).toBe(2)
  })
})

describe('thresholds match doc 20 §1 (D20-13/14/15) verbatim', () => {
  it('pins the approved numbers so a change is deliberate', () => {
    expect(CATEGORY_THRESHOLDS.desktop).toEqual({
      performance: 95, accessibility: 100, 'best-practices': 100, seo: 100
    })
    expect(CATEGORY_THRESHOLDS.mobile).toEqual({
      performance: 60, accessibility: 100, 'best-practices': 100, seo: 100
    })
    expect(RUNS_REQUIRED).toBe(3)

    // D20-14 — device-scoped lab LCP. Unchanged by D20-16: the ceiling is a separate override,
    // not an edit to the device budget, so every unlisted configuration still resolves to these.
    expect(LCP_LIMITS).toEqual({ desktop: 1200, mobile: 4000 })
    // D20-16 — a FROZEN route+device ceiling, never recomputed from a run. Pinned so widening it,
    // or adding a second route to it, cannot happen without editing this expectation.
    expect(LCP_ROUTE_CEILINGS).toEqual([{ formFactor: 'mobile', pathname: '/ar', ceiling: 5000 }])
    // The 4000 ms figure survives as a non-blocking target rather than being deleted.
    expect(LCP_QUALITY_TARGETS).toEqual({ desktop: 1200, mobile: 4000 })
    // D20-15 — the 130 KiB figure is UNCHANGED in value; only its scope was corrected.
    expect(ARABIC_FONT_BUDGET).toBe(130 * 1024)
    expect(ARABIC_FONT_BUDGET).toBe(133120)
    // CLS is context-free and unchanged.
    expect(METRIC_LIMITS['cumulative-layout-shift'].limit).toBe(0.05)
  })

  it('asserts no budget the doc does not state', () => {
    // Exactly three asserted metrics. A fourth appearing here means a budget was invented in code
    // rather than decided in doc 20 — the failure mode every gate comment in this repo warns about.
    expect(Object.keys(METRIC_LIMITS).sort()).toEqual([
      'cumulative-layout-shift',
      'fonts:arabic-script',
      'largest-contentful-paint'
    ])
  })
})

describe('font classification — script is read from the resource, never guessed', () => {
  it('identifies the Arabic subset of an Arabic-script face', () => {
    expect(classifyFontResource(FONTS.cairoArabic).script).toBe('arabic')
    expect(classifyFontResource(FONTS.reemKufiArabic).script).toBe('arabic')
    expect(classifyFontResource(FONTS.plexArabic400).script).toBe('arabic')
    expect(classifyFontResource(FONTS.plexArabic600).script).toBe('arabic')
  })

  // THE TRAP. "IBM Plex Sans Arabic" carries "arabic" in the FAMILY name, so a substring test
  // would charge its Latin subset to the Arabic budget. The subset is parsed positionally instead.
  it('does not mistake a family name for a subset', () => {
    const latin = classifyFontResource(FONTS.plexLatin400)
    expect(latin.subset).toBe('latin')
    expect(latin.script).toBe('latin')

    const arabic = classifyFontResource(FONTS.plexArabic400)
    expect(arabic.subset).toBe('arabic')
  })

  it('classifies the Latin subsets of the Arabic display faces as Latin', () => {
    // These are the 54,806 B that the reverted font-scoping commit removed. They are Latin bytes on
    // a bilingual page, and D20-15 is the decision that they are not charged to the Arabic budget.
    expect(classifyFontResource(FONTS.cairoLatin).script).toBe('latin')
    expect(classifyFontResource(FONTS.reemKufiLatin).script).toBe('latin')
  })

  it('matches the longest subset token, so latin-ext is not truncated to latin', () => {
    expect(classifyFontResource(FONTS.geistLatinExt).subset).toBe('latin-ext')
    expect(classifyFontResource(FONTS.geistLatin).subset).toBe('latin')
  })

  it('handles a static weight as well as a variable axis', () => {
    expect(classifyFontResource(FONTS.jetbrainsMono).subset).toBe('latin')
    expect(classifyFontResource(FONTS.cairoArabic).subset).toBe('arabic')
  })

  it('parses an unhashed asset name', () => {
    expect(classifyFontResource(`${ASSET}/cairo-arabic-wght-normal.woff2`).script).toBe('arabic')
  })

  // Fail loud, in the direction that cannot hide an Arabic face from its budget.
  it('refuses an unknown subset rather than assuming it is not Arabic', () => {
    expect(() => classifyFontResource(`${ASSET}/noto-kufi-syriac-wght-normal.AbCdEfGh.woff2`))
      .toThrow(/FONT_SUBSET_SCRIPTS does not know/)
  })

  it('refuses a font whose name does not carry a subset at all', () => {
    expect(() => classifyFontResource(`${ASSET}/some-icon-font.AbCdEfGh.woff2`))
      .toThrow(/cannot classify font resource/)
  })
})

describe('fontTotalsByScript — the per-script split the budget is written in terms of', () => {
  const AR_ROUTE_FONTS = [
    { url: FONTS.plexArabic400, transferSize: 43163 },
    { url: FONTS.plexArabic600, transferSize: 46003 },
    { url: FONTS.cairoArabic, transferSize: 31211 },
    { url: FONTS.cairoLatin, transferSize: 34135 },
    { url: FONTS.reemKufiLatin, transferSize: 20671 },
    { url: FONTS.jetbrainsMono, transferSize: 21483 },
    { url: FONTS.geistLatin, transferSize: 29715 }
  ]

  // These are the real measured `/ar` numbers from the collected reports, not invented ones.
  it('splits a real bilingual route by script', () => {
    const totals = fontTotalsByScript(lhr({ url: 'http://127.0.0.1:3000/ar', fonts: AR_ROUTE_FONTS }))
    expect(totals.arabic).toBe(120377)
    expect(totals.nonArabic).toBe(106004)
    expect(totals.total).toBe(226381)
    expect(totals.count).toBe(7)
    // The whole point of D20-15: the combined figure breaches 130 KiB, the Arabic-script one does not.
    expect(totals.total).toBeGreaterThan(ARABIC_FONT_BUDGET)
    expect(totals.arabic).toBeLessThan(ARABIC_FONT_BUDGET)
  })

  it('counts nothing as Arabic on a Latin-only route', () => {
    const totals = fontTotalsByScript(lhr())
    expect(totals.arabic).toBe(0)
    expect(totals.nonArabic).toBe(totals.total)
  })

  it('ignores non-font resources', () => {
    const totals = fontTotalsByScript(lhr())
    // The fixture also emits a document and a stylesheet; neither may enter a font total.
    expect(totals.total).toBe(29715 + 22603 + 21483)
  })

  // A silently missed font resource would under-report the Arabic total and pass for the wrong
  // reason, so the script-blind summary is read back as an independent check.
  it('refuses a report whose per-resource sum disagrees with resource-summary', () => {
    expect(() => fontTotalsByScript(lhr({ summaryFonts: 999999 }), 'x.json'))
      .toThrow(/disagree with resource-summary/)
  })

  it('refuses a report with no network-requests audit instead of falling back to the blind total', () => {
    const blind = lhr()
    delete blind.audits['network-requests']
    expect(() => fontTotalsByScript(blind, 'x.json')).toThrow(/network-requests audit is missing/)
  })
})

describe('route locale — which routes the Arabic budget governs', () => {
  it('recognises the Arabic locale prefix', () => {
    expect(isArabicRoute('http://127.0.0.1:3000/ar')).toBe(true)
    expect(isArabicRoute('http://127.0.0.1:3000/ar/')).toBe(true)
    expect(isArabicRoute('http://127.0.0.1:3000/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt')).toBe(true)
  })

  it('does not treat Latin routes as Arabic', () => {
    expect(isArabicRoute('http://127.0.0.1:3000/')).toBe(false)
    expect(isArabicRoute('http://127.0.0.1:3000/blog/staying-inside-performance-budget-nuxt')).toBe(false)
  })

  // A prefix test without the boundary would match `/arabic-typography`, silently extending a
  // release-blocking budget to a Latin route.
  it('requires a path-segment boundary, not a string prefix', () => {
    expect(isArabicRoute('http://127.0.0.1:3000/arabic-typography')).toBe(false)
    expect(isArabicRoute('http://127.0.0.1:3000/architecture')).toBe(false)
  })
})

describe('limitFor — the same metric carries a different bound per run context', () => {
  const AR = 'http://127.0.0.1:3000/ar'
  const EN = 'http://127.0.0.1:3000/'

  it('resolves LCP per device', () => {
    expect(limitFor('largest-contentful-paint', { formFactor: 'desktop', url: EN })).toBe(1200)
    expect(limitFor('largest-contentful-paint', { formFactor: 'mobile', url: EN })).toBe(4000)
  })

  it('applies the D20-16 mobile /ar ceiling, and nowhere else', () => {
    // The one overridden configuration.
    expect(limitFor('largest-contentful-paint', { formFactor: 'mobile', url: AR })).toBe(5000)
    // Desktop /ar is NOT overridden — the ceiling is route AND device scoped.
    expect(limitFor('largest-contentful-paint', { formFactor: 'desktop', url: AR })).toBe(1200)
    // Latin routes keep the device budget on both profiles.
    expect(limitFor('largest-contentful-paint', { formFactor: 'mobile', url: EN })).toBe(4000)
  })

  it('does not leak the /ar ceiling to Arabic child routes', () => {
    // `/ar/blog/<slug>` measured 2667 ms on the same CI run and must keep the 4000 ms budget;
    // an exact-pathname match is what keeps a homepage allowance from relaxing a whole locale.
    const AR_ARTICLE = 'http://127.0.0.1:3000/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt'
    expect(limitFor('largest-contentful-paint', { formFactor: 'mobile', url: AR_ARTICLE })).toBe(4000)
    expect(ceilingFor('largest-contentful-paint', { formFactor: 'mobile', url: AR_ARTICLE })).toBeNull()
  })

  it('never applies an LCP ceiling to another metric', () => {
    expect(ceilingFor('cumulative-layout-shift', { formFactor: 'mobile', url: AR })).toBeNull()
    expect(limitFor('cumulative-layout-shift', { formFactor: 'mobile', url: AR })).toBe(0.05)
  })

  it('reports a quality target only where a ceiling raised the bound above it', () => {
    expect(qualityTargetFor('largest-contentful-paint', { formFactor: 'mobile', url: AR })).toBe(4000)
    // No ceiling here, so the asserted bound already IS the target — nothing extra to report.
    expect(qualityTargetFor('largest-contentful-paint', { formFactor: 'mobile', url: EN })).toBeNull()
    expect(qualityTargetFor('largest-contentful-paint', { formFactor: 'desktop', url: AR })).toBeNull()
  })

  it('applies the Arabic font budget on Arabic routes only', () => {
    expect(limitFor('fonts:arabic-script', { formFactor: 'mobile', url: AR })).toBe(ARABIC_FONT_BUDGET)
    expect(limitFor('fonts:arabic-script', { formFactor: 'mobile', url: EN })).toBeNull()
  })

  it('leaves context-free budgets alone', () => {
    expect(limitFor('cumulative-layout-shift', { formFactor: 'mobile', url: AR })).toBe(0.05)
    expect(limitFor('cumulative-layout-shift', { formFactor: 'desktop', url: EN })).toBe(0.05)
  })

  it('never invents a bound for a recorded-only metric', () => {
    expect(limitFor('total-blocking-time', { formFactor: 'mobile', url: AR })).toBeNull()
    expect(limitFor('fonts:all-scripts', { formFactor: 'mobile', url: AR })).toBeNull()
    expect(limitFor('fonts:non-arabic-script', { formFactor: 'mobile', url: AR })).toBeNull()
  })

  it('refuses a form factor it has no budget for, rather than passing by default', () => {
    expect(() => limitFor('largest-contentful-paint', { formFactor: 'tablet', url: EN }))
      .toThrow(/no limit defined for form factor/)
  })
})

describe('the font budget blocks on Arabic script, and only there (D20-15)', () => {
  const AR = 'http://127.0.0.1:3000/ar'
  const EN = 'http://127.0.0.1:3000/'
  const arabicOf = bytes => [
    { url: FONTS.cairoArabic, transferSize: bytes },
    { url: FONTS.geistLatin, transferSize: 200_000 }
  ]

  it('fails an Arabic route whose Arabic-script fonts exceed the budget', () => {
    const s = summarise([
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET + 1) },
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET + 1) },
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET + 1) }
    ])
    expect(s.metrics['fonts:arabic-script'].pass).toBe(false)
    expect(s.failures.join(' ')).toMatch(/Arabic-script fonts/)
  })

  it('passes at exactly the budget', () => {
    const s = summarise([
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET) },
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET) },
      { url: AR, fonts: arabicOf(ARABIC_FONT_BUDGET) }
    ])
    expect(s.metrics['fonts:arabic-script'].pass).toBe(true)
    expect(s.failures).toHaveLength(0)
  })

  // The correction itself: 200 KB of Latin bytes on the same page must not fail an Arabic budget.
  it('does not charge Latin or monospace bytes to the Arabic budget', () => {
    const s = summarise([
      { url: AR, fonts: arabicOf(1000) },
      { url: AR, fonts: arabicOf(1000) },
      { url: AR, fonts: arabicOf(1000) }
    ])
    expect(s.metrics['fonts:all-scripts'].median).toBe(201_000)
    expect(s.metrics['fonts:all-scripts'].median).toBeGreaterThan(ARABIC_FONT_BUDGET)
    expect(s.metrics['fonts:arabic-script'].pass).toBe(true)
    expect(s.failures).toHaveLength(0)
  })

  it('reports the combined total as a diagnostic that can never block', () => {
    const huge = [{ url: FONTS.geistLatin, transferSize: 5_000_000 }]
    const s = summarise([{ url: AR, fonts: huge }, { url: AR, fonts: huge }, { url: AR, fonts: huge }])
    expect(s.metrics['fonts:all-scripts'].median).toBe(5_000_000)
    expect(s.metrics['fonts:all-scripts'].pass).toBeNull()
    expect(s.metrics['fonts:non-arabic-script'].pass).toBeNull()
    expect(s.failures).toHaveLength(0)
  })

  it('records but does not assert Arabic-script bytes on a Latin route', () => {
    const s = summarise([{ url: EN }, { url: EN }, { url: EN }])
    expect(s.metrics['fonts:arabic-script'].median).toBe(0)
    expect(s.metrics['fonts:arabic-script'].pass).toBeNull()
    expect(s.metrics['fonts:arabic-script'].limit).toBeNull()
  })
})

describe('D20-16 — the mobile /ar ceiling, exercised on the run that produced it', () => {
  const AR = 'http://127.0.0.1:3000/ar'

  /** The three real readings from CI run 30255314618, the run this ceiling was set against. */
  const CI_RUN_LCP = [4723, 4381, 4734]

  it('passes at the 5000 ms ceiling and records the 4000 ms target as unmet', () => {
    const s = summarise(CI_RUN_LCP.map(lcp => ({ formFactor: 'mobile', url: AR, lcp })))
    const m = s.metrics['largest-contentful-paint']

    expect(m.median).toBe(4723)
    expect(m.limit).toBe(5000)
    expect(m.pass).toBe(true)
    // The whole point of the split: passing the gate must not erase the missed target.
    expect(m.target).toBe(4000)
    expect(m.targetMet).toBe(false)
    expect(s.failures).toEqual([])
    expect(overallVerdict([s]).code).toBe(0)
  })

  it('still fails above the ceiling — the gate was relaxed, not removed', () => {
    const s = summarise([5200, 5100, 5300].map(lcp => ({ formFactor: 'mobile', url: AR, lcp })))
    expect(s.metrics['largest-contentful-paint'].pass).toBe(false)
    expect(overallVerdict([s]).code).toBe(1)
  })

  it('marks the target met once the route reaches it', () => {
    const s = summarise([3800, 3700, 3900].map(lcp => ({ formFactor: 'mobile', url: AR, lcp })))
    const m = s.metrics['largest-contentful-paint']
    expect(m.pass).toBe(true)
    expect(m.targetMet).toBe(true)
  })

  it('leaves an un-ceilinged configuration reporting no target at all', () => {
    // Mobile `/` keeps the 4000 ms device budget, so there is no second number to report.
    const s = summarise([3200, 3100, 3300].map(lcp => ({ formFactor: 'mobile', lcp })))
    const m = s.metrics['largest-contentful-paint']
    expect(m.limit).toBe(4000)
    expect(m.target).toBeNull()
    expect(m.targetMet).toBeNull()
  })
})
