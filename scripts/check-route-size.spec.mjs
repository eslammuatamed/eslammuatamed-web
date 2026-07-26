import { execFile } from 'node:child_process'
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

  it('exits 2 — not 1 — when the preview cannot be reached', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'public', '_nuxt'), { recursive: true })
    const meta = join(dir, 'meta.json')
    await writeFile(meta, JSON.stringify({ chunks: [{ fileName: '_nuxt/x.js', modules: [] }] }))
    // Point at a port nothing serves; the fetch path must surface as infrastructure.
    const { code } = await gate({
      ROUTE_SIZE_PUBLIC_DIR: join(dir, 'public'),
      ROUTE_SIZE_META: meta,
      ROUTE_SIZE_BASE: 'http://127.0.0.1:1'
    })
    expect(code).toBe(2)
  })
})
