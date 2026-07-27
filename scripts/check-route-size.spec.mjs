import { execFile } from 'node:child_process'
import { connect } from 'node:net'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'

const run = promisify(execFile)

/**
 * Exit-code semantics of the route-size gate.
 *
 * The distinction under test is the one that decides how a human reacts:
 *   1 → "the code is over budget, or compliance could not be proven"  → fix the code
 *   2 → "the gate could not measure"                                  → fix the pipeline
 * Conflating them trains people to ignore the gate, so both paths are asserted rather than assumed.
 *
 * Every case here fails BEFORE the preview server is started, so these stay fast and cannot leak a
 * process or hold a port.
 */
const tmpDirs = []
async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'route-size-'))
  tmpDirs.push(dir)
  return dir
}
afterAll(async () => { await Promise.all(tmpDirs.map(d => rm(d, { recursive: true, force: true }))) })

/** True when nothing is listening on `port` — i.e. the gate released it. */
function portFree(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const done = (free) => { socket.destroy(); resolve(free) }
    socket.once('connect', () => done(false))
    socket.once('error', () => done(true))
    socket.setTimeout(1000, () => done(true))
  })
}

/** Runs the gate and resolves its exit code + output, never throwing on non-zero. */
async function gate(env) {
  try {
    const { stdout, stderr } = await run('node', ['scripts/check-route-size.mjs'], {
      env: { ...process.env, ...env },
      timeout: 60_000
    })
    return { code: 0, out: stdout + stderr }
  } catch (error) {
    return { code: error.code ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

describe('route-size gate — infrastructure failures return 2, never a budget verdict', () => {
  it('exits 2 when there is no client build', async () => {
    const dir = await scratch()
    const { code, out } = await gate({ ROUTE_SIZE_PUBLIC_DIR: join(dir, 'missing') })
    expect(code).toBe(2)
    expect(out).toMatch(/MEASUREMENT FAILURE/)
    expect(out).toMatch(/no client build/)
  })

  // Provenance is REQUIRED: without it the app-code budget cannot be measured at all. Reporting
  // that as a breach would blame the code for a broken pipeline; reporting it as a pass is worse.
  it('exits 2 when required Rollup metadata is missing', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: join(dir, 'absent.json')
    })
    expect(code).toBe(2)
    expect(out).toMatch(/MEASUREMENT FAILURE/)
    expect(out).toMatch(/missing|ANALYZE_BUNDLE/)
  })

  it('exits 2 when the metadata is corrupt rather than merely absent', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const meta = join(dir, 'corrupt.json')
    await writeFile(meta, '{ this is not json')
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta
    })
    expect(code).toBe(2)
    expect(out).toMatch(/not valid JSON/)
  })

  it('exits 2 when the metadata is valid JSON but describes no chunks', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const meta = join(dir, 'empty.json')
    await writeFile(meta, JSON.stringify({ chunks: [] }))
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta
    })
    expect(code).toBe(2)
    expect(out).toMatch(/no chunk records/)
  })

  it('exits 2 when a chunk record has the wrong shape', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const meta = join(dir, 'malformed-chunk.json')
    await writeFile(meta, JSON.stringify({ chunks: [{ fileName: 42, modules: [] }] }))
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta
    })
    expect(code).toBe(2)
    expect(out).toMatch(/malformed chunk record/)
  })

  // An exact byte sum built from records of the wrong shape would be exactly as wrong as an
  // estimate, but would LOOK authoritative — so the module shape is validated, not trusted.
  it('exits 2 when a module record has a non-numeric renderedLength', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const meta = join(dir, 'malformed-module.json')
    await writeFile(meta, JSON.stringify({
      chunks: [{ fileName: '_nuxt/x.js', modules: [{ id: 'app/x.ts', renderedLength: 'lots' }] }]
    }))
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta
    })
    expect(code).toBe(2)
    expect(out).toMatch(/malformed module record/)
  })

  // The stale-sidecar case: metadata that describes a DIFFERENT build. Measuring the current
  // build's bytes against a previous build's provenance would silently report a wrong number.
  it('exits 2 when the metadata does not describe the build on disk (stale)', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    await writeFile(join(dir, 'public', '_nuxt', 'actually-built.js'), 'console.log(1)')
    const meta = join(dir, 'stale.json')
    await writeFile(meta, JSON.stringify({
      chunks: [{ fileName: '_nuxt/from-a-previous-build.js', modules: [] }]
    }))
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta
    })
    expect(code).toBe(2)
    expect(out).toMatch(/STALE/)
    expect(out).toMatch(/actually-built\.js/)
    expect(out).toMatch(/from-a-previous-build\.js/)
  })

  it('exits 2 — not 1 — when the preview cannot be reached', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    await writeFile(join(dir, 'public', '_nuxt', 'x.js'), 'console.log(1)')
    const meta = join(dir, 'meta.json')
    await writeFile(meta, JSON.stringify({ chunks: [{ fileName: '_nuxt/x.js', modules: [] }] }))
    // Provenance matches the build, so the run gets as far as the fetch. Point at a port nothing
    // serves: the fetch path must surface as infrastructure, never as a budget verdict.
    const { code, out } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta,
      ROUTE_SIZE_BASE: 'http://127.0.0.1:1'
    })
    expect(code).toBe(2)
    expect(out).toMatch(/MEASUREMENT FAILURE/)
    expect(out).not.toMatch(/budget not satisfied/)
  })

  // Every failure path above must leave the preview's ports free. A gate that leaks a listener
  // breaks the NEXT job rather than its own, which is the hardest kind of CI failure to attribute.
  it('leaves ports 3000 and 3001 free after a failing run', async () => {
    const dir = await scratch()
    const { code } = await gate({ ROUTE_SIZE_PUBLIC_DIR: join(dir, 'missing') })
    expect(code).toBe(2)
    for (const port of [3000, 3001]) expect(await portFree(port)).toBe(true)
  })
})
