// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PreviewArticle from './[id].vue'

// The article preview page loads a DRAFT via the public preview route and renders it through the
// same header + ContentProse markup as the live blog page. Two states matter for a reviewer:
//   - a valid token → the draft renders (title + body);
//   - a bad/expired/absent token → the API answers 404 (draft concealment), and the page shows the
//     opaque "unavailable" state rather than leaking why or throwing to the error page.
// `useApi`'s baseURL is `config.public.apiBase`, which is '' in the test runtime, so these relative
// endpoints intercept the real call. `id: 'ok'` resolves via the `/preview/articles/[id]` route.

const DRAFT = {
  id: 'article-draft-1',
  title: 'Unpublished Draft Title',
  body: '# Draft heading\n\nDraft body.',
  excerpt: 'Draft excerpt',
  readingTimeMin: 4,
  publishAt: null,
  category: { id: 'cat-1', name: 'Engineering', slug: 'engineering' }
}

registerEndpoint('/preview/articles/ok', () => ({ data: DRAFT }))
registerEndpoint('/preview/articles/expired', () => {
  // Mirrors the API's concealment contract: any bad/expired/absent token is a 404, never 401/403.
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
// ContentProse renders the body through the internal /api/prose Nitro route; stub it so the success
// case has markup without pulling in the real Shiki pipeline (covered by Prose.spec).
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
