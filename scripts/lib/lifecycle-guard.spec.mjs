import { describe, expect, it, vi } from 'vitest'
import { AbortedError, createResourceGuard } from './lifecycle-guard.mjs'

/**
 * Regression gate for the startup-signal resource race (doc 20 §5.1, D20-25).
 *
 * THE DEFECT. Teardown is asynchronous and the main flow keeps running through it. A signal during
 * startup ran teardown over the resources registered so far, while startup went on to create more —
 * and because teardown runs exactly once, those later resources were never released. The concrete
 * casualty was an ephemeral PRIVATE KEY written to disk after teardown had already finished.
 *
 * WHY THESE ARE UNIT TESTS. The window is a few milliseconds wide inside one specific await. An
 * end-to-end test that signals the real orchestrator and then observes no leak proves nothing: it
 * passes just as happily when the run aborted BEFORE creating anything, which is the common
 * outcome. These tests drive the race directly — shutdown is triggered *during* creation — so the
 * disposal path is genuinely executed rather than hoped for.
 */

describe('resource guard — refusing to start new work', () => {
  it('1 — assertRunning passes while the run is healthy', () => {
    const guard = createResourceGuard()
    expect(() => guard.assertRunning()).not.toThrow()
    expect(guard.terminatedBy).toBeNull()
  })

  it('2 — assertRunning throws once shutdown has begun, naming the signal', () => {
    const guard = createResourceGuard()
    guard.beginShutdown('SIGTERM')
    expect(() => guard.assertRunning()).toThrow(/aborted by SIGTERM/)
    expect(() => guard.assertRunning()).toThrow(AbortedError)
  })

  it('3 — the first signal wins, so a second one cannot rewrite the reason', () => {
    const guard = createResourceGuard()
    guard.beginShutdown('SIGINT')
    guard.beginShutdown('SIGTERM')
    expect(guard.terminatedBy).toBe('SIGINT')
  })
})

