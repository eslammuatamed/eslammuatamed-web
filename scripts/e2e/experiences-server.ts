/**
 * Deterministic Experiences backend for the `dashboard-experiences` Playwright project
 * (FE-3 module 1).
 *
 * WHY AN ELEVENTH BACKEND RATHER THAN A SPEC IN THE ARTICLES LANE.
 * The same invariant that forced `articles-server.ts` into existence, unchanged: a mutable-backend
 * lane is serial only while it is ONE spec file, because `workers` is a top-level Playwright option
 * and `fullyParallel: false` serialises only WITHIN a file. A second mutable spec lands on a second
 * worker and the two reset each other's fixtures mid-assertion. `scripts/e2e/lanes.ts` now asserts
 * that from the registry, so this is not a judgement call per module — a `resetsBackendState: true`
 * lane owns exactly one spec file.
 *
 * ── WHAT THIS SHAPE HAS THAT ARTICLES DID NOT ───────────────────────────────────────────────────
 * Experiences is FE-3's SECOND CONSUMER (ledger §10.2), so what matters is where it DIFFERS from
 * Articles. Four differences are modelled here deliberately, because each one is a place a shared
 * abstraction could be wrong and a permissive mock would hide it:
 *
 * 1. NO PAGINATION ENVELOPE. `GET /admin/experiences` takes zero query parameters and answers
 *    `{ data: [...] }` with NO `meta` — verified against the committed contract. A mock that
 *    helpfully returned `meta` would let a collection built on Articles' paginated shape pass while
 *    reading a field the real API never sends.
 *
 * 2. `technologyIds` REPLACES THE FULL SET, and `[]` CLEARS IT — while `translations` UPSERTS and
 *    never deletes, and `endDate` clears on an explicit `null` (D10-23). THREE different clearing
 *    semantics in one save. The failure this exists to catch is silent: a form model that
 *    initialises `technologyIds: []` before the GET resolves, then saves, wipes the relation with
 *    no 422 and every gate green. So an OMITTED `technologyIds` key here PRESERVES, exactly as
 *    `experiences.service.ts` does (`if (dto.technologyIds !== undefined)`), and the discriminating
 *    spec is a no-touch save against `EXP.current`, which holds three skills.
 *
 * 3. A 422 WITHOUT A FIELD PATH. The real service rejects duplicate and unknown skill ids by
 *    throwing `UnprocessableEntityException` with a MESSAGE and no field array, unlike the
 *    class-validator failures that produce `errors[]` with `translations[N].<field>` paths. Both
 *    shapes are reproduced. An editor that only renders `errors[]` swallows the skills failure
 *    entirely, and the operator sees a save that silently did nothing.
 *
 * 4. `isCurrent` HAS NO SERVER BACKSTOP. The DTOs carry no cross-field rule — `endDate` is validated
 *    only as an optional date string. So "a current role cannot have an end date" is a DASHBOARD
 *    rule with nothing behind it, and this backend deliberately ACCEPTS the contradictory payload.
 *    Rejecting it would test the client's guard against a server rule that does not exist, which is
 *    the most flattering kind of green.
 *
 * ── ORDERING IS THE API'S, AND IT IS NOT `startDate` ─────────────────────────────────────────────
 * `compareExperiences` is transcribed from `experiences.service.ts`, including the production defect
 * its comment records: sorting by `startDate` alone ranked a role that started later but has already
 * ENDED above the role the owner still holds. The canonical order is CURRENT FIRST, then most-recent
 * `startDate`, then the owner-controlled `order`, then `id` to make the sort total. `EXP.endedLater`
 * exists purely so a Dashboard that re-sorts locally by `startDate` FAILS here rather than in
 * Production — which is what that defect did the first time.
 *
 * AUTH IS REAL ENOUGH TO BE HONEST, matching `articles-server.ts` and `dashboard-server.ts`: a
 * bearer token is required, and `forbidden` answers 403 so "you may not read this" stays
 * distinguishable from "empty" (D11-2).
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type ExperienceMode = 'ok' | 'empty' | 'error' | 'forbidden'
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE'

export interface SeedExperienceTranslation {
  role: string
  company: string
  location: string
  impact: string
}

export interface SeedExperience {
  id: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  employmentType: EmploymentType
  order: number
  technologyIds: string[]
  translations: Record<string, SeedExperienceTranslation>
}

/**
 * Fixture ids are REAL UUIDs for the reason `articles-server.ts` gives: the route-query contract
 * validates ids with `z.uuid()` and silently DROPS anything malformed, so a readable id would never
 * select anything and the spec would assert against an empty surface.
 */
