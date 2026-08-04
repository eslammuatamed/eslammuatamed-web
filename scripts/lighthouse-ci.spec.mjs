import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeProvenance } from './lib/build-provenance.mjs'

/**
 * Lifecycle trust gate for the governed Lighthouse orchestrator (doc 20 §5.1, D20-25).
 *
 * WHY AT THIS BOUNDARY. The orchestrator's job is not computing a number — it is owning processes,
 * ports and a private key across success, failure and interruption. Those properties are invisible
 * to a unit test of any single function, and a leak in them does not fail loudly: it poisons the
 * NEXT run, or leaves a key on disk. So the real script is executed as a child process against a
 * sandbox that stands in for the repository.
 *
 * The sandbox replaces exactly three things and nothing else: the preview (a tiny static server
 * instead of Nitro + Prism), `npx lhci` (a fake that writes report JSON), and the median gate. The
 * HTTP/2 frontend, the certificate, the preflight assertion, the measured-session proof, the signal
 * handlers and the teardown are all the REAL code under test.
 *
 * No timing assertions: every wait is on an observable condition (a log line, a released port, a
 * dead PID) with a bounded deadline.
 */

let sandbox, webPort, apiPort

/** A currently-free localhost port. */
async function freePort() {
  const s = net.createServer()
  await new Promise(r => s.listen(0, '127.0.0.1', r))
  const port = s.address().port
  await new Promise(r => s.close(r))
  return port
}

const REAL_SCRIPTS = join(process.cwd(), 'scripts')

/**
 * Certificate directories the orchestrator created.
 *
 * Scoped to the sandbox's OWN temp directory (the child runs with `TMPDIR` pointed there) rather
 * than the shared system one. Reading the shared `tmpdir()` made this assertion depend on whatever
 * else the suite happened to be running concurrently — `h2-proxy.spec.mjs` creates real
 * certificates too, and the shared reading picked those up.
 */
function certDirs() {
  return readdirSync(join(sandbox, 'tmp')).filter(n => n.startsWith('lh-h2-cert-'))
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function portIsFree(port) {
  return new Promise(resolve => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
  })
}

