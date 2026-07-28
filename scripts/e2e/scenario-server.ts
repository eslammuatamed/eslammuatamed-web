/**
 * Deterministic SSR scenario backend for the `ssr-scenarios` Playwright project (web-005 Phase 8).
 *
 * WHY THIS EXISTS — BROWSER INTERCEPTION WAS DISPROVED, NOT ABANDONED.
 * The plan's original mechanism was Playwright `page.route()` fixtures. It cannot work for these
 * routes, which was verified rather than assumed:
 *   - a direct load is server-rendered, so the API read happens inside Nitro and never reaches the
 *     browser (`page.route` intercepted 0 requests);
 *   - a client-side navigation does not help either: `/projects**` carries `swr: 60` route rules, so
 *     Nuxt fetches the pre-rendered `_payload.json` instead of calling the API from the browser.
 * Intercepting `_payload.json` would assert against Nuxt's serialization format instead of the
 * application's behaviour, so the read is moved to where it actually happens — the process boundary
 * BELOW Nitro. This server is the upstream Nitro talks to. Nothing about the application changes.
 *
 * PRISM IS NOT REPLACED (D18-6). The `contract` project still runs the whole normal journey — 19
 * tests — against Prism and the committed `openapi/openapi.json`. This backend serves ONLY the six
 * SSR scenarios Prism cannot express deterministically (because Prism replays one example for every
 * slug and every locale), plus the one bilingual ARTICLE pair D06-6 needs to be proven on both
 * per-locale-slug surfaces. It is not, and must not become, a general mock API.
 *
 * ── THE DESIGN INVARIANT: ONE URL ⇒ ONE SCENARIO ─────────────────────────────────────────────────
 * There is NO mutable scenario state. Every scenario is selected purely from the request path, the
 * slug, and the `locale` query `useApi()` appends (D10-6). Two consequences follow, and both are
 * load-bearing: the Playwright project can run `fullyParallel` with no reset hook, and Nitro's
 * `swr: 60` cache is safe — its key is a hash of the FULL path including the query string, so no two
 * scenarios can share a cache entry and no stale success can mask a later failure.
 *
 *   BROWSER URL                                    UPSTREAM BEHAVIOUR              RENDERED RESULT
 *   /projects            (and /ar/projects)        200, zero projects              localized empty state
 *   /projects?technology=noMatches                 200, zero projects              filtered empty + clear
 *   /projects?technology=unreachable               socket destroyed                localized error state
 *   /projects?technology=upstream503               RFC 7807 503                    localized error state
 *   /projects/ssr-empty-gallery                    200, gallery: []                detail, no gallery region
 *   /projects/ssr-bilingual                        200, authored EN content        English case study
 *   /ar/projects/ssr-bilingual-ar                  200, authored AR content        Arabic case study
 *   /projects/ssr-old-slug                         404, then resolver 200          301 → /projects/ssr-canonical
 *   /projects/ssr-canonical                        200                             canonical case study
 *   /projects/ssr-unknown-slug                     404, then resolver 404          localized Nuxt 404
 *   /projects/ssr-upstream-failure                 RFC 7807 503                    error page, never a 404
 *
 * `/settings/site` and `/skills` are ALWAYS healthy, including in the failure scenarios. If the page
 * shell also failed, the accessibility and recovery-action assertions would be measuring a different
 * page than the one under test.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ARTICLES, EMPTY_PAGE, PROJECTS, REDIRECTS, SITE_SETTINGS, SKILLS, TECHNOLOGY, isLocale, problem } from './fixtures.ts'
import type { Locale, ProblemDetail } from './fixtures.ts'

/** The contract's mount point. `NUXT_PUBLIC_API_BASE` points Nitro at `http://host:port/api/v1`. */
export const API_PREFIX = '/api/v1'

/**
 * What the server should do with one request. `destroy` is the genuine connection failure: the socket
 * is closed without a response, so Nitro's `$fetch` fails at the transport layer exactly as it would
 * against an upstream that is down — not merely an upstream that answers with an error status.
 */
export type Reply =
  | { kind: 'json', status: number, body: unknown }
  | { kind: 'problem', status: number, body: ProblemDetail }
  | { kind: 'destroy' }

