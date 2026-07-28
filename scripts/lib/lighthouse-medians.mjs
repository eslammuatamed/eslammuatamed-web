/**
 * Pure aggregation + threshold logic for the Lighthouse gate (doc 20 §1/§5, D20-13/14/15).
 *
 * Split out of `check-lighthouse-medians.mjs` for the same reason as `route-assets.mjs`: a gate that
 * silently aggregates the WRONG runs is worse than no gate, and every failure mode here — averaging
 * instead of taking a median, mixing desktop and mobile into one group, quietly passing on two runs
 * when three were required, charging Latin bytes to an Arabic budget — is invisible in the final
 * number.
 *
 * WHY THIS EXISTS AT ALL, rather than LHCI's native `assert` block. The approved semantics are
 * project-specific in ways a threshold list cannot express:
 *   - exactly THREE comparable runs per configuration, where fewer is an INFRASTRUCTURE failure and
 *     never a low score (LHCI would happily assert over one or two);
 *   - grouping by authoritative run configuration (`configSettings.formFactor`), never by filename;
 *   - refusing to compare runs from different Lighthouse versions or different URLs;
 *   - budgets whose applicability depends on the run context — LCP on the emulated DEVICE (D20-14),
 *     the font budget on the SCRIPT of each resource and the LOCALE of the route (D20-15).
 * The thresholds themselves were NOT loosened to fit the tool.
 */

/**
 * doc 20 §1 VERBATIM. Re-baselining requires an owner decision plus a decision-log entry in
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
 * LCP lab budgets are DEVICE-SCOPED (D20-14, owner decision 2026-07-27).
 *
 * The previous single 1200 ms figure was applied to both profiles, which compared two different
 * measurements against one number. Lighthouse's mobile profile emulates a mid-tier phone on a
 * throttled connection; its desktop profile does not. The same build, same commit, same serving
 * layer produced 653–891 ms desktop and 3.0–3.9 s mobile — a ~4x gap that is the EMULATION, not the
 * application. A budget that ignores the device it is measured on cannot be met by any amount of
 * application work, and an unreachable gate is one that gets muted (the failure mode D20-11 and
 * D20-13 both corrected).
 *
 * These are LAB budgets, scoped to Lighthouse's own emulated devices under the throttling profile
 * pinned in `lighthouserc.cjs`. They are NOT the doc 20 §1 FIELD target (< 1.8 s p75), which is
 * measured on real devices and is unchanged.
 */
export const LCP_LIMITS = { desktop: 1200, mobile: 4000 }

