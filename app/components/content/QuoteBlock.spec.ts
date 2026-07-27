// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Testimonial } from '~/types/models'
import QuoteBlock from './QuoteBlock.vue'

// Quote block (FR-PUB-016) — a testimonial pull quote. When there is no avatar (the current contract),
// attribution falls back to a monogram of the author's first character; when an avatar is present it
// renders through NuxtImg instead, with no layout change.
const stubs = {
  NuxtImg: { template: '<img :src="src" :alt="alt">', props: ['src', 'alt'] }
}

const testimonial = (overrides: Partial<Testimonial> = {}): Testimonial => ({
  id: 't1',
  avatarId: null,
  avatar: null,
  order: 0,
  quote: 'This team delivered beyond expectations.',
  authorName: 'Alex Morgan',
  authorRole: 'CTO, Acme',
  availableLocales: ['en'],
  ...overrides
})

describe('ContentQuoteBlock', () => {
  it('renders the quote, authorName and authorRole', async () => {
    const wrapper = await mountSuspended(QuoteBlock, { props: { testimonial: testimonial() }, global: { stubs } })
    expect(wrapper.find('blockquote').text()).toBe('This team delivered beyond expectations.')
    expect(wrapper.text()).toContain('Alex Morgan')
    expect(wrapper.text()).toContain('CTO, Acme')
  })

  it('shows a monogram of the first authorName character when avatar is null', async () => {
    const wrapper = await mountSuspended(QuoteBlock, {
      props: { testimonial: testimonial({ authorName: 'Sam Lee', avatar: null }) },
      global: { stubs }
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('figcaption span[aria-hidden="true"]').text()).toBe('S')
  })

  it('renders a NuxtImg when avatar.url is set', async () => {
    const wrapper = await mountSuspended(QuoteBlock, {
      props: {
        testimonial: testimonial({
          avatar: {
            id: 'm1',
            kind: 'IMAGE',
            url: 'https://media.example.com/avatar.webp',
            width: 200,
            height: 200,
            blurhash: null,
            alt: null,
            variants: []
          }
        })
      },
      global: { stubs }
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://media.example.com/avatar.webp')
  })
})