export const EXP = {
  /**
   * CURRENT role, both locales, THREE skills. The no-touch-save fixture: load it, save without
   * touching the picker, and `technologyIds` must still be three.
   */
  current: '00000000-0000-4000-e000-000000000001',
  /** Ended role, both locales, ONE skill. */
  past: '00000000-0000-4000-e000-000000000002',
  /** ENGLISH ONLY — drives the translation-completeness indicator off a real gap. */
  enOnly: '00000000-0000-4000-e000-000000000003',
  /**
   * Started LATER than `current` but already ENDED. Ranks BELOW `current` under the API's order and
   * ABOVE it under a naive `startDate desc` — the exact production defect `compareExperiences`
   * records. A Dashboard that re-sorts locally fails on this fixture.
   */
  endedLater: '00000000-0000-4000-e000-000000000004',
  /** Zero skills, so "cleared to empty" stays distinguishable from "never had any". */
  noSkills: '00000000-0000-4000-e000-000000000005',
  /** A well-formed UUID deliberately absent from the fixtures — the 404 editor case. */
  absent: '00000000-0000-4000-e000-0000000000ff'
} as const

export const SKILL = {
  typescript: '00000000-0000-4000-f000-000000000001',
  vue: '00000000-0000-4000-f000-000000000002',
  nuxt: '00000000-0000-4000-f000-000000000003',
  postgres: '00000000-0000-4000-f000-000000000004',
  nest: '00000000-0000-4000-f000-000000000005'
} as const

/** A well-formed skill id that is NOT in the picker's options — provokes the pathless 422. */
export const UNKNOWN_SKILL = '00000000-0000-4000-f000-0000000000ff'

function seedExperiences(): SeedExperience[] {
  return [
    {
      id: EXP.current,
      startDate: '2025-01-15',
      endDate: null,
      isCurrent: true,
      employmentType: 'FULL_TIME',
      order: 0,
      technologyIds: [SKILL.typescript, SKILL.vue, SKILL.nuxt],
      translations: {
        en: {
          role: 'Senior Frontend Engineer',
          company: 'Findropica',
          location: 'Cairo, Egypt',
          impact: '- Rebuilt the design system.\n- Cut first-load JS by a third.'
        },
        ar: {
          role: 'مهندس واجهات أول',
          company: 'فايندروبيكا',
          location: 'القاهرة، مصر',
          impact: '- أعدت بناء نظام التصميم.\n- خفّضت حجم الجافاسكربت بالثلث.'
        }
      }
    },
    {
      id: EXP.past,
      startDate: '2022-03-01',
      endDate: '2024-12-31',
      isCurrent: false,
      employmentType: 'CONTRACT',
      order: 1,
      technologyIds: [SKILL.postgres],
      translations: {
        en: {
          role: 'Full-stack Engineer',
          company: 'Northwind Labs',
          location: 'Remote',
          impact: '- Shipped the billing rewrite.'
        },
        ar: {
          role: 'مهندس متكامل',
          company: 'مختبرات نورثويند',
          location: 'عن بُعد',
          impact: '- أطلقت إعادة كتابة نظام الفوترة.'
        }
      }
    },
    {
      id: EXP.enOnly,
      startDate: '2021-06-01',
      endDate: '2022-02-28',
      isCurrent: false,
      employmentType: 'PART_TIME',
      order: 2,
      technologyIds: [SKILL.vue],
      translations: {
        en: {
          role: 'Frontend Developer',
          company: 'Cairo Digital',
          location: 'Cairo, Egypt',
          impact: '- Maintained the marketing site.'
        }
      }
    },
    {
      id: EXP.endedLater,
      // Starts AFTER `current` and has ended. Naive `startDate desc` puts this first; the API does
      // not, because `isCurrent` leads.
      startDate: '2026-03-01',
      endDate: '2026-07-31',
      isCurrent: false,
      employmentType: 'FREELANCE',
      order: 3,
      technologyIds: [SKILL.nest],
      translations: {
        en: {
          role: 'Consulting Engineer',
          company: 'WaveX',
          location: 'Remote',
          impact: '- Delivered the migration audit.'
        },
        ar: {
          role: 'مهندس استشاري',
          company: 'ويف إكس',
          location: 'عن بُعد',
          impact: '- سلّمت تدقيق الترحيل.'
        }
      }
    },
    {
      id: EXP.noSkills,
      startDate: '2020-01-01',
      endDate: '2021-05-31',
      isCurrent: false,
      employmentType: 'FULL_TIME',
      order: 4,
      technologyIds: [],
      translations: {
        en: {
          role: 'Junior Developer',
          company: 'First Employer',
          location: 'Cairo, Egypt',
          impact: '- Learned in public.'
        },
        ar: {
          role: 'مطوّر مبتدئ',
          company: 'أول جهة عمل',
          location: 'القاهرة، مصر',
          impact: '- تعلّمت أمام الجميع.'
        }
      }
    }
  ]
}

