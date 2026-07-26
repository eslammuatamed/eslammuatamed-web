/**
 * Pure aggregation + threshold logic for the Lighthouse gate (doc 20 §1/§5, D20-13).
 *
 * Split out of `check-lighthouse-medians.mjs` for the same reason as `route-assets.mjs`: a gate that
 * silently aggregates the WRONG runs is worse than no gate, and every failure mode here — averaging
 * instead of taking a median, mixing desktop and mobile into one group, quietly passing on two runs
 * when three were required — is invisible in the final number.
 *
 * WHY THIS EXISTS AT ALL, rather than LHCI's native `assert` block. The approved semantics (D20-13)
 * are project-specific in ways a threshold list cannot express:
 *   - exactly THREE comparable runs per configuration, where fewer is an INFRASTRUCTURE failure and
 *     never a low score (LHCI would happily assert over one or two);
 *   - grouping by authoritative run configuration (`configSettings.formFactor`), never by filename;
 *   - refusing to compare runs from different Lighthouse versions or different URLs.
 * The thresholds themselves were NOT loosened to fit the tool.
 */

/**
 * doc 20 §1 VERBATIM (D20-13). Re-baselining requires an owner decision plus a decision-log entry in
 * `eslammuatamed-docs/docs/20-performance.md` — never an edit here.
 *
 * Performance differs by form factor because the mobile profile emulates throttled hardware: doc 20
 * §5's same-version control apps show a bilingual Nuxt page with ZERO app code already ships
 * 136.3 KB gz of framework. Accessibility, Best Practices and SEO stay at 100 in both profiles
 * because they are correctness properties, not hardware-bound ones — and they are already met.
 */
export const CATEGORY_THRESHOLDS = {
  desktop: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 },
  mobile: { performance: 60, accessibility: 100, 'best-practices': 100, seo: 100 }
}

/**
 * Numeric limits carried over UNCHANGED from the previous gate — D20-13 changed no numeric budget.
 * They are now asserted on the median rather than per-run, which is the only change.
 */
export const METRIC_LIMITS = {
  'largest-contentful-paint': { limit: 1200, unit: 'ms', label: 'LCP (doc 20 §1, lab)' },
  'cumulative-layout-shift': { limit: 0.05, unit: '', label: 'CLS (doc 20 §1)' },
  'resource-summary:font:size': { limit: 130 * 1024, unit: 'B', label: 'Fonts, per script (doc 20 §1)' }
}

/** Recorded for every configuration but NOT asserted: doc 20 §1 states no TBT or Speed Index budget. */
export const REPORTED_ONLY = {
  'total-blocking-time': { unit: 'ms', label: 'TBT' },
  'speed-index': { unit: 'ms', label: 'Speed Index' }
}

export const RUNS_REQUIRED = 3

/**
 * True median: sort, take the middle. NOT the mean, NOT the best.
 *
 * The best run measures the luckiest sample, so a runner hiccup would decide a build in either
 * direction. The mean lets one catastrophic outlier drag a healthy pair under a threshold. The
 * median is the only one of the three that ignores the magnitude of an outlier while still
 * requiring a majority of runs to be healthy.
 * @param {number[]} values
 */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('median() needs at least one value')
  if (values.some(v => !Number.isFinite(v))) throw new Error('median() needs finite numbers')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Total transfer bytes of font resources in one report, or null when unavailable. */
function fontBytes(lhr) {
  const items = lhr?.audits?.['resource-summary']?.details?.items
  if (!Array.isArray(items)) return null
  const row = items.find(item => item.resourceType === 'font')
  return row ? Number(row.transferSize ?? 0) : 0
}

/**
 * Extract exactly the values D20-13 requires from one Lighthouse report.
 * Throws on a report that cannot be interpreted — a corrupt result is an infrastructure failure,
 * never a zero score that would silently fail the build for the wrong reason.
 * @param {object} lhr
 * @param {string} source path, used only in error messages
 */
