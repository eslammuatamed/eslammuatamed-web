// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Skill } from '~/types/models'
import TechStack from './TechStack.vue'

// The tech-stack section carries the three-state contract (doc 13 §1): populated, empty (→ omitted),
// and error (→ inline retry). Empty-omit is the graceful-degradation guarantee (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const skills: Skill[] = [
  { id: 's1', label: 'TypeScript', group: 'LANGUAGE', order: 0, brandColor: '#3178C6', availableLocales: ['en'] },
  { id: 's2', label: 'Vue.js', group: 'FRAMEWORK', order: 0, brandColor: '#42B883', availableLocales: ['en'] }
]

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div><slot name="action" /></div>', props: ['eyebrow', 'title'] },
  UiTechBadge: { template: '<span class="badge">{{ label }}</span>', props: ['label', 'brandColor'] },
  UiStateError: { template: '<div class="state-error" />' },
  UiSectionSkeleton: { template: '<div class="skeleton" />', props: ['count'] }
}

describe('HomeTechStack', () => {
  it('renders one badge per skill', async () => {
    const wrapper = await mountSuspended(TechStack, { props: { skills }, global: { stubs } })
    expect(wrapper.findAll('.badge')).toHaveLength(2)
    expect(wrapper.text()).toContain('TypeScript')
  })

  it('omits the whole section when there are no skills', async () => {
    const wrapper = await mountSuspended(TechStack, { props: { skills: [] }, global: { stubs } })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('shows an inline error (not badges) when the endpoint failed', async () => {
    const wrapper = await mountSuspended(TechStack, {
      props: { skills: null, error: true },
      global: { stubs }
    })
    expect(wrapper.find('.state-error').exists()).toBe(true)
    expect(wrapper.find('.badge').exists()).toBe(false)
  })
})