interface SeedSkill {
  id: string
  slug: string
  group: string
  brandColor: string | null
  isPublic: boolean
  order: number
  translations: Record<string, { label: string }>
}

function seedSkills(): SeedSkill[] {
  return [
    { id: SKILL.typescript, slug: 'typescript', group: 'LANGUAGE', brandColor: '#3178c6', isPublic: true, order: 0, translations: { en: { label: 'TypeScript' }, ar: { label: 'تايب سكربت' } } },
    { id: SKILL.vue, slug: 'vue', group: 'FRAMEWORK', brandColor: '#42b883', isPublic: true, order: 1, translations: { en: { label: 'Vue' }, ar: { label: 'فيو' } } },
    { id: SKILL.nuxt, slug: 'nuxt', group: 'FRAMEWORK', brandColor: '#00dc82', isPublic: true, order: 2, translations: { en: { label: 'Nuxt' }, ar: { label: 'نكست' } } },
    { id: SKILL.postgres, slug: 'postgresql', group: 'DATABASE', brandColor: '#336791', isPublic: true, order: 3, translations: { en: { label: 'PostgreSQL' }, ar: { label: 'بوستجرس' } } },
    { id: SKILL.nest, slug: 'nestjs', group: 'FRAMEWORK', brandColor: '#e0234e', isPublic: false, order: 4, translations: { en: { label: 'NestJS' }, ar: { label: 'نست' } } }
  ]
}

/** Mutable per-process state. Reset between specs through `POST /__e2e/reset`. */
let experiences = seedExperiences()
const skills = seedSkills()
let mode: ExperienceMode = 'ok'
/**
 * Milliseconds every `/admin/experiences*` response is held open for.
 *
 * Zero by default, for the reason `articles-server.ts` gives: a lane paying this on every request
 * would be slow for no benefit, and a spec that needs to SEE a pending state should say so.
 */
let delayMs = 0
/** Makes one write fail with a server error, to prove a failed save preserves the operator's input. */
let failNextWrite = false

const OWNER = { id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f', email: 'owner@example.com', role: { name: 'OWNER' } }
const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE']

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

/**
 * RFC 7807. `errors[]` is present ONLY where the real API produces it — class-validator failures on
 * the DTO. The skills rejections deliberately omit it, because `assertSkillIds` throws a bare
 * `UnprocessableEntityException(message)`; see the header, point 3.
 */
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

/**
 * Transcribed from `experiences.service.ts#compareExperiences`, defect note and all: CURRENT FIRST,
 * then most-recent `startDate`, then the owner-controlled `order`, then `id` for a TOTAL sort.
 * Sorting by `startDate` alone is the bug that shipped once; `EXP.endedLater` reproduces it.
 */
function compareExperiences(a: SeedExperience, b: SeedExperience): number {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
  return (
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    || a.order - b.order
    || a.id.localeCompare(b.id)
  )
}

function toEntity(row: SeedExperience) {
  const translations: Record<string, unknown> = {}
  for (const [locale, value] of Object.entries(row.translations)) translations[locale] = { ...value }
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    employmentType: row.employmentType,
    order: row.order,
    technologyIds: [...row.technologyIds],
    translations
  }
}

