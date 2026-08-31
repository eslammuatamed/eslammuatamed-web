// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Testimonial } from '~/types/models'
import QuoteBlock from './QuoteBlock.vue'

// This stub models the package's server-only inline handler. The component no longer renders NuxtImg,
// but retaining the stub makes the no-inline-handler assertion discriminating: restoring NuxtImg makes
// that assertion fail rather than merely proving the current DOM happened not to contain the string.
const stubs = {
  NuxtImg: {
    template: '<img :src="src" :alt="alt" :width="width" :height="height" :loading="loading" data-nuxt-img onerror="this.setAttribute(\'data-error\', 1)">',
    props: ['src', 'alt', 'width', 'height', 'loading']
  }
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

  it('renders a native avatar image with the existing semantics and no inline handler', async () => {
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
    expect(img.attributes('alt')).toBe('Alex Morgan')
    expect(img.attributes('width')).toBe('40')
    expect(img.attributes('height')).toBe('40')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.classes()).toEqual(expect.arrayContaining(['size-10', 'shrink-0', 'rounded-full', 'object-cover']))
    expect(img.attributes('onerror')).toBeUndefined()
    expect(img.attributes('data-nuxt-img')).toBeUndefined()
  })
})
