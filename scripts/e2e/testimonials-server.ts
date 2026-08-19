/**
 * Deterministic Testimonials backend for the future `dashboard-testimonials` Playwright project
 * (FE-3 module 3, T·U1).
 *
 * This is a separate mutable backend for the same reason as Skills and Experiences: one serial
 * browser lane must own one resettable process. This unit creates only the instrument and its
 * calibration; registering the lane belongs to the later browser-spec unit.
 *
 * Contract distinctions kept deliberately sharp:
 * - admin list reads are whole `{ data }` responses with no query DTO and no `meta`;
 * - reads expose a locale-keyed translation map, writes take an array;
 * - create requires `order`, `isVisible`, and `translations`, while PATCH permits `{}`;
 * - every translation item requires a two-letter lowercase locale plus non-empty quote,
 *   authorName, and authorRole; quote is capped at 4000 characters and the author fields at 160;
 * - `avatarId` is the sole nullable write field: null clears and omission preserves;
 * - PATCH translations upsert supplied locales and never delete omitted locales;
 * - create requires at least one translation, while PATCH fields remain optional;
 * - order is a non-negative integer;
 * - DELETE is 204 with no body and has no invented linkage conflict.
 *
 * The control plane matches the established authoring instruments: resettable fixtures, bearer
 * auth, forbidden/empty/transport-error modes, one-shot write failure, and response holds.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type TestimonialBackendMode = 'ok' | 'empty' | 'error' | 'forbidden'

export interface SeedAdminTestimonialTranslation {
  quote: string
  authorName: string
  authorRole: string
}

export interface SeedAdminTestimonial {
  id: string
  avatarId: string | null
  order: number
  isVisible: boolean
  translations: Record<string, SeedAdminTestimonialTranslation>
}

export const TESTIMONIAL_IDS = {
  featured: '00000000-0000-4000-a300-000000000001',
  hidden: '00000000-0000-4000-a300-000000000002',
  enOnly: '00000000-0000-4000-a300-000000000003',
  noAvatar: '00000000-0000-4000-a300-000000000004',
  absent: '00000000-0000-4000-a300-0000000000ff'
} as const

export const AVATAR_IDS = {
  featured: '00000000-0000-4000-b300-000000000001',
  hidden: '00000000-0000-4000-b300-000000000002',
  replacement: '00000000-0000-4000-b300-000000000003'
} as const

function seedTestimonials(): SeedAdminTestimonial[] {
  return [
    {
      id: TESTIMONIAL_IDS.featured,
      avatarId: AVATAR_IDS.featured,
      order: 0,
      isVisible: true,
      translations: {
        en: {
          quote: 'The team turned a difficult brief into a dependable product.',
          authorName: 'Alex Morgan',
          authorRole: 'CTO, Northstar'
        },
        ar: {
          quote: 'حوّل الفريق متطلبات معقدة إلى منتج يمكن الاعتماد عليه.',
          authorName: 'أليكس مورغان',
          authorRole: 'المدير التقني، نورث ستار'
        }
      }
    },
    {
      id: TESTIMONIAL_IDS.hidden,
      avatarId: AVATAR_IDS.hidden,
      order: 1,
      isVisible: false,
      translations: {
        en: { quote: 'A thoughtful partner from discovery through launch.', authorName: 'Sam Lee', authorRole: 'Founder, Relay' },
        ar: { quote: 'شريك متأنٍّ من الاكتشاف حتى الإطلاق.', authorName: 'سام لي', authorRole: 'المؤسس، ريلاي' }
      }
    },
    {
      id: TESTIMONIAL_IDS.enOnly,
      avatarId: null,
      order: 2,
      isVisible: true,
      translations: {
        en: { quote: 'Clear communication and excellent execution.', authorName: 'Jordan Kim', authorRole: 'Product Lead' }
      }
    },
    {
      id: TESTIMONIAL_IDS.noAvatar,
      avatarId: null,
      order: 3,
      isVisible: true,
      translations: {
        en: { quote: 'They made the complex feel manageable.', authorName: 'Taylor Reed', authorRole: 'Director, Atlas' }
      }
    }
  ]
}

let testimonials = seedTestimonials()
let mode: TestimonialBackendMode = 'ok'
let delayMs = 0
let failNextWrite = false
let createdSequence = 0

const OWNER = {
  id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  email: 'owner@example.com',
  role: { name: 'OWNER' }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WRITE_FIELDS = new Set(['avatarId', 'order', 'isVisible', 'translations'])

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...headers
  })
  res.end(JSON.stringify(body))
}

function noContent(res: http.ServerResponse) {
  res.writeHead(204, {
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end()
}

function problem(
  res: http.ServerResponse,
  status: number,
  title: string,
  detail?: string,
  errors?: Array<{ field: string, message: string }>
) {
  res.writeHead(status, {
    'content-type': 'application/problem+json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end(JSON.stringify({
    type: errors ? '/problems/validation' : 'about:blank',
    title,
    status,
    detail: detail ?? title,
    instance: res.req.url ?? '/',
    ...(errors ? { errors } : {})
  }))
}

function authorized(req: http.IncomingMessage): boolean {
  return (req.headers.authorization ?? '').startsWith('Bearer ')
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function toEntity(row: SeedAdminTestimonial) {
  return {
    id: row.id,
    avatarId: row.avatarId,
    order: row.order,
    isVisible: row.isVisible,
    translations: Object.fromEntries(
      Object.entries(row.translations).map(([locale, value]) => [locale, { ...value }])
    )
  }
}

interface TranslationInput {
  locale?: unknown
  quote?: unknown
  authorName?: unknown
  authorRole?: unknown
  [key: string]: unknown
}

interface WriteBody {
  avatarId?: unknown
  order?: unknown
  isVisible?: unknown
  translations?: unknown
  [key: string]: unknown
}

function ownErrors(body: WriteBody): Array<{ field: string, message: string }> {
  return Object.keys(body)
    .filter(field => !WRITE_FIELDS.has(field))
    .map(field => ({ field, message: `property ${field} should not exist.` }))
}

function validateWrite(body: WriteBody): Array<{ field: string, message: string }> {
  const errors: Array<{ field: string, message: string }> = []

  if (body.avatarId !== undefined && body.avatarId !== null &&
      (typeof body.avatarId !== 'string' || !UUID_PATTERN.test(body.avatarId))) {
    errors.push({ field: 'avatarId', message: 'avatarId must be a UUID or null.' })
  }
  if (body.order !== undefined && (typeof body.order !== 'number' || !Number.isInteger(body.order))) {
    errors.push({ field: 'order', message: 'order must be an integer.' })
  } else if (typeof body.order === 'number' && body.order < 0) {
    errors.push({ field: 'order', message: 'order must not be less than 0.' })
  }
  if (body.isVisible !== undefined && typeof body.isVisible !== 'boolean') {
    errors.push({ field: 'isVisible', message: 'isVisible must be a boolean.' })
  }
  if (body.translations !== undefined && !Array.isArray(body.translations)) {
    errors.push({ field: 'translations', message: 'translations must be an array.' })
  }

  if (Array.isArray(body.translations)) {
    body.translations.forEach((raw, index) => {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        errors.push({ field: `translations[${index}]`, message: 'translation must be an object.' })
        return
      }
      const entry = raw as TranslationInput
      for (const field of ['locale', 'quote', 'authorName', 'authorRole'] as const) {
        if (entry[field] === undefined) {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
        } else if (typeof entry[field] !== 'string') {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} must be a string.` })
        } else if (field === 'locale' && !/^[a-z]{2}$/.test(entry[field])) {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} must be a two-letter lowercase locale.` })
        } else if (field !== 'locale' && entry[field].length === 0) {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
        } else if (field === 'quote' && entry[field].length > 4000) {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} must be shorter than or equal to 4000 characters.` })
        } else if ((field === 'authorName' || field === 'authorRole') && entry[field].length > 160) {
          errors.push({ field: `translations[${index}].${field}`, message: `${field} must be shorter than or equal to 160 characters.` })
        }
      }
      for (const field of Object.keys(entry).filter(field => !['locale', 'quote', 'authorName', 'authorRole'].includes(field))) {
        errors.push({ field: `translations[${index}].${field}`, message: `property ${field} should not exist.` })
      }
    })
  }

  return errors
}

function applyWrite(target: SeedAdminTestimonial, body: WriteBody): void {
  if (body.avatarId !== undefined) target.avatarId = body.avatarId as string | null
  if (body.order !== undefined) target.order = body.order as number
  if (body.isVisible !== undefined) target.isVisible = body.isVisible as boolean
  for (const raw of Array.isArray(body.translations) ? body.translations : []) {
    const entry = raw as { locale: string, quote: string, authorName: string, authorRole: string }
    target.translations[entry.locale] = {
      quote: entry.quote,
      authorName: entry.authorName,
      authorRole: entry.authorRole
    }
  }
}

function nextId(): string {
  createdSequence += 1
  return `00000000-0000-4000-a300-${String(900000000000 + createdSequence).padStart(12, '0')}`
}

function validPathId(id: string): boolean {
  return UUID_PATTERN.test(id)
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    if (req.destroyed || res.writableEnded || res.destroyed) return
    try {
      problem(res, 500, 'Internal Error', error instanceof Error ? error.message : String(error))
    } catch {
      // The client disconnected between the guard and the response write.
    }
  })
})

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  if (path === '/__e2e/reset' && req.method === 'POST') {
    testimonials = seedTestimonials()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    createdSequence = 0
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: TestimonialBackendMode
      delayMs?: number
      failNextWrite?: boolean
      testimonials?: SeedAdminTestimonial[]
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.testimonials) testimonials = body.testimonials
    return json(res, 200, { ok: true, mode, delayMs })
  }

  if (path === `${API_PREFIX}/auth/login` && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as { email?: string, password?: string }
    if (!body.email || !body.password) return problem(res, 422, 'Validation failed')
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

  if (path.startsWith(`${API_PREFIX}/admin/testimonials`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      res.socket?.destroy()
      return
    }

    const rest = path.slice(`${API_PREFIX}/admin/testimonials`.length)

    if (rest === '' && url.searchParams.size > 0) {
      return problem(res, 422, 'Unprocessable Entity', 'Admin testimonials does not accept query parameters.')
    }

    if (delayMs > 0) await sleep(delayMs)

    if (rest === '' && req.method === 'GET') {
      const pool = mode === 'empty' ? [] : testimonials
      return json(res, 200, { data: pool.map(toEntity) })
    }

    if (rest === '' && req.method === 'POST') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = ownErrors(body)
      for (const field of ['order', 'isVisible', 'translations'] as const) {
        if (body[field] === undefined) errors.push({ field, message: `${field} should not be empty.` })
      }
      if (Array.isArray(body.translations) && body.translations.length === 0) {
        errors.push({ field: 'translations', message: 'translations must contain at least 1 elements.' })
      }
      errors.push(...validateWrite(body))
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }

      const created: SeedAdminTestimonial = {
        id: nextId(),
        avatarId: body.avatarId === undefined ? null : body.avatarId as string | null,
        order: body.order as number,
        isVisible: body.isVisible as boolean,
        translations: {}
      }
      applyWrite(created, body)
      testimonials.push(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/')) {
      const id = rest.slice(1)
      if (!validPathId(id)) return problem(res, 400, 'Bad Request', 'testimonial id must be a UUID.')

      if (req.method === 'PATCH') {
        if (failNextWrite) {
          failNextWrite = false
          return problem(res, 500, 'Save failed')
        }
        const target = testimonials.find(testimonial => testimonial.id === id)
        if (!target) return problem(res, 404, 'Not found')
        const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
        const errors = [...ownErrors(body), ...validateWrite(body)]
        if (Array.isArray(body.translations) && body.translations.length === 0) {
          errors.push({ field: 'translations', message: 'translations must contain at least 1 elements.' })
        }
        if (errors.length > 0) {
          return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
        }
        applyWrite(target, body)
        return json(res, 200, { data: toEntity(target) })
      }

      if (req.method === 'DELETE') {
        if (failNextWrite) {
          failNextWrite = false
          return problem(res, 500, 'Delete failed')
        }
        const target = testimonials.find(testimonial => testimonial.id === id)
        if (!target) return problem(res, 404, 'Not found')
        testimonials = testimonials.filter(testimonial => testimonial.id !== id)
        return noContent(res)
      }

      if (req.method === 'GET') {
        const target = testimonials.find(testimonial => testimonial.id === id)
        if (!target) return problem(res, 404, 'Not found')
        return json(res, 200, { data: toEntity(target) })
      }
    }
  }

  // Dashboard shell dependencies stay healthy in every Testimonials scenario.
  if (path === `${API_PREFIX}/settings/site`) {
    return json(res, 200, {
      data: { siteName: 'Eslam Muatamed', profileLinks: [], contactEmail: null, contactPhone: null }
    })
  }
  if (path.startsWith(`${API_PREFIX}/admin/messages`) && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    return json(res, 200, { data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } })
  }

  return problem(res, 404, 'Not found')
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1] as string) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isMain) {
  const port = Number(process.env.CI_MOCK_PORT ?? 4201)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[testimonials-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
