import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'

const run = promisify(execFile)

/**
 * Exit-code semantics of the Lighthouse median gate (D20-13).
 *
 *   1 → "a median breached a threshold"        → fix the site
 *   2 → "the gate could not measure"           → fix the pipeline
 *
 * The distinction is the whole reason this gate is project-owned: a collection that produced two
 * runs instead of three, or a report that will not parse, must NEVER be converted into a low score
 * — that would fail the build for a reason nobody can act on, and would just as easily PASS one if
 * the surviving runs happened to be good.
 */
const tmpDirs = []
async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'lh-medians-'))
  tmpDirs.push(dir)
  return dir
}
afterAll(async () => { await Promise.all(tmpDirs.map(d => rm(d, { recursive: true, force: true }))) })

async function gate(dirs) {
  try {
    const { stdout, stderr } = await run('node', ['scripts/check-lighthouse-medians.mjs'], {
      env: { ...process.env, LHCI_REPORT_DIRS: dirs.join(',') },
      timeout: 60_000
    })
    return { code: 0, out: stdout + stderr }
  } catch (error) {
    return { code: error.code ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function report({ formFactor = 'mobile', url = 'http://127.0.0.1:3000/', performance = 70, version = '12.0.0' } = {}) {
  return {
    lighthouseVersion: version,
    requestedUrl: url,
    configSettings: { formFactor },
    categories: {
      performance: { score: performance / 100 },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: { score: 1 }
    },
    audits: {
      'largest-contentful-paint': { numericValue: 900 },
      'cumulative-layout-shift': { numericValue: 0.01 },
      'total-blocking-time': { numericValue: 150 },
      'speed-index': { numericValue: 1200 },
      'resource-summary': { details: { items: [{ resourceType: 'font', transferSize: 100 * 1024 }] } }
    }
  }
}

/** Writes `n` reports plus the manifest.json LHCI also emits (which must be skipped, not parsed). */
async function seed(dir, opts, n = 3) {
  await mkdir(dir, { recursive: true })
  for (let i = 0; i < n; i++) {
    await writeFile(join(dir, `lhr-${i}.json`), JSON.stringify(report(opts)))
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify([{ url: opts?.url ?? '/' }]))
}

describe('lighthouse median gate', () => {
  it('exits 0 when three comparable runs clear every threshold', async () => {
    const dir = join(await scratch(), 'mobile')
    await seed(dir, { performance: 70 })
    const { code, out } = await gate([dir])
    expect(code).toBe(0)
    expect(out).toMatch(/All Lighthouse medians within/)
    // Every individual run must be visible, not just the median.
    expect(out).toMatch(/runs \[.*70\.0.*70\.0.*70\.0.*\]/)
  })

  it('exits 1 when a median is below the threshold, naming the configuration', async () => {
    const dir = join(await scratch(), 'mobile')
    await seed(dir, { performance: 40 })
    const { code, out } = await gate([dir])
    expect(code).toBe(1)
    expect(out).toMatch(/thresholds not satisfied/)
    expect(out).toMatch(/performance median 40\.0 < required 60/)
    expect(out).not.toMatch(/MEASUREMENT FAILURE/)
  })

  it('exits 2 — not 1 — when a configuration has fewer than three runs', async () => {
    const dir = join(await scratch(), 'mobile')
    await seed(dir, { performance: 10 }, 2)
    const { code, out } = await gate([dir])
    expect(code).toBe(2)
    expect(out).toMatch(/MEASUREMENT FAILURE/)
    expect(out).toMatch(/expected 3 comparable runs, found 2/)
  })

  it('exits 2 when a report is corrupt rather than dropping it from the sample', async () => {
    const dir = join(await scratch(), 'mobile')
    await seed(dir, { performance: 70 })
    await writeFile(join(dir, 'lhr-broken.json'), '{ not json')
    const { code, out } = await gate([dir])
    expect(code).toBe(2)
    expect(out).toMatch(/not valid JSON/)
  })

  it('exits 2 when the report directory does not exist', async () => {
    const { code, out } = await gate([join(await scratch(), 'never-collected')])
    expect(code).toBe(2)
    expect(out).toMatch(/no Lighthouse reports at/)
  })

  it('exits 2 when the directory holds no reports at all', async () => {
    const dir = join(await scratch(), 'empty')
    await mkdir(dir, { recursive: true })
    const { code, out } = await gate([dir])
    expect(code).toBe(2)
    expect(out).toMatch(/contains no Lighthouse report JSON/)
  })

  it('exits 2 on mixed build provenance within one configuration', async () => {
    const base = await scratch()
    const dir = join(base, 'mobile')
    await seed(dir, { performance: 70 }, 2)
    await writeFile(join(dir, 'lhr-old.json'), JSON.stringify(report({ performance: 70, version: '11.7.1' })))
    const { code, out } = await gate([dir])
    expect(code).toBe(2)
    expect(out).toMatch(/different Lighthouse versions/)
  })

  // Desktop's higher bar must not be applied to mobile runs, or vice versa. A shared threshold
  // would either fail every mobile build or silently exempt desktop.
  it('applies each profile its own threshold and never mixes them', async () => {
    const base = await scratch()
    await seed(join(base, 'mobile'), { formFactor: 'mobile', performance: 70 })
    await seed(join(base, 'desktop'), { formFactor: 'desktop', performance: 97 })
    const { code, out } = await gate([join(base, 'mobile'), join(base, 'desktop')])
    expect(code).toBe(0)
    expect(out).toMatch(/MOBILE/)
    expect(out).toMatch(/DESKTOP/)
    expect(out).toMatch(/≥ 60/)
    expect(out).toMatch(/≥ 95/)
  })

  it('fails a desktop score that would have passed the mobile bar', async () => {
    const base = await scratch()
    await seed(join(base, 'desktop'), { formFactor: 'desktop', performance: 70 })
    const { code, out } = await gate([join(base, 'desktop')])
    expect(code).toBe(1)
    expect(out).toMatch(/performance median 70\.0 < required 95/)
  })

  it('groups by run configuration, not by directory name', async () => {
    const base = await scratch()
    // A desktop report deliberately placed in the "mobile" directory: the gate must believe the
    // report's own configSettings, so this is one desktop group, judged at ≥ 95.
    await seed(join(base, 'mobile'), { formFactor: 'desktop', performance: 70 })
    const { code, out } = await gate([join(base, 'mobile')])
    expect(out).toMatch(/DESKTOP/)
    expect(code).toBe(1)
    expect(out).toMatch(/< required 95/)
  })

  it('keeps separate URLs in separate medians', async () => {
    const base = await scratch()
    const dir = join(base, 'mobile')
    await seed(dir, { url: 'http://127.0.0.1:3000/', performance: 70 })
    await mkdir(dir, { recursive: true })
    for (let i = 0; i < 3; i++) {
      await writeFile(join(dir, `ar-${i}.json`), JSON.stringify(report({ url: 'http://127.0.0.1:3000/ar', performance: 65 })))
    }
    const { code, out } = await gate([dir])
    expect(code).toBe(0)
    expect(out).toMatch(/http:\/\/127\.0\.0\.1:3000\/\s/)
    expect(out).toMatch(/http:\/\/127\.0\.0\.1:3000\/ar/)
  })

  it('leaves the report directory untouched — the gate reads, it does not clean up evidence', async () => {
    const dir = join(await scratch(), 'mobile')
    await seed(dir, { performance: 40 })
    const before = (await readdir(dir)).sort()
    await gate([dir])
    expect((await readdir(dir)).sort()).toEqual(before)
  })
})
