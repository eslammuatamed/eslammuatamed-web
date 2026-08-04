#!/usr/bin/env node
/**
 * THE canonical governed Lighthouse entry point (doc 20 §5.1, D20-25).
 *
 * `npm run lighthouse:ci` is the single command local developers, PR CI, dev-push CI and the
 * dev→main promotion all run. There is deliberately no second governed path: two launch routes mean
 * two methodologies, and the whole reason this file exists is that the gate was silently measuring a
 * protocol production does not serve.
 *
 * It owns the entire lifecycle so nobody has to remember steps, and so a clean checkout needs no
 * setup beyond `npm ci`:
 *   EXACT-HEAD BUILD → contract mock + Nitro preview → ephemeral localhost cert → HTTP/2 frontend →
 *   PREFLIGHT PROTOCOL ASSERTION → mobile matrix → MEASURED-SESSION PROOF → desktop matrix →
 *   MEASURED-SESSION PROOF → report identity stamp → median assertions → teardown.
 *
 * Teardown runs on success, on failure, and on SIGINT/SIGTERM. Ports and certificates are released
 * either way — a half-cleaned run poisons the next one, and a leaked private key is worse than a
 * failed build.
 *
 * TWO protocol checks, doing different jobs, because neither alone is enough:
 *
 *   1. The PREFLIGHT (`assertH2`) runs before the matrix on purpose. The matrix costs minutes;
 *      discovering afterwards that the frontend is not serving h2 at all would mean throwing all of
 *      it away. But it only proves what a NODE client negotiated.
 *   2. The MEASURED-SESSION PROOF (`assertCollectionUsedH2`) runs after each profile and reads
 *      Lighthouse's own `network-requests` record — Chrome's view of every request it actually
 *      made. This is the one that proves the NUMBERS came over h2, which matters because the
 *      frontend deliberately still accepts HTTP/1.1 (see h2-proxy.mjs).
 *
 * The build is also verified rather than assumed: `.output/` is untracked and survives branch
 * switches, so this rebuilds whenever the existing output was not produced from the current source
 * state. Numbers attributed to the wrong commit are as misleading as numbers measured over the
 * wrong protocol.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { assertH2, createEphemeralCert, startH2Proxy } from './lib/h2-proxy.mjs'
import { buildIsCurrent, writeReportStamp } from './lib/build-identity.mjs'
import { assertCollectionUsedH2, formatProtocolSummary } from './lib/lh-protocol.mjs'

const WEB_PORT = Number(process.env.CI_PREVIEW_PORT ?? 3000)
const API_PORT = Number(process.env.CI_MOCK_PORT ?? 3001)
// 0 lets the OS pick a free port, so parallel jobs and local runs cannot collide.
const H2_PORT = Number(process.env.LH_H2_PORT ?? 0)
// How long the preview gets to start listening. Generous by default because a cold Nitro boot on a
// loaded CI runner is genuinely slow; overridable so the lifecycle tests can exercise the
// startup-failure path in seconds instead of minutes.
const PORT_TIMEOUT_MS = Number(process.env.LH_PORT_TIMEOUT_MS ?? 120_000)

/** Everything we own, torn down in reverse order exactly once. */
const owned = { preview: null, proxy: null, cert: null }
let cleanedUp = false

async function cleanup(reason) {
  if (cleanedUp) return
  cleanedUp = true
  if (reason) console.log(`\n[lighthouse:ci] cleanup (${reason})`)
  try { if (owned.proxy) await owned.proxy.close() } catch { /* best effort */ }
  if (owned.preview) {
    // The preview owns a process GROUP (Nitro + Prism); signalling the leader alone orphans children.
    try { process.kill(-owned.preview.pid, 'SIGTERM') } catch { /* already gone */ }
  }
  for (const port of [WEB_PORT, API_PORT]) {
    try {
      const pid = execFileSync('bash', ['-c',
        `ss -ltnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\\K[0-9]+' | head -1`
      ], { encoding: 'utf8' }).trim()
      if (pid) execFileSync('kill', ['-TERM', pid], { stdio: 'ignore' })
    } catch { /* nothing listening */ }
  }
  // The private key goes last and unconditionally.
  try { owned.cert?.dispose() } catch { /* best effort */ }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await cleanup(sig); process.exit(130) })
}