/** Wait for a condition, bounded. Returns false on timeout rather than hanging the suite. */
async function until(fn, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await fn()) return true
    await new Promise(r => setTimeout(r, 100))
  }
  return false
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'lh-ci-lifecycle-'))
  mkdirSync(join(sandbox, 'tmp'), { recursive: true })
  webPort = await freePort()
  apiPort = await freePort()

  // A git repository, so build identity resolves the way it does in the real checkout.
  const git = args => execFileSync('git', args, { cwd: sandbox, stdio: ['ignore', 'pipe', 'ignore'] })
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])
  writeFileSync(join(sandbox, 'source.txt'), 'v1')

  // The REAL orchestrator and the REAL libraries it exercises.
  mkdirSync(join(sandbox, 'scripts', 'lib'), { recursive: true })
  copyFileSync(join(REAL_SCRIPTS, 'lighthouse-ci.mjs'), join(sandbox, 'scripts', 'lighthouse-ci.mjs'))
  for (const lib of ['h2-proxy.mjs', 'build-provenance.mjs', 'lh-protocol.mjs']) {
    copyFileSync(join(REAL_SCRIPTS, 'lib', lib), join(sandbox, 'scripts', 'lib', lib))
  }

  // Stand-in for Nitro + Prism: serves a document that references a first-party /_nuxt/ asset,
  // which is what the preflight discovers and asserts against.
  writeFileSync(join(sandbox, 'scripts', 'ci-preview.mjs'), `
import http from 'node:http'
import { writeFileSync } from 'node:fs'
if (process.env.FAKE_PREVIEW_MODE === 'die') { process.exit(3) }
writeFileSync(process.env.FAKE_PREVIEW_PIDFILE, String(process.pid))
const html = '<!doctype html><html><head><link rel="stylesheet" href="/_nuxt/entry.css"></head>'
  + '<body><h1>hi</h1><script type="module" src="/_nuxt/app.js"></script></body></html>'
const web = http.createServer((req, res) => {
  if (req.url.startsWith('/_nuxt/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('export const a=1') ; return }
  if (req.url.startsWith('/_nuxt/entry.css')) { res.writeHead(200, { 'content-type': 'text/css' }); res.end('body{color:red}'); return }
  res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); res.end(html)
})
web.listen(Number(process.env.CI_PREVIEW_PORT), '127.0.0.1')
const api = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}') })
api.listen(Number(process.env.CI_MOCK_PORT), '127.0.0.1')
`)

  // Stand-in for the median gate.
  writeFileSync(join(sandbox, 'scripts', 'check-lighthouse-medians.mjs'), `
process.exit(process.env.FAKE_MEDIANS_MODE === 'fail' ? 1 : 0)
`)

  // Stand-in for \`npx lhci autorun\`: writes reports whose network trace says what the test needs.
  writeFileSync(join(sandbox, 'fake-npx.mjs'), `
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const mode = process.env.FAKE_LHCI_MODE ?? 'ok'
if (mode === 'fail') process.exit(1)
if (mode === 'hang') { setTimeout(() => {}, 300000); await new Promise(() => {}) }
const profile = process.env.LHCI_PROFILE ?? 'mobile'
const base = process.env.LH_BASE_URL
const dir = join('.lighthouseci', profile)
mkdirSync(dir, { recursive: true })
const proto = mode === 'h1' ? 'http/1.1' : 'h2'
for (const route of ['', '/ar']) {
  const url = base + (route || '/')
  const lhr = {
    requestedUrl: url, finalDisplayedUrl: url,
    configSettings: { formFactor: profile },
    audits: { 'network-requests': { details: { items: [
      { url, protocol: proto, resourceType: 'Document', statusCode: 200 },
      { url: base + '/_nuxt/app.js', protocol: proto, resourceType: 'Script', statusCode: 200 },
      { url: base + '/_nuxt/entry.css', protocol: 'h2', resourceType: 'Stylesheet', statusCode: 200 }
    ] } } }
  }
  writeFileSync(join(dir, 'lhr-' + profile + (route ? '-ar' : '-home') + '.json'), JSON.stringify(lhr))
}
process.exit(0)
`)
  const shim = join(sandbox, 'bin')
  mkdirSync(shim, { recursive: true })
  writeFileSync(join(shim, 'npx'), `#!/bin/sh\nexec "${process.execPath}" "${join(sandbox, 'fake-npx.mjs')}" "$@"\n`)
  chmodSync(join(shim, 'npx'), 0o755)

  // A directory that shadows ONLY openssl, so the certificate-failure test breaks certificate
  // generation and nothing else. Blanking PATH instead would also hide git, curl and npm, and the
  // run would die earlier for an unrelated reason while still exiting 1 — a test that passes for
  // the wrong cause.
  const badBin = join(sandbox, 'badbin')
  mkdirSync(badBin, { recursive: true })
  writeFileSync(join(badBin, 'openssl'), '#!/bin/sh\necho "openssl unavailable" >&2\nexit 1\n')
  chmodSync(join(badBin, 'openssl'), 0o755)

  // Identity now counts untracked-but-not-ignored files, so the fixtures must be committed and the
  // run's own artifacts ignored — exactly the arrangement the real repository has. Everything is in
  // place before the stamp is written, so the orchestrator sees a clean tree that matches its build.
  writeFileSync(join(sandbox, '.gitignore'), '.output\n.output.quarantined-*\n.lighthouseci\ntmp/\n*.pid\n')
  git(['add', '-A'])
  git(['commit', '-qm', 'fixtures'])

  // A build that IS the current source, so these tests exercise the lifecycle rather than a rebuild.
  mkdirSync(join(sandbox, '.output', 'server'), { recursive: true })
  writeFileSync(join(sandbox, '.output', 'server', 'index.mjs'), '// built')
  const here = process.cwd()
  process.chdir(sandbox)
  try { writeProvenance({ cwd: sandbox, outputDir: join(sandbox, '.output') }) } finally { process.chdir(here) }
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

