import http from 'node:http'
import process from 'node:process'

const prefix = '/api/v1'
let failing: 'articles' | 'projects' | 'messages' | null = null
const calls: Array<{ path: string, query: string }> = []
const owner = { id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f', email: 'owner@example.com', role: { name: 'OWNER' } }
const json = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': res.req.headers.origin ?? '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS', ...headers }); res.end(JSON.stringify(body)) }
const problem = (res: http.ServerResponse, status: number) => json(res, status, { type: 'about:blank', title: 'Fixture failure', status })
const body = async (req: http.IncomingMessage) => { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer); return JSON.parse(Buffer.concat(chunks).toString() || '{}') as { failing?: typeof failing } }
const authorized = (req: http.IncomingMessage) => (req.headers.authorization ?? '').startsWith('Bearer ')
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (url.pathname === '/__e2e/reset' && req.method === 'POST') { failing = null; calls.length = 0; return json(res, 200, { ok: true }) }
  if (url.pathname === '/__e2e/state' && req.method === 'POST') { failing = (await body(req)).failing ?? null; return json(res, 200, { ok: true }) }
  if (url.pathname === '/__e2e/requests') return json(res, 200, { calls })
  if (url.pathname === `${prefix}/auth/login` && req.method === 'POST') return json(res, 200, { data: { accessToken: 'e2e-access-token', user: owner } }, { 'set-cookie': `refresh_token=e2e-refresh; Path=${prefix}/auth; HttpOnly; SameSite=Lax` })
  if (url.pathname === `${prefix}/auth/refresh` && req.method === 'POST') {
    if (!(req.headers.cookie ?? '').includes('refresh_token=')) return problem(res, 401)
    return json(res, 200, { data: { accessToken: 'e2e-access-token' } }, { 'set-cookie': `refresh_token=e2e-refresh; Path=${prefix}/auth; HttpOnly; SameSite=Lax` })
  }
  if (url.pathname === `${prefix}/settings/site`) return json(res, 200, { data: { siteName: 'Fixture site', profileLinks: [], contactEmail: null, contactPhone: null } })
  if (!authorized(req)) return problem(res, 401)
  const kind = url.pathname.endsWith('/articles') ? 'articles' : url.pathname.endsWith('/projects') ? 'projects' : url.pathname.endsWith('/messages') ? 'messages' : null
  if (!kind || req.method !== 'GET') return problem(res, 404)
  calls.push({ path: url.pathname, query: url.search })
  if (failing === kind) return problem(res, 500)
  const total = kind === 'articles' ? 7 : kind === 'projects' ? 3 : 2
  return json(res, 200, { data: [], meta: { page: 1, perPage: Number(url.searchParams.get('perPage') ?? 1), total, totalPages: total } })
})
server.listen(Number(process.env.CI_MOCK_PORT ?? 4801), '127.0.0.1')
