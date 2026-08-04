import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BUILD_ENV_ALLOWLIST, GENERATOR, GOVERNED_ENV_DEFAULTS, MARKER_VERSION,
  assertCleanSourceState, envFingerprint, gitStatusEntries, governedBuildEnv,
  outputFingerprint, readProvenance, validateProvenance, writeProvenance
} from './build-provenance.mjs'

/**
 * Regression gate for the build-provenance defect (doc 20 §5.1, D20-25).
 *
 * THE DEFECT. Provenance was derived from `git diff HEAD`, which reports only TRACKED files. A
 * source file that had never been `git add`-ed was therefore invisible — and Nuxt DISCOVERS sources
 * by scanning directories (`app/components/`, `app/composables/`, `app/middleware/`, `app/layouts/`,
 * `app/pages/`, `server/`, …), so such a file is compiled into the build anyway. The build then
 * contained code the recorded HEAD does not contain, and the Lighthouse report carried that HEAD's
 * name over numbers that commit cannot reproduce.
 *
 * `legacyWouldAccept()` below reproduces the original check exactly, so scenario 5 does not merely
 * assert that the new rule works — it demonstrates that the OLD rule accepted the very state the new
 * one rejects.
 *
 * Every test runs against a disposable git repository in a temp directory, so nothing depends on the
 * developer's real worktree.
 */

let repo, cwd

const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const OUT = () => join(repo, '.output')

/** The ORIGINAL, defective check: tracked changes only. Kept solely to prove the regression. */
function legacyWouldAccept() {
  const diff = execFileSync('git', ['diff', 'HEAD'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return diff.length === 0
}

/** A minimal production-like output tree. */
function makeOutput() {
  mkdirSync(join(OUT(), 'server'), { recursive: true })
  mkdirSync(join(OUT(), 'public', '_nuxt'), { recursive: true })
  writeFileSync(join(OUT(), 'server', 'index.mjs'), '// built')
  writeFileSync(join(OUT(), 'public', '_nuxt', 'app.js'), 'export const a = 1')
}

const GOVERNED_ENV = {
  ANALYZE_BUNDLE: undefined,
  NODE_ENV: 'production',
  NUXT_PUBLIC_API_BASE: 'https://example.com/api/v1',
  NUXT_PUBLIC_SITE_URL: 'https://example.com',
  NUXT_PUBLIC_SITE_URL_ALLOW_LOOPBACK: undefined
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'provenance-test-'))
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])
  mkdirSync(join(repo, 'app', 'components'), { recursive: true })
  writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>hi</h1></template>')
  writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({ name: 'web', lockfileVersion: 3 }))
  // Mirrors the real repository: generated output and logs are IGNORED.
  writeFileSync(join(repo, '.gitignore'), '.output\n.lighthouseci\nnode_modules\n*.log\n')
  git(['add', '.'])
  git(['commit', '-qm', 'first'])

  cwd = process.cwd()
  process.chdir(repo)
  makeOutput()
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(repo, { recursive: true, force: true })
})

/** Write a marker for the current state, as a governed build would. */
const stamp = () => writeProvenance({ cwd: repo, outputDir: OUT(), env: GOVERNED_ENV })
const check = () => validateProvenance({ cwd: repo, outputDir: OUT(), env: GOVERNED_ENV })

