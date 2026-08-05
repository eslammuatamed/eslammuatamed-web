/**
 * Request-COUNTING backend for the `settings-dedupe` Playwright lane.
 *
 * WHY THIS LANE EXISTS. Three composables deliberately share one `settings:site:{locale}` async-data
 * key so a public render performs exactly ONE `GET /settings/site`: `useSiteSettings()` (chrome),
 * `useAboutContent()` (`/about`) and `useResumeData()` (`/resume`). That invariant was documented in
 * all three composables and was **false in production code for the whole of web-005..web-013**: Nuxt's
 * default `getCachedData` reads `nuxtApp.static.data` on the server, which is empty during a normal
 * SSR render, so every call site refetched. Measured on `/about`: one request per call site — 2 before
 * the public layout began reading tier-2 metadata, 3 after. `app/utils/settings-cache.ts` fixes it.
 *
 * WHY IT MUST BE A SERVER, NOT A UNIT TEST. The pre-existing unit assertion for this exact invariant
 * (`app/composables/useResumeData.spec.ts`) mocks `useApi`, so it passed throughout while the real
 * behaviour diverged. Only a count taken at the process boundary BELOW Nitro can observe it — the same
 * conclusion `scenario-server.ts` reached for SSR fixtures, and for the same measured reason: a direct
 * load is server-rendered, so the read never reaches the browser and `page.route()` sees 0 requests.
 *
 * WHY A SEPARATE PROCESS. This backend holds MUTABLE state (a counter a test resets), and
 * `scenario-server.ts` is deliberately stateless so its lanes can run `fullyParallel` with no reset
 * hook. Keeping the mutable surface in its own process preserves that invariant instead of trading it
 * away — exactly the reasoning that already governs `dashboard-server.ts`.
 *
 * The counter is exposed OUTSIDE `API_PREFIX`, so it can never be mistaken for contract surface.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { SITE_SETTINGS, isLocale } from './fixtures.ts'

/** The contract's mount point. `NUXT_PUBLIC_API_BASE` points Nitro at `http://host:port/api/v1`. */
export const API_PREFIX = '/api/v1'

/** Every `/settings/site` request this process has served since the last reset. */
let settingsSiteRequests: string[] = []

export function createCountingServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const send = (body: unknown, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    // ── control surface (never under API_PREFIX) ────────────────────────────────────────────────
    if (url.pathname === '/__settings-count') {
      return send({ count: settingsSiteRequests.length, urls: settingsSiteRequests })
    }
    if (url.pathname === '/__settings-count/reset') {
      settingsSiteRequests = []
      return send({ count: 0 })
    }

    if (!url.pathname.startsWith(API_PREFIX)) return send({ detail: 'not served' }, 404)
    const pathname = url.pathname.slice(API_PREFIX.length)

    if (pathname === '/settings/site') {
      settingsSiteRequests.push(request.url ?? '')
      const locale = url.searchParams.get('locale')
      return send({ data: SITE_SETTINGS[isLocale(locale) ? locale : 'en'] })
    }

    // Everything else stays healthy and empty. This lane asserts a REQUEST COUNT, not page content,
    // so an empty list is sufficient — and an empty list still renders, where a 404 would push the
    // page into its error state and change which components mount (and therefore which reads run).
    return send({ data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 0 } })
  })
}

/**
 * CLI entry, spawned by `scripts/ci-preview.mjs --backend settings-count`. Prints a readiness line,
 * but the orchestrator gates on the PORT accepting connections rather than on that line.
 */
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CI_MOCK_PORT ?? 3601)
  const server = createCountingServer()

  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop)

  server.listen(port, '127.0.0.1', () => {
    console.log(`[settings-count-server] listening on http://127.0.0.1:${port}${API_PREFIX}`)
  })
}
