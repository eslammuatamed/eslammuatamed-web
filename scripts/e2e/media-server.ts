/**
 * Deterministic backend for the `dashboard-media` Playwright project (Media Library + Profile).
 *
 * WHY A SEVENTH BACKEND RATHER THAN EXTENDING `dashboard-server.ts`.
 * Not because the two could not share a process, but because `playwright.config.ts` documents what
 * actually makes a mutable lane serial: `workers` is a TOP-LEVEL option and `fullyParallel: false`
 * only serialises tests WITHIN a file, so a lane is serial exactly as long as it is ONE spec file.
 * Adding a second spec file to `dashboard/**` would let Playwright run it in a second worker against
 * the same mutable state, and the two files would reset each other's fixtures mid-assertion. A new
 * project with its own preview + backend pair and its own single spec file is the pattern the other
 * six lanes already follow, and it keeps the Inbox lane exactly as it was.
 *
 * This backend is mutable in three ways the library needs and Prism cannot express: an upload adds an
 * asset, a delete removes one (or is REFUSED when the asset is referenced), and a settings PATCH
 * changes what the next GET returns. The delete refusal in particular is the whole point of
 * `onDelete: Restrict`, and it cannot be observed against a static example.
 *
 * ── SCENARIO SELECTION IS BY STABLE IDENTIFIER, NEVER BY TRANSLATED COPY ────────────────────────
 * Fixture ids are deterministic UUIDs and filenames are literal, so a spec selects by identity
 * rather than by a rendered string a copy edit would break.
 *
 * THE ALT FIXTURES ARE DELIBERATELY IN CONFLICT. `ASSET-LEVEL DEFAULT …` is the library alt on the
 * portrait asset, while the per-usage `portraitAlt` starts null. A Dashboard that wrongly prefilled
 * from the asset default would render that exact string in its inputs, so the browser lane can catch
 * the D09-22 trap the same way the unit tests do — through data, not through a mock.
 */
import { realpathSync } from 'node:fs'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api/v1'

export type MediaMode = 'ok' | 'empty' | 'error' | 'forbidden'

interface SeedAsset {
  id: string
  kind: 'IMAGE' | 'PDF'
  originalFilename: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  alts: Array<{ locale: string, alt: string }>
}

/** Deterministic, addressable-by-name fixture ids. */
export const ASSET = {
  portrait: '00000000-0000-4000-9000-000000000001',
  desk: '00000000-0000-4000-9000-000000000002',
  /** Referenced by the About portrait usage, so its delete must be REFUSED. */
  inUse: '00000000-0000-4000-9000-000000000003',
  resume: '00000000-0000-4000-9000-0000000000f1'
} as const

const paddedId = (i: number) => `00000000-0000-4000-9000-0000000001${String(i).padStart(2, '0')}`

/**
 * 16 images + 1 PDF. The count is chosen so pagination is REAL: `perPage` is 12, so 17 assets
 * guarantee a second page with a distinguishable tail rather than a page 2 that repeats page 1.
 */
function seedAssets(): SeedAsset[] {
  const rows: SeedAsset[] = [
    {
      id: ASSET.portrait,
      kind: 'IMAGE',
      originalFilename: 'portrait-candidate.jpg',
      mimeType: 'image/webp',
      sizeBytes: 245123,
      width: 1200,
      height: 1500,
      // The library default. The per-usage About alt starts NULL, so these two disagree on purpose.
      alts: [
        { locale: 'en', alt: 'ASSET-LEVEL DEFAULT — library description' },
        { locale: 'ar', alt: 'وصف المكتبة الافتراضي' }
      ]
    },
    { id: ASSET.desk, kind: 'IMAGE', originalFilename: 'desk-setup.jpg', mimeType: 'image/webp', sizeBytes: 120000, width: 2400, height: 1350, alts: [] },
    { id: ASSET.inUse, kind: 'IMAGE', originalFilename: 'currently-used.jpg', mimeType: 'image/webp', sizeBytes: 90000, width: 800, height: 600, alts: [] },
    { id: ASSET.resume, kind: 'PDF', originalFilename: 'eslam-cv.pdf', mimeType: 'application/pdf', sizeBytes: 97805, width: null, height: null, alts: [] }
  ]
  for (let i = 1; i <= 13; i += 1) {
    rows.push({
      id: paddedId(i),
      kind: 'IMAGE',
      originalFilename: `library-image-${i}.jpg`,
      mimeType: 'image/webp',
      sizeBytes: 50000 + i,
      width: 640,
      height: 480,
      alts: []
    })
  }
  return rows
}

