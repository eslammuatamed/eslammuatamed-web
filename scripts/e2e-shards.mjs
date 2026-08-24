#!/usr/bin/env node
/**
 * The full e2e suite, run as BOUNDED SHARDS instead of ten process pairs at once.
 *
 * WHY THIS EXISTS. Every lane is a preview-server pair — a backend and the built Nitro server — and
 * `playwright.config.ts` now boots only the lanes an invocation selects (`scripts/e2e/lanes.ts`). A
 * FULL run selects nothing, so it still boots all of them, and that is the fixed cost R14 measured:
 * on 12 cores, ten pairs took peak load average 17.4, drove available memory down to 5.9 GB and added
 * ~1 GB of swap. FE-3 adds five content modules; at one pair per module the suite stops being
 * runnable long before the last one lands.
 *
 * This runner spends WALL CLOCK to buy back that headroom: it runs the suite as consecutive
 * invocations of at most `E2E_MAX_LANES` (default 4) lanes each, so the concurrent process count is
 * bounded by a governed constant rather than by the number of modules the campaign has shipped.
 * Sequential shards are strictly slower than one parallel run — the `contract` lane dominates and no
 * longer overlaps the rest — which is exactly why this was a SEPARATE script before R14 closed.
 *
 * SINCE R14 CLOSED, THIS RUNNER IS THE DEFAULT: `npm run test:e2e` delegates here (measured at
 * SEO-U4 — 15 pairs of full concurrency reproduced the R15 race class twice while 4-shard execution
 * ran 616/616 green), and CI runs the default script unchanged. The old high-concurrency behaviour
 * is preserved deliberately as `npm run test:e2e:unsharded` for reproducing R15 and infrastructure
 * diagnosis — it is NOT the recommended path and must not grow retries.
 *
 * WHAT IT IS NOT EVIDENCE FOR. The intermittent casualty that raised R14 — one test lost per full run
 * to `ECONNRESET` or a 30 s navigation timeout, a different test each time — did NOT reproduce on the
 * pre-change control run (471 passed, exit 0). A green run here therefore does not prove that symptom
 * is fixed, and this file does not claim it. What is bounded, and measurable on demand, is the
 * concurrent pair count.
 *
 * Reporting follows Playwright's documented multi-invocation idiom: each shard writes a `blob` report
 * to its own file, and `playwright merge-reports` combines them into ONE HTML report at the usual
 * path — so `playwright-report/` keeps meaning what it means today.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import process from 'node:process'
import { LANES, maxConcurrentLanes, shardPlan } from './e2e/lanes.ts'

const BLOB_DIR = 'blob-report'

const passthrough = process.argv.slice(2)
if (passthrough.some(arg => arg === '--project' || arg.startsWith('--project='))) {
  // Sharding IS the project selection. Accepting both would silently run a subset while reporting a
  // full-suite result, which is the one failure mode a suite runner must not have.
  console.error(
    '[e2e-shards] --project is not accepted: this runner derives the projects from '
      + 'scripts/e2e/lanes.ts. Run `npx playwright test --project=<name>` directly for one lane.'
  )
  process.exit(1)
}

const maxLanes = maxConcurrentLanes()
const shards = shardPlan(LANES, maxLanes)

console.log(
  `[e2e-shards] ${LANES.length} lanes in ${shards.length} shard(s), at most ${maxLanes} `
    + `concurrent preview pairs (E2E_MAX_LANES overrides).`
)

// A stale blob from an earlier run would be merged into this run's report as if it belonged to it.
rmSync(BLOB_DIR, { recursive: true, force: true })
mkdirSync(BLOB_DIR, { recursive: true })

const failures = []

shards.forEach((projects, index) => {
  const label = `shard ${index + 1}/${shards.length}`
  console.log(`\n[e2e-shards] ${label}: ${projects.join(', ')}`)

  const result = spawnSync(
    'npx',
    [
      'playwright', 'test',
      ...projects.flatMap(project => ['--project', project]),
      // `--reporter` REPLACES the config's reporters, so `list` is restored alongside `blob` to keep
      // the console output a run normally produces.
      '--reporter=blob,list',
      ...passthrough
    ],
    {
      stdio: 'inherit',
      // `OUTPUT_FILE` rather than `OUTPUT_DIR`: the blob reporter DELETES an output directory's
      // existing contents before writing, so per-shard directories would be fine but per-shard files
      // are simpler and cannot wipe a sibling shard's report.
      env: { ...process.env, PLAYWRIGHT_BLOB_OUTPUT_FILE: `${BLOB_DIR}/shard-${index + 1}.zip` }
    }
  )

  if (result.status !== 0) failures.push({ label, projects, status: result.status })
})

console.log(`\n[e2e-shards] merging ${shards.length} blob report(s) into playwright-report/`)
const merge = spawnSync('npx', ['playwright', 'merge-reports', '--reporter', 'html', BLOB_DIR], {
  stdio: 'inherit'
})

if (failures.length > 0) {
  // Name every failing shard rather than only the first: the point of running all of them is to
  // learn everything in one pass, and a runner that reports one failure invites re-running the suite
  // to discover the next.
  console.error(`\n[e2e-shards] FAILED: ${failures.length} of ${shards.length} shard(s)`)
  for (const failure of failures) {
    console.error(`  ${failure.label} (${failure.projects.join(', ')}) exited ${failure.status}`)
  }
  process.exit(1)
}

if (merge.status !== 0) {
  // Every test passed; only the report merge failed. Say precisely that — reporting it as a suite
  // failure would send someone hunting a product defect that does not exist.
  console.error('\n[e2e-shards] every shard passed, but merging the HTML report failed.')
  process.exit(1)
}

console.log(`\n[e2e-shards] all ${shards.length} shard(s) passed.`)
