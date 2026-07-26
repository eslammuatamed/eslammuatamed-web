import { describe, expect, it } from 'vitest'
import {
  CATEGORY_THRESHOLDS,
  METRIC_LIMITS,
  RUNS_REQUIRED,
  groupRuns,
  median,
  overallVerdict,
  readReport,
  summariseGroup
} from './lighthouse-medians.mjs'

/**
 * A synthetic Lighthouse report. Scores are given 0–100 for readability and converted to the 0–1
 * floats Lighthouse actually emits, so the tests exercise the same precision path as production.
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
  fonts = 120 * 1024
} = {}) {
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
      'resource-summary': { details: { items: [{ resourceType: 'font', transferSize: fonts }] } }
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

  it('asserts the UNCHANGED LCP and font limits on the median', () => {
    expect(METRIC_LIMITS['largest-contentful-paint'].limit).toBe(1200)
    expect(METRIC_LIMITS['resource-summary:font:size'].limit).toBe(130 * 1024)
    const s = summarise([{ lcp: 1500 }, { lcp: 1500 }, { lcp: 900 }])
    expect(s.metrics['largest-contentful-paint'].median).toBe(1500)
    expect(s.metrics['largest-contentful-paint'].pass).toBe(false)
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

describe('thresholds match doc 20 §1 (D20-13) verbatim', () => {
  it('pins the approved numbers so a change is deliberate', () => {
    expect(CATEGORY_THRESHOLDS.desktop).toEqual({
      performance: 95, accessibility: 100, 'best-practices': 100, seo: 100
    })
    expect(CATEGORY_THRESHOLDS.mobile).toEqual({
      performance: 60, accessibility: 100, 'best-practices': 100, seo: 100
    })
    expect(RUNS_REQUIRED).toBe(3)
  })
})