function json(body: unknown, status = 200): Reply {
  return { kind: 'json', status, body }
}

function notFound(instance: string, detail: string): Reply {
  return { kind: 'problem', status: 404, body: problem(404, 'Not Found', detail, instance) }
}

function unprocessable(instance: string, detail: string): Reply {
  return { kind: 'problem', status: 422, body: problem(422, 'Unprocessable Entity', detail, instance) }
}

function unavailable(instance: string): Reply {
  return {
    kind: 'problem',
    status: 503,
    body: problem(503, 'Service Unavailable', 'The upstream service is unavailable.', instance)
  }
}

/** `GET /projects` — the index. The `technology` filter is the scenario selector (see the table above). */
function resolveProjectsIndex(technology: string | null, instance: string): Reply {
  if (technology === TECHNOLOGY.unreachable) return { kind: 'destroy' }
  if (technology === TECHNOLOGY.upstream503) return unavailable(instance)
  // Both the unfiltered index and the "no matches" filter answer with a well-formed empty page; the
  // page itself tells the two apart and renders different copy, which is what the tests assert.
  return json(EMPTY_PAGE)
}

/** `GET /projects/{slug}` — the detail route. The slug is the scenario selector. */
function resolveProjectDetail(slug: string, locale: Locale, instance: string): Reply {
  if (slug.startsWith('ssr-upstream-failure')) return unavailable(instance)

  const project = PROJECTS[locale][slug]
  if (project) return json({ data: project })

  // Everything else — unknown slugs and renamed slugs alike — is a contract 404. What distinguishes
  // them is only what the REDIRECT RESOLVER then says, which is precisely the branch under test.
  return notFound(instance, `No published project matches “${slug}” in ${locale}.`)
}

/**
 * `GET /articles/{slug}` — the blog detail route.
 *
 * The ONLY blog endpoint here, and only so D06-6 can be proven on both per-locale-slug surfaces:
 * `blog/[slug].vue` carries the same pattern as `projects/[slug].vue`, so verifying one would leave
 * the other unverified. Everything else about the blog stays with Prism in the `contract` lane.
 */
function resolveArticleDetail(slug: string, locale: Locale, instance: string): Reply {
  const article = ARTICLES[locale][slug]
  return article
    ? json({ data: article })
    : notFound(instance, `No published article matches “${slug}” in ${locale}.`)
}

/**
 * `GET /redirects/resolve?path=…` — consulted only after a 404 (D04-6). A 404 here means "no redirect
 * exists" and is a normal answer; the caller turns that into the real not-found page.
 */
function resolveRedirect(path: string | null, locale: Locale, instance: string): Reply {
  if (!path) return unprocessable(instance, 'The `path` query parameter is required.')

  const toPath = REDIRECTS[locale][path]
  return toPath ? json({ data: { toPath } }) : notFound(instance, `No redirect is registered for “${path}”.`)
}

/**
 * Pure request → reply mapping. Exported separately from the server so route selection, locale
 * selection, the redirect table and the RFC 7807 bodies are unit-testable without binding a port.
 */
export function resolveRequest(url: string): Reply {
  const parsed = new URL(url, 'http://scenario.invalid')
  const instance = parsed.pathname
  const pathname = parsed.pathname.startsWith(API_PREFIX)
    ? parsed.pathname.slice(API_PREFIX.length)
    : null

  if (pathname === null) return notFound(instance, 'Unknown route.')

  // `useApi()` puts `?locale=` on every public GET (D10-6). A request without one is a harness
  // defect, and the contract's own 422 is the honest way to say so — silently defaulting to English
  // would hide exactly the bug the EN/AR scenario exists to catch.
  const locale = parsed.searchParams.get('locale')
  if (!isLocale(locale)) {
    return unprocessable(instance, `Query parameter \`locale\` must be "en" or "ar"; received “${locale}”.`)
  }

  if (pathname === '/settings/site') return json({ data: SITE_SETTINGS[locale] })
  if (pathname === '/skills') return json({ data: SKILLS[locale] })
  if (pathname === '/projects') return resolveProjectsIndex(parsed.searchParams.get('technology'), instance)
  if (pathname === '/redirects/resolve') return resolveRedirect(parsed.searchParams.get('path'), locale, instance)

  const projectDetail = /^\/projects\/([^/]+)$/.exec(pathname)
  if (projectDetail) return resolveProjectDetail(decodeURIComponent(projectDetail[1]!), locale, instance)

  const articleDetail = /^\/articles\/([^/]+)$/.exec(pathname)
  if (articleDetail) return resolveArticleDetail(decodeURIComponent(articleDetail[1]!), locale, instance)

  // Deliberately narrow: this backend serves the six scenarios and the page shell, nothing else. A
  // request for any other endpoint is a mistake in the test, and it should read as one.
  return notFound(instance, `“${pathname}” is not served by the scenario backend.`)
}