interface TranslationInput {
  locale?: string
  role?: string
  company?: string
  location?: string
  impact?: string
}

interface WriteBody {
  startDate?: string
  endDate?: string | null
  isCurrent?: boolean
  employmentType?: EmploymentType
  order?: number
  technologyIds?: string[]
  translations?: TranslationInput[]
}

/** The DTO's own limits, so a client-side max that disagrees with the server is visible. */
const MAX_LENGTH = { role: 160, company: 160, location: 160, impact: 8000 } as const

/**
 * Class-validator-shaped failures ONLY — the ones the real API answers with `errors[]` and a
 * `translations[N].<field>` path. N is the index in the array the CLIENT sent, which is what makes
 * this a genuine test of the Dashboard's index→locale mapping: the read shape is a locale-KEYED map
 * and the write shape is an ARRAY, so a hard-coded index would let a broken mapping pass.
 *
 * Deliberately NOT validated here, because the real DTOs do not: `isCurrent` against `endDate`.
 * See the header, point 4.
 */
function validateWrite(body: WriteBody): Array<{ field: string, message: string }> {
  const errors: Array<{ field: string, message: string }> = []

  if (body.startDate !== undefined && Number.isNaN(new Date(body.startDate).getTime())) {
    errors.push({ field: 'startDate', message: 'startDate must be a valid ISO 8601 date string.' })
  }
  if (body.endDate !== undefined && body.endDate !== null && Number.isNaN(new Date(body.endDate).getTime())) {
    errors.push({ field: 'endDate', message: 'endDate must be a valid ISO 8601 date string.' })
  }
  if (body.employmentType !== undefined && !EMPLOYMENT_TYPES.includes(body.employmentType)) {
    errors.push({ field: 'employmentType', message: `employmentType must be one of: ${EMPLOYMENT_TYPES.join(', ')}.` })
  }
  if (body.order !== undefined && (!Number.isInteger(body.order) || body.order < 0)) {
    errors.push({ field: 'order', message: 'order must be an integer no less than 0.' })
  }

  ;(body.translations ?? []).forEach((entry, index) => {
    if (!entry.locale || !/^[a-z]{2}$/.test(entry.locale)) {
      errors.push({ field: `translations[${index}].locale`, message: 'locale is required.' })
      return
    }
    // All four are REQUIRED by the contract — there is no half-authored locale on this entity, which
    // is what makes it a different second shape from Articles rather than a copy of it.
    for (const field of ['role', 'company', 'location', 'impact'] as const) {
      const value = entry[field]
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
      } else if (value.length > MAX_LENGTH[field]) {
        errors.push({
          field: `translations[${index}].${field}`,
          message: `${field} must be shorter than or equal to ${MAX_LENGTH[field]} characters.`
        })
      }
    }
  })

  return errors
}

/**
 * The skills rejections, kept separate because their SHAPE is different: a message and no field
 * path. Returns the detail string, or `null` when the ids are acceptable.
 *
 * Mirrors `assertSkillIds`: `undefined` and `[]` are both fine — an empty array is a deliberate
 * clear, not a failure — duplicates are rejected rather than de-duplicated, and unknown ids are
 * rejected up front so the caller gets a validation failure rather than an FK violation.
 */
function validateSkillIds(ids?: string[]): string | null {
  if (ids === undefined || ids.length === 0) return null
  const unique = new Set(ids)
  if (unique.size !== ids.length) return 'technologyIds must not contain duplicate skill ids.'
  const known = new Set(skills.map(s => s.id))
  const missing = ids.filter(id => !known.has(id))
  if (missing.length > 0) return `technologyIds reference unknown skills: ${missing.join(', ')}.`
  return null
}