/** Run the real orchestrator against the sandbox. Resolves with its exit code and output. */
function runOrchestrator(env = {}, { onData } = {}) {
  const pidfile = join(sandbox, 'preview.pid')
  const child = spawn(process.execPath, ['scripts/lighthouse-ci.mjs'], {
    cwd: sandbox,
    env: {
      ...process.env,
      PATH: `${join(sandbox, 'bin')}:${process.env.PATH}`,
      CI_PREVIEW_PORT: String(webPort),
      CI_MOCK_PORT: String(apiPort),
      LH_PORT_TIMEOUT_MS: '4000',
      // Sandbox-local temp: the certificate assertions must see only THIS run's key material.
      TMPDIR: join(sandbox, 'tmp'),
      FAKE_PREVIEW_PIDFILE: pidfile,
      ...env
    }
  })
  let out = ''
  const done = new Promise(resolve => {
    child.stdout.on('data', d => { out += d; onData?.(String(d), child) })
    child.stderr.on('data', d => { out += d; onData?.(String(d), child) })
    child.on('exit', code => resolve(code))
  })
  return { child, done: done.then(code => ({ code, out, pidfile })) }
}

const previewPid = pidfile => (existsSync(pidfile) ? Number(readFileSync(pidfile, 'utf8')) : null)

describe('governed orchestrator — the happy path and its cleanup', () => {
  it('18 — succeeds, and CLEANS UP: ports released, certificate gone, no child left alive', async () => {
    const before = certDirs()
    const { done } = runOrchestrator()
    const { code, out, pidfile } = await done

    expect(code).toBe(0)
    expect(out).toMatch(/protocol assertion PASSED/)
    expect(out).toMatch(/browser-session protocol PROVEN h2/)
    // 16 — ports released
    expect(await until(() => portIsFree(webPort))).toBe(true)
    expect(await until(() => portIsFree(apiPort))).toBe(true)
    // 17 — temporary certificate removed
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    // 18 — no owned child process remains
    const pid = previewPid(pidfile)
    expect(pid).toBeTruthy()
    expect(await until(async () => !isAlive(pid))).toBe(true)
  }, 60_000)

  it('19 — binds the reports to the source identity that produced them', async () => {
    const { done } = runOrchestrator()
    const { code } = await done
    expect(code).toBe(0)
    const record = JSON.parse(readFileSync(join(sandbox, '.lighthouseci', 'provenance.json'), 'utf8'))
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sandbox, encoding: 'utf8' }).trim()
    const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: sandbox, encoding: 'utf8' }).trim()
    expect(record.identity.head).toBe(head)
    expect(record.identity.tree).toBe(tree)
    expect(record.identity.outputHash).toMatch(/^[0-9a-f]{64}$/)
    // Every report file is bound by content hash, so a swapped report is detectable.
    expect(record.reports.length).toBeGreaterThan(0)
    for (const r of record.reports) expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(record.protocol.mobile.firstPartyByProtocol.h2).toBeGreaterThan(0)
    expect(record.protocol.desktop.firstPartyByProtocol.h2).toBeGreaterThan(0)
  }, 60_000)

  it('20 — discards a previous run\'s reports instead of measuring them again', async () => {
    const stale = join(sandbox, '.lighthouseci', 'mobile')
    mkdirSync(stale, { recursive: true })
    writeFileSync(join(stale, 'lhr-stale.json'), JSON.stringify({ stale: true }))
    const { done } = runOrchestrator()
    expect((await done).code).toBe(0)
    expect(existsSync(join(stale, 'lhr-stale.json'))).toBe(false)
  }, 60_000)
})

