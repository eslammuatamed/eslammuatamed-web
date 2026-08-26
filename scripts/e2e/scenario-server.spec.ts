import net from 'node:net'
import { describe, expect, it } from 'vitest'
import { ARTICLE_SLUG, CATEGORY, SLUG, TECHNOLOGY } from './fixtures.ts'
import { API_PREFIX, createScenarioServer, PAGE_SEO_KEYS, resolveRequest, stopScenarioServer } from './scenario-server.ts'

/**
 * Unit coverage for the SSR scenario backend.
 *
 * These test the parts whose failure would be MISATTRIBUTED. A wrong scenario selection or a wrong
 * locale would surface in Playwright as "the page rendered the wrong thing", which reads as an
 * application defect; a port that is not released would surface as an unexplained failure in the NEXT
 * run. Both are cheaper to catch here, and neither is visible from the e2e lane at all.
 *
 * No snapshots: every assertion names the behaviour it protects.
 */

const url = (path: string) => `${API_PREFIX}${path}`

describe('route selection', () => {
  it('serves the page shell endpoints, which must stay healthy in every scenario', () => {
    // If these failed alongside the projects read, the "unavailable API" tests would be asserting
    // against a broken shell instead of a working page with a failed section.
    expect(resolveRequest(url('/settings/site?locale=en'))).toMatchObject({ kind: 'json', status: 200 })
    expect(resolveRequest(url('/skills?locale=en'))).toMatchObject({ kind: 'json', status: 200 })
  })

  it('serves the all-null Page SEO override for every known static page', () => {
    for (const pageKey of PAGE_SEO_KEYS) {
      expect(resolveRequest(url(`/seo/pages/${pageKey}?locale=ar`))).toEqual({
        kind: 'json',
        status: 200,
        body: {
          data: {
            pageKey,
            locale: 'ar',
            metaTitle: null,
            metaDescription: null,
            ogImageId: null,
            ogImage: null,
            canonicalUrl: null
          }
        }
      })
    }
  })

  it('answers the unfiltered index with a well-formed empty page', () => {
    const reply = resolveRequest(url('/projects?locale=en&page=1'))

    expect(reply).toMatchObject({ kind: 'json', status: 200 })
    expect(reply).toHaveProperty('body.data', [])
    expect(reply).toHaveProperty('body.meta.total', 0)
    // `totalPages: 0` is what keeps pagination correctly absent rather than offering a second page.
    expect(reply).toHaveProperty('body.meta.totalPages', 0)
  })

  it('selects each index scenario from the technology filter alone', () => {
    expect(resolveRequest(url(`/projects?locale=en&technology=${TECHNOLOGY.noMatches}`)))
      .toMatchObject({ kind: 'json', status: 200 })
    expect(resolveRequest(url(`/projects?locale=en&technology=${TECHNOLOGY.unreachable}`)))
      .toEqual({ kind: 'destroy' })
    expect(resolveRequest(url(`/projects?locale=en&technology=${TECHNOLOGY.upstream503}`)))
      .toMatchObject({ kind: 'problem', status: 503 })
  })

  it('selects each detail scenario from the slug alone', () => {
    expect(resolveRequest(url(`/projects/${SLUG.canonical.en}?locale=en`)))
      .toMatchObject({ kind: 'json', status: 200 })
    expect(resolveRequest(url(`/projects/${SLUG.emptyGallery.en}?locale=en`)))
      .toHaveProperty('body.data.gallery', [])
    expect(resolveRequest(url(`/projects/${SLUG.unknown.en}?locale=en`)))
      .toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest(url(`/projects/${SLUG.upstreamFailure.en}?locale=en`)))
      .toMatchObject({ kind: 'problem', status: 503 })
  })

  it('404s the renamed slug, because the redirect table — not the project read — resolves it', () => {
    // The two-step branch under test depends on this being a 404 rather than a 200 or a 3xx.
    expect(resolveRequest(url(`/projects/${SLUG.renamed.en}?locale=en`)))
      .toMatchObject({ kind: 'problem', status: 404 })
  })

  it('serves the one bilingual article pair D06-6 is proven on', () => {
    expect(resolveRequest(url(`/articles/${ARTICLE_SLUG.bilingual.en}?locale=en`)))
      .toMatchObject({ kind: 'json', status: 200 })
    expect(resolveRequest(url(`/articles/${ARTICLE_SLUG.bilingual.ar}?locale=ar`)))
      .toMatchObject({ kind: 'json', status: 200 })
  })

  it('refuses to act as a general mock API', () => {
    // Scope guard: an endpoint nobody added on purpose must fail loudly, not return something
    // plausible. This is what keeps the backend bounded (D18-6).
    //
    // `/articles` USED TO BE ONE OF THESE. WS E added the blog category filter, so the blog index is
    // now a deliberate scenario and is asserted positively below. The guard is narrowed to endpoints
    // that are still genuinely unadded rather than deleted — deleting it would retire the scope rule
    // along with the one endpoint that outgrew it.
    expect(resolveRequest(url('/tags?locale=en'))).toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest(url('/testimonials?locale=en'))).toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest(url('/seo/pages/not-a-page?locale=en'))).toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest('/not-the-api/projects?locale=en')).toMatchObject({ kind: 'problem', status: 404 })
  })

  it('serves the blog index and the category list, which WS E added on purpose', () => {
    expect(resolveRequest(url('/articles?locale=en'))).toMatchObject({ kind: 'json', status: 200 })
    expect(resolveRequest(url('/categories?locale=en'))).toMatchObject({ kind: 'json', status: 200 })
  })

  it('answers an unknown category exactly like a known-but-empty one — 200, empty page', () => {
    // This is the real API's behaviour and the whole reason the page cannot tell the wrong-locale case
    // from a genuinely empty topic by looking at the response. If this ever diverged, the blog index's
    // third empty state would be testing a fiction.
    const known = resolveRequest(url(`/articles?locale=ar&category=${CATEGORY.noMatches.ar}`))
    const wrongLocale = resolveRequest(url(`/articles?locale=ar&category=${CATEGORY.noMatches.en}`))
    expect(known).toMatchObject({ kind: 'json', status: 200 })
    expect(wrongLocale).toEqual(known)
  })

  // `/experiences` (008) — the locale IS the scenario selector, because `/experience` forwards no
  // parameter this backend could key off. One URL still means one deterministic scenario.
  it('serves an empty experience list in English (the empty-state scenario)', () => {
    expect(resolveRequest(url('/experiences?locale=en')))
      .toMatchObject({ kind: 'json', status: 200, body: { data: [] } })
  })

  it('fails the Arabic experience request (the RTL error-state scenario)', () => {
    expect(resolveRequest(url('/experiences?locale=ar')))
      .toMatchObject({ kind: 'problem', status: 503 })
  })

  it('decodes a percent-encoded slug before selecting the scenario', () => {
    const encoded = encodeURIComponent(SLUG.canonical.en)
    expect(resolveRequest(url(`/projects/${encoded}?locale=en`))).toMatchObject({ kind: 'json', status: 200 })
  })
})

