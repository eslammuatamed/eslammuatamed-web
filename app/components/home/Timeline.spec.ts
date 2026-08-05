// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import Timeline from './Timeline.vue'

// Timeline (FR-PUB-013) renders the API's order VERBATIM (D02-11) — it does not sort. Empty result
// omits the section unless loading/erroring (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiSectionHead: {
    props: ['eyebrow', 'title', 'titleId'],
    template: '<div><h2 :id="titleId">{{ title }}</h2><slot name="action" /></div>'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  // Records the props the home page actually passes, so the FR-PUB-013 rendering contract is
  // observable here rather than only inside the shared component.
  ContentTimelineEntry: {
    template: '<li class="entry" :data-show-tech="showTechnologies ? \'1\' : \'0\'">{{ experience.role }}</li>',
    props: ['experience', 'showTechnologies', 'headingLevel']
  },
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
  technologies: [],
  availableLocales: ['en'],
  ...overrides
})

describe('HomeTimeline', () => {
  // FR-PUB-013 is the home summary and was approved WITHOUT technologies; FR-PUB-021 put them on
  // `/experience`. The shared component defaults to off, and the home must never opt in — this is
  // the assertion that fails if a later change flips the default or adds the prop here.
  it('never enables technology chips, even when the API supplies them', async () => {
    const experiences: Experience[] = [
      experience({ role: 'With stack', technologies: [{ id: 't1', slug: 'nuxt', label: 'Nuxt.js' }] }),
      experience({ role: 'Without stack', technologies: [] })
    ]
    const wrapper = await mountSuspended(Timeline, { props: { experiences }, global: { stubs } })

    const flags = wrapper.findAll('.entry').map(el => el.attributes('data-show-tech'))
    expect(flags).toEqual(['0', '0'])
    expect(wrapper.text()).not.toContain('Nuxt.js')
  })

  // D02-11: ordering is `isCurrent` DESC -> `startDate` DESC -> `order` ASC -> `id` ASC and the API
  // owns it. Home used to re-sort locally, which is the rejected alternative the decision names, and
  // it is why Home could disagree with `/experience` and `/resume` — neither of which sorts.
  //
  // THE FIXTURE IS DELIBERATELY IN AN ORDER NO CLIENT SORT WOULD PRODUCE. The old comparator
  // (`isCurrent` first, then `startDate` desc) would rearrange this into
  // ['Current role', 'Ended, later start', 'Ended, earlier start']. Asserting the input order back
  // therefore fails the moment anyone reintroduces a local sort — which a fixture already in sorted
  // order could never detect.
  it('renders the API order verbatim and does not re-sort', async () => {
    const experiences: Experience[] = [
      experience({ role: 'Ended, later start', isCurrent: false, startDate: '2026-01-01T00:00:00.000Z' }),
      experience({ role: 'Current role', isCurrent: true, startDate: '2020-01-01T00:00:00.000Z' }),
      experience({ role: 'Ended, earlier start', isCurrent: false, startDate: '2022-01-01T00:00:00.000Z' })
    ]
    const wrapper = await mountSuspended(Timeline, { props: { experiences }, global: { stubs } })
    const roles = wrapper.findAll('.entry').map(el => el.text())
    expect(roles).toEqual(['Ended, later start', 'Current role', 'Ended, earlier start'])
  })

  // `order` is the owner's dashboard-controlled tie-breaker, and the removed comparator could not
  // express it: two roles sharing a start date sorted by whatever the comparator returned, so the
  // owner's arrangement was discarded whenever it disagreed. Same `isCurrent` and same `startDate`,
  // ascending `order` — the API's sequence must survive untouched.
  it('preserves the owner-controlled `order` tie-breaker within an identical start date', async () => {
    const experiences: Experience[] = [
      experience({ role: 'Owner placed second', order: 1, startDate: '2024-01-01T00:00:00.000Z' }),
      experience({ role: 'Owner placed first', order: 0, startDate: '2024-01-01T00:00:00.000Z' })
    ]
    const wrapper = await mountSuspended(Timeline, { props: { experiences }, global: { stubs } })
    expect(wrapper.findAll('.entry').map(el => el.text())).toEqual([
      'Owner placed second',
      'Owner placed first'
    ])
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
