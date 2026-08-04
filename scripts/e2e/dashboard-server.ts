/**
 * Deterministic Dashboard backend for the committed `dashboard` Playwright project (Feature 012).
 *
 * WHY A THIRD BACKEND RATHER THAN PRISM OR THE SSR SCENARIO SERVER.
 * Prism replays ONE example per operation, so it cannot express a list that changes after a PATCH —
 * and "the list and the unread badge agree with confirmed server state after a mutation" is the
 * single most important thing this feature does. `scenario-server.ts` is deliberately stateless
 * ("ONE URL ⇒ ONE SCENARIO", `fullyParallel` with no reset hook), and giving it mutable state would
 * destroy the invariant every SSR lane depends on. So the mutable surface lives here, in its own
 * process, behind its own Playwright project that runs serially.
 *
 * WHY NOT THE REAL API. The committed CI browser lane never boots the NestJS API or a database
 * (doc 00 §3) — that is exactly why `e2e-race/` exists as a separate, manually-run lane. This
 * backend gives CI durable coverage of normal Dashboard behaviour; `e2e-race/` remains the
 * AUTHORITATIVE proof for timing-sensitive ordering against a real database. The two layers answer
 * different questions and neither replaces the other.
 *
 * ── SCENARIO SELECTION IS BY STABLE IDENTIFIER, NEVER BY TRANSLATED COPY ────────────────────────
 * Fixture ids are literal and readable (`msg-email-only`, `msg-phone-only`, `msg-both`), so a spec
 * selects behaviour by identity rather than by a rendered string that a copy edit would break.
 * Response MODE is switched by `POST /__e2e/state`, not by a magic URL, so the same route can be
 * observed healthy, empty, failing, or forbidden within one spec file.
 *
 * AUTH IS REAL ENOUGH TO BE HONEST. Login issues a refresh cookie and an access token; admin routes
 * reject a missing/!Bearer Authorization header with 401, and the `forbidden` mode answers 403. The
 * dashboard's silent-refresh path (D11-1) is therefore exercised on every reload, as it is in
 * production. No throttling is modelled: rate limits are the API's concern and are proven against
 * the real API, not here.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type MessageMode = 'ok' | 'empty' | 'error' | 'forbidden'

export interface SeedMessage {
  id: string
  name: string
  email: string | null
  phone: string | null
  subject: string
  body: string
  isRead: boolean
  isArchived: boolean
}

/**
 * Fixture ids are REAL UUIDs, and that is load-bearing rather than cosmetic.
 *
 * `app/utils/messages-query.ts` validates `?message=` as `z.uuid()` and DROPS anything malformed —
 * correct behaviour, and the reason a readable id like `msg-both` would silently never select
 * anything. Deterministic UUIDs keep the fixtures addressable by NAME from the specs (a stable
 * identifier, not translated copy) while still satisfying the contract the app enforces.
 */
export const MSG = {
  // These three sort FIRST among unread, so all three contact shapes are on page 1. Ordering is
  // unread-first then id-ascending here, and a fixture that lands on page 2 would be invisible to a
  // deep link — `selected` is looked up in the LOADED page, never fetched (a documented design).
  emailOnly: '00000000-0000-4000-8000-000000000001',
  phoneOnly: '00000000-0000-4000-8000-000000000002',
  both: '00000000-0000-4000-8000-000000000003',
  archivedOne: '00000000-0000-4000-8000-00000000a001',
  archivedTwo: '00000000-0000-4000-8000-00000000a002',
  /** A well-formed UUID that is deliberately absent from the fixtures — the stale-selection case. */
  absent: '00000000-0000-4000-8000-0000000000ff'
} as const

const inboxId = (i: number) => `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`