/** Mutable per-process state, reset between specs through `POST /__e2e/reset`. */
let assets = seedAssets()
let mode: MediaMode = 'ok'
/** The About portrait association and its PER-USAGE alts — what the Profile page writes. */
let portraitAssetId: string | null = null
let portraitAlt: Record<string, string | null> = { en: null, ar: null }
/** Makes the next settings PATCH fail, to prove a failed save preserves the operator's input. */
let failNextPatch = false
/** Makes the next upload fail with a 422, to prove the validation surface is real. */
let failNextUpload = false

const PER_PAGE_MAX = 50
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

function problem(res: http.ServerResponse, status: number, title: string, detail?: string) {
  res.writeHead(status, {
    'content-type': 'application/problem+json',
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end(JSON.stringify({ type: 'about:blank', title, status, detail: detail ?? title }))
}

function noContent(res: http.ServerResponse) {
  res.writeHead(204, {
    'access-control-allow-origin': res.req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true'
  })
  res.end()
}

const authorized = (req: http.IncomingMessage) => (req.headers.authorization ?? '').startsWith('Bearer ')

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/**
 * Renditions for an image, mirroring the contract's shape closely enough that the app's own
 * `thumbnailFor` picks the narrowest WebP exactly as it does in production.
 */
function variantsFor(asset: SeedAsset) {
  if (asset.kind === 'PDF') return []
  return [
    { format: 'WEBP', width: 320, height: 240, url: `http://127.0.0.1:0/media/${asset.id}-320.webp` },
    { format: 'WEBP', width: 640, height: 480, url: `http://127.0.0.1:0/media/${asset.id}-640.webp` },
    { format: 'AVIF', width: 640, height: 480, url: `http://127.0.0.1:0/media/${asset.id}-640.avif` }
  ]
}

function toEntity(asset: SeedAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    url: `http://127.0.0.1:0/media/${asset.id}.${asset.kind === 'PDF' ? 'pdf' : 'webp'}`,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    originalFilename: asset.originalFilename,
    width: asset.width,
    height: asset.height,
    blurhash: asset.kind === 'IMAGE' ? 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' : null,
    contentHash: `hash-${asset.id}`,
    variants: variantsFor(asset),
    alts: asset.alts,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
}

/**
 * Every record referencing an asset.
 *
 * Two sources, and both are real rather than decorative: `ASSET.inUse` carries a STATIC gallery
 * usage so a delete refusal is assertable without touching settings, and whatever the Profile page
 * has actually associated carries a LIVE `settings-portrait` usage — so selecting a portrait makes
 * that asset undeletable in the very same run, which is the invariant the library page exists to
 * surface.
 */
function usagesOf(id: string) {
  const found: Array<{ type: string, id: string, reference?: Record<string, string> }> = []
  if (id === ASSET.inUse) {
    found.push({ type: 'project-gallery', id: '00000000-0000-4000-9000-00000000e001', reference: { projectId: 'demo-project' } })
  }
  if (portraitAssetId === id) {
    found.push({ type: 'settings-portrait', id: '00000000-0000-4000-9000-00000000e002', reference: { settings: 'site' } })
  }
  return found
}

const translation = (locale: string) => ({
  siteName: 'Eslam Muatamed',
  tagline: null,
  availabilityStatus: null,
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  aboutBio: null,
  engineeringPhilosophy: null,
  currentFocus: null,
  portraitAlt: portraitAlt[locale] ?? null
})

/**
 * `AdminSiteSettingsEntity`. `portrait.alt` is the ASSET-LEVEL default resolved in the default admin
 * locale — deliberately NOT the per-usage value, so a Dashboard that prefills from it is caught.
 */
function settingsEntity() {
  const asset = assets.find(a => a.id === portraitAssetId) ?? null
  return {
    id: '00000000-0000-4000-9000-00000000s001',
    profileLinks: [],
    resumeAssetId: null,
    portraitAssetId,
    portrait: asset
      ? {
          id: asset.id,
          url: toEntity(asset).url,
          alt: asset.alts.find(a => a.locale === 'en')?.alt ?? null,
          width: asset.width,
          height: asset.height,
          blurhash: null,
          variants: variantsFor(asset)
        }
      : null,
    professionalEmail: null,
    contactEmail: null,
    contactPhone: null,
    whatsappPhone: null,
    careerStartYear: null,
    careerStartMonth: null,
    googleSiteVerification: null,
    bingSiteVerification: null,
    gtmContainerId: null,
    analyticsEnabled: false,
    customMetas: [],
    translations: { en: translation('en'), ar: translation('ar') }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') return json(res, 204, {})

  // ── test control plane ───────────────────────────────────────────────────────────────────────
  if (path === '/__e2e/reset' && req.method === 'POST') {
    assets = seedAssets()
    mode = 'ok'
    portraitAssetId = null
    portraitAlt = { en: null, ar: null }
    failNextPatch = false
    failNextUpload = false
    return json(res, 200, { ok: true })
  }
  if (path === '/__e2e/state' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as {
      mode?: MediaMode
      portraitAssetId?: string | null
      portraitAlt?: Record<string, string | null>
      failNextPatch?: boolean
      failNextUpload?: boolean
    }
    if (body.mode) mode = body.mode
    if (body.portraitAssetId !== undefined) portraitAssetId = body.portraitAssetId
    if (body.portraitAlt) portraitAlt = { ...portraitAlt, ...body.portraitAlt }
    if (typeof body.failNextPatch === 'boolean') failNextPatch = body.failNextPatch
    if (typeof body.failNextUpload === 'boolean') failNextUpload = body.failNextUpload
    return json(res, 200, { ok: true, mode })
  }
  // Lets a spec assert what was actually PERSISTED, not merely what the page re-rendered.
  if (path === '/__e2e/portrait' && req.method === 'GET') {
    return json(res, 200, { portraitAssetId, portraitAlt })
  }

  // ── auth ─────────────────────────────────────────────────────────────────────────────────────
  if (path === `${API_PREFIX}/auth/login` && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as { email?: string, password?: string }
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

  // ── admin settings ───────────────────────────────────────────────────────────────────────────
  if (path === `${API_PREFIX}/admin/settings`) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')

    if (req.method === 'PATCH') {
      if (failNextPatch) {
        failNextPatch = false
        return problem(res, 500, 'Save failed')
      }
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as {
        portraitAssetId?: string | null
        translations?: Array<{ locale: string, portraitAlt?: string | null }>
      }
      // `forbidNonWhitelisted`, as the real API enforces it: a payload carrying a read-only field
      // is a 422. Modelled so a Dashboard that echoed the read entity back would FAIL here rather
      // than pass against a permissive fake.
      const allowed = new Set(['portraitAssetId', 'translations'])
      const extra = Object.keys(body).filter(key => !allowed.has(key))
      if (extra.length > 0) return problem(res, 422, 'Validation failed', `property ${extra[0]} should not exist`)

      if (body.portraitAssetId !== undefined) {
        if (body.portraitAssetId !== null) {
          const target = assets.find(a => a.id === body.portraitAssetId)
          if (!target) return problem(res, 422, 'Validation failed', 'portraitAssetId must reference an existing asset')
          // D09-18, enforced here as it is on the real API.
          if (target.kind !== 'IMAGE') return problem(res, 422, 'Validation failed', 'portraitAssetId must reference an IMAGE asset')
        }
        portraitAssetId = body.portraitAssetId
      }
      for (const entry of body.translations ?? []) {
        // `undefined` means "leave it alone"; `null` is the explicit no-fallback clear.
        if (entry.portraitAlt !== undefined) portraitAlt[entry.locale] = entry.portraitAlt
      }
      return json(res, 200, { data: settingsEntity() })
    }

    if (req.method === 'GET') return json(res, 200, { data: settingsEntity() })
  }

  // ── admin media ──────────────────────────────────────────────────────────────────────────────
  if (path.startsWith(`${API_PREFIX}/admin/media`)) {
    if (!authorized(req)) return problem(res, 401, 'Unauthorized')
    if (mode === 'forbidden') return problem(res, 403, 'Forbidden')
    if (mode === 'error') {
      // A transport-level failure: destroy the socket so the client sees a real network error rather
      // than a well-formed body it might render differently.
      res.socket?.destroy()
      return
    }

    const rest = path.slice(`${API_PREFIX}/admin/media`.length)

    if (rest.endsWith('/usages') && req.method === 'GET') {
      const id = rest.slice(1, -'/usages'.length)
      if (!assets.some(a => a.id === id)) return problem(res, 404, 'Not found')
      return json(res, 200, { data: usagesOf(id) })
    }

    if (rest === '' && req.method === 'POST') {
      if (failNextUpload) {
        failNextUpload = false
        return problem(res, 422, 'Unsupported file', 'The file type is not supported.')
      }
      const raw = await readBody(req)
      // The filename is parsed out of the multipart body rather than invented, so a spec can upload
      // a NAMED file and then find it by that name — which is what makes the "upload then reuse"
      // assertion meaningful instead of tautological.
      const filename = /filename="([^"]*)"/.exec(raw.toString('latin1'))?.[1] ?? 'upload.bin'

      // SHA-256 deduplication, modelled on the filename because the fixture bytes are trivial:
      // re-uploading a name that already exists returns the EXISTING asset with meta.deduplicated.
      const existing = assets.find(a => a.originalFilename === filename)
      if (existing) return json(res, 200, { data: toEntity(existing), meta: { deduplicated: true } })

      const isPdf = filename.toLowerCase().endsWith('.pdf')
      const created: SeedAsset = {
        id: `00000000-0000-4000-9000-0000000002${String(assets.length).padStart(2, '0')}`,
        kind: isPdf ? 'PDF' : 'IMAGE',
        originalFilename: filename,
        mimeType: isPdf ? 'application/pdf' : 'image/webp',
        sizeBytes: raw.length,
        width: isPdf ? null : 1024,
        height: isPdf ? null : 768,
        alts: []
      }
      // Newest first, matching the API's documented order.
      assets.unshift(created)
      return json(res, 201, { data: toEntity(created) })
    }

    if (rest.startsWith('/') && req.method === 'DELETE') {
      const id = rest.slice(1)
      const target = assets.find(a => a.id === id)
      if (!target) return problem(res, 404, 'Not found')
      // `onDelete: Restrict` on all nine relations — a referenced asset cannot be removed.
      if (usagesOf(id).length > 0) return problem(res, 409, 'Asset is in use')
      assets = assets.filter(a => a.id !== id)
      return noContent(res)
    }

    if (rest.startsWith('/') && req.method === 'GET') {
      const target = assets.find(a => a.id === rest.slice(1))
      if (!target) return problem(res, 404, 'Not found')
      return json(res, 200, { data: toEntity(target) })
    }

    if (rest === '' && req.method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const kind = url.searchParams.get('kind')
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
      const perPage = Math.min(PER_PAGE_MAX, Math.max(1, Number(url.searchParams.get('perPage') ?? '12') || 12))

      let pool = mode === 'empty' ? [] : assets
      // Searches filename AND alt text, as the contract documents.
      if (q) {
        pool = pool.filter(a =>
          a.originalFilename.toLowerCase().includes(q)
          || a.alts.some(alt => alt.alt.toLowerCase().includes(q))
        )
      }
      if (kind === 'IMAGE' || kind === 'PDF') pool = pool.filter(a => a.kind === kind)

      const total = pool.length
      const totalPages = Math.max(1, Math.ceil(total / perPage))
      const slice = pool.slice((page - 1) * perPage, page * perPage)
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
    console.log(`[media-server] listening on http://127.0.0.1:${port}`)
  })
}

export { server }
