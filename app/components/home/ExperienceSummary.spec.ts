// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import ExperienceSummary from './ExperienceSummary.vue'

// A current role must lead even when its start date predates a newer past role (WD-7); empty → omitted.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const make = (id: string, isCurrent: boolean, startDate: string): Experience => ({
  id,
  role: id,
  company: 'Co',
  location: '',
  impact: '',
  employmentType: 'FULL_TIME',
  isCurrent,
  startDate,
  endDate: isCurrent ? null : startDate,
  order: 0,
  availableLocales: ['en']
})

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div><slot name="action" /></div>', props: ['eyebrow', 'title'] },
  UiStateError: { template: '<div class="state-error" />' },
  UiSectionSkeleton: { template: '<div />', props: ['count'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  ContentExperienceItem: { template: '<li class="expitem">{{ experience.id }}</li>', props: ['experience'] }
}

describe('HomeExperienceSummary', () => {
  it('places the current role first even if its start date is older', async () => {
    const experiences = [
      make('past-newer', false, '2023-01-01T00:00:00.000Z'),
      make('current-older', true, '2020-01-01T00:00:00.000Z')
    ]
    const wrapper = await mountSuspended(ExperienceSummary, { props: { experiences }, global: { stubs } })
    const ids = wrapper.findAll('.expitem').map(li => li.text())
    expect(ids[0]).toBe('current-older')
  })

  it('omits the section when there are no experiences', async () => {
    const wrapper = await mountSuspended(ExperienceSummary, { props: { experiences: [] }, global: { stubs } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
