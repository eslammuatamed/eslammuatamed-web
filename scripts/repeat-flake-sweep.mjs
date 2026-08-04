#!/usr/bin/env node
/**
 * The repeat-flake gate, as a COMMITTED sequence rather than a hand-assembled command line.
 *
 * WHY THIS EXISTS. A repeat sweep is how a flake is distinguished from a defect, so it is only
 * evidence if it is reproducible by someone other than whoever ran it. The previous sweep was
 * assembled ad hoc, and two things went wrong that this file exists to make impossible:
 *
 *   1. It ran every project under one invocation. Playwright groups work by (file, repeatEachIndex),
 *      so `--repeat-each` splits the Dashboard spec's repeat copies across workers — and those
 *      copies then race on the ONE mutable backend that lane shares. Measured: `--repeat-each=3
 *      --workers=2` produced 10 Dashboard failures; the identical run at `--workers=1` produced 0.
 *      The failures were interference between repeat copies, not product behaviour, and a sweep that
 *      manufactures its own failures cannot certify anything.
 *   2. Its totals were reported as one number, so a Dashboard contention failure and a genuine
 *      public regression were indistinguishable in the summary.
 *
 * So the sweep is THREE runs with three separately reported totals, matching the test architecture:
 *
 *   public   — every non-Dashboard project, at the documented CI worker count (2).
 *   dashboard— the Dashboard project alone, workers 1, because its backend is mutable and shared.
 *   race     — the committed real-API lane, at its own governed worker count (1, from its config).
 *
 * NOTHING HERE WEAKENS A TEST. `--retries=0` is passed explicitly to every run so an inherited
 * default can never retry a flake into a false green, no timeout is raised, and a non-zero exit from
 * any lane fails the whole sweep. If a lane still fails, that is a finding to classify through the
 * governed base-vs-head differential process — not something to rerun until it is green.
 */
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPEAT = Number(process.env.REPEAT_EACH ?? 3)
/** The count `ci.yml` runs the browser suite with. Kept in one place so the two cannot drift. */
const CI_WORKERS = 2

const work = mkdtempSync(join(tmpdir(), 'repeat-sweep-'))

/** Playwright's JSON reporter is the only total we trust — stdout wording changes between releases. */
function runLane({ key, label, args }) {
  const jsonPath = join(work, `${key}.json`)
  console.log(`\n━━ ${label} ━━\n$ npx playwright test ${args.join(' ')}\n`)
  const res = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: process.env.CI ?? '1',
      PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath
    }
  })

  let totals = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
  try {
    const report = JSON.parse(readFileSync(jsonPath, 'utf8'))
    totals = {
      expected: report.stats?.expected ?? 0,
      unexpected: report.stats?.unexpected ?? 0,
      flaky: report.stats?.flaky ?? 0,
      skipped: report.stats?.skipped ?? 0
    }
  } catch {
    // A lane that cannot even produce a report is a failure, never a silent zero.
    totals.unexpected = Math.max(totals.unexpected, res.status === 0 ? 0 : 1)
  }
  return { key, label, exit: res.status ?? 1, totals }
}

const lanes = [
  {
    key: 'public',
    label: `PUBLIC / non-Dashboard  ·  repeat-each=${REPEAT}  ·  workers=${CI_WORKERS}  ·  retries=0`,
    args: [
      '--project=contract', '--project=ssr-scenarios', '--project=about-readiness', '--project=resume-pdf',
      `--repeat-each=${REPEAT}`, `--workers=${CI_WORKERS}`, '--retries=0', '--reporter=json'
    ]
  },
  {
    key: 'dashboard',
    label: `DASHBOARD  ·  repeat-each=${REPEAT}  ·  workers=1  ·  retries=0`,
    args: [
      '--project=dashboard',
      `--repeat-each=${REPEAT}`, '--workers=1', '--retries=0', '--reporter=json'
    ]
  },
  {
    key: 'race',
    label: 'REAL-API RACE  ·  governed worker count from playwright.race.config.ts  ·  retries=0',
    args: ['--config=playwright.race.config.ts', '--retries=0', '--reporter=json']
  }
]

const results = []
for (const lane of lanes) results.push(runLane(lane))

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n${'═'.repeat(78)}\nREPEAT-FLAKE SWEEP — separate totals per lane\n${'═'.repeat(78)}`)
console.log(`${pad('lane', 12)}${pad('passed', 9)}${pad('failed', 9)}${pad('flaky', 8)}${pad('skipped', 9)}exit`)
let passed = 0; let failed = 0; let flaky = 0; let skipped = 0
for (const r of results) {
  console.log(`${pad(r.key, 12)}${pad(r.totals.expected, 9)}${pad(r.totals.unexpected, 9)}${pad(r.totals.flaky, 8)}${pad(r.totals.skipped, 9)}${r.exit}`)
  passed += r.totals.expected; failed += r.totals.unexpected
  flaky += r.totals.flaky; skipped += r.totals.skipped
}
console.log(`${'─'.repeat(78)}\n${pad('COMBINED', 12)}${pad(passed, 9)}${pad(failed, 9)}${pad(flaky, 8)}${pad(skipped, 9)}`)

rmSync(work, { recursive: true, force: true })

const bad = results.filter(r => r.exit !== 0 || r.totals.unexpected > 0 || r.totals.flaky > 0)
if (bad.length > 0) {
  console.error(`\n✗ Repeat sweep FAILED in: ${bad.map(r => r.key).join(', ')}`)
  console.error('  Classify these through the governed base-vs-head differential process.')
  console.error('  Do NOT rerun in isolation until green, and do NOT add a retry.')
  process.exit(1)
}
console.log('\n✓ Repeat sweep clean in every lane — no failure, no flake, nothing retried.')
