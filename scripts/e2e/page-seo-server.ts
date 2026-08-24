/**
 * Deterministic Static Page SEO backend (FR-DSH-051) for FE4-U1 — the CONTRACT INSTRUMENT ONLY,
 * created before any Dashboard UI exists (same shape as Skills M2·U1, Testimonials T·U1 and
 * Taxonomy U1; the lane record belongs to the later browser-spec unit).
 *
 * Every behaviour below was re-derived from the adopted `openapi/openapi.json` (blob `185f067e…`,
 * byte-identical to API main/dev), not invented:
 *
 * - THE KEY SET IS CLOSED (D09-24). Exactly seven static pages exist — home, about, experience,
 *   projects, blog, resume, contact — and they are PAGE KEYS, never ids or slugs. An unknown key
 *   answers 422 on BOTH admin routes ("Unknown static page key"), while the PUBLIC route reserves
 *   404 for exactly that case so "nothing authored" and "no such page" stay distinguishable.
 * - ADMIN LIST. `{ data: AdminPageSeoEntity[] }` with ZERO declared query parameters and no
 *   pagination/filter/sort contract anywhere in the document. One entry per known page key, each
 *   carrying EVERY enabled locale — an unauthored locale arrives ALL-NULL so a future editor tab
 *   can render. No ordering is documented in the contract, so the instrument asserts completeness
 *   by SET, never by position, and consumers must look entries up BY KEY rather than by index.
 * - ADMIN DETAIL. `GET /admin/seo/pages/{pageKey}` returns the same whole map for one page.
 * - PATCH UPSERT (D10-23 inside D09-24). Locales present in the body are upserted; locales absent
 *   from it are untouched — there is no replace-all and no delete-locale. Within a supplied
 *   locale, an omitted FIELD key preserves the stored value, an explicit `null` clears it, and a
 *   non-null value replaces it. All locales apply in ONE transaction, so validation happens
 *   before any write.
 * - ERROR CLASSES ARE DISTINCT ON PATCH. Unknown/disabled LOCALE answers 400; unknown PAGE KEY,
 *   malformed FIELDS (including a canonicalUrl that is not an absolute URI and an ogImageId that
 *   is not a UUID), and an ogImageId that is MISSING or NOT AN IMAGE all answer 422.
 * - OG IMAGES reference the media registry by MediaAsset id and must be IMAGE-kind; the asset is
 *   RESTRICT-referenced while set (deletion governance lives in the media module, not here). The
 *   embedded registry below is fixture vocabulary only — no upload, no picker, no media endpoints.
 * - PUBLIC READ IS AN OVERRIDE LAYER, NOT A CONTENT RECORD (D10-24). A known page key with
 *   nothing authored for the requested locale returns 200 with every field null — the caller
 *   falls back to site defaults. There is NO cross-locale fallback (D10-6): authoring EN never
 *   bleeds into an AR read. The public route shares the SAME in-process state as the admin
 *   routes, so an admin PATCH is immediately observable publicly — the coherence FE4-U2 will
 *   depend on. It resolves `ogImage` from the same registry, with `alt` being the ASSET-LEVEL
 *   localized default for the requested locale (null = untranslated, "" = decorative).
 *
 * Deliberately OUT of scope: FR-DSH-052 global head/tags fields (googleSiteVerification,
 * bingSiteVerification, analyticsEnabled, gtmContainerId, customMetas — those live on Settings,
 * and this instrument's DTO boundary actively REJECTS them), Article/Project SEO persistence
 * (embedded translation rows, completed in FE-3), auth surface beyond what the Dashboard shell
 * needs, and rate limiting beyond the established mode flags.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

/** The adopted closed static-page vocabulary (D09-24). Never extend it here. */
export const PAGE_KEYS = ['home', 'about', 'experience', 'projects', 'blog', 'resume', 'contact'] as const

export type PageKey = (typeof PAGE_KEYS)[number]

/** The locales this campaign enables everywhere else; the contract validates against enabled locales. */
export const ENABLED_LOCALES = ['en', 'ar'] as const

export type EnabledLocale = (typeof ENABLED_LOCALES)[number]

export type PageSeoBackendMode = 'ok' | 'error' | 'forbidden'

/** The four per-locale SEO fields, exactly as `PageSeoTranslationEntity` declares them. */
export interface SeoFields {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageId: string | null
}

export type SeoLocaleState = Partial<Record<EnabledLocale, SeoFields>>

