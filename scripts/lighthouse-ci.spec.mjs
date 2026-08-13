import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeProvenance } from './lib/build-provenance.mjs'
import { GOVERNED_PATHS } from './lib/lighthouse-governed-urls.cjs'

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
  for (const lib of ['h2-proxy.mjs', 'build-provenance.mjs', 'home-prime.mjs', 'lh-protocol.mjs', 'lifecycle-guard.mjs', 'process-tree.mjs', 'lighthouse-coverage.mjs', 'lighthouse-governed-urls.cjs']) {
    copyFileSync(join(REAL_SCRIPTS, 'lib', lib), join(sandbox, 'scripts', 'lib', lib))
  }

  // Stand-in for Nitro + Prism: serves a document that references a first-party /_nuxt/ asset,
  // which is what the preflight discovers and asserts against.
  //
  // It now also stands in for the SWR-cached Home page, because the orchestrator verifies what it
  // primed (`primeSwrRoute`). The default document carries the section-heading ids that
  // `app/pages/index.vue` only renders inside `v-if="settings"`; `FAKE_PREVIEW_HOME` swaps in the
  // D13-1 outage stub, which — exactly like the real one — answers 200 and still references the
  // first-party asset, so it satisfies every check that existed before this verification did.
  writeFileSync(join(sandbox, 'scripts', 'ci-preview.mjs'), `
import http from 'node:http'
import { appendFileSync, writeFileSync } from 'node:fs'
if (process.env.FAKE_PREVIEW_MODE === 'die') { process.exit(3) }
writeFileSync(process.env.FAKE_PREVIEW_PIDFILE, String(process.pid))
const head = '<!doctype html><html><head><link rel="stylesheet" href="/_nuxt/entry.css"></head><body>'
const tail = '<script type="module" src="/_nuxt/app.js"></script></body></html>'
const sections = ['capabilities-title', 'work-title', 'experience-title', 'writing-title', 'voices-title']
const complete = head + '<h1>hi</h1>'
  + sections.map(id => '<h2 id="' + id + '">s</h2>').join('') + tail
// The outage state: chrome and tagline present, every section gone.
const stub = head + '<p>Content unavailable</p>' + tail
const homeMode = process.env.FAKE_PREVIEW_HOME ?? 'complete'
const seen = new Map()
function homeDoc(url) {
  const n = (seen.get(url) ?? 0) + 1
  seen.set(url, n)
  if (homeMode === 'stub') return stub
  // Models a poisoned SWR entry that the TTL wait clears: the first render of a route is the
  // outage state, every later one is the real page.
  if (homeMode === 'stub-then-complete') return n === 1 ? stub : complete
  return complete
}
const web = http.createServer((req, res) => {
  if (process.env.FAKE_PREVIEW_REQLOG) appendFileSync(process.env.FAKE_PREVIEW_REQLOG, req.url + '\\n')
  if (req.url.startsWith('/_nuxt/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('export const a=1') ; return }
  if (req.url.startsWith('/_nuxt/entry.css')) { res.writeHead(200, { 'content-type': 'text/css' }); res.end('body{color:red}'); return }
  res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); res.end(homeDoc(req.url))
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
if (mode === 'detached-browser-then-exit') {
  // The combination that defeats a teardown-time walk entirely: a DETACHED descendant (own process
  // group, like Chrome) whose parent then EXITS, reparenting it to init. By teardown there is no
  // group link and no parent link left -- it can only be killed if it was recorded while its parent
  // was still alive.
  const { spawn } = await import('node:child_process')
  const { existsSync } = await import('node:fs')
  const browser = spawn(process.execPath, ['-e',
    'process.on("SIGTERM", () => {});'
    + ' require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PIDFILE, String(process.pid));'
    + ' setInterval(() => {}, 1000)'
  ], { stdio: 'ignore', detached: true })
  browser.unref()
  const deadline = Date.now() + 10000
  while (!existsSync(process.env.FAKE_GRANDCHILD_PIDFILE) && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 50))
  }
  // Give the tracker a sample while the parent link still exists, then abandon it.
  await new Promise(r => setTimeout(r, 1500))
  process.exit(9)
}
if (mode === 'detached-browser') {
  // Reproduces chrome-launcher: it spawns Chrome with detached:true, making it the leader of its
  // OWN process group, so a signal to THIS group never reaches it. It also ignores SIGTERM here, so
  // only per-PID escalation ends it.
  const { spawn } = await import('node:child_process')
  const browser = spawn(process.execPath, ['-e',
    'process.on("SIGTERM", () => {});'
    + ' require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PIDFILE, String(process.pid));'
    + ' setInterval(() => {}, 1000)'
  ], { stdio: 'ignore', detached: true })
  // Deliberately NOT unref()'d: the child handle is what keeps this leader alive. unref()ing it
  // emptied the event loop, so the leader exited 0 immediately and the run failed for an unrelated
  // reason -- the test then measured nothing it claimed to.
  void browser
  await new Promise(() => {})
}
if (mode === 'orphan-exit') {
  // The FAILURE-path shape: the leader exits non-zero straight away while a descendant keeps
  // running. No signal is involved -- run() simply rejects, and cleanup must still be holding the
  // process-GROUP handle to kill what was left behind. (No backticks in here: this text lives
  // inside a template literal, and one would end it.)
  const { spawn } = await import('node:child_process')
  const child = spawn(process.execPath, ['-e',
    'process.on("SIGTERM", () => {});'
    + ' require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PIDFILE, String(process.pid));'
    + ' setInterval(() => {}, 1000)'
  ], { stdio: 'ignore' })
  // Give the descendant time to install its handler and announce itself before the leader goes.
  const { existsSync } = await import('node:fs')
  const deadline = Date.now() + 10000
  while (!existsSync(process.env.FAKE_GRANDCHILD_PIDFILE) && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 50))
  }
  // Stay alive briefly so the descendant is observable, as in a real run where Chrome is up for
  // minutes before lhci exits. Exiting within a single sample interval would test a window that
  // does not occur in practice.
  await new Promise(r => setTimeout(r, 1200))
  void child
  process.exit(7)
}
if (mode === 'orphan') {
  // The scenario a leader-only wait cannot catch: the ROOT exits the instant it is signalled, while
  // a descendant IGNORES SIGTERM and keeps running. Waiting on the leader would declare teardown
  // finished over a live group; only a group-wide check plus SIGKILL escalation actually ends it.
  const { spawn } = await import('node:child_process')
  // The CHILD writes the pidfile, and only after installing its SIGTERM handler. The parent cannot:
  // spawn() returns before the child's runtime has started, so a test that signalled as soon as the
  // parent wrote the file would kill a child that was not yet ignoring SIGTERM — and the scenario
  // would silently degrade into "everything died on SIGTERM", passing for the wrong reason.
  spawn(process.execPath, ['-e',
    'process.on("SIGTERM", () => {});'
    + ' require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PIDFILE, String(process.pid));'
    + ' setInterval(() => {}, 1000)'
  ], { stdio: 'ignore' })
  process.on('SIGTERM', () => process.exit(143))
  await new Promise(() => {})
}
if (mode === 'hang') {
  // Stands in for the real tree: npx -> sh -c lhci -> lhci collect -> Chrome. A teardown that only
  // signals THIS process leaves the grandchild running, which is the defect under test.
  const { spawn } = await import('node:child_process')
  // Same reasoning as 'orphan': the child announces itself once it is genuinely running, so the
  // test never signals a process that has not finished starting.
  spawn(process.execPath, ['-e',
    'require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PIDFILE, String(process.pid));'
    + ' setInterval(() => {}, 1000)'
  ], { stdio: 'ignore' })
  await new Promise(() => {})
}
// The profile is read WITHOUT a default: the real lighthouserc resolver throws on an unrecognised
// value, and a shim that quietly fell back to 'mobile' would hide exactly the wrong-matrix defect
// that resolver exists to prevent.
const profile = process.env.LHCI_PROFILE
if (profile !== 'mobile' && profile !== 'desktop') {
  console.error('fake lhci: LHCI_PROFILE is ' + JSON.stringify(profile) + ' — expected mobile or desktop')
  process.exit(2)
}
const base = process.env.LH_BASE_URL
const dir = join('.lighthouseci', profile)
mkdirSync(dir, { recursive: true })
const proto = mode === 'h1' ? 'http/1.1' : 'h2'
// The GOVERNED population, injected from the real module rather than restated here, so this
// fixture cannot drift out of agreement with the list the orchestrator asserts coverage against.
const paths = ${JSON.stringify(GOVERNED_PATHS)}
paths.forEach((route, i) => {
  const url = base + route
  const lhr = {
    requestedUrl: url, finalDisplayedUrl: url,
    configSettings: { formFactor: profile },
    audits: { 'network-requests': { details: { items: [
      { url, protocol: proto, resourceType: 'Document', statusCode: 200 },
      { url: base + '/_nuxt/app.js', protocol: proto, resourceType: 'Script', statusCode: 200 },
      { url: base + '/_nuxt/entry.css', protocol: 'h2', resourceType: 'Stylesheet', statusCode: 200 }
    ] } } }
  }
  writeFileSync(join(dir, 'lhr-' + profile + '-' + String(i).padStart(2, '0') + '.json'), JSON.stringify(lhr))
})
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
      FAKE_GRANDCHILD_PIDFILE: join(sandbox, 'grandchild.pid'),
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

describe('governed orchestrator — profile sharding (Stage 2B)', () => {
  // The default must stay BOTH: a local run, and any caller that does not set LH_PROFILES, has to
  // keep collecting the full governed matrix. A shard-only default would silently halve coverage
  // for every consumer that never opted in.
  it('39 — collects BOTH profiles when LH_PROFILES is unset', async () => {
    const { done } = runOrchestrator()
    const { code, out } = await done

    expect(code).toBe(0)
    expect(out).toMatch(/collecting MOBILE matrix/)
    expect(out).toMatch(/collecting DESKTOP matrix/)
    expect(existsSync(join(sandbox, '.lighthouseci', 'mobile'))).toBe(true)
    expect(existsSync(join(sandbox, '.lighthouseci', 'desktop'))).toBe(true)
  })

  // The shard itself. `desktop` must collect desktop and MUST NOT touch the mobile directory —
  // the other shard owns it, on another runner, and clearing it here would destroy that evidence.
  it.each(['mobile', 'desktop'])('40 — LH_PROFILES=%s collects that profile ALONE', async profile => {
    const other = profile === 'mobile' ? 'desktop' : 'mobile'
    const { done } = runOrchestrator({ LH_PROFILES: profile })
    const { code, out } = await done

    expect(code).toBe(0)
    expect(out).toMatch(new RegExp(`collecting ${profile.toUpperCase()} matrix`))
    expect(out).not.toMatch(new RegExp(`collecting ${other.toUpperCase()} matrix`))
    expect(existsSync(join(sandbox, '.lighthouseci', profile))).toBe(true)
    expect(existsSync(join(sandbox, '.lighthouseci', other))).toBe(false)
  })

  // Coverage is asserted per shard and STATES ITS COUNT. A gate that only prints "passed" cannot
  // be distinguished from one that verified nothing.
  it('41 — each shard proves it collected the whole governed URL population', async () => {
    const { done } = runOrchestrator({ LH_PROFILES: 'desktop' })
    const { code, out } = await done

    expect(code).toBe(0)
    expect(out).toMatch(/desktop: all 16\/16 governed URLs collected/)
  })

  // The failure mode sharding introduces: an unrecognised profile must STOP the run, not fall back.
  it.each(['', 'Desktop', 'tablet'])('42 — REFUSES the unrecognised profile %o rather than defaulting', async value => {
    const { done } = runOrchestrator({ LH_PROFILES: value })
    const { code, out } = await done

    expect(code).not.toBe(0)
    // Nothing may be collected under a guessed profile.
    expect(existsSync(join(sandbox, '.lighthouseci', 'mobile'))).toBe(false)
    expect(existsSync(join(sandbox, '.lighthouseci', 'desktop'))).toBe(false)
    expect(out).toMatch(value === ''
      ? /names no profile/
      : /expected exactly one of "mobile" or "desktop"/)
  })
})

describe('governed orchestrator — interruption', () => {
  /**
   * Start a run and signal it only once its matrix child has REALLY started.
   *
   * Signalling on the "collecting MOBILE matrix" log line raced the child: the orchestrator prints
   * that before it spawns `npx`, so the signal could land before the child existed and there would
   * be no tree to tear down. Waiting for the child's own pidfile is an observable condition, not a
   * delay.
   */
  async function runAndSignal(signal, mode = 'hang') {
    const before = certDirs()
    const grandchildPid = join(sandbox, 'grandchild.pid')
    const { child, done } = runOrchestrator({ FAKE_LHCI_MODE: mode })
    const started = await until(() => existsSync(grandchildPid))
    expect(started).toBe(true)
    child.kill(signal)
    const result = await done
    return { ...result, before, descendant: Number(readFileSync(grandchildPid, 'utf8')) }
  }

  it('27 — SIGTERM during the matrix cleans up and exits 130, killing the WHOLE tree', async () => {
    const { code, out, pidfile, before, descendant } = await runAndSignal('SIGTERM')
    expect(code).toBe(130)
    expect(out).toMatch(/cleanup \(SIGTERM\)/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)

    // The descendant, not just the root. In the real run this is a headless Chrome holding its own
    // --user-data-dir; signalling only `npx` left it running.
    expect(descendant).toBeGreaterThan(0)
    expect(await until(async () => !isAlive(descendant))).toBe(true)
  }, 60_000)

  it('28 — SIGINT during the matrix cleans up and exits 130, killing the WHOLE tree', async () => {
    const { code, out, pidfile, before, descendant } = await runAndSignal('SIGINT')
    expect(code).toBe(130)
    expect(out).toMatch(/cleanup \(SIGINT\)/)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(async () => !isAlive(descendant))).toBe(true)
  }, 60_000)

  it('29 — cleanup is idempotent: a second signal does not re-run teardown or change the exit code', async () => {
    const grandchildPid = join(sandbox, 'grandchild.pid')
    const { child, done } = runOrchestrator({ FAKE_LHCI_MODE: 'hang' })
    expect(await until(() => existsSync(grandchildPid))).toBe(true)
    child.kill('SIGTERM')
    child.kill('SIGTERM')
    const { code, out } = await done
    expect(code).toBe(130)
    // Teardown is logged exactly once no matter how many signals arrive — and, just as importantly,
    // every caller AWAITS that one teardown instead of racing past it (see `cleanup`).
    expect(out.match(/\[lighthouse:ci\] cleanup \(/g) ?? []).toHaveLength(1)
  }, 60_000)

  it('31 — a signal during STARTUP leaves no certificate, process or bound port behind', async () => {
    // END-TO-END SANITY ONLY. This asserts an OUTCOME — nothing leaked — which is also true when
    // the run simply aborted before creating anything, the common case. It therefore does NOT prove
    // the mid-creation disposal path ran; `lifecycle-guard.spec.mjs` drives that race directly,
    // because the window is milliseconds wide inside one specific await.
    const before = certDirs()
    let signalled = false
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'hang' }, {
      onData: (text, child) => {
        if (!signalled && text.includes('starting Nitro preview')) { signalled = true; child.kill('SIGTERM') }
      }
    })
    const { code, pidfile } = await done
    expect(signalled).toBe(true)
    expect(code).toBe(130)

    // No key material survives, whichever side of the race the signal landed on.
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    // Nor a preview, if startup got far enough to spawn one.
    if (existsSync(pidfile)) {
      expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    }
    expect(await until(() => portIsFree(webPort))).toBe(true)
    expect(await until(() => portIsFree(apiPort))).toBe(true)
  }, 60_000)

  it('34 — a DETACHED descendant survives its parent EXITING and is still killed', async () => {
    // No signal at all. The leader exits non-zero, so its detached descendant is reparented to init:
    // no process group link, no parent link. Only the rolling record taken while the leader lived
    // can still identify it. This is the case a teardown-time /proc walk cannot see.
    const before = certDirs()
    const grandchildPid = join(sandbox, 'grandchild.pid')
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'detached-browser-then-exit' })
    const { code, out, pidfile } = await done

    expect(code).toBe(1) // a genuine failure, not an interruption
    expect(out).toMatch(/exited 9/)

    const descendant = Number(readFileSync(grandchildPid, 'utf8'))
    expect(Number.isFinite(descendant)).toBe(true)
    expect(descendant).toBeGreaterThan(0)
    expect(out).toMatch(/escalating to SIGKILL/)
    expect(await until(async () => !isAlive(descendant))).toBe(true)

    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('33 — a DETACHED descendant that escapes the process group is still killed', async () => {
    // The real defect, reproduced: chrome-launcher spawns Chrome detached, so it sits in its own
    // process group. Signalling the lhci group cleaned up everything EXCEPT Chrome — observed live
    // as nine surviving Chrome processes after ports, certificate and lhci were all gone.
    const { code, out, pidfile, before, descendant } = await runAndSignal('SIGTERM', 'detached-browser')
    expect(Number.isFinite(descendant)).toBe(true)
    expect(descendant).toBeGreaterThan(0)
    expect(code).toBe(130)
    // Escalation had to happen: it ignores SIGTERM and is outside the group.
    expect(out).toMatch(/escalating to SIGKILL/)
    expect(await until(async () => !isAlive(descendant))).toBe(true)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('32 — FAILURE PATH: a leader that exits non-zero still has its orphaned tree killed', async () => {
    // No signal here. `npm exec` exits while `lhci` and Chrome keep running, `run()` rejects, and
    // failure cleanup must still hold the process-GROUP handle. Dropping it on the leader's exit
    // left Chrome and its ports behind with nothing able to terminate them.
    const before = certDirs()
    const grandchildPid = join(sandbox, 'grandchild.pid')
    const { done } = runOrchestrator({ FAKE_LHCI_MODE: 'orphan-exit' })
    const { code, out, pidfile } = await done

    expect(code).toBe(1) // a real failure, not an interruption
    expect(out).toMatch(/exited 7/)

    const descendant = Number(readFileSync(grandchildPid, 'utf8'))
    expect(Number.isFinite(descendant)).toBe(true)
    expect(descendant).toBeGreaterThan(0)
    // Killed via the retained group handle, escalating because it ignores SIGTERM.
    expect(out).toMatch(/escalating to SIGKILL/)
    expect(await until(async () => !isAlive(descendant))).toBe(true)

    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)

  it('30 — a FAST-EXITING leader does not end teardown while its tree is still alive', async () => {
    // The exact case a leader-only wait cannot catch: the ROOT exits the instant it is signalled,
    // while a descendant IGNORES SIGTERM. `npm exec` really does behave this way, so waiting on the
    // leader would report teardown complete over a live group. Only a group-wide check plus SIGKILL
    // escalation actually ends it.
    const { code, out, pidfile, before, descendant } = await runAndSignal('SIGTERM', 'orphan')
    // Assert the fixture is real BEFORE asserting on behaviour: a test whose stubborn descendant
    // never started would "pass" the interesting assertion for the wrong reason.
    expect(Number.isFinite(descendant)).toBe(true)
    expect(descendant).toBeGreaterThan(0)
    expect(code).toBe(130)
    // Escalation genuinely happened: SIGTERM alone did not clear the group.
    expect(out).toMatch(/escalating to SIGKILL/)
    expect(await until(async () => !isAlive(descendant))).toBe(true)
    expect(certDirs().filter(d => !before.includes(d))).toHaveLength(0)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
    expect(await until(() => portIsFree(webPort))).toBe(true)
  }, 60_000)
})

/**
 * The SWR priming gate (`primeSwrRoute`).
 *
 * WHY THIS IS A LIFECYCLE CONCERN AND NOT A UNIT ONE. `/` and `/ar` carry `swr: 60`, so the first
 * render after the preview starts is frozen and supplies all three readings of the matrix. The
 * property under test is therefore about ORDER and OWNERSHIP — that nothing is measured before a
 * complete render is proven cached — which no test of a pure predicate can observe.
 *
 * These reproduce run 31061969098: the priming render returned the D13-1 outage state, HTTP 200,
 * with the first-party asset still referenced, and the whole governed matrix measured it.
 */
describe('governed orchestrator — SWR priming is verified, not assumed', () => {
  it('35 — REFUSES to measure when the primed Home render is the D13-1 outage state', async () => {
    const { done } = runOrchestrator({
      FAKE_PREVIEW_HOME: 'stub',
      LH_PRIME_TTL_MS: '50',
      LH_PRIME_REVALIDATE_MS: '10'
    })
    const { code, out, pidfile } = await done

    // The exact regression: before this gate the run proceeded and reported figures for the stub.
    expect(code).not.toBe(0)
    expect(out).toMatch(/never rendered the complete Home page/)
    expect(out).toMatch(/missing section markers/)
    expect(out).toMatch(/capabilities-title/)
    // Attributed as infrastructure, so nobody reads it as a threshold breach and re-baselines.
    expect(out).toMatch(/NOT a threshold regression/)
    // It must refuse BEFORE the matrix, or it has saved nothing.
    expect(out).not.toMatch(/collecting MOBILE matrix/)
    // Bounded, and every attempt is on the record.
    expect(out).toMatch(/PRIMING ATTEMPT 3\/3 FAILED/)
    // And it still tears everything down.
    expect(await until(() => portIsFree(webPort))).toBe(true)
    expect(await until(async () => !isAlive(previewPid(pidfile)))).toBe(true)
  }, 60_000)

  it('36 — REPAIRS a poisoned entry by waiting out the TTL, then measures the real page', async () => {
    const { done } = runOrchestrator({
      FAKE_PREVIEW_HOME: 'stub-then-complete',
      LH_PRIME_TTL_MS: '50',
      LH_PRIME_REVALIDATE_MS: '10'
    })
    const { code, out } = await done

    expect(code).toBe(0)
    // The repair happened and SAYS SO. A silent retry is indistinguishable from never having had
    // the problem, which is precisely the information an operator needs.
    expect(out).toMatch(/PRIMING ATTEMPT 1\/3 FAILED/)
    expect(out).toMatch(/waiting 50 ms for the \/ SWR entry to expire/)
    expect(out).toMatch(/re-primed successfully on attempt 2/)
    expect(out).toMatch(/browser-session protocol PROVEN h2/)
  }, 60_000)

  it('38 — the LIVENESS probe no longer renders the measured route', async () => {
    // The regression this closes is subtle and was the true first cause: `waitForPort` polled
    // `curl -sf .../`, so the first successful liveness poll was the first render of `/` — a route
    // carrying `swr: 60`. A check that only asks "is anything answering?" was choosing the document
    // the whole governed matrix would measure, and it accepted the D13-1 outage state because that
    // answers 200. Priming must be the FIRST touch of `/`, or verifying the prime proves nothing
    // about what got cached.
    // Deliberately OUTSIDE the sandbox: the orchestrator re-verifies build provenance at
    // measurement time, so a file growing inside the tree would fail the run for an unrelated
    // reason and this test would "prove" its point by never getting there.
    const reqlog = join(mkdtempSync(join(tmpdir(), 'lh-reqlog-')), 'requests.log')
    const { done } = runOrchestrator({ FAKE_PREVIEW_REQLOG: reqlog })
    const { code } = await done
    expect(code).toBe(0)

    const requests = readFileSync(reqlog, 'utf8').split('\n').filter(Boolean)
    // The probe ran at all (otherwise this test would pass by measuring nothing)…
    expect(requests).toContain('/__ci-liveness')
    // …and nothing rendered `/` before it.
    expect(requests.indexOf('/__ci-liveness')).toBeLessThan(requests.indexOf('/'))
  }, 60_000)

  it('37 — verifies BOTH measured locales, not just the default one', async () => {
    // `/ar` is primed by the same preflight and carries the same `swr: 60`. Verifying only `/`
    // would leave the gate one coin-flip away from the identical failure in Arabic.
    const { done } = runOrchestrator({
      FAKE_PREVIEW_HOME: 'complete',
      LH_PRIME_TTL_MS: '50',
      LH_PRIME_REVALIDATE_MS: '10'
    })
    const { code, out } = await done

    expect(code).toBe(0)
    expect(out).toMatch(/\/ primed and verified/)
    expect(out).toMatch(/\/ar primed and verified/)
  }, 60_000)
})