describe('governed orchestrator — failure paths all clean up', () => {
  it('21 — UPSTREAM STARTUP FAILURE: exits non-zero when the preview never listens', async () => {
    const before = certDirs()
    const { done } = runOrchestrator({ FAKE_PREVIEW_MODE: 'die' })
    const { code, out } = await done
    expect(code).toBe(1)
    expect(out).toMatch(/did not start listening/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('22 — PROXY PORT-BINDING FAILURE: exits non-zero and still tears the preview down', async () => {
    const squatter = net.createServer()
    const taken = await freePort()
    await new Promise(r => squatter.listen(taken, '127.0.0.1', r))
    const before = certDirs()
    const { done } = runOrchestrator({ LH_H2_PORT: String(taken) })
    const { code, pidfile } = await done
    expect(code).toBe(1)
    // The certificate was created before the proxy failed — it must still be disposed.
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    const pid = previewPid(pidfile)
    expect(await until(async () => !isAlive(pid))).toBe(true)
    await new Promise(r => squatter.close(r))
  }, 60_000)

  it('23 — CERTIFICATE GENERATION FAILURE: exits non-zero and tears the preview down', async () => {
    // Only openssl is broken; git, curl, npm and the npx shim all still resolve, so this fails for
    // the reason the test is named after and not for an incidental one.
    const { done } = runOrchestrator({
      PATH: `${join(sandbox, 'badbin')}:${join(sandbox, 'bin')}:${process.env.PATH}`
    })
    const { code, out, pidfile } = await done
    expect(code).toBe(1)
    // It got as far as the certificate step, then failed there.
    expect(out).toMatch(/generating ephemeral localhost certificate/)
    expect(out).not.toMatch(/starting HTTP\/2 frontend/)
    const pid = previewPid(pidfile)
    expect(await until(async () => !isAlive(pid))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('24 — LIGHTHOUSE CHILD FAILURE: a failing matrix fails the run and cleans up', async () => {
    const before = certDirs()
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'fail' })
    const { code, out, pidfile } = await done
    expect(code).toBe(1)
    expect(out).toMatch(/exited 1/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    const pid = previewPid(pidfile)
    expect(await until(async () => !isAlive(pid))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('25 — MEDIAN GATE FAILURE propagates, and does not leak the lifecycle', async () => {
    const before = certDirs()
    const { done } = runOrchestrator({ FAKE_MEDIANS_MODE: 'fail' })
    const { code, pidfile } = await done
    expect(code).toBe(1)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
  }, 60_000)

  it('26 — HTTP/1.1 IN THE MEASURED SESSION fails the run even though the preflight passed', async () => {
    // The defect this whole change exists to make impossible: the frontend really does serve h2
    // (the preflight proves it), but Chrome's own record shows the measurement used HTTP/1.1.
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'h1' })
    const { code, out } = await done
    expect(code).toBe(1)
    expect(out).toMatch(/protocol assertion PASSED/)
    expect(out).toMatch(/did NOT measure/)
    expect(out).toMatch(/main document served over "http\/1\.1"/)
  }, 60_000)
})

describe('governed orchestrator — interruption', () => {
  it('27 — SIGTERM during the matrix cleans up and exits 130', async () => {
    const before = certDirs()
    let signalled = false
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'hang' }, {
      onData: (text, child) => {
        if (!signalled && text.includes('collecting MOBILE matrix')) { signalled = true; child.kill('SIGTERM') }
      }
    })
    const { code, out, pidfile } = await done
    expect(signalled).toBe(true)
    expect(code).toBe(130)
    expect(out).toMatch(/cleanup \(SIGTERM\)/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('28 — SIGINT during the matrix cleans up and exits 130', async () => {
    const before = certDirs()
    let signalled = false
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'hang' }, {
      onData: (text, child) => {
        if (!signalled && text.includes('collecting MOBILE matrix')) { signalled = true; child.kill('SIGINT') }
      }
    })
    const { code, out, pidfile } = await done
    expect(code).toBe(130)
    expect(out).toMatch(/cleanup \(SIGINT\)/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
  }, 60_000)

  it('29 — cleanup is idempotent: a second signal does not re-run teardown or change the exit code', async () => {
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'hang' }, {
      onData: (text, child) => {
        if (text.includes('collecting MOBILE matrix')) { child.kill('SIGTERM'); child.kill('SIGTERM') }
      }
    })
    const { code, out } = await done
    expect(code).toBe(130)
    // The guard means teardown is logged exactly once no matter how many signals arrive.
    expect(out.match(/\[lighthouse:ci\] cleanup \(/g) ?? []).toHaveLength(1)
  }, 60_000)
})