/**
 * Fixture media vocabulary — the smallest registry that lets the instrument prove the ogImageId
 * rules WITHOUT building any media surface. Two IMAGE assets give clear/replacement targets, the
 * PDF proves the kind restriction, and the well-formed absent UUID proves the missing-asset case.
 */
export interface SeedMediaAsset {
  id: string
  kind: 'IMAGE' | 'PDF'
  /** Asset-level alt per locale; absent locale = untranslated (public `alt: null`). */
  alts: Partial<Record<EnabledLocale, string>>
}

export const OG_ASSET = {
  hero: '00000000-0000-4000-b100-000000000001',
  spare: '00000000-0000-4000-b100-000000000002',
  pdf: '00000000-0000-4000-b100-0000000000f1',
  absent: '00000000-0000-4000-b199-0000000000ff'
} as const

function seedAssets(): SeedMediaAsset[] {
  return [
    {
      id: OG_ASSET.hero,
      kind: 'IMAGE',
      alts: { en: 'About page social card', ar: 'بطاقة صفحة نبذة' }
    },
    { id: OG_ASSET.spare, kind: 'IMAGE', alts: {} },
    { id: OG_ASSET.pdf, kind: 'PDF', alts: {} }
  ]
}

/**
 * Seeds give every proof immediate discriminating data without setup: `about` is fully authored
 * in BOTH locales, `blog` is AR-only, and everything else is untouched. The remaining five pages
 * therefore start in the exact "known but unauthored" state the public nullable-success rule and
 * a future editor's empty tab must render.
 */
function seedPages(): Record<PageKey, SeoLocaleState> {
  return {
    home: {},
    about: {
      en: {
        metaTitle: 'About — Eslam Muatamed',
        metaDescription: 'Engineering background, philosophy, and current focus.',
        canonicalUrl: 'https://eslammuatamed.com/about',
        ogImageId: OG_ASSET.hero
      },
      ar: {
        metaTitle: 'نبذة — إسلام معتمد',
        metaDescription: 'الخلفية الهندسية والفلسفة والتركيز الحالي.',
        canonicalUrl: 'https://eslammuatamed.com/ar/about',
        ogImageId: OG_ASSET.hero
      }
    },
    experience: {},
    projects: {},
    blog: {
      ar: {
        metaTitle: 'المدونة — إسلام معتمد',
        metaDescription: 'مقالات عن الهندسة والحِرفة.',
        canonicalUrl: 'https://eslammuatamed.com/ar/blog',
        ogImageId: null
      }
    },
    resume: {},
    contact: {}
  }
}

let pages = seedPages()
let assets = seedAssets()
let mode: PageSeoBackendMode = 'ok'
let delayMs = 0
let failNextWrite = false

const OWNER = {
  id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  email: 'owner@example.com',
  role: { name: 'OWNER' }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ABSOLUTE_URI_PATTERN = /^https?:\/\/\S+\.\S+/i

const NULL_FIELDS: SeoFields = {
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  ogImageId: null
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,PATCH,POST,OPTIONS',
    ...headers
  })
  res.end(JSON.stringify(body))
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

/** Admin read shape: EVERY enabled locale present, all-null when unauthored. */
function toAdminEntity(pageKey: PageKey) {
  return {
    pageKey,
    translations: Object.fromEntries(
      ENABLED_LOCALES.map(locale => [locale, { ...(pages[pageKey][locale] ?? NULL_FIELDS) }])
    )
  }
}

function resolveOgImage(ogImageId: string, locale: EnabledLocale) {
  const asset = assets.find(candidate => candidate.id === ogImageId)
  if (!asset || asset.kind !== 'IMAGE') return null
  return {
    id: asset.id,
    kind: asset.kind,
    url: `http://127.0.0.1:0/media/${asset.id}/1200-webp.webp`,
    width: 1200,
    height: 630,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    // The asset-level localized default for the REQUESTED locale: null = untranslated, "" = decorative.
    alt: asset.alts[locale] ?? null,
    variants: [
      { url: `http://127.0.0.1:0/media/${asset.id}/1200-webp.webp`, width: 1200, height: 630, format: 'webp' }
    ]
  }
}

function toPublicEntity(pageKey: PageKey, locale: EnabledLocale) {
  const authored = pages[pageKey][locale]
  // Override layer, not content record (D10-24): nothing authored for THIS locale is success with
  // nulls — never a cross-locale fallback (D10-6), never a 404 (that means an UNKNOWN key).
  const fields = authored ?? NULL_FIELDS
  return {
    pageKey,
    locale,
    metaTitle: fields.metaTitle,
    metaDescription: fields.metaDescription,
    ogImageId: fields.ogImageId,
    ogImage: fields.ogImageId ? resolveOgImage(fields.ogImageId, locale) : null,
    canonicalUrl: fields.canonicalUrl
  }
}