/**
 * THE THREE CLEARING SEMANTICS, each modelled exactly as `experiences.service.ts` implements it.
 * They differ from one another on purpose and a permissive mock would hide the difference:
 *
 * - `endDate` — an explicit `null` CLEARS, an omitted key PRESERVES (D10-23).
 * - `technologyIds` — REPLACES the whole set when present, `[]` clears it, omitted PRESERVES.
 * - `translations` — UPSERT per locale, NEVER deletes. An omitted locale keeps what is stored,
 *   which is why the editor must send every complete locale and not only the tab being edited.
 */
function applyWrite(target: SeedExperience, body: WriteBody): void {
  if (body.startDate !== undefined) target.startDate = body.startDate
  if (body.endDate !== undefined) target.endDate = body.endDate
  if (body.isCurrent !== undefined) target.isCurrent = body.isCurrent
  if (body.employmentType !== undefined) target.employmentType = body.employmentType
  if (body.order !== undefined) target.order = body.order
  if (body.technologyIds !== undefined) target.technologyIds = [...body.technologyIds]
  for (const entry of body.translations ?? []) {
    if (!entry.locale) continue
    const existing = target.translations[entry.locale]
    target.translations[entry.locale] = {
      role: entry.role ?? existing?.role ?? '',
      company: entry.company ?? existing?.company ?? '',
      location: entry.location ?? existing?.location ?? '',
      impact: entry.impact ?? existing?.impact ?? ''
    }
  }
}

function skillEntities() {
  return skills.map(skill => ({
    id: skill.id,
    slug: skill.slug,
    group: skill.group,
    brandColor: skill.brandColor,
    isPublic: skill.isPublic,
    order: skill.order,
    translations: Object.fromEntries(
      Object.entries(skill.translations).map(([locale, value]) => [locale, { ...value }])
    )
  }))
}

/**
 * ⚠ THE HANDLER IS WRAPPED, BECAUSE AN `async` LISTENER'S REJECTION KILLS THE PROCESS.
 *
 * `http.createServer(async …)` hands Node a promise nobody awaits. When a client disconnects
 * mid-request Node aborts the incoming message and the pending handler rejects with
 * `Error: aborted` (`ECONNRESET`) — an UNHANDLED REJECTION, which Node v24 turns into an uncaught
 * exception and exits 1 on. The lane then loses its backend and every remaining test fails with
 * `ECONNREFUSED`, which reads as eleven broken tests rather than one dead server.
 *
 * `M1·U3` is what exposed it: the editor's successful DELETE navigates away via `router.replace`
 * while the shell's reads are still in flight, so the browser really does abort requests. The
 * collection never did that, which is why ten green runs said nothing about it.
 *
 * An aborted request is not a server fault and gets no response — there is no socket left to write
 * to. Anything else is reported as a 500 so a genuine handler bug stays visible instead of being
 * swallowed by this guard.
 *
 * ⚠ THE OTHER e2e BACKENDS HAVE THE SAME SHAPE and are NOT fixed here — `articles-server.ts` and
 * its siblings are other lanes' instruments, and changing them without re-running their lanes would
 * be an unverified edit. Recorded in the ledger as a finding instead.
 */
