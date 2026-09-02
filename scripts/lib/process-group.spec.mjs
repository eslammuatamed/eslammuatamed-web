import { connect, createServer } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const listenerDirectories = []
function registry() {
  const list = []
  registries.push(list)
  return list
}

afterEach(async () => {
  // Never let a failing assertion leak a process into the next test.
  await Promise.all(registries.splice(0).map(list => shutdownAll(list, { graceMs: 1000, killMs: 1000 })))
  await Promise.all(listenerDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

/**
 * A real child listener owns its ephemeral port. It records the assigned port only after `listen(0)`
 * succeeds, so the test never has the parent-side "find a port, release it, race another process"
 * window that fixed repository-wide ports had.
 */
async function listener(list, name, ignoreSigterm) {
  const directory = await mkdtemp(join(tmpdir(), 'process-group-listener-'))
  listenerDirectories.push(directory)
  const readyFile = join(directory, 'port')
  startTracked(list, {
    name,
    command: 'node',
    args: ['-e', [
      "const { writeFileSync } = require('node:fs')",
      "const { createServer } = require('node:net')",
      'const server = createServer()',
      "server.listen(0, '127.0.0.1', () => writeFileSync(process.argv[1], String(server.address().port)))",
      `process.on('SIGTERM', () => ${ignoreSigterm ? '{}' : 'process.exit(0)'})`,
      'setInterval(() => {}, 1000)'
    ].join(';'), readyFile]
  })
  return readyFile
}

/** A child that exits politely on SIGTERM. */
const politeListener = list => listener(list, 'polite', false)
/** A child that IGNORES SIGTERM — the Prism-shaped case that needs SIGKILL. */
const stubbornListener = list => listener(list, 'stubborn', true)

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

async function readBoundPort(readyFile) {
  try {
    const port = Number(await readFile(readyFile, 'utf8'))
    return Number.isInteger(port) && port > 0 ? port : null
  } catch {
    return null
  }
}

/** Waits for the real child to report its OS-assigned port and accept a TCP connection. */
async function waitUntilListening(readyFile, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const port = await readBoundPort(readyFile)
    if (port !== null && !(await portFree(port))) return port
    await new Promise(r => setTimeout(r, 50))
  }
  return null
}

describe('shutdownAll — observed termination, not timed hope', () => {
  it('terminates a well-behaved child and frees its port', async () => {
    const list = registry()
    const readyFile = await politeListener(list)
    const port = await waitUntilListening(readyFile)
    expect(port).toBeTypeOf('number')

    const survivors = await shutdownAll(list, { graceMs: 3000, killMs: 1000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(port)).toBe(true)
  })

  it('escalates to SIGKILL when a child ignores SIGTERM, instead of exiting and orphaning it', async () => {
    // This is the Prism case: the old code would have returned here with the port still held.
    const list = registry()
    const readyFile = await stubbornListener(list)
    const port = await waitUntilListening(readyFile)
    expect(port).toBeTypeOf('number')

    const survivors = await shutdownAll(list, { graceMs: 300, killMs: 3000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(port)).toBe(true)
  })

  it('frees every port when several children are tracked together', async () => {
    const list = registry()
    const politeReadyFile = await politeListener(list)
    const stubbornReadyFile = await stubbornListener(list)
    const politePort = await waitUntilListening(politeReadyFile)
    const stubbornPort = await waitUntilListening(stubbornReadyFile)
    expect(politePort).toBeTypeOf('number')
    expect(stubbornPort).toBeTypeOf('number')

    const survivors = await shutdownAll(list, { graceMs: 300, killMs: 3000 })

    expect(survivors).toEqual([])
    expect(await portRebindable(politePort)).toBe(true)
    expect(await portRebindable(stubbornPort)).toBe(true)
  })

  it('resolves immediately and reports nothing when every child has already exited', async () => {
    const list = registry()
    const child = startTracked(list, { name: 'quick', command: 'node', args: ['-e', 'process.exit(0)'] })
    await waitForExit(child, 3000)

    expect(await shutdownAll(list, { graceMs: 300, killMs: 300 })).toEqual([])
  })

  it('is safe to call twice', async () => {
    const list = registry()
    const readyFile = await politeListener(list)
    const port = await waitUntilListening(readyFile)
    expect(port).toBeTypeOf('number')

    expect(await shutdownAll(list, { graceMs: 2000, killMs: 1000 })).toEqual([])
    expect(await shutdownAll(list, { graceMs: 2000, killMs: 1000 })).toEqual([])
    expect(await portRebindable(port)).toBe(true)
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
