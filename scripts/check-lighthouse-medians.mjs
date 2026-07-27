#!/usr/bin/env node
/**
 * Lighthouse median gate — doc 20 §1 / §5 (D20-13, D20-14, D20-15).
 *
 * `npm run lhci` / `npm run lhci:desktop` COLLECT three runs per URL per profile into
 * `.lighthouseci/<profile>/`. This script ASSERTS the approved thresholds on the median of those
 * runs, and prints every individual run so a median can never hide instability behind a passing
 * number.
 *
 *     Performance     median ≥ 95 desktop  ·  ≥ 60 mobile
 *     A11y / BP / SEO median 100
 *     LCP (lab)       ≤ 1200 ms desktop  ·  ≤ 4000 ms mobile   — device-scoped (D20-14)
 *     CLS             ≤ 0.05
 *     Fonts           Arabic-SCRIPT resources ≤ 130 KiB on Arabic routes (D20-15); the combined
 *                     per-route total and the non-Arabic split are reported as diagnostics
 *     TBT / Speed Index        recorded, never asserted (doc 20 §1 states no budget)
 *
 * Runs are grouped by `configSettings.formFactor` × `requestedUrl` read from each report — the
 * AUTHORITATIVE run configuration, never the output filename or directory, either of which a
 * config change could silently invert.
 *
 * Exit codes mirror the size gate, for the same reason:
 *   0 — every median within threshold
 *   1 — a median breached a threshold (a real regression: fix the site)
 *   2 — infrastructure: fewer than three comparable runs, a corrupt/unreadable report, a report
 *       whose profile or URL cannot be determined, mixed Lighthouse versions, or no reports at all.
 *       Never converted into a low score, and never silently discarded.
 *
 * THRESHOLDS ARE doc 20 §1 VERBATIM (see lib/lighthouse-medians.mjs). Re-baselining requires an
 * owner decision plus a decision-log entry in doc 20 — never an edit here.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import {
  METRIC_LIMITS,
  RUNS_REQUIRED,
  groupRuns,
  isArabicRoute,
  overallVerdict,
  readReport,
  summariseGroup
} from './lib/lighthouse-medians.mjs'

const DIRS = process.env.LHCI_REPORT_DIRS
  ? process.env.LHCI_REPORT_DIRS.split(',').map(s => s.trim()).filter(Boolean)
  : ['.lighthouseci/mobile', '.lighthouseci/desktop']

class InfraError extends Error {}

/**
 * Load every Lighthouse report under the configured directories.
 *
 * A file that is not a report (LHCI also writes `manifest.json`) is skipped; a file that LOOKS like
 * a report but cannot be parsed or interpreted is an error. The distinction matters: silently
 * skipping a corrupt report would drop a run and turn a broken collection into a smaller — and
 * possibly still passing — sample.
 */
async function loadRuns() {
  const runs = []
  for (const dir of DIRS) {
    const entries = await readdir(dir).catch(() => null)
    if (entries === null) {
      throw new InfraError(
        `no Lighthouse reports at ${dir} — collect them first:\n`
        + '    npm run lhci            (mobile profile)\n'
        + '    npm run lhci:desktop    (desktop profile)'
      )
    }
    const reports = entries.filter(name => name.endsWith('.json') && name !== 'manifest.json')
    if (reports.length === 0) throw new InfraError(`${dir} contains no Lighthouse report JSON`)

    for (const name of reports.sort()) {
      const path = join(dir, name)
      let parsed
      try {
        parsed = JSON.parse(await readFile(path, 'utf8'))
      } catch (error) {
        throw new InfraError(`${path} is not valid JSON (${error.message}) — a corrupt report is an infrastructure failure, not a low score`)
      }
      // `manifest.json` is filtered above; anything else without categories is unexpected.
      if (!parsed?.categories) throw new InfraError(`${path} is not a Lighthouse report (no categories)`)
      try {
        runs.push(readReport(parsed, path))
      } catch (error) {
        throw new InfraError(error.message)
      }
    }
  }
  if (runs.length === 0) throw new InfraError('no Lighthouse reports were found in any configured directory')
  return runs
}