describe('locale selection', () => {
  it('serves each locale its own authored content', () => {
    const english = resolveRequest(url(`/projects/${SLUG.bilingual.en}?locale=en`))
    const arabic = resolveRequest(url(`/projects/${SLUG.bilingual.ar}?locale=ar`))

    expect(english).toHaveProperty('body.data.title', 'Bilingual differentiation study')
    expect(arabic).toHaveProperty('body.data.title', 'دراسة تمايز اللغتين')
  })

  it('does not fall back across locales', () => {
    // Asking for the English slug in Arabic must MISS. A fallback here would make the EN/AR
    // differentiation scenario pass while the application silently served English on /ar.
    expect(resolveRequest(url(`/projects/${SLUG.bilingual.en}?locale=ar`)))
      .toMatchObject({ kind: 'problem', status: 404 })
  })

  it('404s a per-locale slug asked for in the WRONG locale — the F-1 fault, reproduced', () => {
    // This is exactly what the application used to send during a client-side locale switch: the
    // INCOMING slug with the OUTGOING locale. The backend answering 404 here is what makes the
    // D06-6 e2e tests meaningful — if it fell back, the fix would be untestable.
    expect(resolveRequest(url(`/projects/${SLUG.bilingual.ar}?locale=en`)))
      .toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest(url(`/articles/${ARTICLE_SLUG.bilingual.ar}?locale=en`)))
      .toMatchObject({ kind: 'problem', status: 404 })
    expect(resolveRequest(url(`/articles/${ARTICLE_SLUG.bilingual.en}?locale=ar`)))
      .toMatchObject({ kind: 'problem', status: 404 })
  })

  it('localizes the shell endpoints too', () => {
    expect(resolveRequest(url('/settings/site?locale=ar'))).toHaveProperty('body.data.siteName', 'إسلام معتمد')
    expect(resolveRequest(url('/skills?locale=ar'))).toHaveProperty('body.data.0.label', 'سيناريو — لا مشاريع مطابقة')
  })

  it('rejects a missing or unsupported locale instead of defaulting to English', () => {
    // `useApi()` puts `?locale=` on every public GET (D10-6). Silently defaulting would hide a real
    // regression in that injection — the request would still succeed and the page would still render.
    expect(resolveRequest(url('/projects'))).toMatchObject({ kind: 'problem', status: 422 })
    expect(resolveRequest(url('/projects?locale=fr'))).toMatchObject({ kind: 'problem', status: 422 })
  })
})

