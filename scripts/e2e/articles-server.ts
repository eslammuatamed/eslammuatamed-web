/**
 * Deterministic Articles backend for the committed `dashboard-articles` Playwright project (FE-2c).
 *
 * WHY A SEVENTH BACKEND RATHER THAN AN EXTENSION OF `dashboard-server.ts`.
 * Not preference — the lane-isolation invariant forces it. A mutable-backend lane is serial only for
 * as long as it is ONE spec file (`workers` is a top-level Playwright option and `fullyParallel:
 * false` only serialises within a file), so adding an Articles spec under `e2e/dashboard/` would put
 * a second worker on the Inbox lane's mutable fixtures and reset them mid-assertion. That exact
 * failure already happened once, to login, and was repaired by giving login its own process pair
 * (`273d4ab`). Articles gets one for the same reason rather than an exemption.
 *
 * ── WHAT THIS BACKEND CAN DO THAT NO OTHER ONE CAN: HOLD A RESPONSE OPEN ────────────────────────
 * `delayMs` is the reason this file exists in the shape it does. Six of plan §14.9's ten acceptance
 * criteria are about a state that is only observable WHILE a request is in flight — the first-load
 * skeleton, the refresh overlay, the editor's pre-resolution state, the submitting action, the
 * background-revalidation treatment, and F-1's proof that all of them speak the Dashboard's
 * language. Against an instant mock every one of those assertions passes without the state ever
 * having rendered, which is a green test that proves nothing.
 *
 * Duplicate-submission prevention is the sharpest case: with an instant backend the second click
 * lands after the first has already resolved, so the test passes whether or not the guard exists.
 * It is only a real test while the first write is still open.
 *
 * ── VALIDATION IS ENFORCED, NOT CANNED ──────────────────────────────────────────────────────────
 * Per-locale slug uniqueness and the SCHEDULED/`publishAt` rule are computed against this store and
 * against the payload the client actually sent, so a 422 comes back with the field path the REAL
 * API would produce — `translations[N].slug`, where N is the index in the array the client built.
 * That index is load-bearing: the read shape is a locale-KEYED map and the write shape is an ARRAY,
 * so mapping the error back onto the right locale tab depends on the request's own ordering. A
 * canned failure with a hard-coded index would let a broken mapping pass.
 *
 * AUTH IS REAL ENOUGH TO BE HONEST, matching `dashboard-server.ts`: a bearer token is required, and
 * the `forbidden` mode answers 403 so "you may not read this" stays distinguishable from "empty".
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type ArticleMode = 'ok' | 'empty' | 'error' | 'forbidden'
export type ArticleStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export interface SeedTranslation {
  title: string
  slug: string
  excerpt: string
  body: string
  metaTitle: string | null
  metaDescription: string | null
  ogImageId: string | null
  canonicalUrl: string | null
}

export interface SeedArticle {
  id: string
  status: ArticleStatus
  publishAt: string | null
  categoryId: string
  coverImageId: string | null
  tagIds: string[]
  translations: Record<string, SeedTranslation>
  createdAt: string
  updatedAt: string
}

/**
 * Fixture ids are REAL UUIDs for the same reason `dashboard-server.ts` gives: the route-query
 * contract validates ids with `z.uuid()` and silently DROPS anything malformed, so a readable id
 * like `art-draft` would never select anything and the spec would assert against an empty surface.
 */
export const ART = {
  /** PUBLISHED, both locales complete — the only fixture with a real public destination. */
  publishedBoth: '00000000-0000-4000-a000-000000000001',
  /** DRAFT, both locales — the "no public destination, preview only" case. */
  draftBoth: '00000000-0000-4000-a000-000000000002',
  /** PUBLISHED, ENGLISH ONLY — drives the translation-completeness indicator off a real gap. */
  publishedEnOnly: '00000000-0000-4000-a000-000000000003',
  /** SCHEDULED with a future instant. */
  scheduled: '00000000-0000-4000-a000-000000000004',
  /** ARCHIVED — proves the status filter reaches a state the default list does not show first. */
  archived: '00000000-0000-4000-a000-000000000005',
  /** A well-formed UUID deliberately absent from the fixtures — the 404 editor case. */
  absent: '00000000-0000-4000-a000-0000000000ff'
} as const