describe('provenance — clean-state gate (the defect and its fix)', () => {
  it('1 — a clean tracked checkout is ACCEPTED', () => {
    expect(gitStatusEntries(repo)).toHaveLength(0)
    expect(assertCleanSourceState(repo).clean).toBe(true)
  })

  it('2 — a STAGED tracked modification is REJECTED', () => {
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>edited</h1></template>')
    git(['add', 'app/components/Hero.vue'])
    expect(() => assertCleanSourceState(repo)).toThrow(/working tree is not clean/)
  })

  it('3 — an UNSTAGED tracked modification is REJECTED', () => {
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>edited</h1></template>')
    expect(() => assertCleanSourceState(repo)).toThrow(/working tree is not clean/)
  })

  it('4 — an UNTRACKED, non-ignored ROOT file is REJECTED', () => {
    writeFileSync(join(repo, 'notes.txt'), 'scratch')
    expect(() => assertCleanSourceState(repo)).toThrow(/untracked \(not ignored\): notes\.txt/)
  })

  it('5 — an UNTRACKED NUXT-DISCOVERED SOURCE is REJECTED, and the OLD check would have ACCEPTED it', () => {
    // This is the regression. `app/components/` is auto-imported, so this file IS compiled in.
    writeFileSync(join(repo, 'app', 'components', 'Sneaky.vue'), '<template><div>ships anyway</div></template>')

    // The original implementation saw nothing wrong — the defect, demonstrated rather than asserted.
    expect(legacyWouldAccept()).toBe(true)

    // The corrected implementation refuses, before anything is built.
    expect(() => assertCleanSourceState(repo)).toThrow(/untracked \(not ignored\): app\/components\/Sneaky\.vue/)
  })

  it('5b — the same holds for every other Nuxt scan location, without an allowlist of directories', () => {
    // The rule is "the tree is clean", not "these directories are clean", so a scan location nobody
    // thought of is covered for free.
    for (const dir of ['app/composables', 'app/middleware', 'app/layouts', 'app/pages', 'server/api']) {
      mkdirSync(join(repo, dir), { recursive: true })
      writeFileSync(join(repo, dir, 'thing.ts'), 'export default {}')
    }
    expect(legacyWouldAccept()).toBe(true)
    const message = (() => { try { assertCleanSourceState(repo); return '' } catch (e) { return e.message } })()
    for (const dir of ['app/composables', 'app/middleware', 'app/layouts', 'app/pages', 'server/api']) {
      expect(message).toContain(`${dir}/thing.ts`)
    }
  })

  it('6 — an IGNORED generated file is NOT rejected', () => {
    writeFileSync(join(OUT(), 'public', '_nuxt', 'late-chunk.js'), 'export const b = 2')
    writeFileSync(join(repo, 'debug.log'), 'noise')
    mkdirSync(join(repo, 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(repo, 'node_modules', 'x', 'index.js'), '')
    expect(assertCleanSourceState(repo).clean).toBe(true)
  })

  it('6b — a CONFLICTED entry is rejected', () => {
    git(['checkout', '-qb', 'other'])
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>theirs</h1></template>')
    git(['commit', '-qam', 'theirs'])
    git(['checkout', '-q', '-'])
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>ours</h1></template>')
    git(['commit', '-qam', 'ours'])
    try { git(['merge', 'other']) } catch { /* the conflict is the point */ }
    expect(() => assertCleanSourceState(repo)).toThrow(/not clean/)
  })
})

describe('provenance — marker validation', () => {
  it('14 — a clean build writes a VALID marker', () => {
    const marker = stamp()
    expect(marker.head).toBe(git(['rev-parse', 'HEAD']))
    expect(marker.tree).toBe(git(['rev-parse', 'HEAD^{tree}']))
    expect(marker.generator).toBe(GENERATOR)
    expect(marker.markerVersion).toBe(MARKER_VERSION)
    expect(marker.output.fileCount).toBe(2)
    expect(check().valid).toBe(true)
  })

  it('12 — a MISSING marker is rejected', () => {
    const result = check()
    expect(result.valid).toBe(false)
    expect(result.failures[0]).toMatch(/no provenance marker/)
  })

  it('7 — a STALE HEAD marker is rejected', () => {
    stamp()
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>v2</h1></template>')
    git(['commit', '-qam', 'second'])
    const result = check()
    expect(result.valid).toBe(false)
    expect(result.failures.some(f => /does not match current HEAD/.test(f))).toBe(true)
  })

  it('8 — a STALE TREE marker is rejected', () => {
    const marker = stamp()
    // A commit that changes content necessarily changes the tree; assert the tree check names it.
    writeFileSync(join(repo, 'app', 'components', 'Hero.vue'), '<template><h1>v2</h1></template>')
    git(['commit', '-qam', 'second'])
    expect(git(['rev-parse', 'HEAD^{tree}'])).not.toBe(marker.tree)
    expect(check().failures.some(f => /does not match current tree/.test(f))).toBe(true)
  })

  it('9 — a CHANGED package-lock is rejected', () => {
    stamp()
    writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({ name: 'web', lockfileVersion: 3, changed: true }))
    git(['commit', '-qam', 'lockfile'])
    expect(check().failures.some(f => /package-lock\.json changed/.test(f))).toBe(true)
  })

  it('10 — a CHANGED governed environment fingerprint is rejected', () => {
    stamp()
    const different = { ...GOVERNED_ENV, NUXT_PUBLIC_SITE_URL: 'https://different.example' }
    const result = validateProvenance({ cwd: repo, outputDir: OUT(), env: different })
    expect(result.valid).toBe(false)
    expect(result.failures.some(f => /build-environment fingerprint changed/.test(f))).toBe(true)
  })

  it('10b — ABSENT and EMPTY environment values are distinguished', () => {
    const absent = envFingerprint({ ...GOVERNED_ENV, ANALYZE_BUNDLE: undefined })
    const empty = envFingerprint({ ...GOVERNED_ENV, ANALYZE_BUNDLE: '' })
    expect(absent.presence.ANALYZE_BUNDLE).toBe('absent')
    expect(empty.presence.ANALYZE_BUNDLE).toBe('empty')
    expect(absent.hash).not.toBe(empty.hash)
  })

  it('10c — a marker written by the BUILD CHILD validates in the ORCHESTRATOR (regression)', () => {
    // The build runs as a CHILD PROCESS with the D23-8 placeholders applied. The first end-to-end
    // run failed here: the orchestrator fingerprinted its own bare environment, computed a different
    // hash from the one the build had just recorded, and rejected its own freshly built artifact.
    // `governedBuildEnv()` is the single resolver both sides now go through.
    const ambient = { NODE_ENV: 'production' }

    // Why the resolver is needed at all: the bare environment really does fingerprint differently.
    expect(envFingerprint(ambient).hash).not.toBe(envFingerprint(governedBuildEnv(ambient)).hash)

    writeProvenance({ cwd: repo, outputDir: OUT(), env: governedBuildEnv(ambient) })
    expect(validateProvenance({ cwd: repo, outputDir: OUT(), env: governedBuildEnv(ambient) }).valid).toBe(true)

    // And the placeholders are genuinely applied rather than silently absent.
    expect(governedBuildEnv(ambient).NUXT_PUBLIC_SITE_URL).toBe(GOVERNED_ENV_DEFAULTS.NUXT_PUBLIC_SITE_URL)
  })

  it('11 — a CHANGED output asset is rejected', () => {
    stamp()
    writeFileSync(join(OUT(), 'public', '_nuxt', 'app.js'), 'export const a = 999 /* tampered */')
    expect(check().failures.some(f => /output changed since the marker/.test(f))).toBe(true)
  })

  it('11b — an ADDED output file is rejected too', () => {
    stamp()
    writeFileSync(join(OUT(), 'public', '_nuxt', 'extra.js'), 'export const c = 3')
    expect(check().failures.some(f => /output changed since the marker/.test(f))).toBe(true)
  })

  it('15 — a marker validates ONLY for the exact output it describes', () => {
    const marker = stamp()
    const other = join(repo, '.output-other')
    mkdirSync(join(other, 'server'), { recursive: true })
    writeFileSync(join(other, 'server', 'index.mjs'), '// a DIFFERENT build')
    writeFileSync(join(other, '.provenance.json'), JSON.stringify(marker))
    const result = validateProvenance({ cwd: repo, outputDir: other, env: GOVERNED_ENV })
    expect(result.valid).toBe(false)
    expect(result.failures.some(f => /output changed since the marker/.test(f))).toBe(true)
  })

  it('15b — a marker from a different generator or contract version is rejected', () => {
    stamp()
    const marker = readProvenance(OUT())
    writeFileSync(join(OUT(), '.provenance.json'), JSON.stringify({ ...marker, generator: 'somebody-elses-tool' }))
    expect(check().failures.some(f => /was produced by somebody-elses-tool/.test(f))).toBe(true)
  })

  it('1b — the working tree being dirtied AFTER the build is rejected at measurement time', () => {
    stamp()
    expect(check().valid).toBe(true)
    writeFileSync(join(repo, 'app', 'components', 'Sneaky.vue'), '<template><div/></template>')
    expect(check().valid).toBe(false)
  })
})