interface TranslationInput {
  locale?: unknown
  metaTitle?: unknown
  metaDescription?: unknown
  canonicalUrl?: unknown
  ogImageId?: unknown
  [key: string]: unknown
}

interface WriteBody {
  translations?: unknown
  [key: string]: unknown
}

const SEO_FIELD_NAMES = ['metaTitle', 'metaDescription', 'canonicalUrl', 'ogImageId'] as const

function ownErrors(body: WriteBody): Array<{ field: string, message: string }> {
  return Object.keys(body)
    .filter(field => field !== 'translations')
    .map(field => ({ field, message: `property ${field} should not exist.` }))
}

/**
 * Field-level validation, BEFORE any write (the contract applies all locales in one transaction).
 * Locale FORMAT problems are 422-class malformed fields; locale SET-MEMBERSHIP problems are the
 * contract's dedicated 400 class ("Unknown or disabled locale").
 */
function validatePatch(body: WriteBody): {
  status: 400 | 422
  errors: Array<{ field: string, message: string }>
} {
  const errors: Array<{ field: string, message: string }> = [
    // The DTO accepts ONLY `translations` — foreign top-level keys (including every FR-DSH-052
    // global-tags field) are rejected, never silently accepted.
    ...ownErrors(body)
  ]

  if (body.translations === undefined || !Array.isArray(body.translations)) {
    errors.push({ field: 'translations', message: 'translations should not be empty.' })
    return { status: 422, errors }
  }
  if (body.translations.length === 0) {
    errors.push({ field: 'translations', message: 'translations must contain at least 1 elements.' })
    return { status: 422, errors }
  }

  let status: 400 | 422 = 422
  body.translations.forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push({ field: `translations[${index}]`, message: 'translation must be an object.' })
      return
    }
    const entry = raw as TranslationInput

    if (typeof entry.locale !== 'string' || !/^[a-z]{2}$/.test(entry.locale)) {
      errors.push({ field: `translations[${index}].locale`, message: 'locale must be a two-letter lowercase locale.' })
      return
    }
    if (!(ENABLED_LOCALES as readonly string[]).includes(entry.locale)) {
      // The contract's dedicated class: unknown OR disabled locale → 400.
      status = 400
      errors.push({ field: `translations[${index}].locale`, message: 'Unknown or disabled locale.' })
      return
    }

    for (const name of ['metaTitle', 'metaDescription'] as const) {
      const value = entry[name]
      if (value !== undefined && typeof value !== 'string' && value !== null) {
        errors.push({ field: `translations[${index}].${name}`, message: `${name} must be a string or null.` })
      }
    }

    const canonicalUrl = entry.canonicalUrl
    if (canonicalUrl !== undefined && typeof canonicalUrl !== 'string' && canonicalUrl !== null) {
      errors.push({ field: `translations[${index}].canonicalUrl`, message: 'canonicalUrl must be a string or null.' })
    } else if (typeof canonicalUrl === 'string' && !ABSOLUTE_URI_PATTERN.test(canonicalUrl)) {
      errors.push({ field: `translations[${index}].canonicalUrl`, message: 'canonicalUrl must be an absolute URI.' })
    }

    const ogImageId = entry.ogImageId
    if (ogImageId !== undefined && typeof ogImageId !== 'string' && ogImageId !== null) {
      errors.push({ field: `translations[${index}].ogImageId`, message: 'ogImageId must be a string or null.' })
    } else if (typeof ogImageId === 'string') {
      if (!UUID_PATTERN.test(ogImageId)) {
        errors.push({ field: `translations[${index}].ogImageId`, message: 'ogImageId must be a UUID.' })
      } else {
        const asset = assets.find(candidate => candidate.id === ogImageId)
        if (!asset) {
          errors.push({ field: `translations[${index}].ogImageId`, message: 'ogImageId references a missing media asset.' })
        } else if (asset.kind !== 'IMAGE') {
          errors.push({ field: `translations[${index}].ogImageId`, message: 'ogImageId must reference an IMAGE asset.' })
        }
      }
    }

    for (const field of Object.keys(entry).filter(field => field !== 'locale' && !(SEO_FIELD_NAMES as readonly string[]).includes(field))) {
      errors.push({ field: `translations[${index}].${field}`, message: `property ${field} should not exist.` })
    }
  })

  return { status, errors }
}

function isKnownPageKey(candidate: string): candidate is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(candidate)
}