export const CATEGORY = {
  engineering: '00000000-0000-4000-b000-000000000001',
  product: '00000000-0000-4000-b000-000000000002'
} as const

export const TAG = {
  architecture: '00000000-0000-4000-c000-000000000001',
  testing: '00000000-0000-4000-c000-000000000002',
  nuxt: '00000000-0000-4000-c000-000000000003'
} as const

export const ARTICLE_ASSET = {
  cover: '00000000-0000-4000-9000-000000000101',
  og: '00000000-0000-4000-9000-000000000102'
} as const

/** A slug that ALREADY EXISTS in Arabic, so a collision can be provoked deliberately. */
export const TAKEN_AR_SLUG = 'الهندسة-المعمارية-المعيارية'
/** The English slug of the same fixture, for the mirror-image collision. */
export const TAKEN_EN_SLUG = 'a-modular-monolith-in-practice'

const listId = (i: number) => `00000000-0000-4000-a000-0000000001${String(i).padStart(2, '0')}`

function translation(over: Partial<SeedTranslation> & { title: string, slug: string }): SeedTranslation {
  return {
    excerpt: `${over.title} — excerpt`,
    body: `# ${over.title}\n\nOpaque Markdown body for ${over.slug}.`,
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    ...over
  }
}

/**
 * The fixture set. Sized so pagination is REAL: `perPage` is 12, so 18 rows guarantee a second page
 * with a distinguishable tail rather than a page 2 that happens to repeat page 1.
 */
