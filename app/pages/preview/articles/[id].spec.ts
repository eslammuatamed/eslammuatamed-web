// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PreviewArticle from './[id].vue'

// The article preview page loads a DRAFT via the public preview route and renders it through the
// same header + ContentProse markup as the live blog page. Two states matter for a reviewer:
//   - a valid token → the draft renders (title + body);
//   - a bad/expired/absent token → the API answers 404 (draft concealment), and the page shows the
//     opaque "unavailable" state rather than leaking why or throwing to the error page.
// `usePreview` reaches the API through `useApi`, whose baseURL is `config.public.apiBase` — '' locally
// but SET in CI (NUXT_PUBLIC_API_BASE). A relative `registerEndpoint('/preview/…')` only intercepts
// when the baseURL is '', so under CI it stops matching `${apiBase}/preview/…` and the success case
// flakes to the unavailable state. Stub the single API door instead (`usePreview` is the only `useApi`
// consumer in this mounted tree): a valid token resolves the Envelope, `id: 'expired'` throws the
// API's 404, and both states stay deterministic regardless of `apiBase`.

const { DRAFT } = vi.hoisted(() => ({
  DRAFT: {
    id: 'article-draft-1',
    title: 'Unpublished Draft Title',
    body: '# Draft heading\n\nDraft body.',
    excerpt: 'Draft excerpt',
    readingTimeMin: 4,
    publishAt: null,
    category: { id: 'cat-1', name: 'Engineering', slug: 'engineering' }
  }
}))

mockNuxtImport('useApi', () => {
  // Returns the apiFetch closure `useApi()` yields. `usePreview` swallows any throw into the opaque
  // `unavailable` state, so the expired id mirrors the API's 404 concealment (never 401/403).
  return () => async (request: string) => {
    if (request.endsWith('/expired')) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
    return { data: DRAFT }
  }
})

// ContentProse renders the body through the internal /api/prose Nitro route (a raw $fetch, not
// useApi); stub it so the success case has markup without pulling in the real Shiki pipeline
// (covered by Prose.spec).
registerEndpoint('/api/prose', { method: 'POST', handler: () => ({ html: '<p>Draft body.</p>' }) })

describe('preview/articles/[id]', () => {
  it('renders the draft when the token resolves (success state)', async () => {
    const wrapper = await mountSuspended(PreviewArticle, { route: '/preview/articles/ok?token=valid' })
    try {
      expect(wrapper.find('[data-testid="preview-unavailable"]').exists()).toBe(false)
      expect(wrapper.find('h1').text()).toContain('Unpublished Draft Title')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the opaque unavailable state when the token yields 404 (expired state)', async () => {
    const wrapper = await mountSuspended(PreviewArticle, { route: '/preview/articles/expired?token=stale' })
    try {
      expect(wrapper.find('[data-testid="preview-unavailable"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Unpublished Draft Title')
    } finally {
      wrapper.unmount()
    }
  })
})
