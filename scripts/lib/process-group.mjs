import { spawn } from 'node:child_process'

/**
 * Deterministic child-process lifecycle for the preview orchestrator.
 *
 * WHY THIS EXISTS. The previous shutdown sent SIGTERM and then called `process.exit()` after a fixed
 * ~300 ms, without ever confirming the children had gone. Prism routinely outlives that window, so the
 * orchestrator exited first, Prism was reparented to init, and it kept listening on 3001 — which then
 * failed the next run's readiness check and the route-size gate's port assertion, with no visible cause.
 *
 * The original diagnosis blamed the `npx prism` shim: the process we spawned was not the process that
 * bound the port, so signalling the direct child left the listener running. The obvious fix — spawn
 * children DETACHED and signal the whole group — works in isolation but breaks the orchestrator's most
 * important consumer. Playwright's `webServer` tears down by killing the process GROUP it spawned; a
 * detached child sits in its own group, out of that reach, so every port survived the run.
 *
 * So the shim is removed instead of worked around: callers pass the resolved binary
 * (`node_modules/.bin/prism`), which makes the listener the direct child. With no descendant to chase,
 * children stay in the orchestrator's own process group, where Playwright, a CI runner, and Ctrl+C all
 * reap them for free.
 *
 * What remains here is the part that was genuinely missing: shutdown WAITS for real exits, escalates to
 * SIGKILL, and waits again. Time-based hope is replaced by observed process death, so "shutdown
 * returned" means the ports are actually free. No third-party process manager.
 */

/** Grace period for a well-behaved child to exit on SIGTERM before SIGKILL. */
const DEFAULT_GRACE_MS = 5_000
/** How long to wait for a SIGKILLed process group to disappear. */
const DEFAULT_KILL_MS = 2_000

/** True once the process has actually exited (either normally or via a signal). */
function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

/** Signal a child, tolerating the race where it has already been reaped (ESRCH is success here). */
function signal(child, signalName) {
  if (hasExited(child)) return
  try {
    child.kill(signalName)
  } catch {
    // Already gone.
  }
}

/** Resolves true when the child exits within `timeoutMs`, false if it is still alive. */
export function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(hasExited(child)), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/**
 * Spawn a tracked child in its own process group and push it onto `registry`.
 * `onUnexpectedExit` fires only when the child dies while the orchestrator still expected it to run.
 */
export function startTracked(registry, { name, command, args, env, onUnexpectedExit, onSpawnError }) {
  const child = spawn(command, args, {
    // PIPED, then forwarded. Inheriting would hand our stdout/stderr descriptors straight to the
    // children; a supervisor that pipes our output (Playwright's `webServer`) then waits for EOF on
    // that pipe until every holder closes it. Keeping this process the sole holder means our exit
    // closes the pipe, so teardown completes instead of hanging with all tests already green.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })

  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)

  child.on('exit', (code, signal) => onUnexpectedExit?.(name, code, signal))
  child.on('error', error => onSpawnError?.(name, error))

  registry.push(child)
  return child
}

/**
 * Terminate every tracked child and RESOLVE ONLY once they are observably gone.
 *
 * SIGTERM the groups → wait up to `graceMs` → SIGKILL whatever survived → wait up to `killMs`.
 * Returns the children still alive afterwards, which should always be empty; a non-empty result means
 * a process is unkillable (uninterruptible sleep) and the caller should surface that rather than
 * pretend the ports are free.
 */
export async function shutdownAll(registry, { graceMs = DEFAULT_GRACE_MS, killMs = DEFAULT_KILL_MS } = {}) {
  const alive = registry.filter(child => !hasExited(child))
  if (alive.length === 0) return []

  for (const child of alive) signal(child, 'SIGTERM')
  const exitedGracefully = await Promise.all(alive.map(child => waitForExit(child, graceMs)))

  const stragglers = alive.filter((_, index) => !exitedGracefully[index])
  if (stragglers.length > 0) {
    for (const child of stragglers) signal(child, 'SIGKILL')
    await Promise.all(stragglers.map(child => waitForExit(child, killMs)))
  }

  return registry.filter(child => !hasExited(child))
}
