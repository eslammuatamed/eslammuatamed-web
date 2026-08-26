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
import { resolveMockPort, resolvePreviewPort } from './lib/preview-base.mjs'

/**
 * Where Prism itself listens when the locale proxy is holding the public mock port.
 *
 * `+40` keeps it clear of every lane's allocated pair — the lanes are spaced by 100 (3000/3001,
 * 3100/3101, 3200/3201, 3300/3301, 3500/3501, 3600/3601) — so the offset stays free whatever port
 * block a worktree is assigned. Derived rather than a constant for exactly that reason.
 */
const prismUpstreamPort = port => String(Number(port) + 40)

const BACKENDS = {
  overview: { label: 'dashboard overview backend', command: process.execPath, args: () => ['scripts/e2e/overview-server.ts'] },
  // The RESOLVED binary, not `npx`: the npx shim spawns Prism as a grandchild, so the process we
  // track is not the process that binds the port, and signalling the shim leaves the listener holding
  // the port. Invoking the binary directly makes the listener our direct child, which is what makes
  // the shutdown below sufficient — and keeps every child inside our process group, where
  // Playwright's `webServer` teardown and Ctrl+C already reap them.
  // A PAIR, not one process: Prism on an internal port, and a thin locale-selecting proxy holding
  // the port Nitro actually talks to (`scripts/e2e/prism-locale-proxy.mjs`).
  //
  // Prism replays ONE body per operation, so with only schema-level (locale-blind) property
  // examples it answered `?locale=ar` with the English identity — every Arabic page in every gate
  // rendered a Latin `h1` under an Arabic font stack. The contract now carries named `en`/`ar`
  // response examples and the proxy selects between them per request with `Prefer: example=<name>`.
  //
  // BOTH are direct children of this orchestrator, so the existing observed-shutdown path reaps
  // them unchanged — the same reason the resolved binary is invoked instead of the `npx` shim.
  // Readiness still gates on the single mock port because the proxy deliberately does not bind
  // until Prism is listening, so "the mock port accepts connections" continues to mean the whole
  // backend can answer.
  prism: {
    label: 'prism (contract mock, locale-selecting)',
    command: 'node_modules/.bin/prism',
    args: port => ['mock', 'openapi/openapi.json', '--port', prismUpstreamPort(port)],
    sidecar: {
      name: 'prism-locale-proxy',
      command: process.execPath,
      args: port => ['scripts/e2e/prism-locale-proxy.mjs', port, prismUpstreamPort(port)]
    },
    // READINESS IS ASSERTED ON CONTENT, NOT ON A STATUS CODE. An open port only proves something
    // is listening; it does not prove the locale actually resolved. The failure this replaces was
    // exactly that shape — every gate ran green against an Arabic page carrying the ENGLISH site
    // name, and the only symptom was a layout-shift budget failing further downstream. Asserting
    // Arabic CMS prose here makes a mis-wired fixture fail at startup, in this file, with a message
    // that names the cause.
    //
    // THE ASSERTED STRING MUST COME FROM THE API AND NOWHERE ELSE, and this bit was measured rather
    // than assumed: the obvious choice — the Arabic site name — ALSO lives in `i18n/locales/ar.json`
    // (as the tier-3 title fallback), so `/ar/about` still contained it with locale selection
    // deliberately broken. It would have been a readiness gate that could not fail. This substring
    // is from the governed `aboutBio`, which exists only in the settings response.
    //
    // `/ar/about` and NOT `/ar` or `/ar/resume`: `/ar` carries `swr: 60` (nuxt.config routeRules),
    // so probing it would render and CACHE a page before any gate runs — the INF-A cache-poisoning
    // defect. `/ar/resume` is the route the Lighthouse gate measures and must stay cold. `/ar/about`
    // has no SWR rule, so probing it cannot poison anything.
    readiness: {
      path: '/ar/about',
      mustContain: 'أحوّل متطلبات المنتج',
      description:
        'Arabic CMS prose from the settings response, proving ?locale=ar resolved through the mock'
    }
  },
  // Node 24 runs TypeScript directly, so the fixtures stay typed with the generated OpenAPI-derived
  // types instead of drifting as untyped JSON. Same reasoning as above: this IS the listener.
  scenarios: {
    label: 'scenario backend (SSR scenarios)',
    command: process.execPath,
    args: () => ['scripts/e2e/scenario-server.ts']
  },
  // The SAME server, run as a separate process with one variable pinned (FE4-U2e2): `/settings/site`
  // publishes a syntactically valid, entirely FICTIONAL GTM container id. A distinct process on a
  // distinct port keeps analytics DISABLED (null id) for every other lane — the true live state they
  // must keep rendering — and the variant stays a property of the process rather than of a request,
  // exactly like the About/résumé variants above.
  'gtm-settings': {
    label: 'scenario backend (GTM container published)',
    command: process.execPath,
    args: () => ['scripts/e2e/scenario-server.ts'],
    env: { E2E_GTM_STATE: 'valid' }
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
  },
  // The SAME server again, with the résumé PDF slot populated (010). It additionally serves the PDF
  // object itself with `Content-Type: application/pdf` and `Content-Disposition: attachment`, so the
  // download contract is observed end to end by a real browser rather than asserted from the markup.
  // Its own process and port for the same reason as `about-readiness`: `/settings/site` carries no
  // slug or query this backend could select a variant on, so a variant must be a property of the
  // process — which also keeps the PDF-NULL state (the real live state) as what every other lane
  // renders.
  'resume-pdf': {
    label: 'scenario backend (Résumé PDF available)',
    command: process.execPath,
    args: () => ['scripts/e2e/scenario-server.ts'],
    env: { E2E_RESUME_STATE: 'pdf' }
  },
  // Feature 012. A DIFFERENT server, not another variant of the scenario one: the Dashboard lane
  // needs MUTABLE state (a PATCH must change what the next GET returns), and `scenario-server.ts`
  // is deliberately stateless so its own lanes can run `fullyParallel` with no reset hook. Keeping
  // the mutable surface in its own process preserves that invariant instead of trading it away.
  dashboard: {
    label: 'dashboard backend (Feature 012, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/dashboard-server.ts']
  },
  // Another DIFFERENT server, and mutable for the same reason as `dashboard`: it counts
  // `/settings/site` requests so the `settings-dedupe` lane can assert that one public SSR render
  // performs exactly one. That count cannot be taken in the browser — the read happens inside Nitro
  // — and it cannot live in `scenario-server.ts` without giving up that server's stateless invariant.
  'settings-count': {
    label: 'settings-count backend (one-read-per-render guard)',
    command: process.execPath,
    args: () => ['scripts/e2e/settings-count-server.ts']
  },
  // Media Library + Profile. Mutable for three reasons at once: an upload adds an asset, a delete
  // removes one OR is refused when the asset is referenced, and a settings PATCH changes what the
  // next GET returns. Its own process rather than an extension of `dashboard`, because what makes a
  // mutable lane serial is being ONE spec file — a second file under `dashboard/**` would run in a
  // second worker and the two would reset each other's fixtures mid-assertion.
  media: {
    label: 'media backend (Media Library + Profile, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/media-server.ts']
  },
  // Articles authoring (FE-2c). Mutable like `dashboard` and `media` — a create/update/delete must
  // change what the next GET returns — and its own process for the same lane-isolation reason: a
  // mutable lane is serial only while it is ONE spec file, so it cannot share a directory with the
  // Inbox or Media specs.
  //
  // It is also the ONLY backend that can HOLD A RESPONSE OPEN (`delayMs`, via `POST /__e2e/state`).
  // Six of plan §14.9's ten criteria assert a state that exists only while a request is in flight;
  // against an instant mock every one of them passes without that state ever rendering.
  articles: {
    label: 'articles backend (FE-2c authoring, mutable, latency-controllable)',
    command: process.execPath,
    args: () => ['scripts/e2e/articles-server.ts']
  },
  // FE-3 module 1. A separate process from `articles` for the same invariant, not for symmetry: a
  // mutable lane is serial only while it is ONE spec file. What it holds that `articles` cannot is
  // a DIFFERENT write shape — `technologyIds` replaces its whole set while `translations` upsert and
  // `endDate` clears on an explicit null, so the three clearing semantics can disagree in one save.
  // It also answers the skills 422 WITHOUT a field path, which is the shape the real service throws
  // and the one an editor reading only `errors[]` would swallow.
  experiences: {
    label: 'experiences backend (FE-3 module 1, mutable, latency-controllable)',
    command: process.execPath,
    args: () => ['scripts/e2e/experiences-server.ts']
  },
  // FE-3 module 2. Skills owns a separate mutable backend so its collection fixtures can be reset
  // between browser tests without sharing state with Experiences or another future module.
  skills: {
    label: 'skills backend (FE-3 module 2, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/skills-server.ts']
  },
  // FE-3 module 3. A separate process from `skills` for the same invariant, not for symmetry: a
  // mutable lane is serial only while it is ONE spec file. What this lane holds that Skills cannot
  // is fixtures whose `order` values run deliberately OUT of sequence — the discriminating state
  // that makes a client-side re-sort fail loudly instead of passing by coincidence with a
  // monotonic seed. Its instrument (`testimonials-server.ts`) and calibration landed in T·U1;
  // registering the backend belongs to T·U2's browser lane.
  testimonials: {
    label: 'testimonials backend (FE-3 module 3, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/testimonials-server.ts']
  },
  // FE-3 Taxonomy (U2). One backend for BOTH collections — the product surface is ONE destination,
  // and the two stores keep separate slug namespaces inside it exactly like the two database
  // tables. What this lane holds that Testimonials cannot: TWO server-order pins on one page plus
  // the no-detail-read request counting, against fixtures whose names run deliberately out of
  // alphabetical sequence.
  taxonomy: {
    label: 'taxonomy backend (FE-3 Categories + Tags, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/taxonomy-server.ts']
  },
  // R16 closure (SEO-U3c). Projects predates the lane architecture and never had a browser pair.
  // This one models the paginated collection envelope the other FE-3 backends deliberately lack,
  // and the D10-23 SEO pair on the wire — omitted key preserves, explicit null clears — so the
  // browser can prove a cleared meta title reaches the PATCH as `null`, not an omission.
  projects: {
    label: 'projects backend (R16, mutable, SEO null-clear on the wire)',
    command: process.execPath,
    args: () => ['scripts/e2e/projects-server.ts']
  },
  // FE4-U1e. The U1a Static Page SEO instrument, now serving its browser lane: one list read is
  // the whole surface's edit source (zero detail GETs), PATCH upserts per locale with explicit
  // null clears, and admin/public share ONE in-process SEO state. Mutable + resettable like every
  // sibling; the additive /admin/media reads exist only so the shared OG picker functions.
  'page-seo': {
    label: 'page-seo backend (FE4-U1e Static Page SEO, mutable)',
    command: process.execPath,
    args: () => ['scripts/e2e/page-seo-server.ts']
  },
  // Project-detail freshness. This backend starts with an empty gallery and exposes test-only
  // controls that publish the authored gallery after both localized detail pages have been primed.
  // Its own process is essential: the regression observes mutable upstream state while every other
  // public SSR fixture remains deterministic and parallel-safe.
  'project-cache': {
    label: 'project-detail cache backend (mutable gallery)',
    command: process.execPath,
    args: () => ['scripts/e2e/project-cache-server.ts']
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

// Same resolver `check-route-size.mjs` measures through, so the server this file starts and the URL
// that gate reads can no longer be defaulted to different ports. See `lib/preview-base.mjs`.
const WEB_PORT = resolvePreviewPort()
const API_PORT = resolveMockPort()

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

// 1b. Its sidecar, when the backend is a pair (Prism + the locale-selecting proxy). Started here
// rather than spawned by the backend itself so BOTH listeners stay DIRECT children of this
// orchestrator: the `shutdownAll` path observes real exits and releases both ports, and neither can
// be reparented to init the way the old `npx` shim's grandchild was.
if (BACKEND.sidecar) {
  start(BACKEND.sidecar.name, BACKEND.sidecar.command, BACKEND.sidecar.args(API_PORT), BACKEND.env)
}

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

/**
 * The content half of the readiness gate. Both ports accepting connections proves the processes are
 * alive; it does not prove they are serving the RIGHT thing. This renders one real page through the
 * whole stack — Nitro → locale proxy → Prism → the named contract example — and refuses to announce
 * readiness unless the expected localized content actually came back.
 *
 * It also catches `error.vue`: an outage render returns 200 with the error page, which every
 * status-only probe accepts and which silently changes what a gate measures.
 */
async function assertReadyContent({ path, mustContain, description }) {
  try {
    const response = await fetch(`http://127.0.0.1:${WEB_PORT}${path}`)
    const html = await response.text()
    if (response.ok && html.includes(mustContain)) return true

    console.error(
      `[ci-preview] readiness assertion FAILED on ${path} (HTTP ${response.status}): expected `
        + `${description} — "${mustContain}" — in the rendered HTML. The backend is listening but is `
        + 'not serving the expected localized content, so every gate downstream would measure the '
        + 'wrong fixture.'
    )
  } catch (error) {
    console.error(`[ci-preview] readiness assertion could not fetch ${path}: ${error.message}`)
  }
  return false
}

if (!ready) {
  await shutdown(1)
} else if (BACKEND.readiness && !(await assertReadyContent(BACKEND.readiness))) {
  await shutdown(1)
} else {
  console.log(`[ci-preview] listening on http://127.0.0.1:${WEB_PORT} (${BACKEND.label} on ${API_PORT})`)
}
