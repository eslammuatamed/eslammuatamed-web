/**
 * Mutable upstream for the public project-detail cache regression.
 *
 * It deliberately models the only transition involved in the production defect: the same published
 * project is first read with no gallery, then a Dashboard-equivalent mutation makes its already
 * authored gallery visible. Nitro must observe that new state on the next detail request. The
 * controls live outside `/api/v1`, are reachable only on this test listener, and are never imported
 * by application code.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { EMPTY_PAGE, PROJECTS, SITE_SETTINGS, SKILLS, SLUG, isLocale } from './fixtures.ts'

const API_PREFIX = '/api/v1'
export const CONTROL_RESET = '/__test__/gallery/reset'
export const CONTROL_PUBLISH = '/__test__/gallery/publish'

let galleryPublished = false

function writeJson(response: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store'
  })
  response.end(payload)
}

export function createProjectCacheServer(): http.Server {
  return http.createServer((request, response) => {
    const parsed = new URL(request.url ?? '/', 'http://project-cache.invalid')

    if (request.method === 'POST' && parsed.pathname === CONTROL_RESET) {
      galleryPublished = false
      request.resume()
      response.writeHead(204, { 'cache-control': 'no-store' })
      response.end()
      return
    }

    if (request.method === 'POST' && parsed.pathname === CONTROL_PUBLISH) {
      galleryPublished = true
      request.resume()
      response.writeHead(204, { 'cache-control': 'no-store' })
      response.end()
      return
    }

    if (request.method !== 'GET' || !parsed.pathname.startsWith(API_PREFIX)) {
      writeJson(response, 404, { status: 404, title: 'Not Found' })
      return
    }

    const locale = parsed.searchParams.get('locale')
    if (!isLocale(locale)) {
      writeJson(response, 422, { status: 422, title: 'Unprocessable Entity' })
      return
    }

    const pathname = parsed.pathname.slice(API_PREFIX.length)
    if (pathname === '/settings/site') {
      writeJson(response, 200, { data: SITE_SETTINGS[locale] })
      return
    }
    if (pathname === '/skills') {
      writeJson(response, 200, { data: SKILLS[locale] })
      return
    }
    if (pathname === '/projects') {
      writeJson(response, 200, EMPTY_PAGE)
      return
    }

    const slug = locale === 'en' ? SLUG.bilingual.en : SLUG.bilingual.ar
    if (pathname === `/projects/${slug}`) {
      const project = PROJECTS[locale][slug]!
      writeJson(response, 200, {
        data: galleryPublished ? project : { ...project, gallery: [] }
      })
      return
    }

    writeJson(response, 404, { status: 404, title: 'Not Found' })
  })
}

export function stopProjectCacheServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve()
    server.close(error => (error ? reject(error) : resolve()))
    server.closeAllConnections()
  })
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CI_MOCK_PORT ?? 3801)
  const server = createProjectCacheServer()
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    void stopProjectCacheServer(server).then(() => process.exit(0))
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[project-cache-server] listening on http://127.0.0.1:${port}${API_PREFIX}`)
  })
}
