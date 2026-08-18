/**
 * Deterministic Skills backend for the future `dashboard-skills` Playwright project
 * (FE-3 module 2, M2·U1).
 *
 * WHY A SEPARATE MUTABLE BACKEND.
 * The same invariant `experiences-server.ts` records applies unchanged: a mutable Playwright lane is
 * serial only while it owns ONE spec file. Skills create/update/delete operations change what later
 * reads return, and the control plane resets that state between tests. U1 deliberately creates only
 * the instrument and its calibration; the lane record cannot land before U2 creates the browser spec
 * directory that justifies it.
 *
 * ── THE CONTRACT SHAPE THIS INSTRUMENT ENFORCES ────────────────────────────────────────────────
 *
 * 1. ADMIN READS RETURN A MAP; WRITES TAKE AN ARRAY. `AdminSkillEntity.translations` is keyed by
 *    locale, while `Create/UpdateSkillDto.translations` is an array of `{ locale, label }`. Field
 *    failures therefore carry CLIENT-array paths such as `translations[0].label`.
 *
 * 2. CREATE AND PATCH ARE NOT THE SAME DTO. Create requires `slug`, `group`, `order` and
 *    `translations`. Patch makes every declared property optional and does NOT declare `slug`, so a
 *    PATCH carrying it is rejected instead of being silently accepted or ignored.
 *
 * 3. `brandColor` HAS D10-23 SEMANTICS. Omission preserves; explicit `null` clears. The contract
 *    declares only `string | null`: this backend deliberately accepts non-hex strings and does not
 *    invent a colour-format validator. Likewise, `order` is only `number`; negative and fractional
 *    values are accepted because integer/nonnegative is an Experiences rule, not a Skills rule.
 *
 * 4. TWO 422 SHAPES ARE REAL. DTO field failures answer RFC 7807 with indexed `errors[]`. A
 *    UUID-shaped slug is rejected by a rule the OpenAPI regex cannot express and answers a
 *    detail-only problem with NO `errors` array. An editor that assumes every 422 is field-addressed
 *    will swallow the latter.
 *
 * 5. THE LIST IS WHOLE. `GET /admin/skills` accepts no query parameters and answers `{ data }` with
 *    no `meta`. An unsolicited query key receives 422, matching `forbidNonWhitelisted`; a permissive
 *    mock that ignored `?locale=` would conceal an admin call missing `locale: false`.
 *
 * ── A DOCUMENTED LIMIT THIS INSTRUMENT CANNOT DISCOVER FOR ITSELF ─────────────────────────────────────
 * DELETE models ONLY the contract's stated conflict: "Skill is linked to a project." A project-linked
 * skill returns 409. Experience linkage does NOT block deletion here, because the contract does not
 * say that it does. If the real backend also blocks experience-linked deletion, this instrument is
 * wrong in a way its own tests cannot reveal; that limit is written here rather than guessed around.
 *
 * `isPublic: false` never destroys either relation. Links are fixture-only state, intentionally not
 * volunteered in `AdminSkillEntity`; `/__e2e/links/:id` lets the calibration inspect that internal
 * invariant without widening the API response the Dashboard consumes.
 *
 * AUTH AND FAILURE STATES match the established authoring instruments: bearer auth, distinct 403,
 * empty and transport-error modes, a one-shot write failure, a controllable hold for reads/writes,
 * and a reset that restores every mutable fixture and control flag.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type SkillBackendMode = 'ok' | 'empty' | 'error' | 'forbidden'
export type AdminSkillGroup = 'LANGUAGE' | 'FRONTEND' | 'BACKEND' | 'DELIVERY'

export interface SeedAdminSkillTranslation {
  label: string
}

export interface SeedAdminSkill {
  id: string
  slug: string
  group: AdminSkillGroup
  order: number
  brandColor: string | null
  isPublic: boolean
  translations: Record<string, SeedAdminSkillTranslation>
  /** Fixture-only relations: neither belongs to `AdminSkillEntity`. */
  projectIds: string[]
  experienceIds: string[]
}

export const SKILL_IDS = {
  typescript: '00000000-0000-4000-f100-000000000001',
  vue: '00000000-0000-4000-f100-000000000002',
  nest: '00000000-0000-4000-f100-000000000003',
  delivery: '00000000-0000-4000-f100-000000000004',
  experienceOnly: '00000000-0000-4000-f100-000000000005',
  absent: '00000000-0000-4000-f100-0000000000ff'
} as const

/** Satisfies the kebab-case regex, but the contract separately reserves UUID-shaped slugs. */
export const UUID_SHAPED_SLUG = '123e4567-e89b-12d3-a456-426614174000'

const PROJECT = {
  portfolio: '00000000-0000-4000-a100-000000000001'
} as const

const EXPERIENCE = {
  current: '00000000-0000-4000-e100-000000000001'
} as const

