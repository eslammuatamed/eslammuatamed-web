/**
 * Ownership of resources that must not outlive a run (doc 20 §5.1, D20-25).
 *
 * WHY THIS EXISTS. Teardown is asynchronous — terminating a process tree takes seconds — and the
 * main flow keeps running throughout it. A signal arriving during startup therefore runs teardown
 * over whatever has been registered SO FAR, while startup carries on and creates more. Because
 * teardown runs exactly once, anything created after it has finished is never released. The
 * concrete casualty was an ephemeral PRIVATE KEY: written to disk after teardown, with nothing left
 * to dispose it.
 *
 * TWO GUARDS, because one is not enough. `assertRunning()` refuses to START acquiring once shutdown
 * has begun, which handles the common case. But the check and the creation are separated by an
 * await, so a signal can still land in between — and then the creator itself must release what it
 * just made. That is `own()`.
 *
 * AND DISPOSAL LIVES IN EXACTLY ONE PLACE. The obvious way to write `own()` — "if we are shutting
 * down, dispose it here" — introduces a second bug in place of the first. Teardown is not
 * instantaneous: it may be mid-flight, several seconds into killing a process tree, and simply not
 * have reached this resource yet. Disposing inside `own()` while teardown is still coming means the
 * same socket gets closed twice, the same key removed twice. So a resource is registered TOGETHER
 * WITH its disposer, and `release()` is idempotent per slot: whoever gets there first disposes it,
 * and the other side finds it already gone. Neither caller needs to know which one won.
 *
 * Extracted into its own module so these races can be tested deterministically. Exercising them
 * through the real orchestrator would mean landing a signal inside a specific millisecond window; a
 * test that merely fails to observe a leak proves nothing, because it passes just as happily when
 * the run aborted before creating anything at all.
 */

/** Thrown when a run is abandoned because shutdown began. Distinct so callers can recognise it. */
export class AbortedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AbortedError'
    this.aborted = true
  }
}

/**
 * A registry of owned resources, their disposers, and the acquisition guards.
 *
 * @param keys resource slots to track, so teardown reads them in a known order
 */
export function createResourceGuard(keys = ['preview', 'proxy', 'cert', 'child']) {
  const owned = Object.fromEntries(keys.map(k => [k, null]))
  const disposers = new Map()
  const releasing = new Map()
  let terminatedBy = null

  /**
   * Record a resource and how to release it.
   *
   * Clearing any in-flight release for the slot matters: `run()` reuses the `child` slot for every
   * child it spawns, and a latch left over from the previous occupant would make the next one
   * unreleasable.
   */
  function register(key, value, dispose) {
    owned[key] = value
    disposers.set(key, dispose)
    releasing.delete(key)
    return value
  }

  /**
   * Release a resource exactly once.
   *
   * Idempotent per slot AND safe under concurrency: the in-flight promise is memoised, so a second
   * caller awaits the first disposal rather than starting a duplicate one. The slot is cleared
   * before the disposer runs, so nothing can observe a half-released resource.
   */
  function release(key) {
    if (releasing.has(key)) return releasing.get(key)

    const value = owned[key]
    const dispose = disposers.get(key)
    owned[key] = null
    disposers.delete(key)

    const done = (value === null || value === undefined || !dispose)
      ? Promise.resolve(false)
      : Promise.resolve().then(() => dispose(value)).then(() => true)

    releasing.set(key, done)
    return done
  }

  return {
    owned,

    /** Which signal, if any, is tearing this run down. */
    get terminatedBy() { return terminatedBy },

    /** Has this slot's resource been released (or is it being released right now)? */
    isReleased(key) { return releasing.has(key) },

    /**
     * Record that shutdown has begun.
     *
     * Callers MUST do this synchronously inside the signal handler, before any await, so it is
     * already true by the time teardown's side effects reach the rest of the program.
     */
    beginShutdown(signal) {
      if (terminatedBy === null) terminatedBy = signal
      return terminatedBy
    },

    /** Refuse to begin acquiring anything new once shutdown has begun. */
    assertRunning() {
      if (terminatedBy) throw new AbortedError(`aborted by ${terminatedBy} — not acquiring further resources`)
    },

    register,
    release,

    /**
     * Take ownership of a freshly created resource.
     *
     * If shutdown began while it was being created, it is released here and the run aborts. Should
     * teardown already be releasing this slot, `release()` returns that same in-flight promise, so
     * the resource is disposed once and this caller still waits for it to finish.
     *
     * A failure to dispose is swallowed deliberately — we are already shutting down, and the abort
     * is the more useful error to surface.
     */
    async own(key, value, dispose) {
      register(key, value, dispose)
      if (terminatedBy) {
        try {
          await release(key)
        } catch { /* best effort: shutting down already, and the abort matters more */ }
        throw new AbortedError(`aborted by ${terminatedBy} — released a ${key} created during teardown`)
      }
      return value
    }
  }
}
