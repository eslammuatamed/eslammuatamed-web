import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertBuildIsCurrent, buildIsCurrent, readBuildStamp, sourceIdentity, writeBuildStamp } from './build-identity.mjs'

/**
 * Trust gate for build identity (doc 20 §5.1, D20-25).
 *
 * `.output/` is untracked and survives branch switches, so "a build exists" never meant "a build of
 * THIS commit exists". These tests pin the property that closes that gap: a build from another
 * source state is detected, and the governed path refuses to attribute its numbers to the current
 * head.
 *
 * Each test runs against a throwaway git repository in a temp directory, so nothing depends on the
 * state of the repository the suite happens to be running in.
 */

let repo, cwd

function git(args, cwdArg = repo) {
  return execFileSync('git', args, { cwd: cwdArg, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/** Paths inside the sandbox, mirroring the real layout. */
const OUT = () => join(repo, '.output')
const ENTRY = () => join(OUT(), 'server', 'index.mjs')
const STAMP = () => join(OUT(), '.build-identity.json')
const opts = () => ({ outputEntry: ENTRY(), stampPath: STAMP() })

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'build-identity-test-'))
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])
  writeFileSync(join(repo, 'app.txt'), 'v1')
  // Mirrors the real repository: build output and logs are IGNORED, so they must not invalidate
  // the build, while anything else untracked must.
  writeFileSync(join(repo, '.gitignore'), '.output\n*.log\n')
  git(['add', '.'])
  git(['commit', '-qm', 'first'])
  // The module reads the CURRENT working directory's git state, so the sandbox becomes cwd.
  cwd = process.cwd()
  process.chdir(repo)
  mkdirSync(join(OUT(), 'server'), { recursive: true })
  writeFileSync(ENTRY(), '// built')
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(repo, { recursive: true, force: true })
})

describe('build identity — source state', () => {
  it('18 — a clean tree identifies as exactly its HEAD sha', () => {
    const id = sourceIdentity()
    expect(id.sha).toBe(git(['rev-parse', 'HEAD']))
    expect(id.dirty).toBe(false)
    expect(id.id).toBe(id.sha)
  })

  it('19 — a dirty tree gets a distinct identity, so uncommitted edits cannot be measured as HEAD', () => {
    const clean = sourceIdentity()
    writeFileSync(join(repo, 'app.txt'), 'v2')
    const dirty = sourceIdentity()
    expect(dirty.dirty).toBe(true)
    expect(dirty.id).not.toBe(clean.id)
    expect(dirty.id.startsWith(`${clean.sha}+`)).toBe(true)
  })

  it('20 — the dirty identity is stable while the sources are, and moves when they change', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2')
    const a = sourceIdentity().id
    expect(sourceIdentity().id).toBe(a)
    writeFileSync(join(repo, 'app.txt'), 'v3')
    expect(sourceIdentity().id).not.toBe(a)
  })

  it('21 — IGNORED paths do not change identity (a build must not invalidate itself)', () => {
    // `.output/` already exists in this sandbox and is ignored, exactly as in the real repository.
    const before = sourceIdentity().id
    writeFileSync(join(OUT(), 'server', 'chunk.mjs'), 'generated output')
    writeFileSync(join(repo, 'ignored.log'), 'noise')
    expect(sourceIdentity().id).toBe(before)
  })

  it('22 — an UNTRACKED, NON-IGNORED source file DOES change identity', () => {
    // The provenance hole this closes: Nuxt auto-imports from `app/components/`, so a file that was
    // never `git add`-ed is still compiled into the build. If identity ignored it, the report would
    // carry HEAD's name over numbers HEAD cannot reproduce.
    const before = sourceIdentity().id
    mkdirSync(join(repo, 'app', 'components'), { recursive: true })
    writeFileSync(join(repo, 'app', 'components', 'Sneaky.vue'), '<template><div/></template>')
    const after = sourceIdentity()
    expect(after.dirty).toBe(true)
    expect(after.id).not.toBe(before)
  })

  it('23 — editing an untracked file changes identity again (content is hashed, not just the path)', () => {
    mkdirSync(join(repo, 'app', 'components'), { recursive: true })
    const file = join(repo, 'app', 'components', 'Sneaky.vue')
    writeFileSync(file, '<template><div>v1</div></template>')
    const first = sourceIdentity().id
    writeFileSync(file, '<template><div>v2</div></template>')
    expect(sourceIdentity().id).not.toBe(first)
  })

  it('24 — a build stamped before an untracked source appeared is REJECTED as stale', () => {
    writeBuildStamp(STAMP())
    expect(buildIsCurrent(opts()).current).toBe(true)
    mkdirSync(join(repo, 'app', 'components'), { recursive: true })
    writeFileSync(join(repo, 'app', 'components', 'Sneaky.vue'), '<template><div/></template>')
    const state = buildIsCurrent(opts())
    expect(state.current).toBe(false)
    expect(state.reason).toBe('build is from a different source state')
  })
})

describe('build identity — stale build detection', () => {
  it('25 — a build with no stamp is not current', () => {
    const state = buildIsCurrent(opts())
    expect(state.current).toBe(false)
    expect(state.reason).toBe('build has no identity stamp')
  })

  it('26 — a stamped build of the current source IS current', () => {
    writeBuildStamp(STAMP())
    expect(buildIsCurrent(opts()).current).toBe(true)
  })

  it('27 — STALE BUILD IS REJECTED: a build from another commit is not current', () => {
    writeBuildStamp(STAMP())
    expect(buildIsCurrent(opts()).current).toBe(true)
    // A new commit — the classic "switched branches, .output stayed" case.
    writeFileSync(join(repo, 'app.txt'), 'v2')
    git(['commit', '-qam', 'second'])
    const state = buildIsCurrent(opts())
    expect(state.current).toBe(false)
    expect(state.reason).toBe('build is from a different source state')
  })

  it('28 — an uncommitted edit after the build also invalidates it', () => {
    writeBuildStamp(STAMP())
    writeFileSync(join(repo, 'app.txt'), 'edited-after-build')
    expect(buildIsCurrent(opts()).current).toBe(false)
  })

  it('29 — a missing build is reported as "no build", not as a stale one', () => {
    rmSync(OUT(), { recursive: true, force: true })
    expect(buildIsCurrent(opts()).reason).toBe('no build')
  })

  it('30 — a corrupt stamp is treated as missing rather than trusted', () => {
    writeFileSync(STAMP(), '{ not json')
    expect(readBuildStamp(STAMP())).toBeNull()
    expect(buildIsCurrent(opts()).current).toBe(false)
  })
})

describe('build identity — the non-governed refusal', () => {
  it('31 — assertBuildIsCurrent passes silently on an exact build', () => {
    writeBuildStamp(STAMP())
    expect(assertBuildIsCurrent(opts()).current).toBe(true)
  })

  it('32 — assertBuildIsCurrent REFUSES a stale build and names both identities', () => {
    writeBuildStamp(STAMP())
    const built = readBuildStamp(STAMP()).id
    writeFileSync(join(repo, 'app.txt'), 'v2')
    git(['commit', '-qam', 'second'])
    let message = ''
    try { assertBuildIsCurrent(opts()) } catch (e) { message = e.message }
    expect(message).toMatch(/Refusing to measure/)
    expect(message).toContain(built)
    expect(message).toContain(sourceIdentity().id)
  })
})
