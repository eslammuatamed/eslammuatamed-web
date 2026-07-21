// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Testimonial } from '~/types/models'
import Testimonials from './Testimonials.vue'

// Testimonials render as a linear layout (no carousel, D13-10), ordered by `order`, and the section is
// omitted when there are none (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const make = (id: string, order: number): Testimonial => ({
  id,
  avatarId: null,
  avatar: null,
  order,
  quote: `quote ${id}`,
  authorName: `Author ${id}`,
  authorRole: 'Engineering Manager',
  availableLocales: ['en']
})

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div />', props: ['eyebrow', 'title'] },
  UiStateError: { template: '<div class="state-error" />' },
  UiSectionSkeleton: { template: '<div class="skeleton" />', props: ['count'] },
  ContentTestimonialCard: { template: '<figure class="tcard">{{ testimonial.id }}</figure>', props: ['testimonial'] }
}

describe('HomeTestimonials', () => {
  it('renders a card per visible testimonial', async () => {
    const wrapper = await mountSuspended(Testimonials, {
      props: { testimonials: [make('a', 1), make('b', 0)] },
      global: { stubs }
    })
    expect(wrapper.findAll('.tcard')).toHaveLength(2)
  })

  it('omits the section when there are no testimonials', async () => {
    const wrapper = await mountSuspended(Testimonials, { props: { testimonials: [] }, global: { stubs } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