/**
 * Run a child command WITHOUT blocking this process's event loop.
 *
 * This is load-bearing, not style. The HTTP/2 frontend runs inside THIS process, so a synchronous
 * child (`execFileSync`) would freeze the event loop for the whole matrix — the frontend would stop
 * answering, and Lighthouse would record `NO_FCP` on every route while looking like a product
 * failure. Observed exactly that before this was made async.
 */
function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('error', reject)
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))))
  })
}

async function waitForPort(port, label, timeoutMs = PORT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await new Promise((res, rej) => {
        const c = spawn('curl', ['-sf', '-o', '/dev/null', `http://127.0.0.1:${port}/`])
        c.on('exit', code => (code === 0 ? res() : rej(new Error('not up'))))
        c.on('error', rej)
      })
      return true
    } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  throw new Error(`${label} did not start listening on ${port} within ${timeoutMs} ms`)
}

/** Profile output directories, in the order they are collected. */
const PROFILE_DIRS = { mobile: join('.lighthouseci', 'mobile'), desktop: join('.lighthouseci', 'desktop') }

/**
 * Guarantee `.output/` was built from the CURRENT source state, building it if it was not.
 *
 * `.output/` is untracked and survives branch switches, so "a build exists" never meant "a build of
 * this commit exists". Reports carrying the wrong commit's numbers are as misleading as reports
 * carrying the wrong protocol's numbers, so this is enforced rather than assumed — and because the
 * canonical command must work from a clean checkout, a missing or stale build is CORRECTED here
 * instead of merely being reported.
 */
async function ensureExactBuild() {
  const state = buildIsCurrent()
  if (state.current) {
    console.log(`[lighthouse:ci] build identity ${state.stamp.id} matches HEAD — reusing .output/`)
    return state.expected
  }

  console.log(`[lighthouse:ci] rebuilding: ${state.reason}`)
  if (state.stamp) console.log(`  build was ${state.stamp.id}, source is ${state.expected.id}`)

  // The same build-time placeholders CI uses (D23-8). They are baked into canonical/og:url and the
  // sitemap, never into anything performance is measured on, and `npm run build` refuses to fall
  // back to localhost — so without them a clean checkout could not build at all.
  await run('npm', ['run', 'build'], {
    NUXT_PUBLIC_SITE_URL: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://example.com',
    NUXT_PUBLIC_API_BASE: process.env.NUXT_PUBLIC_API_BASE ?? 'https://example.com/api/v1'
  })

  const after = buildIsCurrent()
  if (!after.current) {
    throw new Error(`build completed but its identity still does not match HEAD (${after.reason}) — refusing to measure`)
  }
  return after.expected
}

/** Every report Lighthouse wrote for one profile. */
function readProfileReports(dir) {
  const entries = readdirSync(dir).filter(n => n.endsWith('.json') && n !== 'manifest.json')
  if (entries.length === 0) throw new Error(`${dir} contains no Lighthouse report JSON`)
  return entries.sort().map(n => JSON.parse(readFileSync(join(dir, n), 'utf8')))
}

/**
 * Prove, from Lighthouse's OWN record, that Chrome measured over h2 (doc 20 §5.1, D20-25).
 *
 * Runs immediately after each profile is collected rather than once at the end, so a fallback is
 * attributed to the profile that suffered it and the desktop matrix is not collected on top of a
 * mobile matrix that is already invalid.
 */
function assertProfileProtocol(profile) {
  const summary = assertCollectionUsedH2(readProfileReports(PROFILE_DIRS[profile]))
  console.log(`[lighthouse:ci] ${profile} browser-session protocol verified from Lighthouse artifacts:`)
  console.log(formatProtocolSummary(summary))
  return summary
}

