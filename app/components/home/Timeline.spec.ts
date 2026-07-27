// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import Timeline from './Timeline.vue'

// Timeline (FR-PUB-013) sorts the current role first — even over a past role with a later-looking
// start date (code-review WD-7) — then orders the rest by startDate desc. Empty result omits the
// section unless loading/erroring (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiSectionHead: {
    props: ['eyebrow', 'title', 'titleId'],
    template: '<div><h2 :id="titleId">{{ title }}</h2><slot name="action" /></div>'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  ContentTimelineEntry: { template: '<li class="entry">{{ experience.role }}</li>', props: ['experience'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  UIcon: { template: '<i />', props: ['name'] }
}

const experience = (overrides: Partial<Experience>): Experience => ({
  id: overrides.role ?? 'id',
  role: 'Role',
  company: 'Company',
  location: 'Remote',
  impact: '- Did a thing',
  employmentType: 'FULL_TIME',
  isCurrent: false,
  startDate: '2020-01-01T00:00:00.000Z',
  endDate: null,
  order: 0,
  availableLocales: ['en'],
  ...overrides
})

describe('HomeTimeline', () => {
  it('sorts the current role first, then the rest by startDate desc', async () => {
    const experiences: Experience[] = [
      experience({ role: 'Older, not current, later start', isCurrent: false, startDate: '2026-01-01T00:00:00.000Z' }),
      experience({ role: 'Current role', isCurrent: true, startDate: '2020-01-01T00:00:00.000Z' }),
      experience({ role: 'Past role, earlier start', isCurrent: false, startDate: '2022-01-01T00:00:00.000Z' })
    ]
    const wrapper = await mountSuspended(Timeline, { props: { experiences }, global: { stubs } })
    const roles = wrapper.findAll('.entry').map(el => el.text())
    expect(roles).toEqual(['Current role', 'Older, not current, later start', 'Past role, earlier start'])
  })

  it('hides when there are no experiences and the section is idle', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { experiences: [], pending: false, error: false },
      global: { stubs }
    })
    expect(wrapper.find('#experience-title').exists()).toBe(false)
  })

  it('shows a skeleton while pending, even with no experiences yet', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { experiences: null, pending: true },
      global: { stubs }
    })
    expect(wrapper.find('#experience-title').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders an inline error and emits retry', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { experiences: null, error: true },
      global: { stubs }
    })
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