/**
 * Route + device specific CI REGRESSION CEILINGS that override `LCP_LIMITS` (D20-16 and D20-17,
 * owner decisions 2026-07-27 and 2026-07-28). Matched on the exact pathname — `/ar` is the Arabic
 * HOME route only, never its children: `/ar/blog/<slug>` measured 2667 ms on the same run and keeps
 * the unmodified 4000 ms. `/ar/projects` is likewise the Arabic projects INDEX only, never
 * `/ar/projects/<slug>` and never a prefix match such as `/ar/projects-extra`.
 *
 * WHY THIS EXISTS, AND WHAT IT IS NOT. D20-14 set mobile at 4000 ms from measurements taken on a
 * local developer workstation (a 3.0–3.9 s band), and doc 20 §5 recorded in its own words that the
 * figure "must be re-taken on CI hardware before any conclusion is drawn about the threshold". Run
 * 30255314618 is that re-take: on CI hardware mobile `/ar` measured 4723 / 4381 / 4734 ms — all
 * three runs over, so a consistent property of the configuration rather than one unlucky sample.
 * The budget had been calibrated on different hardware than the gate runs on.
 *
 * 5000 ms is ~5.6 % above the measured maximum (4734 ms). That is deliberately tight: a real
 * regression on this route still trips the gate, and no other route or device is relaxed to reach it.
 *
 * D20-17 (2026-07-28) adds mobile `/ar/projects` at 5500 ms for a DIFFERENT reason, reached by the
 * same mechanism. Here the gate was not consistently over budget — it was non-deterministic AT the
 * boundary. The PR #23 baseline investigation measured 12 runs of a byte-equivalent tree
 * (5101/2810/2804, 5106/2826/5111, 5128/4050/3676, 5128/2826/3975): exactly 6 of 12 above 4000 ms
 * and 6 below, pooled median 4012.5 ms, gate outcomes 2 pass / 2 fail, and a controlled diagnostic
 * on unchanged `dev` that passed by 25 ms. The variance is isolated to LCP RENDER DELAY
 * (2326–4649 ms) against a near-constant TTFB (472–482 ms) and an invariant payload (523,327 B,
 * 47 requests) — a text LCP element whose paint waits on the main thread under CPU throttling, so
 * the result is bimodal (~2.8 s fast mode / ~5.1 s slow mode) from bytes that never changed.
 * 5500 ms is the measured slow cluster (5101–5128 ms) rounded up to the next 500 ms boundary.
 *
 * D20-17 is a SEPARATE entry, not a widening of D20-16: broadening `/ar` to all Arabic routes would
 * relax routes never measured over budget. Two narrow entries state what was measured; one broad
 * rule would state more than the evidence supports.
 *
 * This is a CI regression ceiling. It is NOT a redefinition of good LCP, NOT a statement that this
 * route needs no further work, and NOT a licence to re-baseline from future results — the value is
 * a frozen constant, exactly as D20-12 froze the app-code budget, because a threshold recomputed
 * from each run measures nothing. The 4000 ms figure survives as a non-blocking QUALITY TARGET
 * (`LCP_QUALITY_TARGETS`), reported on every run so an unmet target stays visible rather than
 * disappearing behind a passing gate.
 */
export const LCP_ROUTE_CEILINGS = [
  { formFactor: 'mobile', pathname: '/ar', ceiling: 5000 },
  { formFactor: 'mobile', pathname: '/ar/projects', ceiling: 5500 }
]

/**
 * The non-blocking optimization target a configuration is ALSO measured against (D20-16).
 *
 * Only meaningful where a ceiling override raised the asserted bound above the device budget: the
 * gate asserts the ceiling, and reports the target it did or did not meet. Keeping both visible is
 * the point of the split — relaxing the gate without recording what was given up is how a
 * temporary ceiling quietly becomes the standard.
 */
export const LCP_QUALITY_TARGETS = { mobile: 4000, desktop: 1200 }

/**
 * The per-script font budget, in bytes (doc 20 §1, scope clarified by D20-15).
 *
 * §1 has always written this budget "per script". It was previously ASSERTED against
 * `resource-summary`'s font row, which is the sum of EVERY font resource on the page regardless of
 * script — so on a bilingual `/ar` view the Latin body face, the Latin display face and the mono
 * data face were all charged to the Arabic budget. That is not the budget §1 states, and the only
 * ways to satisfy the mis-scoped sum were to delete approved families or weights (doc 03 §3 —
 * brand typography is non-negotiable) or to re-scope faces in a way that changes approved rendering.
 * Neither is a performance decision.
 */
export const ARABIC_FONT_BUDGET = 130 * 1024

/**
 * Numeric limits asserted on the median.
 *
 * `limit` is either a plain number (context-free) or a map keyed by form factor (device-scoped).
 * `scope: 'arabic-routes'` marks a budget that only APPLIES on Arabic routes; elsewhere the value is
 * still measured and printed, but not asserted. Resolve both through `limitFor()` — never read
 * `.limit` directly, or a per-device budget prints and asserts the wrong bound.
 */
export const METRIC_LIMITS = {
  'largest-contentful-paint': { limit: LCP_LIMITS, unit: 'ms', label: 'LCP (doc 20 §1 lab, per device)' },
  'cumulative-layout-shift': { limit: 0.05, unit: '', label: 'CLS (doc 20 §1)' },
  'fonts:arabic-script': {
    limit: ARABIC_FONT_BUDGET,
    unit: 'B',
    scope: 'arabic-routes',
    label: 'Arabic-script fonts (doc 20 §1)'
  }
}

