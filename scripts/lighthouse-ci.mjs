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
 *   CLEAN-TREE GATE → PROVENANCE-VERIFIED BUILD → contract mock + Nitro preview → ephemeral
 *   localhost cert → HTTP/2 frontend → PREFLIGHT PROTOCOL ASSERTION → PROVENANCE RE-CHECK →
 *   mobile matrix → MEASURED-SESSION PROOF → desktop matrix → MEASURED-SESSION PROOF →
 *   PROVENANCE RE-CHECK → report provenance record → median assertions → teardown.
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
 * PROVENANCE, for the same reason. Numbers attributed to the wrong commit mislead exactly as much as
 * numbers measured over the wrong protocol. Governed measurement therefore demands a COMPLETELY
 * CLEAN working tree before it builds anything — not a "dirty" label, a refusal — because Nuxt
 * discovers sources by scanning directories and an uncommitted file is compiled in while HEAD does
 * not contain it. The build then carries a marker (HEAD, tree, lockfile, toolchain, allowlisted
 * build environment, output fingerprint) that is re-verified before and after collection, and every
 * report file is bound to it by content hash. See `lib/build-provenance.mjs`.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { assertH2, createEphemeralCert, startH2Proxy } from './lib/h2-proxy.mjs'
import { assertCleanSourceState, governedBuildEnv, headSha, validateProvenance, writeReportProvenance } from './lib/build-provenance.mjs'
import { assertCollectionUsedH2, formatProtocolSummary } from './lib/lh-protocol.mjs'
import { browserProfileDir, trackProcessTree } from './lib/process-tree.mjs'
import { createResourceGuard } from './lib/lifecycle-guard.mjs'

const WEB_PORT = Number(process.env.CI_PREVIEW_PORT ?? 3000)
const API_PORT = Number(process.env.CI_MOCK_PORT ?? 3001)
// 0 lets the OS pick a free port, so parallel jobs and local runs cannot collide.
const H2_PORT = Number(process.env.LH_H2_PORT ?? 0)
// How long the preview gets to start listening. Generous by default because a cold Nitro boot on a
// loaded CI runner is genuinely slow; overridable so the lifecycle tests can exercise the
// startup-failure path in seconds instead of minutes.
const PORT_TIMEOUT_MS = Number(process.env.LH_PORT_TIMEOUT_MS ?? 120_000)

/**
 * Everything we own, torn down in reverse order exactly once, plus the two acquisition guards that
 * stop startup from creating resources teardown has already finished with. See lib/lifecycle-guard.
 */
const guard = createResourceGuard(['preview', 'proxy', 'cert', 'child'])
const { owned } = guard
let cleanupPromise = null

/** Has this child already exited (and been reaped by Node)? */
const hasExited = child => child.exitCode !== null || child.signalCode !== null

/** Is any process still in this group? Signal 0 checks existence without delivering anything. */
function groupAlive(pid) {
  try { process.kill(-pid, 0); return true } catch { return false }
}

/**
 * Terminate a child, its process GROUP, and every descendant that escaped that group.
 *
 * Escalation is bounded and only ever targets processes recorded as ours — the group we created and
 * the descendants we walked — never a process-name pattern, which could match unrelated work.
 */
