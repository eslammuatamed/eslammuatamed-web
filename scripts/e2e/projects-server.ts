/**
 * Deterministic Projects backend for the `dashboard-projects` Playwright project (SEO-U3c, R16).
 *
 * WHY A NEW BACKEND RATHER THAN A SPEC IN AN EXISTING LANE. The same invariant every FE-3 module
 * recorded: a mutable-backend lane is serial only while it is ONE spec file, because `workers` is a
 * top-level Playwright option and `fullyParallel: false` serialises only WITHIN a file. Projects
 * also has NO earlier browser lane at all — R16 — so there was nothing to share a process pair with.
 *
 * ── WHAT THIS MODELS, EACH FOR A REASON ─────────────────────────────────────────────────────────
 *
 * 1. PAGINATED COLLECTION ENVELOPE. Unlike Experiences/Skills/Testimonials, `GET /admin/projects`
 *    answers `{ data, meta: { total, totalPages } }` — verified against `useAdminProjects`, which
 *    reads `res.meta.total`. A meta-less mock would break the collection for a reason unrelated to
 *    anything this lane tests.
 *
 * 2. SEO NULL-CLEAR ON THE WIRE (D10-23 / SEO-U2). Within an upserted translation, an omitted SEO
 *    key PRESERVES the stored value while an explicit `null` CLEARS it — transcribed from the real
 *    service semantics that SEO-U2 aligned the client with. The lane's most important assertion
 *    reads the PATCH body on the wire AND the round-tripped entity: clearing a held meta title must
 *    produce `"metaTitle": null`, never a missing key or an empty string.
 *
 * 3. OG IMAGE REFERENCES RESOLVE THROUGH MEDIA. The picker resolves a stored `ogImageId` via
 *    `GET /admin/media/:id`, so the backend serves one IMAGE asset; a dangling reference would show
 *    the picker's resolve-failed state instead of the clearable selection the tests need.
 *
 * 4. AUTH IS REAL ENOUGH TO BE HONEST, matching `experiences-server.ts`: a bearer token is required,
 *    and `forbidden`/`error` modes answer 403/500 so each request state stays distinguishable.
 */
import http from 'node:http'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

export const API_PREFIX = '/api/v1'

export type Mode = 'ok' | 'empty' | 'error' | 'forbidden'

export const PRJ = {
  /** Both locales complete, EN carrying a FULL populated SEO set + one linked technology. */
  main: '00000000-0000-4000-a000-000000000001',
  /** English only — the collection's translation-completeness gap fixture. */
  enOnly: '00000000-0000-4000-a000-000000000002'
} as const

export const SKILL = {
  typescript: '00000000-0000-4000-b000-000000000001',
  nest: '00000000-0000-4000-b000-000000000002',
  postgres: '00000000-0000-4000-b000-000000000003'
} as const

/** The media asset `PRJ.main`'s English `ogImageId` points at; served by GET /admin/media/:id. */
export const OG_ASSET = '00000000-0000-4000-c000-000000000001'

interface SeedTranslation {
  title: string
  slug: string
  summary: string
  overview: string
  businessProblem: string
  solution: string
  role: string
  architecture: string
  challenges: string
  features: string
  lessonsLearned: string
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageId: string | null
}

interface SeedProject {
  id: string
  featured: boolean
  isPublished: boolean
  order: number
  liveUrl: string | null
  repoUrl: string | null
  year: number | null
  technologyIds: string[]
  gallery: unknown[]
  translations: Record<string, SeedTranslation>
  /** Required on the entity; a row that lacks them throws `Invalid time value` in the list. */
  createdAt: string
  updatedAt: string
}

const narrative = (prefix: string) => ({
  summary: `${prefix} summary.`,
  overview: `${prefix} overview.`,
  businessProblem: `${prefix} problem.`,
  solution: `${prefix} solution.`,
  role: `${prefix} role.`,
  architecture: `${prefix} architecture.`,
  challenges: `${prefix} challenges.`,
  features: `${prefix} features.`,
  lessonsLearned: `${prefix} lessons.`
})

function seedProjects(): SeedProject[] {
  return [
    {
      id: PRJ.main,
      featured: true,
      isPublished: true,
      order: 0,
      liveUrl: 'https://example.com/main',
      repoUrl: null,
      year: 2026,
      technologyIds: [SKILL.typescript],
      gallery: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      translations: {
        en: {
          title: 'Content platform',
          slug: 'content-platform',
          ...narrative('Held'),
          // THE POPULATED SEO SET the null-clear assertions depend on.
          metaTitle: 'Held EN title',
          metaDescription: 'Held EN description',
          canonicalUrl: 'https://held.example.com/en',
          ogImageId: OG_ASSET
        },
        ar: {
          title: 'منصة المحتوى',
          slug: 'منصة-المحتوى',
          ...narrative('محفوظ'),
          metaTitle: 'عنوان محفوظ',
          metaDescription: null,
          canonicalUrl: null,
          ogImageId: null
        }
      }
    },
    {
      id: PRJ.enOnly,
      featured: false,
      isPublished: false,
      order: 1,
      liveUrl: null,
      repoUrl: null,
      year: null,
      technologyIds: [],
      gallery: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      translations: {
        en: { title: 'Side experiment', slug: 'side-experiment', ...narrative('Draft'), metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null }
      }
    }
  ]
}