export function seedArticles(): SeedArticle[] {
  const rows: SeedArticle[] = []

  rows.push({
    id: ART.publishedBoth,
    status: 'PUBLISHED',
    publishAt: '2026-08-01T09:00:00.000Z',
    categoryId: CATEGORY.engineering,
    coverImageId: ARTICLE_ASSET.cover,
    tagIds: [TAG.architecture],
    translations: {
      en: translation({ title: 'A modular monolith in practice', slug: TAKEN_EN_SLUG }),
      ar: translation({ title: 'الهندسة المعمارية المعيارية', slug: TAKEN_AR_SLUG })
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  })

  rows.push({
    id: ART.draftBoth,
    status: 'DRAFT',
    publishAt: null,
    categoryId: CATEGORY.product,
    coverImageId: null,
    tagIds: [],
    translations: {
      en: translation({ title: 'Draft: shipping the dashboard', slug: 'shipping-the-dashboard' }),
      ar: translation({ title: 'مسودة: إطلاق لوحة التحكم', slug: 'اطلاق-لوحة-التحكم' })
    },
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z'
  })

  // ENGLISH ONLY, deliberately. The completeness indicator must be driven by a real missing
  // translation rather than by a flag the fixture sets, or it would assert its own input.
  rows.push({
    id: ART.publishedEnOnly,
    status: 'PUBLISHED',
    publishAt: '2026-08-03T09:00:00.000Z',
    categoryId: CATEGORY.engineering,
    coverImageId: null,
    tagIds: [TAG.testing],
    translations: {
      en: translation({ title: 'Negative controls for frontend tests', slug: 'negative-controls' })
    },
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z'
  })

  rows.push({
    id: ART.scheduled,
    status: 'SCHEDULED',
    publishAt: '2027-01-01T09:00:00.000Z',
    categoryId: CATEGORY.product,
    coverImageId: null,
    tagIds: [TAG.nuxt],
    translations: {
      en: translation({ title: 'Scheduled for next year', slug: 'scheduled-for-next-year' }),
      ar: translation({ title: 'مجدول للعام القادم', slug: 'مجدول-للعام-القادم' })
    },
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z'
  })

  rows.push({
    id: ART.archived,
    status: 'ARCHIVED',
    publishAt: '2026-01-01T09:00:00.000Z',
    categoryId: CATEGORY.engineering,
    coverImageId: null,
    tagIds: [],
    translations: {
      en: translation({ title: 'Archived: an older note', slug: 'an-older-note' }),
      ar: translation({ title: 'مؤرشف: ملاحظة قديمة', slug: 'ملاحظة-قديمة' })
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z'
  })

  // Filler, so page 2 exists and is distinguishable.
  for (let i = 1; i <= 25; i++) {
    rows.push({
      id: listId(i),
      status: i % 3 === 0 ? 'DRAFT' : 'PUBLISHED',
      publishAt: i % 3 === 0 ? null : `2026-06-${String(i).padStart(2, '0')}T09:00:00.000Z`,
      categoryId: i % 2 === 0 ? CATEGORY.product : CATEGORY.engineering,
      coverImageId: null,
      tagIds: [],
      translations: {
        en: translation({ title: `Listed article ${i}`, slug: `listed-article-${i}` }),
        ar: translation({ title: `مقالة مدرجة ${i}`, slug: `مقالة-مدرجة-${i}` })
      },
      createdAt: `2026-06-${String(i).padStart(2, '0')}T00:00:00.000Z`,
      updatedAt: `2026-06-${String(i).padStart(2, '0')}T00:00:00.000Z`
    })
  }

  return rows
}

/** Mutable per-process state. Reset between specs through `POST /__e2e/reset`. */
let articles = seedArticles()
let mode: ArticleMode = 'ok'
/**
 * Milliseconds every `/admin/articles*` response is held open for.
 *
 * Zero by default: a lane that paid this cost on every request would be slow for no benefit, and a
 * spec that needs to SEE a pending state should say so explicitly rather than inherit it.
 */
let delayMs = 0
/** Makes one write fail with a server error, to prove a failed save preserves the operator's input. */
let failNextWrite = false
/** Fails one requested taxonomy page so exhaustive-load atomicity is browser-provable. */
let failVocabularyPage: number | null = null

const PER_PAGE_MAX = 50
const DEFAULT_PER_PAGE = 12
const OWNER = { id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f', email: 'owner@example.com', role: { name: 'OWNER' } }

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
 * RFC 7807, with `errors[]` on 422 exactly as the contract documents it (`ProblemDetailsDto`).
 * The Dashboard's `ApiError.fieldErrorMap()` reads that array, so a mock that omitted it would let
 * a broken field-mapping pass.
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

/** Newest-first by `createdAt`, then id — the API's documented admin order, never re-sorted client-side. */
function ordered(list: SeedArticle[]): SeedArticle[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return a.id < b.id ? -1 : 1
  })
}

function toEntity(article: SeedArticle) {
  const translations: Record<string, unknown> = {}
  for (const [locale, value] of Object.entries(article.translations)) {
    translations[locale] = {
      ...value,
      // Server-computed, exactly as the contract states — never accepted from the client. A form
      // that echoed it back would be sending a field the real API does not declare.
      readingTimeMin: Math.max(1, Math.ceil(value.body.split(/\s+/).length / 200))
    }
  }
  return {
    id: article.id,
    status: article.status,
    publishAt: article.publishAt,
    categoryId: article.categoryId,
    coverImageId: article.coverImageId,
    tagIds: [...article.tagIds],
    translations,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt
  }
}

interface TranslationInput {
  locale?: string
  title?: string
  slug?: string
  excerpt?: string
  body?: string
  metaTitle?: string | null
  metaDescription?: string | null
  ogImageId?: string | null
  canonicalUrl?: string | null
}

interface WriteBody {
  status?: ArticleStatus
  publishAt?: string | null
  categoryId?: string
  coverImageId?: string | null
  tagIds?: string[]
  translations?: TranslationInput[]
}

/**
 * The write rules, computed against the real store and the real payload.
 *
 * Returns field errors whose `field` path is `translations[N].<field>` with N being the index in the
 * array the CLIENT sent — which is what makes this a genuine test of the Dashboard's index→locale
 * mapping rather than of a hard-coded string.
 */
function validateWrite(body: WriteBody, selfId: string | null): Array<{ field: string, message: string }> {
  const errors: Array<{ field: string, message: string }> = []

  const status = body.status
  if (status === 'SCHEDULED') {
    if (!body.publishAt) {
      errors.push({ field: 'publishAt', message: 'publishAt is required when status is SCHEDULED.' })
    } else if (new Date(body.publishAt).getTime() <= Date.now()) {
      errors.push({ field: 'publishAt', message: 'publishAt must be in the future when status is SCHEDULED.' })
    }
  }

  (body.translations ?? []).forEach((entry, index) => {
    const locale = entry.locale ?? ''
    if (!locale) {
      errors.push({ field: `translations[${index}].locale`, message: 'locale is required.' })
      return
    }
    for (const field of ['title', 'slug', 'excerpt', 'body'] as const) {
      const value = entry[field]
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({ field: `translations[${index}].${field}`, message: `${field} should not be empty.` })
      }
    }
    // Per-locale uniqueness, checked against every OTHER article — the collision the operator will
    // actually hit, and the one whose error has to land on the right locale tab.
    if (typeof entry.slug === 'string' && entry.slug.trim() !== '') {
      const taken = articles.some(a =>
        a.id !== selfId && a.translations[locale]?.slug === entry.slug
      )
      if (taken) {
        errors.push({
          field: `translations[${index}].slug`,
          message: `Slug already exists for locale '${locale}'.`
        })
      }
    }
  })

  return errors
}