function fmt(value, unit) {
  if (value === null || value === undefined) return 'n/a'
  if (unit === 'B') return `${Math.round(value)} B (${(value / 1024).toFixed(1)} KB)`
  if (unit === 'ms') return `${Math.round(value)} ms`
  return String(Number(value.toFixed(4)))
}

async function main() {
  const runs = await loadRuns()
  const summaries = groupRuns(runs).map(summariseGroup)

  console.log(`\nLighthouse medians — doc 20 §1 (D20-13/14/15), ${RUNS_REQUIRED} runs per configuration`)
  console.log('Grouped by configSettings.formFactor × requestedUrl (run configuration, not filename).')
  console.log('Every individual run is shown: the median must not be able to hide instability.')
  console.log('LCP budgets are device-scoped (D20-14); the font budget is Arabic-script on Arabic routes (D20-15).\n')

  for (const s of summaries) {
    const locale = isArabicRoute(s.url) ? 'Arabic route' : 'Latin route'
    console.log(`── ${s.formFactor.toUpperCase()}  ${s.url}   (${s.runs.length} run${s.runs.length === 1 ? '' : 's'}, ${locale})`)

    if (s.problems.length) {
      for (const problem of s.problems) console.log(`   ✗ INFRASTRUCTURE: ${problem}`)
      console.log('')
      continue
    }

    for (const [key, c] of Object.entries(s.categories)) {
      console.log(
        `   ${c.pass ? '✓' : '✗'} ${key.padEnd(15)}`
        + ` runs [${c.values.map(v => v.toFixed(1).padStart(5)).join(', ')}]`
        + `  median ${c.median.toFixed(1).padStart(5)}  ≥ ${c.threshold}`
      )
    }
    for (const [id, m] of Object.entries(s.metrics)) {
      const mark = m.pass === null ? '·' : m.pass ? '✓' : '✗'
      // The bound comes from the SAME resolver the verdict used, so the printed limit can never
      // disagree with the one asserted — a device-scoped budget printed from a flat constant is how
      // a wrong bound survives review.
      // Two different reasons a metric carries no bound, kept distinct: doc 20 §1 states no budget
      // at all (TBT, Speed Index, the font diagnostics), versus a budget that exists but does not
      // apply to THIS run context (Arabic fonts on a Latin route). Collapsing them would read as
      // "unbudgeted" for a metric that is very much budgeted elsewhere.
      const bound = m.limit === null || m.limit === undefined
        ? (id in METRIC_LIMITS
            ? '(budget does not apply to this route)'
            : '(recorded, no doc 20 §1 budget)')
        : `≤ ${fmt(m.limit, m.unit)}`
      console.log(
        `   ${mark} ${m.label.padEnd(38)} runs [${m.values.map(v => fmt(v, m.unit)).join(', ')}]`
        + `  median ${fmt(m.median, m.unit)}  ${bound}`
      )
    }
    console.log('')
  }

  const verdict = overallVerdict(summaries)
  if (verdict.code === 0) {
    console.log('✓ All Lighthouse medians within the doc 20 §1 thresholds.')
    return 0
  }

  if (verdict.code === 2) {
    console.error(`✗ MEASUREMENT FAILURE (not a score verdict): ${verdict.reason}.`)
    for (const s of summaries) {
      for (const problem of s.problems) console.error(`  ${s.formFactor} ${s.url}: ${problem}`)
    }
    return 2
  }

  console.error('✗ doc 20 §1 Lighthouse thresholds not satisfied.')
  for (const s of summaries) {
    for (const failure of s.failures) console.error(`  ${s.formFactor} ${s.url}: ${failure}`)
  }
  console.error(
    '\n  These thresholds are normative. They are re-baselined ONLY by a decision-log entry in\n'
    + '  eslammuatamed-docs/docs/20-performance.md — never by editing this gate.'
  )
  return 1
}

let code
try {
  code = await main()
} catch (error) {
  console.error(`\n✗ MEASUREMENT FAILURE (not a score verdict): ${error instanceof InfraError ? error.message : (error?.stack ?? error)}`)
  code = 2
}
process.exit(code)