/**
 * Recorded for every configuration but NOT asserted.
 *
 * TBT and Speed Index: doc 20 §1 states no budget, and inventing budgets is forbidden.
 *
 * The two font aggregates are DIAGNOSTICS by owner decision (D20-15): the combined per-route font
 * transfer stays visible because it is the number that governs real bandwidth on a bilingual page,
 * but it is not release-blocking under the Arabic-specific threshold — charging both scripts to a
 * per-script budget is exactly the mis-scoping D20-15 corrected. No Latin-script threshold is
 * asserted either: §1's "per script" phrasing could support one, but introducing a second blocking
 * budget is a new gate and therefore an owner decision, not an implementation detail.
 */
export const REPORTED_ONLY = {
  'fonts:non-arabic-script': { unit: 'B', label: 'Non-Arabic-script fonts (diagnostic)' },
  'fonts:all-scripts': { unit: 'B', label: 'Fonts, all scripts (diagnostic)' },
  'total-blocking-time': { unit: 'ms', label: 'TBT' },
  'speed-index': { unit: 'ms', label: 'Speed Index' }
}

export const RUNS_REQUIRED = 3

/**
 * Font subset → writing script.
 *
 * Keys are fontsource's own subset tokens, which every self-hosted face in this project carries in
 * its filename (`<family>-<subset>-<axis|weight>-<style>.<hash>.woff2`). This table is the ONLY
 * place a subset is judged Arabic or not, and an unlisted subset is an infrastructure failure rather
 * than a silent "not Arabic" — otherwise a newly added Arabic subset would slip past the budget it
 * exists to enforce, which is precisely the direction the gate must not fail in.
 */
export const FONT_SUBSET_SCRIPTS = {
  arabic: 'arabic',
  latin: 'latin',
  'latin-ext': 'latin',
  vietnamese: 'latin',
  cyrillic: 'cyrillic',
  'cyrillic-ext': 'cyrillic',
  greek: 'greek',
  'greek-ext': 'greek'
}

/** Longest-first, so `latin-ext` is matched before `latin` rather than being truncated to it. */
const SUBSETS_LONGEST_FIRST = Object.keys(FONT_SUBSET_SCRIPTS).sort((a, b) => b.length - a.length)

/** `<stem>.<content-hash>.<ext>` — the hash is optional so an unhashed asset still parses. */
const FONT_FILENAME = /^(.+?)(?:\.[A-Za-z0-9_-]{6,12})?\.(?:woff2|woff|ttf|otf)$/
/** fontsource's stem tail: a variable axis (`wght`) or a static weight, then the style. */
const FONT_STEM = /^(.+)-(?:wght|\d{3})-(?:normal|italic)$/

/**
 * Classify one font resource by the writing script it serves.
 *
 * Parsing is anchored at the END of the stem, because the family name is of unknown length and can
 * itself contain a script token: `ibm-plex-sans-arabic-arabic-400-normal` is the ARABIC subset of a
 * family called "IBM Plex Sans Arabic", while a hypothetical `ibm-plex-sans-arabic-latin-400-normal`
 * would be that same family's LATIN subset and must not count against the Arabic budget. Matching
 * the subset as a suffix of `family-subset` gets both right; a substring test for "arabic" would get
 * the second one wrong.
 *
 * Throws on anything it cannot positively identify — see `FONT_SUBSET_SCRIPTS`.
 * @param {string} url absolute resource URL
 * @param {string} source report path, used only in error messages
 */