function applyWrite(target: SeedArticle, body: WriteBody): void {
  if (body.status !== undefined) target.status = body.status
  // `null` CLEARS, an omitted key PRESERVES (D10-23) — modelled exactly, because the Dashboard's
  // "empty this field" controls have to send an explicit null and a permissive mock would hide it.
  if (body.publishAt !== undefined) target.publishAt = body.publishAt
  if (body.categoryId !== undefined) target.categoryId = body.categoryId
  if (body.coverImageId !== undefined) target.coverImageId = body.coverImageId
  if (body.tagIds !== undefined) target.tagIds = [...body.tagIds]
  // UPSERT per locale, never delete — the real PATCH semantics. An omitted locale keeps whatever is
  // stored, which is exactly why the editor must send every complete locale rather than only the
  // one being edited.
  for (const entry of body.translations ?? []) {
    if (!entry.locale) continue
    const existing = target.translations[entry.locale]
    target.translations[entry.locale] = {
      title: entry.title ?? existing?.title ?? '',
      slug: entry.slug ?? existing?.slug ?? '',
      excerpt: entry.excerpt ?? existing?.excerpt ?? '',
      body: entry.body ?? existing?.body ?? '',
      metaTitle: entry.metaTitle !== undefined ? entry.metaTitle : (existing?.metaTitle ?? null),
      metaDescription: entry.metaDescription !== undefined ? entry.metaDescription : (existing?.metaDescription ?? null),
      ogImageId: entry.ogImageId !== undefined ? entry.ogImageId : (existing?.ogImageId ?? null),
      canonicalUrl: entry.canonicalUrl !== undefined ? entry.canonicalUrl : (existing?.canonicalUrl ?? null)
    }
  }
  target.updatedAt = new Date(0).toISOString()
}

// ── taxonomy + media fixtures the editor's pickers read ────────────────────────────────────────

function seedCategories() {
  return [
    {
      id: CATEGORY.engineering,
      translations: {
        en: { name: 'Engineering', slug: 'engineering', description: null },
        ar: { name: 'الهندسة', slug: 'الهندسة', description: null }
      }
    },
    {
      id: CATEGORY.product,
      translations: {
        en: { name: 'Product', slug: 'product', description: null },
        ar: { name: 'المنتج', slug: 'المنتج', description: null }
      }
    }
  ]
}

function seedTags() {
  return [
    { id: TAG.architecture, translations: { en: { name: 'Architecture', slug: 'architecture' }, ar: { name: 'العمارة', slug: 'العمارة' } } },
    { id: TAG.testing, translations: { en: { name: 'Testing', slug: 'testing' }, ar: { name: 'الاختبارات', slug: 'الاختبارات' } } },
    { id: TAG.nuxt, translations: { en: { name: 'Nuxt', slug: 'nuxt' }, ar: { name: 'Nuxt', slug: 'nuxt-ar' } } }
  ]
}

