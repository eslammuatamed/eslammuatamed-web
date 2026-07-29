#!/usr/bin/env node
/**
 * Deterministic production-like preview, shared by the Lighthouse gate (doc 20 §5), the per-route size
 * gate, and the Playwright + axe suite (doc 18 §3, D18-3).
 *
 * Serves the real `.output` Nitro build behind a Prism mock of the COMMITTED contract
 * (`openapi/openapi.json`) rather than the hosted staging API, so every gate:
 *   - never depends on mutable staging data or staging uptime;
 *   - gives article/blog/project routes stable content, so LCP and CLS are reproducible run to run;
 *   - measures the same artifact the deploy ships.
 *
 * `NUXT_PUBLIC_SITE_URL` is intentionally the real public origin, not localhost: canonical, og:url,
 * hreflang and the sitemap are baked at build time, and the gates assert they are correct. Only the
 * LISTENING address is local.
 *
 * SHUTDOWN IS OBSERVED, NOT TIMED. Every exit path — normal completion, SIGINT, SIGTERM, spawn
 * failure, unexpected child death — goes through `shutdownAll`, which SIGTERMs, waits for real exits,
 * escalates to SIGKILL, and waits again. The previous version exited ~300 ms after signalling, which
 * reparented Prism to init and left port 3001 held; the next run's readiness check then passed against
 * a stale mock. See `scripts/lib/process-group.mjs`.
 *
 * TWO BACKENDS, ONE ORCHESTRATOR (`--backend prism|scenarios`, default `prism`).
 * Prism remains the primary contract mock and backs every gate: Lighthouse, the route-size budget,
 * and the `contract` Playwright project. `--backend scenarios` swaps ONLY the upstream, for the
 * `ssr-scenarios` Playwright project, which covers the six states Prism cannot express
 * deterministically because it replays one example for every slug and locale
 * (`scripts/e2e/scenario-server.ts`). Everything else — real `.output` execution, readiness gating
 * before any SSR request, observed shutdown — is shared verbatim rather than reimplemented, which is
 * the entire reason this is a flag and not a second script. Both ports are env-driven, so the two
 * Playwright projects run side by side without colliding.
 */
import net from 'node:net'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { shutdownAll, startTracked } from './lib/process-group.mjs'

const BACKENDS = {
  // The RESOLVED binary, not `npx`: the npx shim spawns Prism as a grandchild, so the process we
  // track is not the process that binds the port, and signalling the shim leaves the listener holding
  // the port. Invoking the binary directly makes the listener our direct child, which is what makes
  // the shutdown below sufficient — and keeps every child inside our process group, where
  // Playwright's `webServer` teardown and Ctrl+C already reap them.
  prism: {
    label: 'prism (contract mock)',
    command: 'node_modules/.bin/prism',
    args: port => ['mock', 'openapi/openapi.json', '--port', port]
  },
  // Node 24 runs TypeScript directly, so the fixtures stay typed with the generated OpenAPI-derived
  // types instead of drifting as untyped JSON. Same reasoning as above: this IS the listener.
  scenarios: {
    label: 'scenario backend (SSR scenarios)',
    command: process.execPath,
    args: () => ['scripts/e2e/scenario-server.ts']
  },
  // The SAME server, run as a separate process with one variable pinned: `/settings/site` answers
  // with the real live About state (governed prose, no portrait). A distinct process on a distinct
  // port is what keeps the global settings endpoint published and healthy for every other scenario —
  // no unrelated test becomes scenario-dependent, and the variant stays a property of the process
  // rather than of a request.
  'about-readiness': {
    label: 'scenario backend (About portrait-null)',
    command: process.execPath,
    args: () => ['scripts/e2e/scenario-server.ts'],
    env: { E2E_ABOUT_STATE: 'portrait-null' }
  }
}

const backendArg = process.argv.indexOf('--backend')
const BACKEND_NAME = backendArg === -1
  ? (process.env.CI_PREVIEW_BACKEND ?? 'prism')
  : process.argv[backendArg + 1]

const BACKEND = BACKENDS[BACKEND_NAME]
if (!BACKEND) {
  console.error(
    `[ci-preview] unknown backend "${BACKEND_NAME}". Expected one of: ${Object.keys(BACKENDS).join(', ')}.`
  )
  process.exit(1)
}

const WEB_PORT = process.env.CI_PREVIEW_PORT ?? '3000'
const API_PORT = process.env.CI_MOCK_PORT ?? '3001'

const children = []
let shuttingDown = false

async function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true

  const survivors = await shutdownAll(children)
  if (survivors.length > 0) {
    // Never exit claiming success while something still holds a port — the next run would fail with
    // no visible cause, which is the failure this module exists to prevent.
    console.error(`[ci-preview] ${survivors.length} child process(es) could not be terminated.`)
    process.exit(code === 0 ? 1 : code)
  }
  process.exit(code)
}

function start(name, command, args, env) {
  return startTracked(children, {
    name,
    command,
    args,
    env,
    onUnexpectedExit(childName, code, signal) {
      if (shuttingDown) return
      console.error(`[ci-preview] ${childName} exited unexpectedly (code=${code} signal=${signal}).`)
      void shutdown(code ?? 1)
    },
    onSpawnError(childName, error) {
      console.error(`[ci-preview] failed to start ${childName}: ${error.message}`)
      void shutdown(1)
    }
  })
}

// 1. The API backend first — the Nitro server fetches it during SSR.
start(BACKEND_NAME, BACKEND.command, BACKEND.args(API_PORT), { CI_MOCK_PORT: API_PORT, ...BACKEND.env })

// 2. The built Nitro server. Its runtime API base points at the mock.
start('nitro', 'node', ['.output/server/index.mjs'], {
  PORT: WEB_PORT,
  HOST: '127.0.0.1',
  NUXT_PUBLIC_API_BASE: `http://127.0.0.1:${API_PORT}/api/v1`
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown(0))

/** Resolves once something accepts a TCP connection on `port`. */
function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: Number(port) })
    const done = (ok) => { socket.destroy(); resolve(ok) }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(1000, () => done(false))
  })
}

async function waitForPort(name, port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (shuttingDown) return false
    if (await canConnect(port)) return true
    await sleep(250)
  }
  console.error(`[ci-preview] ${name} did not start listening on ${port} within ${timeoutMs} ms.`)
  return false
}

// The readiness line must not be printed until BOTH ports actually accept connections, and the API
// backend must be checked FIRST. `spawn()` resolves as soon as the child process exists, so announcing
// readiness there would let a gate start collecting while Nitro is still booting and Prism is still
// parsing the OpenAPI document. That does not merely risk a connection refusal: if the mock is not up
// when a
// `/blog/<slug>` or `/projects/<slug>` request is server-rendered, the page renders its ERROR state,
// which silently changes LCP and makes assertions pass or fail by timing — the intermittently-flaky
// gate this setup exists to avoid. It passed locally only because Chrome's own launch time absorbed
// the slack.
const ready = (await waitForPort(BACKEND.label, API_PORT))
  && (await waitForPort('nitro (web preview)', WEB_PORT))

if (!ready) {
  await shutdown(1)
} else {
  console.log(`[ci-preview] listening on http://127.0.0.1:${WEB_PORT} (${BACKEND.label} on ${API_PORT})`)
}