/** Upsert supplied locales only; within a locale, omitted field keys PRESERVE, explicit null CLEARS. */
function applyPatch(pageKey: PageKey, body: WriteBody): void {
  for (const raw of body.translations as TranslationInput[]) {
    const locale = raw.locale as EnabledLocale
    const previous = pages[pageKey][locale] ?? { ...NULL_FIELDS }
    pages[pageKey][locale] = {
      metaTitle: raw.metaTitle === undefined ? previous.metaTitle : raw.metaTitle as string | null,
      metaDescription: raw.metaDescription === undefined ? previous.metaDescription : raw.metaDescription as string | null,
      canonicalUrl: raw.canonicalUrl === undefined ? previous.canonicalUrl : raw.canonicalUrl as string | null,
      ogImageId: raw.ogImageId === undefined ? previous.ogImageId : raw.ogImageId as string | null
    }
  }
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
    pages = seedPages()
    assets = seedAssets()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: PageSeoBackendMode
      delayMs?: number
      failNextWrite?: boolean
      pages?: Record<PageKey, SeoLocaleState>
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.pages) pages = body.pages
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

  // ── ADMIN ────────────────────────────────────────────────────────────────────────────────
  const adminRoot = `${API_PREFIX}/admin/seo/pages`
  if (path === adminRoot || path.startsWith(`${adminRoot}/`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      res.socket?.destroy()
      return
    }

    if (delayMs > 0) await sleep(delayMs)

    if (path === adminRoot && req.method === 'GET') {
      // Zero declared query parameters — there is no pagination, filter or search contract to
      // honour, so unsolicited ones are rejected instead of silently ignored.
      if (url.searchParams.size > 0) {
        return problem(res, 422, 'Unprocessable Entity', 'Admin SEO page list does not accept query parameters.')
      }
      // Completeness is the contract; ORDER IS NOT DOCUMENTED and must never be asserted as such.
      return json(res, 200, { data: PAGE_KEYS.map(toAdminEntity) })
    }

    const rest = path.slice(adminRoot.length)
    if (rest.startsWith('/')) {
      const pageKey = decodeURIComponent(rest.slice(1))
      // ONE closed-set guard for BOTH admin methods (D09-24): unknown keys are 422 here,
      // never 404 — that status is reserved for the PUBLIC route.
      if (!isKnownPageKey(pageKey)) {
        return problem(res, 422, 'Unprocessable Entity', 'Unknown static page key.')
      }

      if (req.method === 'GET') {
        return json(res, 200, { data: toAdminEntity(pageKey) })
      }

      if (req.method === 'PATCH') {
        if (failNextWrite) {
          failNextWrite = false
          return problem(res, 500, 'Save failed')
        }
        const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
        const outcome = validatePatch(body)
        if (outcome.errors.length > 0) {
          const title = outcome.status === 400 ? 'Bad Request' : 'Validation failed'
          return problem(res, outcome.status, title, title, outcome.errors)
        }
        // Validation passed for EVERY supplied locale → apply all in one pass.
        applyPatch(pageKey, body)
        return json(res, 200, { data: toAdminEntity(pageKey) })
      }
    }
  }

  // ── PUBLIC ───────────────────────────────────────────────────────────────────────────────
  const publicRoot = `${API_PREFIX}/seo/pages`
  if (path.startsWith(`${publicRoot}/`) && req.method === 'GET') {
    const pageKey = decodeURIComponent(path.slice(publicRoot.length + 1))

    const rawLocale = url.searchParams.get('locale') ?? 'en'
    if (!/^[a-z]{2}$/.test(rawLocale)) {
      return problem(res, 422, 'Unprocessable Entity', 'Malformed query parameters.')
    }
    if (!(ENABLED_LOCALES as readonly string[]).includes(rawLocale)) {
      return problem(res, 400, 'Bad Request', 'Unknown or disabled locale.')
    }
    if (delayMs > 0) await sleep(delayMs)

    // 404 is RESERVED for a key outside the closed set — "nothing authored" is 200-with-nulls.
    if (!isKnownPageKey(pageKey)) {
      return problem(res, 404, 'Not Found', 'Unknown static page key.')
    }
    return json(res, 200, { data: toPublicEntity(pageKey, rawLocale as EnabledLocale) })
  }

  // Dashboard shell dependencies stay healthy in every scenario.
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
  // Standalone default only. The AUTHORITATIVE port pair belongs to the lane record, which is
  // registered by the later browser-spec unit (established pairs end at 4500/4501).
  const port = Number(process.env.CI_MOCK_PORT ?? 4601)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[page-seo-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