/**
 * Create the server. Not started — the caller binds the port, so tests can use an ephemeral one and
 * the CLI below can use the port `ci-preview.mjs` assigns.
 */
/**
 * CORS headers for the browser-side leg of a request.
 *
 * NOT optional, and not a workaround. `useApi()` is one client used from BOTH sides: Nitro calls the
 * API during SSR, and the browser calls it again after hydration whenever `useAsyncData` re-runs.
 * That second call is cross-origin here, because the preview binds the web app and the backend to
 * different ports. Prism enables CORS by default, so the `contract` lane never had to state this —
 * which is exactly why it has to be stated here, or the scenario lane would report an application
 * error for something the deployment does not have.
 *
 * The origin is REFLECTED rather than `*`: `useApi()` sends `credentials: 'include'` (D19-3), and a
 * browser rejects a wildcard on a credentialed request.
 */
function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    // The response varies by request origin, so it must never be cached across origins.
    vary: 'Origin'
  }
}

export function createScenarioServer(): http.Server {
  const server = http.createServer((request, response) => {
    const cors = corsHeaders(request.headers.origin)

    if (request.method === 'OPTIONS') {
      response.writeHead(204, cors)
      response.end()
      return
    }

    const reply = resolveRequest(request.url ?? '/')

    if (reply.kind === 'destroy') {
      // No response, no FIN handshake: the peer sees the connection fail mid-request.
      request.socket.destroy()
      return
    }

    const contentType = reply.kind === 'problem' ? 'application/problem+json' : 'application/json'
    const body = JSON.stringify(reply.body)
    response.writeHead(reply.status, {
      ...cors,
      'content-type': `${contentType}; charset=utf-8`,
      'content-length': Buffer.byteLength(body),
      // The upstream must never be cached anywhere between here and Nitro: a scenario that answered
      // from a cache would break the one-URL-one-scenario invariant this file rests on.
      'cache-control': 'no-store'
    })
    response.end(body)
  })

  // Node's default keep-alive timeout is deliberately LEFT ALONE. Lowering it to release the port
  // sooner would only add a race — undici keeps connections for longer than a second, so a server
  // that hangs up first turns an ordinary request into an ECONNRESET. `stopScenarioServer` releases
  // the port by ending connections explicitly, which is deterministic rather than timing-dependent.
  return server
}

/**
 * Shut a running server down so the PORT IS ACTUALLY FREE when this resolves.
 *
 * `close()` alone stops accepting new connections but waits for open keep-alive sockets to drain,
 * which is the same "exited without releasing the port" failure `scripts/lib/process-group.mjs`
 * exists to prevent one level up. `closeAllConnections()` ends them, so the next bind succeeds
 * immediately instead of racing a draining socket.
 */
export function stopScenarioServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve()
    server.close(error => (error ? reject(error) : resolve()))
    server.closeAllConnections()
  })
}

/**
 * CLI entry, spawned by `scripts/ci-preview.mjs --backend scenarios`. It prints a readiness line on
 * stdout, but the orchestrator gates on the PORT accepting connections rather than on that line —
 * the same rule that applies to Prism, and for the same reason.
 */
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CI_MOCK_PORT ?? 3101)
  const server = createScenarioServer()

  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    void stopScenarioServer(server).then(() => process.exit(0))
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop)

  server.listen(port, '127.0.0.1', () => {
    console.log(`[scenario-server] listening on http://127.0.0.1:${port}${API_PREFIX}`)
  })
}
