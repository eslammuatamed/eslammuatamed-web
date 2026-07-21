// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { MediaImage, Testimonial } from '~/types/models'
import TestimonialCard from './TestimonialCard.vue'

// Renders quote + author; avatar via <NuxtImg> when present, an initial fallback (never a broken image)
// when the descriptor is null.
const avatar: MediaImage = {
  id: 'a1',
  kind: 'IMAGE',
  url: 'https://media.example.com/a.webp',
  width: 80,
  height: 80,
  blurhash: null,
  alt: 'Sara',
  variants: []
}

const make = (withAvatar: boolean): Testimonial => ({
  id: 't1',
  avatarId: withAvatar ? 'a1' : null,
  avatar: withAvatar ? avatar : null,
  order: 0,
  quote: 'Great collaborator.',
  authorName: 'Sara Ali',
  authorRole: 'Engineering Manager',
  availableLocales: ['en']
})

const stubs = {
  NuxtImg: { template: '<img :src="src" :alt="alt" />', props: ['src', 'alt', 'width', 'height', 'loading'] }
}

describe('ContentTestimonialCard', () => {
  it('renders the avatar image when a descriptor is present', async () => {
    const wrapper = await mountSuspended(TestimonialCard, { props: { testimonial: make(true) }, global: { stubs } })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://media.example.com/a.webp')
    expect(wrapper.text()).toContain('Great collaborator.')
    expect(wrapper.text()).toContain('Sara Ali')
  })

  it('falls back to an initial (no image) when the avatar is null', async () => {
    const wrapper = await mountSuspended(TestimonialCard, { props: { testimonial: make(false) }, global: { stubs } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('S')
  })
})
