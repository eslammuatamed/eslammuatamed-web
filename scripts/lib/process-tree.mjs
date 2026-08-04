/**
 * Identifying the processes a run owns, safely (doc 20 §5.1, D20-25).
 *
 * Teardown signals things. Everything here exists so that it signals only what this run actually
 * created — never a name pattern, and never a PID that has since been handed to someone else.
 *
 * TWO HAZARDS, both real:
 *
 *  1. ESCAPE. `chrome-launcher` spawns Chrome with `detached: true` (its own source:
 *     `detached: process.platform !== 'win32'`), making Chrome the leader of a NEW process group so
 *     it outlives its parent. A signal to the `lhci` group therefore never reaches it. And once the
 *     parent exits, the child is reparented to init immediately, so a parent walk performed AT
 *     teardown finds nothing either. Descendants must be recorded WHILE their parent is alive.
 *
 *  2. REUSE. A PID recorded minutes ago may since have exited and been reassigned. Signalling on PID
 *     alone would kill a stranger's process. Every recorded PID therefore carries the process start
 *     time from /proc, and is re-checked immediately before it is signalled or polled. This applies
 *     to the ROOT as much as to descendants: once Node has reaped the leader, `-pid` may name an
 *     unrelated process group.
 *
 * The readers are injectable so the identity rules can be tested without spawning anything.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve } from 'node:path'

/** Default /proc readers. Replaced in tests. */
export const procReaders = {
  listPids: () => {
    try { return readdirSync('/proc').filter(n => /^\d+$/.test(n)).map(Number) } catch { return [] }
  },
  readStat: pid => {
    try { return readFileSync(`/proc/${pid}/stat`, 'utf8') } catch { return null }
  },
  readCmdline: pid => {
    try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8') } catch { return null }
  }
}

/**
 * Fields of `/proc/<pid>/stat` after the process name.
 *
 * `comm` can contain spaces and parentheses, so everything is read relative to the LAST ')'. The
 * fields that follow start at field 3, making state index 0, ppid index 1 and starttime index 19.
 */
function statFields(stat) {
  if (typeof stat !== 'string') return null
  const close = stat.lastIndexOf(')')
  if (close < 0) return null
  return stat.slice(close + 2).split(' ')
}

export function parentPid(stat) {
  const fields = statFields(stat)
  const ppid = Number(fields?.[1])
  return Number.isFinite(ppid) ? ppid : null
}

export function startTime(stat) {
  return statFields(stat)?.[19] ?? null
}

/** The process GROUP id (field 5), used to prove a group still contains something of ours. */
export function processGroupOf(stat) {
  const pgrp = Number(statFields(stat)?.[2])
  return Number.isFinite(pgrp) ? pgrp : null
}

/** The group a live process belongs to, or null if it is gone. */
export function processGroupId(pid, readers = procReaders) {
  return processGroupOf(readers.readStat(pid))
}

/** The start time of a live process, or null if it is gone. */
export function processStartTime(pid, readers = procReaders) {
  return startTime(readers.readStat(pid))
}

/**
 * Is this PID still the process we recorded?
 *
 * The whole defence against PID reuse. A null recorded time means we never identified it, and a
 * missing current time means it is gone — neither may be signalled.
 */
export function isSameProcess(pid, recordedStartTime, readers = procReaders) {
  if (recordedStartTime === null || recordedStartTime === undefined) return false
  const now = processStartTime(pid, readers)
  return now !== null && now === recordedStartTime
}

/** Every descendant of `root`, by parent link, regardless of process group. */
export function descendantPids(root, readers = procReaders) {
  const childrenOf = new Map()
  for (const pid of readers.listPids()) {
    const ppid = parentPid(readers.readStat(pid))
    if (ppid === null) continue
    if (!childrenOf.has(ppid)) childrenOf.set(ppid, [])
    childrenOf.get(ppid).push(pid)
  }
  const found = []
  const stack = [root]
  while (stack.length > 0) {
    for (const child of childrenOf.get(stack.pop()) ?? []) { found.push(child); stack.push(child) }
  }
  return found
}

/** The prefix the browser launcher gives its throwaway profile directories. */
export const PROFILE_PREFIX = 'lighthouse.'

/**
 * A process's throwaway browser profile, if it has one created for this measurement.
 *
 * The return value is handed to a RECURSIVE DELETE, so containment is enforced rather than
 * asserted. A `startsWith` test on the raw string is not enough: `/tmp/lighthouse.x/../../home/me`
 * begins with the temp prefix and yet resolves to a home directory, which teardown would then
 * delete. The path is therefore RESOLVED first — collapsing `..` — and accepted only when it is a
 * DIRECT child of the temp root whose name carries the launcher's prefix. Anything else, including
 * a nested path or one that escapes upward, is refused.
 */
export function browserProfileDir(pid, tmpRoot, readers = procReaders) {
  const raw = readers.readCmdline(pid)
  if (raw === null) return null
  const flag = raw.split('\0').find(a => a.startsWith('--user-data-dir='))
  if (!flag) return null

  const value = flag.slice('--user-data-dir='.length)

  // Rejected BEFORE resolving. `resolve()` is relative to THIS process's working directory, so a
  // relative value like `lighthouse.x` would become `/tmp/lighthouse.x` whenever the orchestrator
  // happened to be running from /tmp — making acceptance depend on our cwd rather than on the
  // value. Only an absolute path can be reasoned about at all.
  if (value === '' || !isAbsolute(value)) return null

  const resolved = resolve(value)
  if (dirname(resolved) !== resolve(tmpRoot)) return null
  if (!basename(resolved).startsWith(PROFILE_PREFIX)) return null
  return resolved
}

/**
 * Record everything a child spawns, for as long as it lives.
 *
 * Sampling only at teardown is too late: when the leader exits, its children are reparented to init
 * immediately and the link identifying them as ours is gone. Each PID is stored with its start time
 * so it can be re-validated before being signalled.
 */
export function trackProcessTree(rootPid, { readers = procReaders, intervalMs = 250 } = {}) {
  const seen = new Map()
  const rootStartTime = processStartTime(rootPid, readers)

  const sample = () => {
    for (const pid of descendantPids(rootPid, readers)) {
      if (seen.has(pid)) continue
      const startedAt = processStartTime(pid, readers)
      if (startedAt !== null) seen.set(pid, startedAt)
    }
    return seen
  }

  sample()
  const timer = setInterval(sample, intervalMs)
  timer.unref?.()

  return {
    rootStartTime,
    sample,
    stop: () => clearInterval(timer),
    /** Recorded descendants that are still the SAME processes, safe to signal. */
    liveDescendants: () => {
      sample()
      return [...seen.entries()].filter(([pid, at]) => isSameProcess(pid, at, readers)).map(([pid]) => pid)
    },
    /** Is the root still the process we started? False once reaped — its PID may be reused. */
    rootIsOurs: () => isSameProcess(rootPid, rootStartTime, readers),

    /**
     * Is the process GROUP still ours?
     *
     * True while the root lives, and still true afterwards if a descendant we have VALIDATED is
     * a member of it. That second clause is what makes signalling `-rootPid` safe once the leader
     * has been reaped: the group is proven to contain a process we recorded, rather than assumed to
     * still be ours on the strength of a PID that may since have been reassigned.
     */
    groupIsOurs: () => {
      if (isSameProcess(rootPid, rootStartTime, readers)) return true
      return [...seen.entries()]
        .filter(([pid, at]) => isSameProcess(pid, at, readers))
        .some(([pid]) => processGroupId(pid, readers) === rootPid)
    }
  }
}