async function terminateTree(child, label, tracker) {
  if (!child) return

  // Profiles are read while their owners are still alive — /proc/<pid>/cmdline vanishes with them.
  const profiles = (tracker ? tracker.liveDescendants() : [])
    .map(pid => browserProfileDir(pid, tmpdir()))
    .filter(Boolean)

  /**
   * Ownership is re-derived BEFORE EVERY SIGNAL, never cached.
   *
   * Termination spans up to ten seconds — SIGTERM, wait, SIGKILL, wait. A group that was provably
   * ours when the first signal went out can empty in that window, and `child.pid` can then be
   * recycled by an unrelated process that becomes a group leader. Escalating on a stale answer
   * would send SIGKILL to a stranger's process group. The same applies to each recorded descendant,
   * which is re-validated against its start time on every pass.
   */
  const groupIsOurs = () => (tracker ? tracker.groupIsOurs() : !hasExited(child))
  const currentStrays = () => (tracker ? tracker.liveDescendants() : [])

  if (!groupIsOurs() && currentStrays().length === 0) {
    tracker?.stop()
    return
  }

  const signalAll = signal => {
    if (groupIsOurs()) {
      try {
        process.kill(-child.pid, signal)
      } catch {
        // No group to signal; fall back to the handle, which is a no-op once Node has reaped it.
        try { child.kill(signal) } catch { /* already gone */ }
      }
    }
    for (const pid of currentStrays()) {
      try { process.kill(pid, signal) } catch { /* already gone */ }
    }
  }

  const treeGone = () => {
    const groupGone = !groupIsOurs() || !groupAlive(child.pid)
    return groupGone && hasExited(child) && currentStrays().length === 0
  }

  const waitFor = async ms => {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (treeGone()) return true
      await new Promise(r => setTimeout(r, 100))
    }
    return false
  }

  try {
    signalAll('SIGTERM')
    if (!await waitFor(5000)) {
      console.log(`[lighthouse:ci] ${label} tree still alive after SIGTERM — escalating to SIGKILL`)
      signalAll('SIGKILL')
      if (!await waitFor(5000)) {
        console.error(`[lighthouse:ci] WARNING: ${label} tree survived SIGKILL (root ${child.pid}, strays ${currentStrays().join(', ') || 'none'})`)
      }
    }
  } finally {
    // Tracking stops only once termination is over: it is what keeps identity checks honest.
    tracker?.stop()
  }

  // The throwaway browser profiles go with the browsers that owned them.
  for (const dir of new Set(profiles)) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

/**
 * Tear everything down exactly once, and let EVERY caller await that one teardown.
 *
 * Memoising the promise rather than setting a "done" flag is load-bearing. With a flag, a second
 * caller returns instantly while the first teardown is still running — and the signal path and the
 * failure path do both fire, because killing the matrix child is itself what rejects `run()`. The
 * second caller then reached `process.exit()` mid-teardown and the ephemeral private key survived.
 */
function cleanup(reason) {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = doCleanup(reason)
  return cleanupPromise
}

async function doCleanup(reason) {
  if (reason) console.log(`\n[lighthouse:ci] cleanup (${reason})`)
  // Every release goes through the guard, which disposes each slot exactly once. Startup may be
  // releasing the same resource concurrently — a socket that finished binding after the signal
  // arrived, say — and whoever reaches it first wins; the other simply awaits that same disposal.
  //
  // The in-flight child (an `lhci` matrix, or the build) goes first, as a whole process tree: it
  // would otherwise outlive this process and keep driving Chrome against a frontend being torn down.
  for (const slot of ['child', 'proxy', 'preview']) {
    try { await guard.release(slot) } catch { /* best effort */ }
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
  try { await guard.release('cert') } catch { /* best effort */ }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    // SYNCHRONOUSLY first, before any await: killing the matrix child is itself what makes `run()`
    // reject, so the failure path must already be able to see that this is an interruption rather
    // than a real failure — otherwise `exit(1)` lands before this handler's `exit(130)`.
    guard.beginShutdown(sig)
    await cleanup(sig)
    process.exit(130)
  })
}

/**
 * Run a child command WITHOUT blocking this process's event loop.
 *
 * This is load-bearing, not style. The HTTP/2 frontend runs inside THIS process, so a synchronous
 * child (`execFileSync`) would freeze the event loop for the whole matrix — the frontend would stop
 * answering, and Lighthouse would record `NO_FCP` on every route while looking like a product
 * failure. Observed exactly that before this was made async.
 */