const server = http.createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    if (req.destroyed || res.writableEnded || res.destroyed) return
    try {
      problem(res, 500, 'Internal Error', error instanceof Error ? error.message : String(error))
    } catch {
      // The socket went away between the check above and the write. Nothing to report it on.
    }
  })
})

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  // ── test control plane ───────────────────────────────────────────────────────────────────────
  if (path === '/__e2e/reset' && req.method === 'POST') {
    experiences = seedExperiences()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: ExperienceMode
      delayMs?: number
      failNextWrite?: boolean
      experiences?: SeedExperience[]
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.experiences) experiences = body.experiences
    return json(res, 200, { ok: true, mode, delayMs })
  }

  // ── auth ─────────────────────────────────────────────────────────────────────────────────────
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

  // ── admin skills — the picker's option source, READ-ONLY here ────────────────────────────────
  // Unpaginated, exactly as the contract declares it (zero query parameters). Read-only because
  // Skills is FE-3 module 2: this lane must not become the place the Skills module is designed.
  if (path === `${API_PREFIX}/admin/skills` && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (delayMs > 0) await sleep(delayMs)
    return json(res, 200, { data: skillEntities() })
  }

  // ── admin experiences ────────────────────────────────────────────────────────────────────────
  if (path.startsWith(`${API_PREFIX}/admin/experiences`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      // A transport-level failure: destroy the socket so the client sees a real network error
      // rather than a well-formed error body it might render differently.
      res.socket?.destroy()
      return
    }

    // THE HOLD. Reads and writes alike — a held GET is what makes a skeleton or a refresh overlay
    // observable, and a held POST/PATCH is the only condition under which duplicate-submission
    // prevention is actually exercised.
    if (delayMs > 0) await sleep(delayMs)

    const rest = path.slice(`${API_PREFIX}/admin/experiences`.length)

    if (rest === '' && req.method === 'POST') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const missing: Array<{ field: string, message: string }> = []
      // Required on CREATE only — `UpdateExperienceDto` requires nothing.
      if (body.startDate === undefined) missing.push({ field: 'startDate', message: 'startDate should not be empty.' })
      if (body.isCurrent === undefined) missing.push({ field: 'isCurrent', message: 'isCurrent should not be empty.' })
      if (body.employmentType === undefined) missing.push({ field: 'employmentType', message: 'employmentType should not be empty.' })
      if (body.order === undefined) missing.push({ field: 'order', message: 'order should not be empty.' })
      if (!body.translations || body.translations.length === 0) {
        missing.push({ field: 'translations', message: 'At least one locale translation is required.' })
      }
      const errors = [...missing, ...validateWrite(body)]
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      // Skills are checked AFTER the field errors, matching the service's order, and answer without
      // a field path — see the header, point 3.
      const skillsDetail = validateSkillIds(body.technologyIds)
      if (skillsDetail) return problem(res, 422, 'Unprocessable Entity', skillsDetail)

      const created: SeedExperience = {
        id: `00000000-0000-4000-e000-0000000009${String(experiences.length).padStart(2, '0')}`,
        startDate: body.startDate as string,
        endDate: body.endDate ?? null,
        isCurrent: body.isCurrent as boolean,
        employmentType: body.employmentType as EmploymentType,
        order: body.order as number,
        technologyIds: [...(body.technologyIds ?? [])],
        translations: {}
      }
      applyWrite(created, body)
      experiences.push(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/') && req.method === 'PATCH') {
      const id = rest.slice(1)
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const target = experiences.find(e => e.id === id)
      if (!target) return problem(res, 404, 'Not found')
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = validateWrite(body)
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      const skillsDetail = validateSkillIds(body.technologyIds)
      if (skillsDetail) return problem(res, 422, 'Unprocessable Entity', skillsDetail)
      applyWrite(target, body)
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest.startsWith('/') && req.method === 'DELETE') {
      const id = rest.slice(1)
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Delete failed')
      }
      if (!experiences.some(e => e.id === id)) return problem(res, 404, 'Not found')
      experiences = experiences.filter(e => e.id !== id)
      return noContent(res)
    }

    if (rest.startsWith('/') && req.method === 'GET') {
      const target = experiences.find(e => e.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest === '' && req.method === 'GET') {
      // NO `meta`. The contract declares `{ data: [...] }` and zero query parameters; a mock that
      // volunteered a pagination envelope would let a collection read a field that does not exist.
      const pool = mode === 'empty' ? [] : experiences
      return json(res, 200, { data: [...pool].sort(compareExperiences).map(toEntity) })
    }
  }

  // The dashboard shell must stay healthy in every scenario; a failing shell would mean the
  // accessibility and recovery assertions were measuring a different page than the one under test.
  if (path === `${API_PREFIX}/settings/site`) {
    return json(res, 200, { data: { siteName: 'Eslam Muatamed', profileLinks: [], contactEmail: null, contactPhone: null } })
  }
  // The shell's unread badge reads this on every dashboard route; an unanswered call would put an
  // error surface in the chrome of every Experiences assertion.
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
  const port = Number(process.env.CI_MOCK_PORT ?? 4101)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[experiences-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