/** A tiny single-page fixture for order-sensitive specs (focus, Back/Forward). */
export function smallSeed(): SeedMessage[] {
  return [
    { id: MSG.emailOnly, name: 'Email Only', email: 'emailonly@example.com', phone: null, subject: 'Email only enquiry', body: 'Email only body', isRead: false, isArchived: false },
    { id: MSG.phoneOnly, name: 'Phone Only', email: null, phone: '+201002785408', subject: 'Phone only enquiry', body: 'Phone only body', isRead: false, isArchived: false },
    { id: MSG.both, name: 'Both Methods', email: 'both@example.com', phone: '+201112223334', subject: 'Both methods enquiry', body: 'Both methods body', isRead: false, isArchived: false },
    { id: MSG.archivedOne, name: 'Archived One', email: 'arch1@example.com', phone: null, subject: 'Archived subject 1', body: 'Archived body 1', isRead: true, isArchived: true }
  ]
}

/**
 * The fixture inbox. Sizes are chosen so pagination is REAL: `perPage` is 12 (MESSAGES_PER_PAGE), so
 * 14 inbox rows guarantee a second page with a distinguishable tail rather than a page-2 that
 * happens to render the same rows.
 */
export function seedMessages(): SeedMessage[] {
  const rows: SeedMessage[] = []
  for (let i = 1; i <= 14; i++) {
    rows.push({
      id: inboxId(i),
      name: `Inbox Sender ${i}`,
      email: `inbox${i}@example.com`,
      phone: null,
      subject: `Inbox subject ${i}`,
      body: `Inbox body ${i}`,
      // A deterministic mix so "unread is not colour-only" and the badge have something to assert.
      isRead: i > 11,
      isArchived: false
    })
  }
  rows.push(
    { id: MSG.emailOnly, name: 'Email Only', email: 'emailonly@example.com', phone: null, subject: 'Email only enquiry', body: 'Email only body', isRead: false, isArchived: false },
    { id: MSG.phoneOnly, name: 'Phone Only', email: null, phone: '+201002785408', subject: 'Phone only enquiry', body: 'Phone only body', isRead: false, isArchived: false },
    { id: MSG.both, name: 'Both Methods', email: 'both@example.com', phone: '+201112223334', subject: 'Both methods enquiry', body: 'Both methods body', isRead: false, isArchived: false },
    { id: MSG.archivedOne, name: 'Archived One', email: 'arch1@example.com', phone: null, subject: 'Archived subject 1', body: 'Archived body 1', isRead: true, isArchived: true },
    { id: MSG.archivedTwo, name: 'Archived Two', email: 'arch2@example.com', phone: null, subject: 'Archived subject 2', body: 'Archived body 2', isRead: true, isArchived: true }
  )
  return rows
}

/** Mutable per-process state. Reset between specs through `POST /__e2e/reset`. */
let messages = seedMessages()
let mode: MessageMode = 'ok'
/** Makes one PATCH fail, to prove a failed mutation preserves the previous confirmed state. */
let failNextPatch = false

const PER_PAGE_MAX = 50
const OWNER = { id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f', email: 'owner@example.com', role: { name: 'OWNER' } }

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    ...headers
  })
  res.end(payload)
}

