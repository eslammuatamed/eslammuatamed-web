// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import { formatExperiencePeriod } from '../../utils/format'
import TimelineEntry from './TimelineEntry.vue'

// Timeline entry (FR-PUB-013) — `impact` is a Markdown bullet string in the contract; it is split into
// `<li>` items here with the leading "- "/"* " marker stripped. A current role gets the violet marker
// class; a past role does not.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const experience = (overrides: Partial<Experience> = {}): Experience => ({
  id: 'e1',
  role: 'Senior Engineer',
  company: 'Acme',
  location: 'Remote',
  impact: '- Shipped the platform rewrite\n- Reduced build time by 40%',
  employmentType: 'FULL_TIME',
  isCurrent: false,
  startDate: '2022-03-01T00:00:00.000Z',
  endDate: '2024-06-01T00:00:00.000Z',
  order: 0,
  technologies: [],
  availableLocales: ['en'],
  ...overrides
})

describe('ContentTimelineEntry', () => {
  it('parses the Markdown impact bullets into li items, stripping the leading "- "', async () => {
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: experience() } })
    const bullets = wrapper.findAll('ul li').map(li => li.text())
    expect(bullets).toEqual(['Shipped the platform rewrite', 'Reduced build time by 40%'])
  })

  it('marks a current role with bg-primary and leaves a past role without it', async () => {
    const current = await mountSuspended(TimelineEntry, { props: { experience: experience({ isCurrent: true }) } })
    expect(current.find('span.bg-primary').exists()).toBe(true)

    const past = await mountSuspended(TimelineEntry, { props: { experience: experience({ isCurrent: false }) } })
    expect(past.find('span.bg-primary').exists()).toBe(false)
  })

  it('renders role, company, location, period and the employment type label', async () => {
    const exp = experience()
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: exp } })
    expect(wrapper.find('h3').text()).toBe('Senior Engineer')
    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).toContain('Remote')
    expect(wrapper.text()).toContain(formatExperiencePeriod(exp.startDate, exp.endDate, 'en', 'home.experience.present'))
    expect(wrapper.text()).toContain('home.experience.employmentType.FULL_TIME')
  })
})