export function classifyFontResource(url, source = '<report>') {
  let file
  try {
    file = new URL(url).pathname.split('/').pop() ?? ''
  } catch {
    throw new Error(`${source}: font resource has an unparseable URL (${url})`)
  }

  const named = FONT_FILENAME.exec(file)
  if (!named) {
    throw new Error(
      `${source}: cannot classify font resource "${file}" — expected a fontsource asset named`
      + ' <family>-<subset>-<wght|weight>-<style>.<hash>.<ext>. An unclassifiable font is an'
      + ' infrastructure failure, never an assumed non-Arabic one'
    )
  }
  const stem = FONT_STEM.exec(named[1])
  if (!stem) {
    throw new Error(
      `${source}: cannot classify font resource "${file}" — its name carries no <wght|weight>-<style>`
      + ' tail, so the subset cannot be located'
    )
  }

  const familyAndSubset = stem[1]
  for (const subset of SUBSETS_LONGEST_FIRST) {
    if (familyAndSubset.endsWith(`-${subset}`)) {
      return { file, subset, script: FONT_SUBSET_SCRIPTS[subset] }
    }
  }
  throw new Error(
    `${source}: font resource "${file}" declares a subset that FONT_SUBSET_SCRIPTS does not know.`
    + ' Add it there deliberately — an unknown subset must never be assumed non-Arabic, or a new'
    + ' Arabic face would silently escape the doc 20 §1 budget'
  )
}

/** Total transfer bytes of font resources per `resource-summary`, or null when unavailable. */
function summaryFontBytes(lhr) {
  const items = lhr?.audits?.['resource-summary']?.details?.items
  if (!Array.isArray(items)) return null
  const row = items.find(item => item.resourceType === 'font')
  return row ? Number(row.transferSize ?? 0) : 0
}

/**
 * Split one report's font transfer by script.
 *
 * Reads `network-requests`, which is the only audit that reports fonts INDIVIDUALLY;
 * `resource-summary` gives a single script-blind total and so cannot express a per-script budget at
 * all. That total is still read back as a cross-check: if the per-resource sum and the summary
 * disagree, some font resource was missed, and reporting a smaller-than-real Arabic number would be
 * a gate that passes for the wrong reason.
 * @param {object} lhr
 * @param {string} source path, used only in error messages
 */
export function fontTotalsByScript(lhr, source = '<report>') {
  const items = lhr?.audits?.['network-requests']?.details?.items
  if (!Array.isArray(items)) {
    throw new Error(
      `${source}: the network-requests audit is missing, so fonts cannot be split by script.`
      + ' The per-script budget cannot be asserted from resource-summary alone'
    )
  }

  const byScript = {}
  let arabic = 0
  let nonArabic = 0
  let count = 0
  for (const item of items) {
    if (item?.resourceType !== 'Font') continue
    count += 1
    const bytes = Number(item.transferSize ?? 0)
    if (!Number.isFinite(bytes)) {
      throw new Error(`${source}: font resource ${item.url} has a non-numeric transferSize`)
    }
    const { script } = classifyFontResource(item.url, source)
    byScript[script] = (byScript[script] ?? 0) + bytes
    if (script === 'arabic') arabic += bytes
    else nonArabic += bytes
  }

  const total = arabic + nonArabic
  const summary = summaryFontBytes(lhr)
  if (summary !== null && summary !== total) {
    throw new Error(
      `${source}: per-resource font bytes (${total}) disagree with resource-summary (${summary}).`
      + ' Some font resource was not counted, so the per-script split cannot be trusted'
    )
  }

  return { arabic, nonArabic, total, count, byScript }
}

/** True for the Arabic locale's routes — `/ar` and everything beneath it. */
export function isArabicRoute(url) {
  let pathname
  try {
    ({ pathname } = new URL(url))
  } catch {
    throw new Error(`cannot determine locale from an unparseable URL (${url})`)
  }
  return pathname === '/ar' || pathname.startsWith('/ar/')
}