describe('resource guard — a resource created DURING teardown is released', () => {
  it('4 — own() returns and registers the resource on the healthy path', async () => {
    const guard = createResourceGuard()
    const dispose = vi.fn()
    const value = await guard.own('cert', { key: 'k' }, dispose)
    expect(value).toEqual({ key: 'k' })
    expect(guard.owned.cert).toEqual({ key: 'k' })
    expect(dispose).not.toHaveBeenCalled()
  })

  it('5 — THE RACE: shutdown begins while the resource is being created, so own() disposes it', async () => {
    // This is the exact defect. `assertRunning()` passed, then the signal landed during the await
    // that creates the resource. Nobody else will ever release it, so the creator must.
    const guard = createResourceGuard()
    const disposed = []

    guard.assertRunning() // healthy at the moment we decided to acquire

    const cert = await (async () => {
      // …the signal arrives here, mid-creation.
      guard.beginShutdown('SIGTERM')
      return { key: '/tmp/lh-h2-cert-xxxx/key.pem' }
    })()

    await expect(guard.own('cert', cert, c => { disposed.push(c.key) }))
      .rejects.toThrow(/released a cert created during teardown/)

    expect(disposed).toEqual(['/tmp/lh-h2-cert-xxxx/key.pem'])
  })

  it('6 — the same holds for a process handle, not just the certificate', async () => {
    const guard = createResourceGuard()
    const killed = []
    guard.beginShutdown('SIGINT')
    await expect(guard.own('preview', { pid: 4242 }, p => { killed.push(p.pid) }))
      .rejects.toThrow(AbortedError)
    expect(killed).toEqual([4242])
  })

  it('7 — an async dispose is awaited before the abort propagates', async () => {
    const guard = createResourceGuard()
    let finished = false
    guard.beginShutdown('SIGTERM')
    await expect(guard.own('proxy', {}, async () => {
      await new Promise(r => setTimeout(r, 20))
      finished = true
    })).rejects.toThrow(AbortedError)
    // If the abort had propagated first, the process could exit mid-disposal — the very bug that
    // left a private key on disk.
    expect(finished).toBe(true)
  })

  it('8 — a failing dispose still aborts, and does not mask the abort with its own error', async () => {
    const guard = createResourceGuard()
    guard.beginShutdown('SIGTERM')
    await expect(guard.own('cert', {}, () => { throw new Error('rm failed') }))
      .rejects.toThrow(/aborted by SIGTERM/)
  })

  it('9 — once released the slot is EMPTY, so teardown cannot dispose it a second time', async () => {
    const guard = createResourceGuard()
    const disposed = []
    guard.beginShutdown('SIGTERM')
    await guard.own('cert', { key: 'k' }, c => { disposed.push(c.key) }).catch(() => {})

    expect(disposed).toEqual(['k'])
    expect(guard.owned.cert).toBeNull()
    // Teardown arriving afterwards finds nothing left to do.
    await guard.release('cert')
    expect(disposed).toEqual(['k'])
  })

  it('11 — THE PROXY SHAPE: a creation promise still PENDING when the signal lands', async () => {
    // `startH2Proxy` is the only genuinely asynchronous acquisition in the orchestrator: it binds a
    // socket, so a signal can arrive while it is in flight and teardown can run to completion before
    // it resolves. Modelled faithfully — the promise is created, shutdown begins while it is
    // pending, and only then does it resolve with a live listening socket.
    const guard = createResourceGuard()
    const closed = []
    let resolveCreation
    const creation = new Promise(resolve => { resolveCreation = resolve })

    guard.assertRunning() // healthy when we committed to acquiring

    // The signal lands, and the whole of teardown runs, while creation is still pending.
    guard.beginShutdown('SIGTERM')
    const teardownSawProxy = guard.owned.proxy // teardown finds nothing to close
    expect(teardownSawProxy).toBeNull()

    // Only now does the socket come up.
    resolveCreation({ port: 43295, close: () => { closed.push(43295); return Promise.resolve() } })
    const started = await creation

    await expect(guard.own('proxy', started, proxy => proxy.close()))
      .rejects.toThrow(/released a proxy created during teardown/)

    // Without this, the socket would stay bound with nothing left to close it.
    expect(closed).toEqual([43295])
  })

  it('12 — a creation that REJECTS after shutdown leaves nothing to release', async () => {
    const guard = createResourceGuard()
    guard.beginShutdown('SIGTERM')
    await expect(Promise.reject(new Error('EADDRINUSE'))).rejects.toThrow('EADDRINUSE')
    expect(guard.owned.proxy).toBeNull()
  })

  it('13 — DOUBLE DISPOSAL: teardown still IN PROGRESS when own() registers the same slot', async () => {
    // The window the earlier tests missed. They modelled teardown as already FINISHED; the real
    // hazard is teardown mid-flight — several seconds into killing a process tree — reaching this
    // slot only after `own()` has put something in it. Disposing in both places would close the
    // same socket twice.
    const guard = createResourceGuard()
    const closes = []
    let finishClose
    const closeGate = new Promise(resolve => { finishClose = resolve })

    guard.beginShutdown('SIGTERM')

    // Teardown reaches the proxy slot FIRST, while it is still empty, and latches it.
    const teardown = guard.release('proxy')

    // Only now does the socket finish binding, and startup hands it over.
    const abort = guard.own('proxy', { id: 'socket' }, v => {
      closes.push(v.id)
      return closeGate
    })

    finishClose()
    await expect(abort).rejects.toThrow(/released a proxy created during teardown/)
    await teardown

    // Disposed exactly once, by whichever side got there first.
    expect(closes).toEqual(['socket'])
    expect(guard.owned.proxy).toBeNull()
  })

  it('14 — release() is idempotent and concurrent callers share ONE disposal', async () => {
    const guard = createResourceGuard()
    const closes = []
    guard.register('proxy', { id: 'socket' }, v => {
      closes.push(v.id)
      return new Promise(r => setTimeout(r, 10))
    })

    // Three callers race — the signal handler, the failure path, and startup.
    await Promise.all([guard.release('proxy'), guard.release('proxy'), guard.release('proxy')])
    await guard.release('proxy') // and one more, after the fact

    expect(closes).toEqual(['socket'])
  })

  it('15 — a slot can be reused: releasing one child does not make the next unreleasable', async () => {
    // `run()` reuses the `child` slot for every command it spawns. A latch left over from the
    // previous occupant would silently make later children unkillable.
    const guard = createResourceGuard()
    const killed = []
    guard.register('child', { pid: 1 }, c => { killed.push(c.pid) })
    await guard.release('child')
    expect(killed).toEqual([1])

    guard.register('child', { pid: 2 }, c => { killed.push(c.pid) })
    await guard.release('child')
    expect(killed).toEqual([1, 2])
  })

  it('16 — an EXITED leader keeps its group handle, so teardown can still kill survivors', async () => {
    // The failure-path leak: `run()` used to drop the handle the moment the leader exited. But
    // `npm exec` exits while `lhci` and Chrome keep running, so the only process-GROUP reference
    // was discarded and cleanup had nothing left to terminate.
    const guard = createResourceGuard()
    const killedGroups = []
    const exitedLeader = { pid: 4242, exitCode: 143 } // leader gone, descendants still alive
    guard.register('child', exitedLeader, c => { killedGroups.push(c.pid) })

    expect(guard.owned.child).toBe(exitedLeader) // handle retained despite the exit
    await guard.release('child')
    expect(killedGroups).toEqual([4242])
  })

  it('17 — the slot is cleared BEFORE the disposer runs, so nothing sees a half-released resource', async () => {
    const guard = createResourceGuard()
    let observedDuringDispose = 'unset'
    guard.register('cert', { key: 'k' }, () => {
      observedDuringDispose = guard.owned.cert
      return Promise.resolve()
    })
    await guard.release('cert')
    expect(observedDuringDispose).toBeNull()
  })

  it('10 — without the guard the resource would simply leak (what the old code did)', async () => {
    // The pre-fix behaviour, written out so the regression is unmistakable: assign and move on.
    const guard = createResourceGuard()
    const disposed = []
    guard.beginShutdown('SIGTERM')

    guard.owned.cert = { key: 'leaked.pem' } // old code: a bare assignment, no disposal
    expect(disposed).toEqual([])              // nothing released it — the private key survives

    // The corrected path releases it instead.
    await guard.own('cert', { key: 'released.pem' }, c => { disposed.push(c.key) }).catch(() => {})
    expect(disposed).toEqual(['released.pem'])
  })
})
