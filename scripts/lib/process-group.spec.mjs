import { connect, createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { shutdownAll, startTracked, waitForExit } from './process-group.mjs'

/**
 * Regression coverage for the orphaned-Prism defect.
 *
 * The old orchestrator sent SIGTERM and exited ~300 ms later without confirming anything had died.
 * Prism outlived that, was reparented to init, and kept port 3001 — which then failed the route-size
 * gate's port assertion and let a later readiness check pass against a stale mock.
 *
 * These tests use real child processes that really bind ports, because the whole contract is about
 * observed process death and released sockets. A mocked child would prove nothing.
 *
 * The npx-shim/grandchild case is deliberately absent: the orchestrator now invokes the resolved
 * `node_modules/.bin/prism` binary, so the listener IS the direct child. Chasing descendants required
 * detaching children into their own process groups, which put them out of reach of Playwright's
 * group-based `webServer` teardown and left every port held after a green run. Removing the shim
 * removes the problem instead of layering process management on top of it.
 */
const registries = []
function registry() {
  const list = []
  registries.push(list)
  return list
}

afterEach(async () => {
  // Never let a failing assertion leak a process into the next test.
  await Promise.all(registries.splice(0).map(list => shutdownAll(list, { graceMs: 1000, killMs: 1000 })))
})

/** A child that binds `port` and exits politely on SIGTERM. */
function politeListener(list, port) {
  return startTracked(list, {
    name: 'polite',
    command: 'node',
    args: ['-e', `require('net').createServer().listen(${port},'127.0.0.1');process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)`]
  })
}

/** A child that binds `port` and IGNORES SIGTERM — the Prism-shaped case that needs SIGKILL. */
function stubbornListener(list, port) {
  return startTracked(list, {
    name: 'stubborn',
    command: 'node',
    args: ['-e', `require('net').createServer().listen(${port},'127.0.0.1');process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`]
  })
}

/** Resolves true when nothing is listening on `port`. */
function portFree(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const done = free => { socket.destroy(); resolve(free) }
    socket.once('connect', () => done(false))
    socket.once('error', () => done(true))
    socket.setTimeout(1000, () => done(true))
  })
}

/** Resolves true when the port can actually be BOUND again — stricter than "nothing answers". */
function portRebindable(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

async function waitUntilListening(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await portFree(port))) return true
    await new Promise(r => setTimeout(r, 50))
  }
  return false
}

describe('shutdownAll — observed termination, not timed hope', () => {
  it('terminates a well-behaved child and frees its port', async () => {
    const list = registry()
    politeListener(list, 39301)
    expect(await waitUntilListening(39301)).toBe(true)

    const survivors = await shutdownAll(list, { graceMs: 3000, killMs: 1000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(39301)).toBe(true)
  })

  it('escalates to SIGKILL when a child ignores SIGTERM, instead of exiting and orphaning it', async () => {
    // This is the Prism case: the old code would have returned here with the port still held.
    const list = registry()
    stubbornListener(list, 39302)
    expect(await waitUntilListening(39302)).toBe(true)

    const survivors = await shutdownAll(list, { graceMs: 300, killMs: 3000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(39302)).toBe(true)
  })

  it('frees every port when several children are tracked together', async () => {
    const list = registry()
    politeListener(list, 39304)
    stubbornListener(list, 39305)
    expect(await waitUntilListening(39304)).toBe(true)
    expect(await waitUntilListening(39305)).toBe(true)

    const survivors = await shutdownAll(list, { graceMs: 300, killMs: 3000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(39304)).toBe(true)
    expect(await portRebindable(39305)).toBe(true)
  })

  it('resolves immediately and reports nothing when every child has already exited', async () => {
    const list = registry()
    const child = startTracked(list, { name: 'quick', command: 'node', args: ['-e', 'process.exit(0)'] })
    await waitForExit(child, 3000)

    expect(await shutdownAll(list, { graceMs: 300, killMs: 300 })).toEqual([])
  })

  it('is safe to call twice', async () => {
    const list = registry()
    politeListener(list, 39306)
    expect(await waitUntilListening(39306)).toBe(true)

    expect(await shutdownAll(list, { graceMs: 2000, killMs: 1000 })).toEqual([])
    expect(await shutdownAll(list, { graceMs: 2000, killMs: 1000 })).toEqual([])
    expect(await portRebindable(39306)).toBe(true)
  })
})

describe('waitForExit', () => {
  it('reports true when the process exits inside the window', async () => {
    const list = registry()
    const child = startTracked(list, { name: 'brief', command: 'node', args: ['-e', 'setTimeout(()=>process.exit(0),50)'] })

    expect(await waitForExit(child, 3000)).toBe(true)
  })

  it('reports false when the process outlives the window, so the caller can escalate', async () => {
    const list = registry()
    const child = startTracked(list, { name: 'long', command: 'node', args: ['-e', 'setInterval(()=>{},1000)'] })

    expect(await waitForExit(child, 200)).toBe(false)
  })
})