function problem(res: http.ServerResponse, status: number, title: string) {
  const payload = JSON.stringify({ type: 'about:blank', title, status, detail: title })
  res.writeHead(status, {
    'content-type': 'application/problem+json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end(payload)
}

/** Admin routes require a bearer token, exactly as the real API does. */
function authorized(req: http.IncomingMessage): boolean {
  return (req.headers.authorization ?? '').startsWith('Bearer ')
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** Unread-first, then newest-first — the API's documented order, which the client never re-sorts. */
function ordered(list: SeedMessage[]): SeedMessage[] {
  return [...list].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
    return a.id < b.id ? -1 : 1
  })
}

function toEntity(m: SeedMessage) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
    body: m.body,
    isRead: m.isRead,
    isArchived: m.isArchived,
    archivedAt: m.isArchived ? '2026-08-01T00:00:00.000Z' : null,
    meta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  // ── test control plane ───────────────────────────────────────────────────────────────────────
  if (path === '/__e2e/reset' && req.method === 'POST') {
    messages = seedMessages()
    mode = 'ok'
    failNextPatch = false
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as { mode?: MessageMode, failNextPatch?: boolean, messages?: SeedMessage[] }
    if (body.mode) mode = body.mode
    if (typeof body.failNextPatch === 'boolean') failNextPatch = body.failNextPatch
    if (body.messages) messages = body.messages
    return json(res, 200, { ok: true, mode })
  }

  // ── auth ─────────────────────────────────────────────────────────────────────────────────────
  if (path === `${API_PREFIX}/auth/login` && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as { email?: string, password?: string }
    if (!body.email || !body.password) return problem(res, 422, 'Validation failed')
    // A single known-bad credential so the login failure path is assertable without guessing.
    if (body.password === 'wrong-password') return problem(res, 401, 'Invalid credentials')
    return json(res, 200, { data: { accessToken: 'e2e-access-token', user: OWNER } }, {
      'set-cookie': `refresh_token=e2e-refresh; Path=${API_PREFIX}/auth; HttpOnly; SameSite=Lax`
    })
  }
  if (path === `${API_PREFIX}/auth/refresh` && req.method === 'POST') {
    if (!(req.headers.cookie ?? '').includes('refresh_token=')) return problem(res, 401, 'Missing refresh token')
    return json(res, 200, { data: { accessToken: 'e2e-access-token' } }, {
      'set-cookie': `refresh_token=e2e-refresh; Path=${API_PREFIX}/auth; HttpOnly; SameSite=Lax`
    })
  }
  if (path === `${API_PREFIX}/auth/logout` && req.method === 'POST') {
    return json(res, 200, { data: { ok: true } }, {
      'set-cookie': `refresh_token=; Path=${API_PREFIX}/auth; HttpOnly; Max-Age=0`
    })
  }

  // ── admin messages ───────────────────────────────────────────────────────────────────────────
  if (path.startsWith(`${API_PREFIX}/admin/messages`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      // A transport-level failure: destroy the socket so the client sees a real network error
      // rather than a well-formed error body it might render differently.
      res.socket?.destroy()
      return
    }

    if (req.method === 'PATCH') {
      const id = path.split('/').pop() as string
      if (failNextPatch) {
        failNextPatch = false
        return problem(res, 500, 'Mutation failed')
      }
      const target = messages.find(m => m.id === id)
      if (!target) return problem(res, 404, 'Not found')
      const body = JSON.parse((await readBody(req)) || '{}') as { isRead?: boolean, isArchived?: boolean }
      if (typeof body.isRead === 'boolean') target.isRead = body.isRead
      if (typeof body.isArchived === 'boolean') target.isArchived = body.isArchived
      return json(res, 200, { data: toEntity(target) })
    }

    if (req.method === 'GET') {
      const isArchived = url.searchParams.get('isArchived') === 'true'
      const isReadParam = url.searchParams.get('isRead')
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
      const perPage = Math.min(PER_PAGE_MAX, Math.max(1, Number(url.searchParams.get('perPage') ?? '12') || 12))

      let pool = mode === 'empty' ? [] : messages.filter(m => m.isArchived === isArchived)
      if (isReadParam !== null) pool = pool.filter(m => m.isRead === (isReadParam === 'true'))

      const sorted = ordered(pool)
      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / perPage))
      const slice = sorted.slice((page - 1) * perPage, page * perPage)
      return json(res, 200, { data: slice.map(toEntity), meta: { page, perPage, total, totalPages } })
    }
  }

  // The dashboard shell must stay healthy in every scenario; a failing shell would mean the
  // accessibility and recovery assertions were measuring a different page than the one under test.
  if (path === `${API_PREFIX}/settings/site`) {
    return json(res, 200, { data: { siteName: 'Eslam Muatamed', profileLinks: [], contactEmail: null, contactPhone: null } })
  }

  return problem(res, 404, 'Not found')
})

const isMain = (() => {
  try {
    return realpathSync(process.argv[1] as string) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isMain) {
  const port = Number(process.env.CI_MOCK_PORT ?? 3001)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[dashboard-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