function seedSkills(): SeedAdminSkill[] {
  return [
    {
      id: SKILL_IDS.typescript,
      slug: 'typescript',
      group: 'LANGUAGE',
      order: 0,
      brandColor: '#3178C6',
      isPublic: true,
      translations: { en: { label: 'TypeScript' }, ar: { label: 'تايب سكربت' } },
      projectIds: [PROJECT.portfolio],
      experienceIds: [EXPERIENCE.current]
    },
    {
      id: SKILL_IDS.vue,
      slug: 'vue',
      group: 'FRONTEND',
      order: 1.5,
      brandColor: '#42B883',
      isPublic: true,
      translations: { en: { label: 'Vue' }, ar: { label: 'فيو' } },
      projectIds: [],
      experienceIds: [EXPERIENCE.current]
    },
    {
      id: SKILL_IDS.nest,
      slug: 'nestjs',
      group: 'BACKEND',
      order: -2,
      brandColor: 'brand-token-nest',
      isPublic: false,
      translations: { en: { label: 'NestJS' }, ar: { label: 'نست' } },
      projectIds: [],
      experienceIds: []
    },
    {
      id: SKILL_IDS.delivery,
      slug: 'continuous-delivery',
      group: 'DELIVERY',
      order: 3,
      brandColor: null,
      isPublic: true,
      translations: { en: { label: 'Continuous delivery' } },
      projectIds: [],
      experienceIds: []
    },
    {
      id: SKILL_IDS.experienceOnly,
      slug: 'mentoring',
      group: 'DELIVERY',
      order: 4,
      brandColor: null,
      isPublic: true,
      translations: { en: { label: 'Mentoring' }, ar: { label: 'الإرشاد' } },
      projectIds: [],
      experienceIds: [EXPERIENCE.current]
    }
  ]
}

let skills = seedSkills()
let mode: SkillBackendMode = 'ok'
/** Milliseconds every `/admin/skills*` read or write is held open for. */
let delayMs = 0
/** Makes exactly one POST/PATCH/DELETE fail, then resets itself. */
let failNextWrite = false
let createdSequence = 0

const OWNER = {
  id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  email: 'owner@example.com',
  role: { name: 'OWNER' }
}

const GROUPS: readonly AdminSkillGroup[] = ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY']
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_SHAPED_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CREATE_FIELDS = new Set(['slug', 'group', 'order', 'brandColor', 'isPublic', 'translations'])
const UPDATE_FIELDS = new Set(['group', 'order', 'brandColor', 'isPublic', 'translations'])

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

function toEntity(row: SeedAdminSkill) {
  return {
    id: row.id,
    slug: row.slug,
    group: row.group,
    order: row.order,
    brandColor: row.brandColor,
    isPublic: row.isPublic,
    translations: Object.fromEntries(
      Object.entries(row.translations).map(([locale, value]) => [locale, { ...value }])
    )
  }
}

interface TranslationInput {
  locale?: unknown
  label?: unknown
}

interface WriteBody {
  slug?: unknown
  group?: unknown
  order?: unknown
  brandColor?: unknown
  isPublic?: unknown
  translations?: unknown
  [key: string]: unknown
}

function ownErrors(body: WriteBody, allowed: ReadonlySet<string>): Array<{ field: string, message: string }> {
  return Object.keys(body)
    .filter(field => !allowed.has(field))
    .map(field => ({ field, message: `property ${field} should not exist.` }))
}

function validateWrite(body: WriteBody): Array<{ field: string, message: string }> {
  const errors: Array<{ field: string, message: string }> = []

  if (body.slug !== undefined && (typeof body.slug !== 'string' || !SLUG_PATTERN.test(body.slug))) {
    errors.push({ field: 'slug', message: 'slug must be lowercase kebab-case.' })
  }
  if (body.group !== undefined && (typeof body.group !== 'string' || !GROUPS.includes(body.group as AdminSkillGroup))) {
    errors.push({ field: 'group', message: `group must be one of: ${GROUPS.join(', ')}.` })
  }
  // No integer/minimum rule: the contract declares only `number`.
  if (body.order !== undefined && typeof body.order !== 'number') {
    errors.push({ field: 'order', message: 'order must be a number.' })
  }
  // No hex rule: the contract declares only nullable string.
  if (body.brandColor !== undefined && body.brandColor !== null && typeof body.brandColor !== 'string') {
    errors.push({ field: 'brandColor', message: 'brandColor must be a string or null.' })
  }
  if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
    errors.push({ field: 'isPublic', message: 'isPublic must be a boolean.' })
  }
  if (body.translations !== undefined && !Array.isArray(body.translations)) {
    errors.push({ field: 'translations', message: 'translations must be an array.' })
  }

  if (Array.isArray(body.translations)) {
    body.translations.forEach((raw, index) => {
      const entry = raw as TranslationInput
      if (typeof entry !== 'object' || entry === null) {
        errors.push({ field: `translations[${index}]`, message: 'translation must be an object.' })
        return
      }
      if (typeof entry.locale !== 'string' || entry.locale.trim() === '') {
        errors.push({ field: `translations[${index}].locale`, message: 'locale should not be empty.' })
      }
      if (typeof entry.label !== 'string' || entry.label.trim() === '') {
        errors.push({ field: `translations[${index}].label`, message: 'label should not be empty.' })
      }
    })
  }

  return errors
}

