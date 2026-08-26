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
 *   /experience                                    200, zero experiences           localized empty state
 *   /ar/experience                                 RFC 7807 503                    localized RTL error state
 *   /blog                (and /ar/blog)            200, zero articles              localized empty state
 *   /blog?category=scenario-empty-topic            200, zero articles              filtered empty + clear
 *   /ar/blog?category=scenario-empty-topic         200, zero articles              UNKNOWN-category copy
 *
 * The last row is the one worth reading twice. `scenario-empty-topic` is the ENGLISH slug, and category
 * slugs are per-locale (D04-2), so on the Arabic index it names a category that does not exist there —
 * exactly what a locale switch produces, because the query string is carried across. The upstream
 * answers all three identically (a valid empty page), so the page can only tell them apart from the
 * category LIST. That is the behaviour the scenario exists to pin.
 *
 * `/settings/site`, `/skills` and `/categories` are ALWAYS healthy, including in the failure scenarios. If the page
 * shell also failed, the accessibility and recovery-action assertions would be measuring a different
 * page than the one under test.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ARTICLES, CATEGORIES, EMPTY_PAGE, gtmSettings, PROJECTS, REDIRECTS, SITE_SETTINGS, SKILLS,
  TECHNOLOGY, TECHNOLOGY_SLUG, isLocale, problem,
  ABOUT_READINESS_SETTINGS, RESUME_PDF_BYTES, RESUME_PDF_FILENAME, resumePdfSettings } from './fixtures.ts'
import type { Locale, ProblemDetail } from './fixtures.ts'

/** The contract's mount point. `NUXT_PUBLIC_API_BASE` points Nitro at `http://host:port/api/v1`. */
export const API_PREFIX = '/api/v1'

/**
 * Which `/settings/site` variant this PROCESS serves, fixed at start-up and never per-request.
 *
 * `portrait-null` reproduces the real live API state for `/about` (governed prose present, no
 * portrait). It is selected by `ci-preview.mjs --backend about-readiness`, which runs this server as
 * a SEPARATE process on its own port. That separation is the point: the global settings endpoint
 * stays published and healthy for every other scenario, so no unrelated test becomes
 * scenario-dependent, and the "one URL ⇒ one scenario" invariant is preserved because the variant is
 * a property of the process, not of the request.
 */
const ABOUT_STATE = process.env.E2E_ABOUT_STATE === 'portrait-null' ? 'portrait-null' : 'published'

/**
 * Which `/settings/site` résumé slot this PROCESS serves (010), on the same process-variant
 * principle as `ABOUT_STATE` above.
 *
 * `null` — the DEFAULT and the real live state — is what the ordinary scenario lane serves, so the
 * honest PDF-unavailable rendering is proven against the state production is actually in. The
 * `pdf` variant is selected by `ci-preview.mjs --backend resume-pdf` and additionally serves the
 * object itself at `/media/…`, which is the only way the `application/pdf` content type and the
 * `Content-Disposition: attachment` header can be observed by a real browser.
 */
const RESUME_STATE = process.env.E2E_RESUME_STATE === 'pdf' ? 'pdf' : 'none'

/**
 * Which `/settings/site` GTM publication this PROCESS serves (FE4-U2e2), on the same
 * process-variant principle as the two states above.
 *
 * `valid` — selected by `ci-preview.mjs --backend gtm-settings` — publishes a syntactically valid,
 * entirely FICTIONAL container id, which is the ONLY way a real browser can prove the GTM loader
 * lifecycle end to end: Prism's committed contract publishes `null` (the true live state), and no
 * other lane may see analytics enabled. The harness intercepts the loader request itself, so no
 * real container is contacted.
 */
const GTM_STATE = process.env.E2E_GTM_STATE === 'valid' ? 'valid' : 'none'

/**
 * The origin the résumé descriptor points at. Read from the SAME env var the listener binds below,
 * so the advertised URL and the port actually serving the bytes cannot disagree.
 */
const MEDIA_ORIGIN = `http://127.0.0.1:${Number(process.env.CI_MOCK_PORT ?? 3101)}`