/**
 * Resolve the limit that applies to one metric in one run context, or null when the metric is
 * recorded but not asserted there.
 *
 * Every read of a threshold goes through here — printing included. A per-device budget that is
 * ASSERTED correctly but PRINTED from a stale flat number is a gate whose output contradicts its
 * verdict, which is how a wrong bound survives review.
 * @param {string} id metric id
 * @param {{formFactor: string, url: string}} context
 */
export function limitFor(id, { formFactor, url }) {
  const spec = METRIC_LIMITS[id]
  if (!spec) return null
  if (spec.scope === 'arabic-routes' && !isArabicRoute(url)) return null

  const { limit } = spec
  if (typeof limit === 'number') return limit

  const resolved = limit[formFactor]
  if (!Number.isFinite(resolved)) {
    throw new Error(`${id} has no limit defined for form factor "${formFactor}"`)
  }

  // A route+device ceiling overrides the device budget where one is defined (D20-16). Applied here,
  // inside the single resolver, so the ceiling cannot be asserted in one place and printed from the
  // un-overridden constant in another.
  const ceiling = ceilingFor(id, { formFactor, url })
  return ceiling === null ? resolved : ceiling
}

/**
 * The route+device ceiling that overrides the device budget for `id` here, or null when none does.
 * LCP is the only metric with ceilings today; the lookup is keyed by id so adding another cannot
 * silently inherit LCP's table.
 * @param {string} id metric id
 * @param {{formFactor: string, url: string}} context
 */
export function ceilingFor(id, { formFactor, url }) {
  if (id !== 'largest-contentful-paint') return null
  let pathname
  try {
    ({ pathname } = new URL(url))
  } catch {
    throw new Error(`cannot resolve an LCP ceiling from an unparseable URL (${url})`)
  }
  const match = LCP_ROUTE_CEILINGS.find(c => c.formFactor === formFactor && c.pathname === pathname)
  return match ? match.ceiling : null
}

/**
 * The non-blocking quality target for `id` here, or null when the asserted bound already IS the
 * target. Returned only where a ceiling raised the bound above it, so the gate can report a target
 * it missed while still passing (D20-16).
 * @param {string} id metric id
 * @param {{formFactor: string, url: string}} context
 */
export function qualityTargetFor(id, { formFactor, url }) {
  if (ceilingFor(id, { formFactor, url }) === null) return null
  const target = LCP_QUALITY_TARGETS[formFactor]
  return Number.isFinite(target) ? target : null
}

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

/**
 * Extract exactly the values the gate requires from one Lighthouse report.
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

  const fonts = fontTotalsByScript(lhr, source)

  const metrics = {
    'fonts:arabic-script': fonts.arabic,
    'fonts:non-arabic-script': fonts.nonArabic,
    'fonts:all-scripts': fonts.total
  }
  for (const id of [...Object.keys(METRIC_LIMITS), ...Object.keys(REPORTED_ONLY)]) {
    if (id in metrics) continue
    metrics[id] = lhr?.audits?.[id]?.numericValue ?? null
  }

  return { source, formFactor, url, lighthouseVersion: lhr.lighthouseVersion ?? 'unknown', categories, metrics, fonts }
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
    // Resolved per configuration, not per metric: LCP is device-scoped and the Arabic font budget
    // applies only to Arabic routes, so the SAME id carries a different bound — or none — here.
    const limit = runs.length ? limitFor(id, { formFactor, url }) : null
    // Non-blocking, and only present where a D20-16 ceiling raised `limit` above it.
    const target = runs.length ? qualityTargetFor(id, { formFactor, url }) : null
    const values = runs.map(r => r.metrics[id]).filter(v => Number.isFinite(v))
    if (values.length !== runs.length || !runs.length) {
      metrics[id] = { values, median: null, ...spec, limit, target, targetMet: null, pass: null }
      continue
    }
    const value = median(values)
    const pass = limit === null ? null : value <= limit
    // Recorded regardless of the verdict: a missed target must stay visible on a passing gate.
    const targetMet = target === null ? null : value <= target
    metrics[id] = { values, median: value, ...spec, limit, target, targetMet, pass }
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