async function run(cmd, args, env = {}) {
  // The PREVIOUS occupant's tree must be gone before the slot is reused, or its handle would be
  // overwritten while its descendants were still running and nothing would be left to kill them.
  // This also stops the desktop matrix starting while the mobile matrix's Chrome still lingers.
  await guard.release('child')

  return new Promise((resolve, reject) => {
    // `detached: true` makes the child a process-GROUP LEADER. That is what lets teardown signal
    // the whole tree it goes on to spawn (`npm exec` → `sh -c lhci` → `lhci` → Chrome) with a single
    // negative-PID signal. Without it, only the root would be signalled and Chrome would be orphaned.
    //
    // The trade-off is deliberate: a detached child no longer receives the terminal's Ctrl-C
    // directly, so teardown MUST kill it explicitly — which is exactly the controlled path
    // `terminateTree` implements, rather than racing the signal.
    const child = spawn(cmd, args, { stdio: 'inherit', detached: true, env: { ...process.env, ...env } })
    // Tracking starts NOW, not at teardown: Chrome appears minutes later and must be recorded while
    // its parent link still exists.
    const tracker = trackProcessTree(child.pid)
    // Registered WITH its disposer, so teardown never has to know how to kill it.
    guard.register('child', child, c => terminateTree(c, 'matrix child', tracker))

    // The slot is deliberately NOT cleared when the leader exits. `npm exec` exits while `lhci` and
    // Chrome are still running underneath it, so dropping the handle here would discard the only
    // process-GROUP reference and leave failure cleanup with nothing to terminate — the orphaned
    // tree would keep its ports and its Chrome. The handle stays until `release()` has confirmed
    // the whole group is gone.
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

/** Where a rejected build is moved so it cannot be measured, but can still be inspected. */
function quarantine(reason) {
  if (!existsSync('.output')) return null
  const dest = `.output.quarantined-${reason}`
  rmSync(dest, { recursive: true, force: true })
  renameSync('.output', dest)
  console.log(`[lighthouse:ci] quarantined the rejected build to ${dest}/ (not deleted, not measured)`)
  return dest
}

/**
 * Produce a build whose provenance can be stated, and refuse to proceed otherwise.
 *
 * ORDER MATTERS. The clean-state check runs FIRST, before anything is built, because the point is
 * never to create output whose provenance cannot be stated — not to discover afterwards that it
 * cannot. A tree with uncommitted or untracked sources is rejected here, not labelled.
 *
 * A build that fails validation is QUARANTINED rather than relabelled. Rewriting a marker around
 * output whose sources are unknown is precisely the mislabelling this exists to prevent, so the
 * only honest recovery is to move it aside and build again through this lifecycle.
 */
async function ensureGovernedBuild() {
  assertCleanSourceState()
  console.log('[lighthouse:ci] working tree is clean — provenance can be stated')

  const first = validateProvenance()
  if (first.valid) {
    console.log(`[lighthouse:ci] provenance verified, reusing .output/ — HEAD ${first.marker.head}`)
    return first.marker
  }

  console.log('[lighthouse:ci] existing build rejected:')
  for (const failure of first.failures) console.log(`   · ${failure}`)
  quarantine(headSha().slice(0, 12))

  // The build runs with EXACTLY the environment the fingerprint describes. Resolving it in one
  // shared place (`governedBuildEnv`) is load-bearing: the build is a child process, so applying
  // the D23-8 placeholders only to the child while fingerprinting the parent's bare environment
  // made the orchestrator reject its own freshly built artifact.
  await run('npm', ['run', 'build'], governedBuildEnv())

  const after = validateProvenance()
  if (!after.valid) {
    throw new Error(
      'build completed but its provenance still does not validate — refusing to measure:\n'
      + after.failures.map(f => `   · ${f}`).join('\n')
    )
  }
  console.log(`[lighthouse:ci] provenance recorded — HEAD ${after.marker.head}`)
  return after.marker
}

/**
 * Re-validate immediately before collection.
 *
 * The build may have happened minutes ago; a stray edit, a dependency install or a touched artifact
 * in between would make every number that follows unattributable.
 */
function assertProvenanceAtMeasurementTime(expected) {
  const result = validateProvenance()
  if (!result.valid) {
    throw new Error(
      'provenance no longer valid at measurement time — refusing to collect:\n'
      + result.failures.map(f => `   · ${f}`).join('\n')
    )
  }
  if (result.marker.output.hash !== expected.output.hash) {
    throw new Error('the output changed between build and measurement — refusing to collect')
  }
  console.log('[lighthouse:ci] provenance re-verified at measurement time')
  return result.marker
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
  const marker = await ensureGovernedBuild()

  // Stale reports from an earlier run would be read back both by the protocol proof and by the
  // median gate, which expects exactly three comparable runs per configuration.
  for (const dir of Object.values(PROFILE_DIRS)) {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }

  assertProvenanceAtMeasurementTime(marker)

  guard.assertRunning()
  console.log('[lighthouse:ci] starting Nitro preview + contract mock…')
  const preview = spawn('node', ['scripts/ci-preview.mjs'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
    env: { ...process.env, CI_PREVIEW_PORT: String(WEB_PORT), CI_MOCK_PORT: String(API_PORT) }
  })
  // Tracked from the moment it exists, for the same reason as the matrix child.
  const previewTracker = trackProcessTree(preview.pid)
  await guard.own('preview', preview, child => terminateTree(child, 'preview', previewTracker))
  await waitForPort(WEB_PORT, 'nitro preview')

  guard.assertRunning()
  console.log('[lighthouse:ci] generating ephemeral localhost certificate…')
  await guard.own('cert', createEphemeralCert(), cert => cert.dispose())

  guard.assertRunning()
  console.log('[lighthouse:ci] starting HTTP/2 frontend…')
  // The ONLY genuinely asynchronous acquisition: `startH2Proxy` binds a socket, so a signal can
  // land while it is still pending and teardown can complete before it resolves. Creation and
  // ownership are written as two statements rather than nested awaits so that window is explicit —
  // whatever this resolves to is handed to `own()`, which closes it if teardown has already run.
  const startedProxy = await startH2Proxy({
    upstreamPort: WEB_PORT, port: H2_PORT, key: owned.cert.key, cert: owned.cert.cert
  })
  await guard.own('proxy', startedProxy, proxy => proxy.close())
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

  // Nothing may have shifted underneath the collection either.
  assertProvenanceAtMeasurementTime(marker)

  // Bind every report file to the exact identity it was measured from, by content hash, so an
  // artifact downloaded weeks later is attributable to a commit rather than to "whatever was
  // checked out at the time".
  const record = writeReportProvenance({
    marker,
    extra: { protocol: { mobile: mobileProtocol, desktop: desktopProtocol } }
  })
  console.log(`[lighthouse:ci] ${record.reports.length} report files bound to HEAD ${record.identity.head} (tree ${record.identity.tree.slice(0, 12)}, output ${record.identity.outputHash.slice(0, 12)})`)

  console.log('\n[lighthouse:ci] asserting medians (thresholds unchanged)…')
  await run('node', ['scripts/check-lighthouse-medians.mjs'])
}

main()
  .then(async () => { await cleanup('success'); console.log('\n✓ governed Lighthouse complete over HTTP/2'); process.exit(0) })
  .catch(async (err) => {
    // An interruption is not a failure. When a signal is tearing the run down, the child we just
    // killed rejects here first — reporting that as a build failure, with exit 1, would be a lie.
    if (guard.terminatedBy) {
      await cleanup(guard.terminatedBy)
      process.exit(130)
    }
    console.error(`\n✗ [lighthouse:ci] ${err.message ?? err}`)
    await cleanup('failure')
    process.exit(1)
  })