let categories = seedCategories()
let tags = seedTags()

function vocabularyPage<T>(rows: T[], url: URL) {
  const readPositiveInt = (value: string | null, fallback: number) => {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  }
  const page = readPositiveInt(url.searchParams.get('page'), 1)
  const perPage = readPositiveInt(url.searchParams.get('perPage'), 12)
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  return { data: rows.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total, totalPages } }
}

function mediaEntity(id: string, filename: string) {
  return {
    id,
    kind: 'IMAGE',
    url: `http://127.0.0.1:0/media/${id}.webp`,
    mimeType: 'image/webp',
    sizeBytes: 24_576,
    originalFilename: filename,
    width: 1200,
    height: 630,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    contentHash: `hash-${id}`,
    variants: [
      { format: 'WEBP', width: 320, height: 168, url: `http://127.0.0.1:0/media/${id}-320.webp` },
      { format: 'WEBP', width: 640, height: 336, url: `http://127.0.0.1:0/media/${id}-640.webp` }
    ],
    alts: [{ locale: 'en', alt: filename }],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
}

function mediaAssets() {
  return [
    mediaEntity(ARTICLE_ASSET.cover, 'article-cover.webp'),
    mediaEntity(ARTICLE_ASSET.og, 'article-og.webp')
  ]
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  // ── test control plane ───────────────────────────────────────────────────────────────────────
  if (path === '/__e2e/reset' && req.method === 'POST') {
    articles = seedArticles()
    categories = seedCategories()
    tags = seedTags()
    mode = 'ok'
    delayMs = 0
    failNextWrite = false
    failVocabularyPage = null
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}') as {
      mode?: ArticleMode
      delayMs?: number
      failNextWrite?: boolean
      articles?: SeedArticle[]
      categories?: ReturnType<typeof seedCategories>
      tags?: ReturnType<typeof seedTags>
      failVocabularyPage?: number | null
    }
    if (body.mode) mode = body.mode
    if (typeof body.delayMs === 'number') delayMs = Math.max(0, body.delayMs)
    if (typeof body.failNextWrite === 'boolean') failNextWrite = body.failNextWrite
    if (body.articles) articles = body.articles
    if (body.categories) categories = body.categories
    if (body.tags) tags = body.tags
    if (body.failVocabularyPage === null || typeof body.failVocabularyPage === 'number') {
      failVocabularyPage = body.failVocabularyPage
    }
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

  // ── admin taxonomy — the released paginated admin vocabulary contract ─────────────────────────
  if (path === `${API_PREFIX}/admin/categories` && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (url.searchParams.get('page') === String(failVocabularyPage)) return problem(res, 500, 'Vocabulary page failed')
    return json(res, 200, vocabularyPage(categories, url))
  }
  if (path === `${API_PREFIX}/admin/tags` && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (url.searchParams.get('page') === String(failVocabularyPage)) return problem(res, 500, 'Vocabulary page failed')
    return json(res, 200, vocabularyPage(tags, url))
  }

  // ── admin media (read-only here — the editor picks, it does not manage the library) ──────────
  if (path.startsWith(`${API_PREFIX}/admin/media`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    const rest = path.slice(`${API_PREFIX}/admin/media`.length)
    if (rest.startsWith('/') && req.method === 'GET') {
      const target = mediaAssets().find(a => a.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      return json(res, 200, { data: target })
    }
    if (rest === '' && req.method === 'GET') {
      const all = mediaAssets()
      return json(res, 200, { data: all, meta: { page: 1, perPage: DEFAULT_PER_PAGE, total: all.length, totalPages: 1 } })
    }
  }

  // ── admin articles ───────────────────────────────────────────────────────────────────────────
  if (path.startsWith(`${API_PREFIX}/admin/articles`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      // A transport-level failure: destroy the socket so the client sees a real network error
      // rather than a well-formed error body it might render differently.
      res.socket?.destroy()
      return
    }

    // THE HOLD. Applied to reads and writes alike, because the states under test live on both: a
    // held GET is what makes a skeleton or a refresh overlay observable, and a held POST/PATCH is
    // the only condition under which duplicate-submission prevention is actually exercised.
    if (delayMs > 0) await sleep(delayMs)

    const rest = path.slice(`${API_PREFIX}/admin/articles`.length)

    if (rest.endsWith('/preview-token') && req.method === 'POST') {
      const id = rest.slice(1, -'/preview-token'.length)
      if (!articles.some(a => a.id === id)) return problem(res, 404, 'Not found')
      return json(res, 200, {
        data: {
          token: `e2e-preview-${id}`,
          url: `/preview/articles/${id}?token=e2e-preview-${id}`,
          expiresAt: '2027-01-01T00:00:00.000Z'
        }
      })
    }

    if (rest === '' && req.method === 'POST') {
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      if (!body.categoryId) {
        return problem(res, 422, 'Validation failed', '1 field failed validation.', [
          { field: 'categoryId', message: 'categoryId should not be empty.' }
        ])
      }
      if (!body.translations || body.translations.length === 0) {
        return problem(res, 422, 'Validation failed', '1 field failed validation.', [
          { field: 'translations', message: 'At least one locale translation is required.' }
        ])
      }
      const errors = validateWrite(body, null)
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      const created: SeedArticle = {
        id: `00000000-0000-4000-a000-0000000009${String(articles.length).padStart(2, '0')}`,
        status: body.status ?? 'DRAFT',
        publishAt: body.publishAt ?? null,
        categoryId: body.categoryId,
        coverImageId: body.coverImageId ?? null,
        tagIds: [...(body.tagIds ?? [])],
        translations: {},
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }
      applyWrite(created, body)
      articles.unshift(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/') && req.method === 'PATCH') {
      const id = rest.slice(1)
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Save failed')
      }
      const target = articles.find(a => a.id === id)
      if (!target) return problem(res, 404, 'Not found')
      const body = JSON.parse((await readBody(req)) || '{}') as WriteBody
      const errors = validateWrite(body, id)
      if (errors.length > 0) {
        return problem(res, 422, 'Validation failed', `${errors.length} field(s) failed validation.`, errors)
      }
      applyWrite(target, body)
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest.startsWith('/') && req.method === 'DELETE') {
      const id = rest.slice(1)
      if (failNextWrite) {
        failNextWrite = false
        return problem(res, 500, 'Delete failed')
      }
      if (!articles.some(a => a.id === id)) return problem(res, 404, 'Not found')
      articles = articles.filter(a => a.id !== id)
      return noContent(res)
    }

    if (rest.startsWith('/') && req.method === 'GET') {
      const target = articles.find(a => a.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest === '' && req.method === 'GET') {
      const status = url.searchParams.get('status')
      const q = url.searchParams.get('q')?.trim()
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
      const perPage = Math.min(
        PER_PAGE_MAX,
        Math.max(1, Number(url.searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE)) || DEFAULT_PER_PAGE)
      )

      if (q && q.length > 120) return problem(res, 422, 'Validation failed', 'q must not exceed 120 characters.')

      let pool = mode === 'empty' ? [] : articles
      if (status) pool = pool.filter(a => a.status === status)
      if (q) {
        const needle = q.toLocaleLowerCase()
        // Production owns the whole title-only predicate across every authored locale. Keeping it at
        // the mock boundary lets browser tests prove query parameters and server metadata together.
        pool = pool.filter(article =>
          Object.values(article.translations).some(translation => translation.title.toLocaleLowerCase().includes(needle))
        )
      }

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
  // The shell's unread badge reads this on every dashboard route; an unanswered call would put an
  // error surface in the chrome of every Articles assertion.
  if (path.startsWith(`${API_PREFIX}/admin/messages`) && req.method === 'GET') {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    return json(res, 200, { data: [], meta: { page: 1, perPage: DEFAULT_PER_PAGE, total: 0, totalPages: 1 } })
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
  const port = Number(process.env.CI_MOCK_PORT ?? 4001)
  server.listen(port, '127.0.0.1', () => {
    console.log(`[articles-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
