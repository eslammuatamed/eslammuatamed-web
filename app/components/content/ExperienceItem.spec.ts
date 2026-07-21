// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import ExperienceItem from './ExperienceItem.vue'

// The item shows role @ company, a formatted period (present label for a current role), and the
// localized employment-type label from the enum code (D09-9).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const current: Experience = {
  id: 'e1',
  role: 'Senior Frontend Engineer',
  company: 'Acme',
  location: 'Cairo',
  impact: '- shipped things',
  employmentType: 'FULL_TIME',
  isCurrent: true,
  startDate: '2023-11-01T00:00:00.000Z',
  endDate: null,
  order: 0,
  availableLocales: ['en']
}

describe('ContentExperienceItem', () => {
  it('renders role, company, period and employment-type label', async () => {
    const wrapper = await mountSuspended(ExperienceItem, { props: { experience: current } })
    const text = wrapper.text()
    expect(text).toContain('Senior Frontend Engineer')
    expect(text).toContain('Acme')
    expect(text).toContain('Cairo')
    // employment-type maps the enum to a localized key
    expect(text).toContain('home.experience.employmentType.FULL_TIME')
    // a current role formats "start – <present label>"
    expect(text).toContain('2023')
    expect(text).toContain('home.experience.present')
  })
})