describe('redirect resolution', () => {
  it('answers the renamed path with that locale’s canonical path', () => {
    expect(resolveRequest(url(`/redirects/resolve?locale=en&path=/projects/${SLUG.renamed.en}`)))
      .toHaveProperty('body.data.toPath', `/projects/${SLUG.canonical.en}`)
    expect(resolveRequest(url(`/redirects/resolve?locale=ar&path=/projects/${SLUG.renamed.ar}`)))
      .toHaveProperty('body.data.toPath', `/projects/${SLUG.canonical.ar}`)
  })

  it('returns a section-relative path, which the caller localizes', () => {
    // A locale-prefixed `toPath` would be double-prefixed by `localePath()` on the way out.
    const reply = resolveRequest(url(`/redirects/resolve?locale=ar&path=/projects/${SLUG.renamed.ar}`))
    expect(reply).toHaveProperty('body.data.toPath', expect.not.stringContaining('/ar/'))
  })

  it('resolves to a slug that itself exists, so no redirect loop is possible', () => {
    const reply = resolveRequest(url(`/redirects/resolve?locale=en&path=/projects/${SLUG.renamed.en}`))
    const toPath = (reply as { body: { data: { toPath: string } } }).body.data.toPath

    expect(resolveRequest(url(`${toPath}?locale=en`))).toMatchObject({ kind: 'json', status: 200 })
  })

  it('misses with a 404 for an unknown path, which is a normal answer and not a failure', () => {
    expect(resolveRequest(url(`/redirects/resolve?locale=en&path=/projects/${SLUG.unknown.en}`)))
      .toMatchObject({ kind: 'problem', status: 404 })
  })

  it('rejects a request with no path', () => {
    expect(resolveRequest(url('/redirects/resolve?locale=en'))).toMatchObject({ kind: 'problem', status: 422 })
  })
})

describe('RFC 7807 failure responses', () => {
  it('uses the contract’s problem shape for every error, with no invented fields', () => {
    for (const path of [
      `/projects/${SLUG.unknown.en}?locale=en`,
      `/projects/${SLUG.upstreamFailure.en}?locale=en`,
      `/projects?locale=en&technology=${TECHNOLOGY.upstream503}`,
      '/projects?locale=fr'
    ]) {
      const reply = resolveRequest(url(path))
      expect(reply.kind, path).toBe('problem')

      const body = (reply as { body: Record<string, unknown> }).body
      // RFC 7807's members, and the contract's five required ones exactly.
      expect(Object.keys(body).sort(), path).toEqual(['detail', 'instance', 'status', 'title', 'type'])
      expect(typeof body.detail, path).toBe('string')
      expect(body.instance, path).toBe(url(new URL(path, 'http://x.invalid').pathname))
    }
  })

  it('serves problem bodies with the problem+json content type over the wire', async () => {
    const { origin, close } = await listen()
    try {
      const response = await fetch(`${origin}${API_PREFIX}/projects/${SLUG.unknown.en}?locale=en`)

      expect(response.status).toBe(404)
      // `toApiError` only recognizes a problem document when the client parses it as JSON; ofetch
      // decides that from the content type, so this header is load-bearing, not cosmetic.
      expect(response.headers.get('content-type')).toContain('application/problem+json')
      await expect(response.json()).resolves.toMatchObject({ status: 404, type: 'about:blank' })
    } finally {
      await close()
    }
  })

  it('destroys the connection for the unreachable scenario rather than answering', async () => {
    const { origin, close } = await listen()
    try {
      // A genuine transport failure: `fetch` rejects, it does not resolve with an error status.
      await expect(
        fetch(`${origin}${API_PREFIX}/projects?locale=en&technology=${TECHNOLOGY.unreachable}`)
      ).rejects.toThrow()
    } finally {
      await close()
    }
  })
})

describe('shutdown and port cleanup', () => {
  it('releases the port immediately, so the next run can rebind it', async () => {
    const { port, close } = await listen()

    await close()

    // Rebinding the SAME port is the only assertion that actually proves the port was released; a
    // closed server object proves nothing about the socket. This is the failure mode
    // `scripts/lib/process-group.mjs` was written for, one level down.
    await expect(canBind(port)).resolves.toBe(true)
  })

  it('releases the port even while a keep-alive connection is open', async () => {
    const { origin, port, close } = await listen()

    // An idle keep-alive socket is exactly what makes `close()` alone hang: it stops accepting new
    // connections but waits for existing ones to drain.
    const agentResponse = await fetch(`${origin}${API_PREFIX}/skills?locale=en`)
    await agentResponse.json()

    await close()
    await expect(canBind(port)).resolves.toBe(true)
  })

  it('is safe to stop a server that was never started', async () => {
    await expect(stopScenarioServer(createScenarioServer())).resolves.toBeUndefined()
  })
})

/** Start the scenario server on an EPHEMERAL port, so parallel test files never collide. */
async function listen(): Promise<{ origin: string, port: number, close: () => Promise<void> }> {
  const server = createScenarioServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('expected a TCP address')

  return {
    origin: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () => stopScenarioServer(server)
  }
}

/** True when `port` can be bound right now — i.e. nothing is still holding it. */
function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}