describe('provenance — secrets are never recorded', () => {
  it('13 — no environment VALUE reaches the marker, only names and presence', () => {
    const secretish = {
      ...GOVERNED_ENV,
      NUXT_PUBLIC_API_BASE: 'https://api.example.com/s3cr3t-t0ken-do-not-leak',
      NUXT_PUBLIC_SITE_URL: 'https://site.example.com/another-s3cr3t'
    }
    writeProvenance({ cwd: repo, outputDir: OUT(), env: secretish })
    const raw = readFileSync(join(OUT(), '.provenance.json'), 'utf8')

    expect(raw).not.toContain('s3cr3t-t0ken-do-not-leak')
    expect(raw).not.toContain('another-s3cr3t')
    expect(raw).not.toContain('api.example.com')

    // What IS recorded: the allowlisted names, each one's presence, and a hash.
    const marker = JSON.parse(raw)
    expect(marker.env.allowlist).toEqual([...BUILD_ENV_ALLOWLIST])
    expect(marker.env.presence.NUXT_PUBLIC_API_BASE).toBe('set')
    expect(marker.env.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.values(marker.env.presence).every(v => ['set', 'empty', 'absent'].includes(v))).toBe(true)
  })

  it('13b — a variable OUTSIDE the allowlist is neither hashed nor recorded', () => {
    const a = envFingerprint({ ...GOVERNED_ENV, AWS_SECRET_ACCESS_KEY: 'aaaa' })
    const b = envFingerprint({ ...GOVERNED_ENV, AWS_SECRET_ACCESS_KEY: 'bbbb' })
    expect(a.hash).toBe(b.hash)
    expect(Object.keys(a.presence)).not.toContain('AWS_SECRET_ACCESS_KEY')
  })

  it('13c — the timestamp is metadata only and never affects validation', () => {
    stamp()
    const marker = readProvenance(OUT())
    writeFileSync(join(OUT(), '.provenance.json'), JSON.stringify({ ...marker, builtAt: '1999-01-01T00:00:00.000Z' }))
    expect(check().valid).toBe(true)
  })
})

describe('provenance — writing requires a clean tree', () => {
  it('a marker is never written for a tree whose sources cannot be stated', () => {
    writeFileSync(join(repo, 'app', 'components', 'Sneaky.vue'), '<template><div/></template>')
    expect(() => stamp()).toThrow(/working tree is not clean/)
    expect(readProvenance(OUT())).toBeNull()
  })

  it('the output fingerprint excludes the marker itself', () => {
    const before = outputFingerprint(OUT())
    stamp()
    const after = outputFingerprint(OUT())
    expect(after.hash).toBe(before.hash)
    expect(after.fileCount).toBe(before.fileCount)
  })
})