export function readReport(lhr, source = '<report>') {
  const formFactor = lhr?.configSettings?.formFactor
  if (formFactor !== 'mobile' && formFactor !== 'desktop') {
    throw new Error(`${source}: configSettings.formFactor is "${formFactor}" — cannot tell which profile this run belongs to`)
  }
  const url = lhr?.requestedUrl
  if (typeof url !== 'string' || !url) throw new Error(`${source}: missing requestedUrl`)

  const categories = {}
  for (const key of Object.keys(CATEGORY_THRESHOLDS[formFactor])) {
    const score = lhr?.categories?.[key]?.score
    if (!Number.isFinite(score)) throw new Error(`${source}: category "${key}" has no numeric score`)
    // Raw 0–1 float × 100, deliberately NOT rounded: a 0.9451 that DISPLAYS as 95 must fail ≥ 95.
    categories[key] = score * 100
  }

  const metrics = {}
  for (const id of Object.keys(METRIC_LIMITS)) {
    metrics[id] = id === 'resource-summary:font:size'
      ? fontBytes(lhr)
      : lhr?.audits?.[id]?.numericValue ?? null
  }
  for (const id of Object.keys(REPORTED_ONLY)) {
    metrics[id] = lhr?.audits?.[id]?.numericValue ?? null
  }

  return { source, formFactor, url, lighthouseVersion: lhr.lighthouseVersion ?? 'unknown', categories, metrics }
}

/** Stable key for one tested configuration. Profile and URL never share a median. */
export function groupKey(run) {
  return `${run.formFactor} ${run.url}`
}

/**
 * Group runs by profile × URL, from the reports' own configuration — never from filenames, which
 * an output-directory convention could silently get wrong.
 * @param {ReturnType<typeof readReport>[]} runs
 */
export function groupRuns(runs) {
  const groups = new Map()
  for (const run of runs) {
    const key = groupKey(run)
    if (!groups.has(key)) groups.set(key, { formFactor: run.formFactor, url: run.url, runs: [] })
    groups.get(key).runs.push(run)
  }
  return [...groups.values()].sort((a, b) => groupKey(a).localeCompare(groupKey(b)))
}

/**
 * Reduce one configuration's runs to medians + verdicts.
 *
 * `problems` are INFRASTRUCTURE faults (wrong run count, mixed provenance) and are kept separate
 * from `failures`, which are genuine threshold breaches — the caller maps them to different exit
 * codes because "the gate could not measure" and "the site got slower" demand different responses.
 * @param {{formFactor: string, url: string, runs: any[]}} group
 */
export function summariseGroup(group) {
  const problems = []
  const { runs, formFactor, url } = group

  if (runs.length !== RUNS_REQUIRED) {
    problems.push(
      `expected ${RUNS_REQUIRED} comparable runs, found ${runs.length}`
      + ' — an incomplete collection is an infrastructure failure, not a score'
    )
  }
  const versions = [...new Set(runs.map(r => r.lighthouseVersion))]
  if (versions.length > 1) {
    problems.push(`runs came from different Lighthouse versions (${versions.join(', ')}) — they are not comparable`)
  }

  const categories = {}
  const failures = []
  if (!problems.length) {
    for (const [key, threshold] of Object.entries(CATEGORY_THRESHOLDS[formFactor])) {
      const values = runs.map(r => r.categories[key])
      const value = median(values)
      const pass = value >= threshold
      categories[key] = { values, median: value, threshold, pass }
      if (!pass) {
        failures.push(`${key} median ${value.toFixed(1)} < required ${threshold} (runs: ${values.map(v => v.toFixed(1)).join(', ')})`)
      }
    }
  }

  const metrics = {}
  for (const [id, spec] of Object.entries({ ...METRIC_LIMITS, ...REPORTED_ONLY })) {
    const values = runs.map(r => r.metrics[id]).filter(v => Number.isFinite(v))
    if (values.length !== runs.length || !runs.length) {
      metrics[id] = { values, median: null, ...spec, pass: null }
      continue
    }
    const value = median(values)
    const limit = METRIC_LIMITS[id]?.limit
    const pass = limit === undefined ? null : value <= limit
    metrics[id] = { values, median: value, ...spec, pass }
    if (pass === false && !problems.length) {
      failures.push(`${spec.label} median ${value} exceeds ${limit}${spec.unit} (runs: ${values.join(', ')})`)
    }
  }

  return { formFactor, url, runs, categories, metrics, problems, failures }
}

/** @param {ReturnType<typeof summariseGroup>[]} summaries */
export function overallVerdict(summaries) {
  if (!summaries.length) return { code: 2, reason: 'no Lighthouse reports were found' }
  if (summaries.some(s => s.problems.length)) return { code: 2, reason: 'incomplete or incomparable Lighthouse runs' }
  if (summaries.some(s => s.failures.length)) return { code: 1, reason: 'a median breached a doc 20 §1 threshold' }
  return { code: 0, reason: 'all medians within doc 20 §1 thresholds' }
}
