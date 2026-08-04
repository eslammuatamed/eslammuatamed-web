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
 * fix has uncommitted edits that change the build. Identity is therefore HEAD plus a digest of
 * everything in the working tree that can reach the build. A clean tree yields `<sha>`; anything
 * else yields `<sha>+<digest>`, which moves whenever the sources move and stays stable when they do
 * not.
 *
 * IGNORED is the exclusion, not UNTRACKED — and the difference is load-bearing. `.output/`,
 * `.nuxt/`, `.lighthouseci/` and `node_modules/` are all in `.gitignore`, so excluding ignored paths
 * is enough to stop a build from invalidating itself. Excluding *untracked* paths instead would let
 * a brand-new file that has never been `git add`-ed sit in the build while identity still reported a
 * pristine HEAD — and Nuxt auto-imports from `app/components/`, so a new untracked component is
 * compiled in without anyone touching a tracked file. That report would carry a commit's name over
 * numbers that commit cannot reproduce, which is the exact failure this module exists to prevent.
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

  // `git diff HEAD` covers staged and unstaged changes to TRACKED files in one digest.
  let diff = ''
  try {
    diff = execFileSync('git', ['diff', 'HEAD'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { /* treat an unreadable diff as clean; the SHA still pins the commit */ }

  // …and this covers files git has never seen. `--others --exclude-standard` lists untracked paths
  // while honouring `.gitignore`, so build output and `node_modules/` stay out while a genuinely new
  // source file counts. Content is hashed, not just the path: creating a file and then editing it
  // must produce two different identities.
  let untrackedDigest = ''
  try {
    const listed = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    const paths = listed.split('\0').filter(Boolean).sort()
    if (paths.length > 0) {
      const h = createHash('sha256')
      for (const p of paths) {
        h.update(p)
        try { h.update(readFileSync(p)) } catch { h.update('<unreadable>') }
      }
      untrackedDigest = h.digest('hex')
    }
  } catch { /* no git or unreadable listing; the diff and SHA still apply */ }

  const dirty = diff.length > 0 || untrackedDigest !== ''
  const id = dirty
    ? `${sha}+${createHash('sha256').update(diff).update(untrackedDigest).digest('hex').slice(0, 12)}`
    : sha
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