function seedSkills() {
  return [
    { id: SKILL.typescript, slug: 'typescript', group: 'LANGUAGE', order: 1, brandColor: null, isPublic: true, translations: { en: { label: 'TypeScript' } } },
    { id: SKILL.nest, slug: 'nestjs', group: 'BACKEND', order: 2, brandColor: null, isPublic: true, translations: { en: { label: 'NestJS' } } },
    { id: SKILL.postgres, slug: 'postgres', group: 'BACKEND', order: 3, brandColor: null, isPublic: true, translations: { en: { label: 'PostgreSQL' } } }
  ]
}

function seedMedia(id: string) {
  return {
    id, kind: 'IMAGE', url: `https://cdn.example.com/${id}.png`, mimeType: 'image/png', sizeBytes: 12_345,
    originalFilename: 'og-image.png', width: 1200, height: 630, blurhash: null, contentHash: 'hash-og',
    variants: [], alts: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

/** Mutable per-process state. Reset between specs through `POST /__e2e/reset`. */
let projects = seedProjects()
let mode: Mode = 'ok'
let delayMs = 0
/** The body of the last PATCH, for wire-level assertions through the control plane. */
let lastPatchBody: Record<string, unknown> | null = null

function reset(): void {
  projects = seedProjects()
  mode = 'ok'
  delayMs = 0
  lastPatchBody = null
}

const TOKEN = 'e2e-access-token'
/** Same owner identity the other lane backends answer with. */
const OWNER = { id: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f', email: 'owner@example.com', role: { name: 'OWNER' } }
const authed = (req: http.IncomingMessage): boolean =>
  (req.headers.authorization ?? '').startsWith(`Bearer ${TOKEN}`)

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (error) { reject(error as Error) }
    })
    req.on('error', reject)
  })
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    // The browser posts cross-origin (preview port → backend port); without these the login
    // preflight fails and every test times out on the sign-in navigation.
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...headers
  })
  res.end(JSON.stringify(body))
}

/**
 * The D10-23 pair inside one upserted translation: omitted key → keep the stored value;
 * explicit `null` → clear; anything else → replace. This is the server half of the exact
 * behaviour SEO-U2 aligned the client with, so the round-trip proof means what it claims.
 */
function applyTranslation(stored: SeedTranslation | undefined, patch: Record<string, unknown>): SeedTranslation {
  const next: SeedTranslation = stored
    ? { ...stored }
    : {
        title: '', slug: '', ...narrative(''),
        metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null
      }
  const seoKeys = ['metaTitle', 'metaDescription', 'canonicalUrl', 'ogImageId'] as const
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'locale') continue
    if ((seoKeys as readonly string[]).includes(key)) {
      // Nullable SEO column: null clears, a string sets — omission never reaches here because the
      // client simply does not send the key.
      (next as unknown as Record<string, unknown>)[key] = value
      continue
    }
    if (typeof value === 'string') (next as unknown as Record<string, unknown>)[key] = value
  }
  return next
}

function applyPatch(id: string, body: Record<string, unknown>): SeedProject | undefined {
  const stored = projects.find(project => project.id === id)
  if (!stored) return undefined
  const next: SeedProject = { ...stored }

  if (body.technologyIds !== undefined) next.technologyIds = [...(body.technologyIds as string[])]
  if (Array.isArray(body.gallery)) next.gallery = body.gallery
  if (typeof body.featured === 'boolean') next.featured = body.featured
  if (typeof body.isPublished === 'boolean') next.isPublished = body.isPublished
  if (typeof body.order === 'number') next.order = body.order

  const translations = body.translations as Array<Record<string, unknown>> | undefined
  if (translations !== undefined) {
    const map: Record<string, SeedTranslation> = { ...next.translations }
    for (const entry of translations) {
      const locale = String(entry.locale)
      map[locale] = applyTranslation(map[locale], entry)
    }
    next.translations = map
  }
  return next
}

