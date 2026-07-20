// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PreviewProject from './[id].vue'

// The project preview page has no live counterpart, so this is the only runtime exercise of its
// net-new markup: section filtering (empty sections dropped), the technology badges, and the sorted
// gallery. Same two states as the article page — a valid token renders the draft; a 404 shows the
// opaque unavailable state.
// `usePreview` reaches the API through `useApi`, whose baseURL is `config.public.apiBase` — '' locally
// but SET in CI (NUXT_PUBLIC_API_BASE). A relative `registerEndpoint('/preview/…')` only intercepts
// when the baseURL is '', so under CI it stops matching `${apiBase}/preview/…` and the success case
// flakes to the unavailable state. Stub the single API door instead (`usePreview` is the only `useApi`
// consumer in this mounted tree): a valid token resolves the Envelope, `id: 'expired'` throws the
// API's 404, and both states stay deterministic regardless of `apiBase`.

const { DRAFT } = vi.hoisted(() => ({
  DRAFT: {
    id: 'project-draft-1',
    slug: 'draft-project',
    title: 'Unpublished Project Draft',
    summary: 'A short draft summary.',
    featured: false,
    year: 2026,
    technologies: [{ id: 't1', label: 'Nuxt' }, { id: 't2', label: 'TypeScript' }],
    availableLocales: ['en'],
    slugs: { en: 'draft-project' },
    liveUrl: null,
    repoUrl: null,
    overview: '## Overview body\n\nText.',
    businessProblem: 'The problem.',
    solution: '', // empty → section must be skipped
    role: '',
    architecture: '',
    challenges: '',
    features: '',
    lessonsLearned: '',
    gallery: [
      { mediaAssetId: 'm1', order: 1, caption: 'Second', mediaAsset: { id: 'm1', kind: 'image', url: 'https://cdn.example/2.png', width: 800, height: 600, blurhash: null, alt: 'Two', variants: [] } },
      { mediaAssetId: 'm0', order: 0, caption: null, mediaAsset: { id: 'm0', kind: 'image', url: 'https://cdn.example/1.png', width: 800, height: 600, blurhash: null, alt: 'One', variants: [] } }
    ],
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    ogImage: null,
    canonicalUrl: null
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

// ContentProse renders each section through the internal /api/prose Nitro route (a raw $fetch, not
// useApi); stub it so the success case has markup without pulling in the real Shiki pipeline.
registerEndpoint('/api/prose', { method: 'POST', handler: () => ({ html: '<p>section body</p>' }) })

describe('preview/projects/[id]', () => {
  it('renders the draft with sections, badges, and gallery when the token resolves', async () => {
    const wrapper = await mountSuspended(PreviewProject, { route: '/preview/projects/ok?token=valid' })
    try {
      expect(wrapper.find('[data-testid="preview-unavailable"]').exists()).toBe(false)
      expect(wrapper.find('h1').text()).toContain('Unpublished Project Draft')
      // Non-empty sections render (Overview + Business problem); empty ones are dropped.
      const headings = wrapper.findAll('h2').map(h => h.text())
      expect(headings).toContain('Overview')
      expect(headings).toContain('Business problem')
      expect(headings).not.toContain('Solution')
      // Technology badges + gallery images render.
      expect(wrapper.text()).toContain('TypeScript')
      expect(wrapper.findAll('img').length).toBe(2)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the opaque unavailable state when the token yields 404', async () => {
    const wrapper = await mountSuspended(PreviewProject, { route: '/preview/projects/expired?token=stale' })
    try {
      expect(wrapper.find('[data-testid="preview-unavailable"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Unpublished Project Draft')
    } finally {
      wrapper.unmount()
    }
  })
})
