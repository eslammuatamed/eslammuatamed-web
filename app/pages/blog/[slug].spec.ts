// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import BlogArticle from './[slug].vue'

// D10-20 on the article DETAIL surface. `category` is `TaxonomyRef | null`: an article whose
// category has no translation in the requested locale is still fully readable, and the eyebrow that
// normally carries the category name is simply absent — no blank kicker, no "Uncategorized".
//
// `useApi` is stubbed rather than intercepted by route, for the reason the preview spec documents:
// a relative `registerEndpoint` only matches while `apiBase` is '', so it stops matching under CI.
// The slug selects the shape, so both states stay deterministic.

const { ARTICLE } = vi.hoisted(() => ({
  ARTICLE: {
    id: 'article-1',
    title: 'Designing a modular monolith',
    slug: 'with-category',
    excerpt: 'Why one deployable with hard module seams beats microservices here.',
    readingTimeMin: 7,
    publishAt: '2026-03-15T00:00:00.000Z',
    coverImageId: null,
    coverImage: null,
    category: { id: 'c1', name: 'Engineering', slug: 'engineering' },
    tags: [],
    availableLocales: ['en'],
    slugs: { en: 'with-category' },
    body: '# Heading\n\nBody.',
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    ogImage: null,
    canonicalUrl: null
  }
}))

mockNuxtImport('useApi', () => {
  return () => async (request: string) => {
    if (request.endsWith('/no-category')) {
      return { data: { ...ARTICLE, slug: 'no-category', category: null, slugs: { en: 'no-category' } } }
    }
    return { data: ARTICLE }
  }
})

// ContentProse renders through the internal /api/prose Nitro route; stub it so these assertions do
// not pull in the real Shiki pipeline (covered by Prose.spec).
registerEndpoint('/api/prose', { method: 'POST', handler: () => ({ html: '<p>Body.</p>' }) })

/** The eyebrow above the title — the only element that carries the category name on this page. */
const kicker = (wrapper: { find: (s: string) => { exists: () => boolean, text: () => string } }) =>
  wrapper.find('header .kicker')

describe('blog/[slug]', () => {
  it('renders the category eyebrow when the category is translated', async () => {
    const wrapper = await mountSuspended(BlogArticle, { route: '/blog/with-category' })
    try {
      expect(wrapper.find('h1').text()).toContain('Designing a modular monolith')
      expect(kicker(wrapper).exists()).toBe(true)
      expect(kicker(wrapper).text()).toBe('Engineering')
    } finally {
      wrapper.unmount()
    }
  })

  describe('with an untranslated category (D10-20)', () => {
    it('still renders the article and its body', async () => {
      const wrapper = await mountSuspended(BlogArticle, { route: '/blog/no-category' })
      try {
        expect(wrapper.find('h1').text()).toContain('Designing a modular monolith')
        expect(wrapper.find('.content-prose').exists()).toBe(true)
      } finally {
        wrapper.unmount()
      }
    })

    it('renders no eyebrow at all rather than a blank one or a placeholder', async () => {
      const wrapper = await mountSuspended(BlogArticle, { route: '/blog/no-category' })
      try {
        // The element is absent, not present-and-empty — a blank kicker would still occupy the slot.
        expect(kicker(wrapper).exists()).toBe(false)
        expect(wrapper.text()).not.toContain('Engineering')
        expect(wrapper.text()).not.toContain('Uncategorized')
      } finally {
        wrapper.unmount()
      }
    })

    it('emits no category link, empty-query or otherwise', async () => {
      const wrapper = await mountSuspended(BlogArticle, { route: '/blog/no-category' })
      try {
        const hrefs = wrapper.findAll('a').map(a => a.attributes('href') ?? '')
        expect(hrefs.some(href => href.includes('category='))).toBe(false)
      } finally {
        wrapper.unmount()
      }
    })
  })
})