const server = http.createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname.replace(API_PREFIX, '')

    // CORS preflight — the preview origin differs from this port.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': req.headers.origin ?? '*',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type,authorization',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS'
      })
      res.end()
      return
    }

    if (delayMs > 0 && path.startsWith('/admin')) await sleep(delayMs)

    if (path === '/__e2e/reset' && req.method === 'POST') {
      reset()
      json(res, 204, null)
      return
    }
    if (path === '/__e2e/state' && req.method === 'POST') {
      const state = await readBody(req)
      if (state.mode !== undefined) mode = state.mode as Mode
      if (state.delayMs !== undefined) delayMs = Number(state.delayMs)
      json(res, 204, null)
      return
    }
    if (path === '/__e2e/last-patch' && req.method === 'GET') {
      json(res, 200, { body: lastPatchBody })
      return
    }

    if (path === '/auth/login' && req.method === 'POST') {
      const body = await readBody(req)
      if (!body.email || !body.password) {
        json(res, 422, { title: 'Validation failed' })
        return
      }
      if (body.password === 'wrong-password') {
        json(res, 401, { title: 'Invalid credentials' })
        return
      }
      // Same envelope the other backends answer with: `data` wrapper + refresh cookie. Raw
      // writeHead must still carry the CORS headers or the browser kills the response.
      res.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': req.headers.origin ?? '*',
        'access-control-allow-credentials': 'true',
        'set-cookie': `refresh_token=e2e-refresh; Path=/api/v1/auth; HttpOnly; SameSite=Lax`
      })
      res.end(JSON.stringify({ data: { accessToken: TOKEN, user: OWNER } }))
      return
    }

    if (path === '/auth/refresh' && req.method === 'POST') {
      // The rotating-refresh handshake fires right after login; answer it like articles-server.
      if (!(req.headers.cookie ?? '').includes('refresh_token=')) {
        json(res, 401, { title: 'Missing refresh token' })
        return
      }
      json(res, 200, { data: { accessToken: TOKEN } }, {
        'set-cookie': `refresh_token=e2e-refresh; Path=/api/v1/auth; HttpOnly; SameSite=Lax`
      })
      return
    }

    if (!path.startsWith('/admin')) {
      json(res, 404, { title: 'Not found' })
      return
    }
    if (!authed(req)) {
      json(res, 401, { title: 'Missing or invalid access token.' })
      return
    }
    if (mode === 'error' && req.method === 'GET') {
      json(res, 500, { title: 'Server error' })
      return
    }
    if (mode === 'forbidden' && req.method === 'GET') {
      json(res, 403, { title: 'Forbidden' })
      return
    }

    if (path === '/admin/skills' && req.method === 'GET') {
      json(res, 200, { data: seedSkills() })
      return
    }

    if (path === '/admin/projects' && req.method === 'GET') {
      if (mode === 'empty') {
        json(res, 200, { data: [], meta: { total: 0, totalPages: 1 } })
        return
      }
      const ordered = [...projects].sort((a, b) => a.order - b.order)
      json(res, 200, { data: ordered, meta: { total: ordered.length, totalPages: 1 } })
      return
    }

    if (path === '/admin/projects' && req.method === 'POST') {
      const body = await readBody(req)
      const created = applyPatch(PRJ.main, body)
      if (!created) {
        json(res, 422, { title: 'Unprocessable' })
        return
      }
      created.id = '00000000-0000-4000-a000-0000000000aa'
      created.isPublished = Boolean(body.isPublished ?? false)
      projects.push(created)
      json(res, 201, { data: created })
      return
    }

    const projectMatch = /^\/admin\/projects\/([0-9a-f-]+)$/.exec(path)
    if (projectMatch) {
      const id = projectMatch[1] ?? ""
      if (req.method === 'GET') {
        const found = projects.find(project => project.id === id)
        if (!found) {
          json(res, 404, { title: 'Not found' })
          return
        }
        json(res, 200, { data: found })
        return
      }
      if (req.method === 'PATCH') {
        const body = await readBody(req)
        lastPatchBody = body
        const updated = applyPatch(id, body)
        if (!updated) {
          json(res, 404, { title: 'Not found' })
          return
        }
        projects = projects.map(project => (project.id === id ? updated : project))
        json(res, 200, { data: updated })
        return
      }
    }

    const mediaMatch = /^\/admin\/media\/([0-9a-f-]+)$/.exec(path)
    if (mediaMatch && req.method === 'GET') {
      json(res, 200, { data: seedMedia(mediaMatch[1] ?? "") })
      return
    }

    json(res, 404, { title: 'Not found' })
  })().catch((error: unknown) => {
    // A rejected handler must not hang the connection open: answer 500 and move on.
    json(res, 500, { title: 'Backend handler error' })
    console.error('[projects-server]', error)
  })
})

const port = Number(process.env.CI_PROJECTS_MOCK_PORT ?? 4501)
server.listen(port, '127.0.0.1', () => {
  console.log(`[projects-server] listening on http://127.0.0.1:${port}`)
})