async function main() {
  await ensureExactBuild()

  // Stale reports from an earlier run would be read back both by the protocol proof and by the
  // median gate, which expects exactly three comparable runs per configuration.
  for (const dir of Object.values(PROFILE_DIRS)) {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }

  console.log('[lighthouse:ci] starting Nitro preview + contract mock…')
  owned.preview = spawn('node', ['scripts/ci-preview.mjs'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
    env: { ...process.env, CI_PREVIEW_PORT: String(WEB_PORT), CI_MOCK_PORT: String(API_PORT) }
  })
  await waitForPort(WEB_PORT, 'nitro preview')

  console.log('[lighthouse:ci] generating ephemeral localhost certificate…')
  owned.cert = createEphemeralCert()

  console.log('[lighthouse:ci] starting HTTP/2 frontend…')
  owned.proxy = await startH2Proxy({
    upstreamPort: WEB_PORT, port: H2_PORT, key: owned.cert.key, cert: owned.cert.cert
  })
  const origin = owned.proxy.origin
  console.log(`[lighthouse:ci] HTTP/2 frontend: ${origin} -> http://127.0.0.1:${WEB_PORT}`)

  // A real first-party asset, discovered from the document rather than guessed at.
  const html = execFileSync('curl', ['-s', `http://127.0.0.1:${WEB_PORT}/`], { encoding: 'utf8' })
  const asset = html.match(/\/_nuxt\/[A-Za-z0-9_.-]+\.js/)?.[0]
  if (!asset) throw new Error('could not discover a first-party /_nuxt/ asset to assert the protocol against')

  console.log('[lighthouse:ci] asserting browser-facing protocol BEFORE the matrix…')
  const proto = await assertH2({ origin, paths: ['/', '/ar', asset], cert: owned.cert.cert })
  for (const r of proto) console.log(`  ✓ ${r.path}  ALPN=${r.alpn}  status=${r.status}`)
  console.log('[lighthouse:ci] protocol assertion PASSED — browser-facing path is HTTP/2 (D20-25)')

  // Chrome trusts exactly this key. Narrower than `--ignore-certificate-errors`, which would accept
  // any bad certificate for the whole run.
  const chromeFlags = `--no-sandbox --headless=new --ignore-certificate-errors-spki-list=${owned.cert.spki}`
  const lhEnv = { LH_BASE_URL: origin, LH_CHROME_FLAGS: chromeFlags }

  console.log('\n[lighthouse:ci] collecting MOBILE matrix over HTTP/2…')
  await run('npx', ['lhci', 'autorun'], { ...lhEnv, LHCI_PROFILE: 'mobile' })
  const mobileProtocol = assertProfileProtocol('mobile')

  console.log('\n[lighthouse:ci] collecting DESKTOP matrix over HTTP/2…')
  await run('npx', ['lhci', 'autorun', '--collect.settings.preset=desktop'], { ...lhEnv, LHCI_PROFILE: 'desktop' })
  const desktopProtocol = assertProfileProtocol('desktop')

  console.log('\n[lighthouse:ci] browser-session protocol PROVEN h2 for every governed report (D20-25)')

  // Bind the reports to the source state they describe, so an artifact downloaded weeks later is
  // still attributable to a commit rather than to "whatever was checked out at the time".
  const stamp = writeReportStamp({
    protocol: { mobile: mobileProtocol, desktop: desktopProtocol }
  })
  console.log(`[lighthouse:ci] reports bound to source identity ${stamp.id}`)

  console.log('\n[lighthouse:ci] asserting medians (thresholds unchanged)…')
  await run('node', ['scripts/check-lighthouse-medians.mjs'])
}

main()
  .then(async () => { await cleanup('success'); console.log('\n✓ governed Lighthouse complete over HTTP/2'); process.exit(0) })
  .catch(async (err) => {
    console.error(`\n✗ [lighthouse:ci] ${err.message ?? err}`)
    await cleanup('failure')
    process.exit(1)
  })
