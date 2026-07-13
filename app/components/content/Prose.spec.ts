// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { renderMarkdown } from '../../../server/utils/markdown'
import Prose from './Prose.vue'

// ContentProse is the single Markdown surface (D12-4): it hands the source to the /api/prose Nitro
// renderer and injects the returned HTML via v-html. This mounts the component against the REAL
// renderer (through a mocked endpoint) so the three rendering contracts are verified end-to-end at
// the component boundary — hostile input renders inert (D19-5), fences are Shiki-highlighted
// (D20-3), and headings get anchors — with no network and no highlighting JS on the client.
const SOURCE = [
  '# Hello World',
  '',
  '```ts',
  'const answer = 42',
  '```',
  '',
  '<script>alert(1)</script>',
  '',
  '<img src=x onerror=alert(1)>'
].join('\n')

registerEndpoint('/api/prose', {
  method: 'POST',
  handler: async () => ({ html: await renderMarkdown(SOURCE) })
})

describe('ContentProse', () => {
  it('renders renderer HTML via v-html: anchored heading, highlighted fence, inert hostile input', async () => {
    const wrapper = await mountSuspended(Prose, {
      props: { source: SOURCE, cacheKey: 'article-1:en' }
    })

    const prose = wrapper.find('.content-prose')
    expect(prose.exists()).toBe(true)

    // Heading anchor (drives the future TOC) is a real element id.
    expect(prose.find('h1#hello-world').exists()).toBe(true)

    // Fenced code was highlighted during SSR — Shiki markup is present as static DOM.
    expect(prose.find('.shiki').exists()).toBe(true)

    // Hostile raw HTML never became live nodes; it survives only as escaped text.
    expect(prose.find('script').exists()).toBe(false)
    expect(prose.find('img').exists()).toBe(false)
    expect(prose.html()).toContain('&lt;script&gt;')
  })
})
