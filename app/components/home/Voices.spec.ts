// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Testimonial } from '~/types/models'
import Voices from './Voices.vue'

// Voices (FR-PUB-016) renders testimonials in API order (no client-side re-sort). Empty result omits
// the section unless loading/erroring (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiSectionHead: {
    props: ['eyebrow', 'title', 'titleId'],
    template: '<div><h2 :id="titleId">{{ title }}</h2><slot name="action" /></div>'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  UiSectionSkeleton: { template: '<div class="section-skeleton" />', props: ['count'] },
  ContentQuoteBlock: { template: '<div class="quote-block">{{ testimonial.authorName }}</div>', props: ['testimonial'] }
}

const testimonial = (overrides: Partial<Testimonial>): Testimonial => ({
  id: overrides.authorName ?? 'id',
  avatarId: null,
  avatar: null,
  order: 0,
  quote: 'Quote',
  authorName: 'Author',
  authorRole: 'Role',
  availableLocales: ['en'],
  ...overrides
})

describe('HomeVoices', () => {
  it('renders a quote block per testimonial, honoring API order', async () => {
    const testimonials: Testimonial[] = [
      testimonial({ authorName: 'Alex Morgan' }),
      testimonial({ authorName: 'Sam Lee' })
    ]
    const wrapper = await mountSuspended(Voices, { props: { testimonials }, global: { stubs } })
    const names = wrapper.findAll('.quote-block').map(el => el.text())
    expect(names).toEqual(['Alex Morgan', 'Sam Lee'])
  })

  it('hides when there are no testimonials and the section is idle', async () => {
    const wrapper = await mountSuspended(Voices, {
      props: { testimonials: [], pending: false, error: false },
      global: { stubs }
    })
    expect(wrapper.find('#voices-title').exists()).toBe(false)
  })

  it('shows a skeleton while pending, even with no testimonials yet', async () => {
    const wrapper = await mountSuspended(Voices, {
      props: { testimonials: null, pending: true },
      global: { stubs }
    })
    expect(wrapper.find('#voices-title').exists()).toBe(true)
    expect(wrapper.find('.section-skeleton').exists()).toBe(true)
  })

  it('renders an inline error and emits retry', async () => {
    const wrapper = await mountSuspended(Voices, {
      props: { testimonials: null, error: true },
      global: { stubs }
    })
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
