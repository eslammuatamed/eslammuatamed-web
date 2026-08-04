import { describe, expect, it } from 'vitest'
import {
  browserProfileDir, descendantPids, isSameProcess, parentPid, processStartTime, startTime, trackProcessTree
} from './process-tree.mjs'

/**
 * Regression gate for process identity (doc 20 §5.1, D20-25).
 *
 * Teardown signals things, so the only question that matters is whether a PID is still the process
 * this run created. Two hazards, both observed rather than imagined:
 *
 *  - ESCAPE: chrome-launcher spawns Chrome `detached`, in its own process group, and once its
 *    parent exits it is reparented to init. A teardown-time walk finds nothing.
 *  - REUSE: a PID recorded earlier may since belong to something entirely unrelated.
 *
 * The /proc readers are injected, so every rule is exercised deterministically without spawning
 * anything — including PID reuse, which cannot be provoked on demand with real processes.
 */

/** A fake /proc. `procs` maps pid -> { ppid, startedAt, cmdline }. */
function fakeProc(procs) {
  return {
    listPids: () => Object.keys(procs).map(Number),
    readStat: pid => {
      const p = procs[pid]
      if (!p) return null
      // Field 2 is `comm`, deliberately containing a space and parentheses.
      // fields: 1 pid, 2 comm, 3 state, 4 ppid, 5 pgrp, … 22 starttime
      const pre = `${pid} (some (weird) name) S ${p.ppid} ${p.pgrp ?? pid}`
      const middle = new Array(16).fill('0').join(' ') // fields 6..21
      return `${pre} ${middle} ${p.startedAt} rest`
    },
    readCmdline: pid => procs[pid]?.cmdline ?? null
  }
}

describe('process identity — parsing /proc', () => {
  it('1 — reads ppid and starttime even when the process name contains spaces and parens', () => {
    const readers = fakeProc({ 100: { ppid: 7, startedAt: '999' } })
    const stat = readers.readStat(100)
    expect(parentPid(stat)).toBe(7)
    expect(startTime(stat)).toBe('999')
  })

  it('2 — a missing process yields null rather than throwing', () => {
    const readers = fakeProc({})
    expect(processStartTime(404, readers)).toBeNull()
    expect(parentPid(null)).toBeNull()
    expect(startTime(null)).toBeNull()
  })
})

describe('process identity — PID reuse', () => {
  it('3 — the same PID with the SAME start time is the same process', () => {
    const readers = fakeProc({ 100: { ppid: 1, startedAt: '555' } })
    expect(isSameProcess(100, '555', readers)).toBe(true)
  })

  it('4 — REUSE: the same PID with a DIFFERENT start time is NOT signalled', () => {
    // The PID was recycled between recording and teardown. Signalling it would kill a stranger.
    const readers = fakeProc({ 100: { ppid: 1, startedAt: '999' } })
    expect(isSameProcess(100, '555', readers)).toBe(false)
  })

  it('5 — a PID that no longer exists is not signalled', () => {
    expect(isSameProcess(100, '555', fakeProc({}))).toBe(false)
  })

  it('6 — a PID we never identified is not signalled', () => {
    const readers = fakeProc({ 100: { ppid: 1, startedAt: '555' } })
    expect(isSameProcess(100, null, readers)).toBe(false)
    expect(isSameProcess(100, undefined, readers)).toBe(false)
  })
})

describe('process identity — walking the tree', () => {
  it('7 — finds descendants at any depth, regardless of process group', () => {
    const readers = fakeProc({
      10: { ppid: 1, startedAt: 'a' },   // root
      11: { ppid: 10, startedAt: 'b' },  // sh
      12: { ppid: 11, startedAt: 'c' },  // lhci
      13: { ppid: 12, startedAt: 'd' },  // chrome (detached — still a child here)
      99: { ppid: 1, startedAt: 'z' }    // unrelated
    })
    expect(descendantPids(10, readers).sort()).toEqual([11, 12, 13])
  })

  it('8 — an unrelated process is never included', () => {
    const readers = fakeProc({ 10: { ppid: 1, startedAt: 'a' }, 99: { ppid: 1, startedAt: 'z' } })
    expect(descendantPids(10, readers)).toEqual([])
  })
})

describe('process identity — the tracker', () => {
  it('9 — REMEMBERS a descendant after its parent link is gone (reparented to init)', () => {
    // The exact failure a teardown-time walk cannot survive: record while alive, then the leader
    // exits and chrome is reparented to init, erasing the only link that identified it as ours.
    const procs = {
      10: { ppid: 1, startedAt: 'a' },
      13: { ppid: 10, startedAt: 'd' }
    }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    expect(tracker.liveDescendants()).toEqual([13])

    // The leader exits; the descendant is reparented to init and its start time is unchanged.
    delete procs[10]
    procs[13].ppid = 1

    expect(descendantPids(10, readers)).toEqual([])   // a fresh walk finds nothing…
    expect(tracker.liveDescendants()).toEqual([13])   // …but the record still identifies it
    tracker.stop()
  })

  it('10 — ROOT REUSE: once the leader is gone, its PID is not treated as ours', () => {
    // Without this, `process.kill(-child.pid, ...)` could signal an unrelated process GROUP, and
    // polling that group could keep teardown waiting on a stranger.
    const procs = { 10: { ppid: 1, startedAt: 'a' } }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    expect(tracker.rootIsOurs()).toBe(true)

    // The leader exits and PID 10 is handed to something else.
    procs[10] = { ppid: 1, startedAt: 'DIFFERENT' }
    expect(tracker.rootIsOurs()).toBe(false)
    tracker.stop()
  })

  it('11 — a recorded descendant whose PID was reused is dropped', () => {
    const procs = { 10: { ppid: 1, startedAt: 'a' }, 13: { ppid: 10, startedAt: 'd' } }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    expect(tracker.liveDescendants()).toEqual([13])

    procs[13] = { ppid: 1, startedAt: 'SOMEONE-ELSE' }
    expect(tracker.liveDescendants()).toEqual([])
    tracker.stop()
  })
})