function applyWrite(target: SeedAdminSkill, body: WriteBody): void {
  if (body.group !== undefined) target.group = body.group as AdminSkillGroup
  if (body.order !== undefined) target.order = body.order as number
  if (body.brandColor !== undefined) target.brandColor = body.brandColor as string | null
  if (body.isPublic !== undefined) target.isPublic = body.isPublic as boolean
  for (const raw of Array.isArray(body.translations) ? body.translations : []) {
    const entry = raw as { locale: string, label: string }
    target.translations[entry.locale] = { label: entry.label }
  }
}

function nextId(): string {
  createdSequence += 1
  return `00000000-0000-4000-f100-${String(900000000000 + createdSequence).padStart(12, '0')}`
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

  // ── test control plane ─────────────────────────────────────────────────────────────────────────────────────
  if (path === '/__e2e/reset' && req.method === 'POST') {
    skills = seedSkills()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    createdSequence = 0
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: SkillBackendMode
      delayMs?: number
      failNextWrite?: boolean
      skills?: SeedAdminSkill[]
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.skills) skills = body.skills
    return json(res, 200, { ok: true, mode, delayMs })
  }
  if (path.startsWith('/__e2e/links/') && req.method === 'GET') {
    const target = skills.find(skill => skill.id === path.slice('/__e2e/links/'.length))
    if (!target) return problem(res, 404, 'Not found')
    return json(res, 200, {
      projectIds: [...target.projectIds],
      experienceIds: [...target.experienceIds]
    })
  }

  // ── auth ───────────────────────────────────────────────────────────────────────────────────────────────
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

  // ── admin skills ────────────────────────────────────────────────────────────────────────────────────────────────
  if (path.startsWith(`${API_PREFIX}/admin/skills`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      res.socket?.destroy()
      return
    }

    const rest = path.slice(`${API_PREFIX}/admin/skills`.length)

    // There is no admin list-query DTO. In particular, `?locale=` is not harmless.
    if (rest === '' && url.searchParams.size > 0) {
      return problem(res, 422, 'Unprocessable Entity', 'Admin skills does not accept query parameters.')
    }

    // THE HOLD covers every entity read and mutation. Without it loading and double-submit tests are
    // assertions against states too brief to observe.
    if (delayMs > 0) await sleep(delayMs)

    if (rest === '' && req.method === 'GET') {
      const pool = mode === 'empty' ? [] : skills
      return json(res, 200, { data: pool.map(toEntity) })
    }

    if (rest === '' && req.method === 'POST') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = ownErrors(body, CREATE_FIELDS)
      for (const field of ['slug', 'group', 'order', 'translations'] as const) {
        if (body[field] === undefined) errors.push({ field, message: `${field} should not be empty.` })
      }
      errors.push(...validateWrite(body))
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      if (UUID_SHAPED_PATTERN.test(body.slug as string)) {
        return problem(
          res,
          422,
          'Unprocessable Entity',
          'slug must not be shaped like a UUID because that form is reserved for the legacy technology filter.'
        )
      }
      if (skills.some(skill => skill.slug === body.slug)) {
        return problem(res, 422, 'Unprocessable Entity', `Skill slug '${String(body.slug)}' already exists.`)
      }

      const created: SeedAdminSkill = {
        id: nextId(),
        slug: body.slug as string,
        group: body.group as AdminSkillGroup,
        order: body.order as number,
        brandColor: body.brandColor === undefined ? null : body.brandColor as string | null,
        isPublic: body.isPublic === undefined ? true : body.isPublic as boolean,
        translations: {},
        projectIds: [],
        experienceIds: []
      }
      applyWrite(created, body)
      skills.push(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/') && req.method === 'PATCH') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const target = skills.find(skill => skill.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = [...ownErrors(body, UPDATE_FIELDS), ...validateWrite(body)]
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      applyWrite(target, body)
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest.startsWith('/') && req.method === 'DELETE') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Delete failed')
      }
      const id = rest.slice(1)
      const target = skills.find(skill => skill.id === id)
      if (!target) return problem(res, 404, 'Not found')
      if (target.projectIds.length > 0) {
        return problem(res, 409, 'Conflict', 'Skill is linked to a project.')
      }
      skills = skills.filter(skill => skill.id !== id)
      return noContent(res)
    }

    if (rest.startsWith('/') && req.method === 'GET') {
      const target = skills.find(skill => skill.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      return json(res, 200, { data: toEntity(target) })
    }
  }

  // Dashboard shell dependencies stay healthy in every Skills scenario.
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
    console.log(`[skills-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