const SETTINGS = ABOUT_STATE === 'portrait-null'
  ? ABOUT_READINESS_SETTINGS
  : RESUME_STATE === 'pdf'
    ? resumePdfSettings(MEDIA_ORIGIN)
    : GTM_STATE === 'valid'
      ? gtmSettings()
      : SITE_SETTINGS

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

/**
 * `GET /experiences` — the Experience timeline (008).
 *
 * THE SELECTOR IS THE LOCALE, and it has to be. Every other scenario here keys off something the
 * page puts in the request — a slug or the `?technology=` filter. `/experience` takes no parameters
 * and forwards none, so the only variable this backend can see is `?locale=`. Adding a query
 * parameter to the page purely so tests could select a scenario would be production API surface
 * invented for the harness.
 *
 * The design invariant still holds — one URL still means exactly one deterministic scenario:
 *
 *   /experience     (locale=en)   200, zero experiences   localized EMPTY state
 *   /ar/experience  (locale=ar)   RFC 7807 503            localized, RTL ERROR state
 *
 * The pairing is deliberate rather than arbitrary: the error state is the one that must be proven
 * direction-correct, so it is the Arabic route that exercises it.
 *
 * Nothing else in this lane reads `/experiences` (the home page is not a scenario route), so the
 * Arabic 503 cannot leak into another scenario's page shell.
 */
function resolveExperiences(locale: Locale, instance: string): Reply {
  if (locale === 'ar') return unavailable(instance)
  return json({ data: [] })
}

/**
 * `GET /projects` — the index. The `technology` filter is the scenario selector (see the table above).
 *
 * BOTH forms select the same scenario, because the real API accepts both: the slug is canonical and
 * the uuid is backward-compatible only (D10-17). Resolving only the slug here would make the legacy
 * form untestable, and a shared link carrying the old uuid is exactly the case that must keep working.
 */
function resolveProjectsIndex(technology: string | null, instance: string): Reply {
  if (technology === TECHNOLOGY.unreachable || technology === TECHNOLOGY_SLUG.unreachable) {
    return { kind: 'destroy' }
  }
  if (technology === TECHNOLOGY.upstream503 || technology === TECHNOLOGY_SLUG.upstream503) {
    return unavailable(instance)
  }
  // Both the unfiltered index and the "no matches" filter answer with a well-formed empty page; the
  // page itself tells the two apart and renders different copy, which is what the tests assert.
  return json(EMPTY_PAGE)
}

/**
 * `GET /articles` — the blog index. The `category` filter is the scenario selector.
 *
 * Every scenario here answers with a well-formed EMPTY page, including an UNKNOWN category — which is
 * the real API's behaviour (an unknown category is a valid empty result, not a 404). That is exactly
 * what makes the wrong-locale case indistinguishable at the network level and why the page has to tell
 * the two apart from the category LIST rather than from the response.
 */