describe('process identity — proving GROUP ownership', () => {
  // The group legitimately outlives its leader (npm exec exits while lhci and Chrome run on), so
  // teardown must still be able to signal it. But once the leader is reaped its PID may name a
  // stranger's group. Ownership is therefore PROVEN, never assumed in either direction.

  it('15 — while the root lives, the group is ours', () => {
    const readers = fakeProc({ 10: { ppid: 1, startedAt: 'a' } })
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    expect(tracker.groupIsOurs()).toBe(true)
    tracker.stop()
  })

  it('16 — after the leader exits, the group is STILL ours if a validated descendant is in it', () => {
    // The fast-exit case: signalling -10 here is safe because PID 13, which we recorded, is a member.
    const procs = { 10: { ppid: 1, startedAt: 'a', pgrp: 10 }, 13: { ppid: 10, startedAt: 'd', pgrp: 10 } }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    tracker.sample()
    delete procs[10] // leader reaped
    expect(tracker.rootIsOurs()).toBe(false)
    expect(tracker.groupIsOurs()).toBe(true)
    tracker.stop()
  })

  it('17 — REUSE: a recycled root PID with nothing of ours in the group is NOT signalled', () => {
    // Without this the group signal would hit a stranger's process group.
    const procs = { 10: { ppid: 1, startedAt: 'a', pgrp: 10 } }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    procs[10] = { ppid: 1, startedAt: 'STRANGER', pgrp: 10 }
    expect(tracker.groupIsOurs()).toBe(false)
    tracker.stop()
  })

  it('18 — a DETACHED descendant does not make the old group ours (it left that group)', () => {
    // Chrome is in its own group, so it proves nothing about the lhci group. It is killed by PID.
    const procs = { 10: { ppid: 1, startedAt: 'a', pgrp: 10 }, 13: { ppid: 10, startedAt: 'd', pgrp: 13 } }
    const readers = fakeProc(procs)
    const tracker = trackProcessTree(10, { readers, intervalMs: 60_000 })
    tracker.sample()
    delete procs[10]
    expect(tracker.groupIsOurs()).toBe(false)
    expect(tracker.liveDescendants()).toEqual([13]) // still killable, individually
    tracker.stop()
  })
})

describe('process identity — browser profiles are contained, not just prefixed', () => {
  // The return value is handed to a RECURSIVE DELETE, so this is the one place a wrong answer
  // destroys data rather than leaking it. Containment is enforced, never assumed.
  const TMP = '/tmp'
  const cmd = dir => ({ 13: { ppid: 1, startedAt: 'd', cmdline: `chrome\0--user-data-dir=${dir}\0about:blank` } })

  it('12 — accepts the throwaway profile the launcher created', () => {
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/lighthouse.AbC123')))).toBe('/tmp/lighthouse.AbC123')
  })

  it('13 — REFUSES a real user profile outside the temp root', () => {
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/home/someone/.config/google-chrome')))).toBeNull()
  })

  it('14 — a process with no profile flag yields null', () => {
    const readers = fakeProc({ 13: { ppid: 1, startedAt: 'd', cmdline: 'node\0script.mjs\0' } })
    expect(browserProfileDir(13, TMP, readers)).toBeNull()
  })

  it('19 — TRAVERSAL: a path that escapes upward is refused even though it starts with the prefix', () => {
    // `/tmp/lighthouse.x/../../home/me` passes a naive startsWith test and resolves to /home/me.
    // Accepting it would make teardown recursively delete a home directory.
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/lighthouse.x/../../home/me')))).toBeNull()
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/lighthouse.x/../../../etc')))).toBeNull()
  })

  it('20 — a NESTED path under a valid profile is refused; only the profile root itself is removable', () => {
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/lighthouse.AbC123/Default/Cookies')))).toBeNull()
  })

  it('21 — a sibling that merely shares the prefix string is refused', () => {
    // `/tmp/lighthouse.evil` IS a legitimate shape; `/tmplighthouse.x` is not a child of /tmp.
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmpevil/lighthouse.x')))).toBeNull()
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/notlighthouse.x')))).toBeNull()
  })

  it('22 — the temp root itself is never returned', () => {
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp')))).toBeNull()
    expect(browserProfileDir(13, TMP, fakeProc(cmd('/tmp/lighthouse.x/..')))).toBeNull()
  })

  it('23 — an empty or RELATIVE value is refused, whatever the working directory', () => {
    expect(browserProfileDir(13, TMP, fakeProc(cmd('')))).toBeNull()
    expect(browserProfileDir(13, TMP, fakeProc(cmd('lighthouse.x')))).toBeNull()

    // Pinned from INSIDE the temp root, because that is where a relative value would resolve to a
    // valid-looking profile. Asserting this only from the repository directory proved nothing: the
    // result depended on cwd, not on the value.
    const cwd = process.cwd()
    try {
      process.chdir(TMP)
      expect(browserProfileDir(13, TMP, fakeProc(cmd('lighthouse.x')))).toBeNull()
      expect(browserProfileDir(13, TMP, fakeProc(cmd('./lighthouse.x')))).toBeNull()
    } finally {
      process.chdir(cwd)
    }
  })
})
