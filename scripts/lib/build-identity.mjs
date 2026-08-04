/**
 * Build identity — binds a Git source state to the `.output` it produced, and to the Lighthouse
 * reports measured from it (doc 20 §5.1, D20-25).
 *
 * WHY THIS EXISTS. `.output/` is untracked and survives branch switches. Before this, the governed
 * gate only checked that `.output/server/index.mjs` *existed*: a build left behind by another commit
 * would be measured silently, and the resulting numbers would be attributed to the current HEAD.
 * That is the same class of defect as measuring the wrong protocol — the reading is precise, the
 * label on it is wrong — so it is closed the same way: assert, and refuse to measure.
 *
 * WHAT IDENTITY MEANS HERE. The commit SHA alone is not enough, because a contributor iterating on a
 * fix has uncommitted edits that change the build. Identity is therefore HEAD plus a digest of the
 * working-tree diff against HEAD. A clean tree yields `<sha>`; a dirty tree yields `<sha>+<digest>`,
 * which changes whenever the tracked sources change and stays stable when they do not.
 *
 * Untracked files are deliberately EXCLUDED. `.output/`, `.lighthouseci/` and `node_modules/` are
 * untracked and would otherwise make every build differ from itself.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Written INTO the build output, so the stamp travels with the artifact it describes. */
export const STAMP_PATH = join('.output', '.build-identity.json')

/** Written next to the reports, so a report set can always be traced back to a source state. */
export const REPORT_STAMP_PATH = join('.lighthouseci', 'build-identity.json')

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/**
 * The current source state.
 *
 * When git is unavailable (a source tarball, say), identity is `unknown`. That is not treated as a
 * match by `isCurrent()`, so the governed command rebuilds rather than trusting an artifact it
 * cannot attribute — degraded, but never silently wrong.
 */
export function sourceIdentity() {
  let sha
  try {
    sha = git(['rev-parse', 'HEAD'])
  } catch {
    return { sha: 'unknown', dirty: false, id: 'unknown' }
  }

  // `git diff HEAD` covers staged and unstaged tracked changes in one digest.
  let diff = ''
  try {
    diff = execFileSync('git', ['diff', 'HEAD'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { /* treat an unreadable diff as clean; the SHA still pins the commit */ }

  const dirty = diff.length > 0
  const id = dirty ? `${sha}+${createHash('sha256').update(diff).digest('hex').slice(0, 12)}` : sha
  return { sha, dirty, id }
}

/** Record the identity of the source that produced the build now sitting in `.output/`. */
export function writeBuildStamp(stampPath = STAMP_PATH) {
  const identity = sourceIdentity()
  const stamp = { ...identity, stampedAt: new Date().toISOString() }
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`)
  return stamp
}

/** The identity recorded in `.output/`, or `null` when there is no build or no stamp. */
export function readBuildStamp(stampPath = STAMP_PATH) {
  if (!existsSync(stampPath)) return null
  try {
    return JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch {
    return null // A corrupt stamp is treated exactly like a missing one: rebuild.
  }
}

/** Is there a build in `.output/` that was produced from the current source state? */
export function buildIsCurrent({ outputEntry = join('.output', 'server', 'index.mjs'), stampPath = STAMP_PATH } = {}) {
  if (!existsSync(outputEntry)) return { current: false, reason: 'no build', stamp: null, expected: sourceIdentity() }
  const stamp = readBuildStamp(stampPath)
  const expected = sourceIdentity()
  if (!stamp) return { current: false, reason: 'build has no identity stamp', stamp: null, expected }
  if (expected.id === 'unknown') return { current: false, reason: 'source identity unavailable (no git)', stamp, expected }
  if (stamp.id !== expected.id) return { current: false, reason: 'build is from a different source state', stamp, expected }
  return { current: true, reason: 'build matches HEAD', stamp, expected }
}

/**
 * Refuse to proceed unless `.output/` was built from the current source state.
 *
 * Used by the NON-governed low-level paths, which must never build on a contributor's behalf but
 * equally must never measure an artifact from another commit.
 */
export function assertBuildIsCurrent(options) {
  const result = buildIsCurrent(options)
  if (result.current) return result
  throw new Error(
    `Refusing to measure: ${result.reason}.\n`
    + `  build identity: ${result.stamp?.id ?? '(none)'}\n`
    + `  source identity: ${result.expected.id}\n`
    + 'Governed measurement runs `npm run lighthouse:ci`, which builds the exact head itself\n'
    + '(doc 20 §5.1, D20-25). Reports must be attributable to the commit they claim to describe.'
  )
}

/** Bind a report set to the source state it was measured from. */
export function writeReportStamp(extra = {}, stampPath = REPORT_STAMP_PATH) {
  const identity = sourceIdentity()
  const stamp = { ...identity, measuredAt: new Date().toISOString(), ...extra }
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`)
  return stamp
}