function resolveArticlesIndex(category: string | null, locale: Locale): Reply {
  void category
  void locale
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

  if (pathname === '/settings/site') return json({ data: SETTINGS[locale] })
  if (pathname === '/skills') return json({ data: SKILLS[locale] })
  if (pathname === '/categories') return json({ data: CATEGORIES[locale] })
  if (pathname === '/articles') return resolveArticlesIndex(parsed.searchParams.get('category'), locale)
  if (pathname === '/experiences') return resolveExperiences(locale, instance)
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
 * `POST /contact` scenario resolution (011).
 *
 * THE SELECTOR IS A REQUEST HEADER, deliberately — not the subject or any other visible form field.
 * Subject is content a real visitor writes, and selecting server behaviour from it would mean a
 * production message could change what the API does. `x-contact-scenario` is attached by the
 * `ssr-scenarios` Playwright project only, via `setExtraHTTPHeaders`, and cannot reach the real API:
 * the contract, scenario and real-API lanes are separate projects with separate `baseURL`s.
 *
 * The default with no header is the neutral 2xx receipt, which is what the API returns for BOTH a
 * stored message and a silently dropped one (D02-1) — so the happy path here is the honest one.
 */
export function resolveContactPost(
  scenario: string | undefined,
  instance: string
): { readonly reply: Reply, readonly headers?: Record<string, string> } {
  switch (scenario) {
    case 'validation':
      return {
        reply: {
          kind: 'problem',
          status: 422,
          body: {
            ...problem(422, 'Unprocessable Entity', 'Validation failed.', instance),
            errors: [
              { field: 'email', message: 'Enter a valid email address.' },
              { field: 'phone', message: 'Provide a valid international phone number in E.164 format, or an email address.' }
            ]
          }
        }
      }
    case 'throttled':
      // Seconds, per doc 19 §6 / D10-15. CORS-exposed above, so the browser can actually read it.
      return {
        reply: { kind: 'problem', status: 429, body: problem(429, 'Too Many Requests', 'Rate limit exceeded.', instance) },
        headers: { 'retry-after': '3600' }
      }
    case 'throttled-no-retry-after':
      // The state the copy must degrade to a static message for.
      return {
        reply: { kind: 'problem', status: 429, body: problem(429, 'Too Many Requests', 'Rate limit exceeded.', instance) }
      }
    case 'throttled-bad-retry-after':
      // Present but unparseable: must degrade exactly like an absent one, never render "NaN".
      return {
        reply: { kind: 'problem', status: 429, body: problem(429, 'Too Many Requests', 'Rate limit exceeded.', instance) },
        headers: { 'retry-after': 'soon' }
      }
    case 'server-error':
      return {
        reply: { kind: 'problem', status: 500, body: problem(500, 'Internal Server Error', 'Something went wrong.', instance) }
      }
    case 'network-failure':
      // The socket dies mid-request, exactly as the GET destroy scenario does.
      return { reply: { kind: 'destroy' } }
    default:
      return { reply: json({ data: { received: true } }) }
  }
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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-contact-scenario',
    // `Retry-After` is only readable cross-origin when it is named here (D10-15). Without this the
    // 429-with-countdown scenario would be indistinguishable from the 429-without one, and the lane
    // would silently prove nothing.
    'access-control-expose-headers': 'Retry-After',
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

    // The one mutating route this backend serves (011). The body is drained but never inspected for
    // routing — see resolveContactPost for why the selector is a header.
    if (request.method === 'POST' && request.url?.startsWith(`${API_PREFIX}/contact`)) {
      const scenario = request.headers['x-contact-scenario']
      request.resume()
      request.on('end', () => {
        const { reply, headers } = resolveContactPost(
          typeof scenario === 'string' ? scenario : undefined,
          `${API_PREFIX}/contact`
        )
        if (reply.kind === 'destroy') {
          request.socket.destroy()
          return
        }
        const contentType = reply.kind === 'problem' ? 'application/problem+json' : 'application/json'
        const payload = JSON.stringify(reply.body)
        response.writeHead(reply.status, {
          ...cors,
          ...headers,
          'content-type': `${contentType}; charset=utf-8`,
          'content-length': Buffer.byteLength(payload),
          'cache-control': 'no-store'
        })
        response.end(payload)
      })
      return
    }

    /**
     * The résumé OBJECT (010) — served outside `API_PREFIX`, because a media object is not an API
     * endpoint: production serves it from a separate media origin (R2 behind `PUBLIC_MEDIA_URL`),
     * and the point of this route is to reproduce that separation locally.
     *
     * The two headers below are the ones under test. In production they are OBJECT METADATA written
     * at upload time (doc 19 §5, `media.service.ts`), not response logic — which is exactly why the
     * Web app must not rely on the HTML `download` attribute: it is ignored cross-origin, so the
     * storage headers are the authoritative download mechanism, and this route is where that claim
     * becomes observable.
     */
    if ((request.url ?? '').split('?')[0] === `/media/${RESUME_PDF_FILENAME}`) {
      if (RESUME_STATE !== 'pdf') {
        response.writeHead(404, { ...cors, 'content-type': 'text/plain' })
        response.end('not served by this lane')
        return
      }
      response.writeHead(200, {
        ...cors,
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${RESUME_PDF_FILENAME}"`,
        'content-length': RESUME_PDF_BYTES.byteLength,
        'cache-control': 'no-store'
      })
      response.end(Buffer.from(RESUME_PDF_BYTES))
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
