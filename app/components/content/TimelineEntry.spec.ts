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

/** Technologies render in their own `<ul>`, so impact bullets are addressed by the first list only. */
const IMPACT_LIST = 'ul:not([aria-labelledby]) li'
const TECHNOLOGY_LIST = 'ul[aria-labelledby] li'

describe('ContentTimelineEntry', () => {
  it('parses the Markdown impact bullets into li items, stripping the leading "- "', async () => {
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: experience() } })
    const bullets = wrapper.findAll(IMPACT_LIST).map(li => li.text())
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

  // ---- Experience slice (008) — FR-PUB-021 technologies, dates, semantics ----

  it('renders both period ends as <time> elements carrying the contract ISO instants', async () => {
    const exp = experience()
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: exp } })
    const times = wrapper.findAll('time')
    expect(times).toHaveLength(2)
    expect(times[0]!.attributes('datetime')).toBe(exp.startDate)
    expect(times[1]!.attributes('datetime')).toBe(exp.endDate)
  })

  it('renders an open-ended role with a single <time> and the localized present label', async () => {
    const wrapper = await mountSuspended(TimelineEntry, {
      props: { experience: experience({ endDate: null, isCurrent: true }) }
    })
    const times = wrapper.findAll('time')
    expect(times).toHaveLength(1)
    expect(wrapper.text()).toContain('home.experience.present')
  })

  it('renders technologies in the API order and never re-sorts them', async () => {
    // Deliberately NOT alphabetical and NOT id-ordered: the API has already applied `Skill.order`
    // (D02-9), so any client-side sort would be visible here as a reordering.
    const wrapper = await mountSuspended(TimelineEntry, {
      props: {
        experience: experience({
          technologies: [
            { id: 't3', label: 'Vue.js' },
            { id: 't1', label: 'Nuxt.js' },
            { id: 't2', label: 'TypeScript' }
          ]
        })
      }
    })
    expect(wrapper.findAll(TECHNOLOGY_LIST).map(li => li.text())).toEqual([
      'Vue.js',
      'Nuxt.js',
      'TypeScript'
    ])
  })

  it('labels the technology list with the role it belongs to', async () => {
    const wrapper = await mountSuspended(TimelineEntry, {
      props: { experience: experience({ technologies: [{ id: 't1', label: 'Nuxt.js' }] }) }
    })
    const list = wrapper.find('ul[aria-labelledby]')
    expect(list.exists()).toBe(true)
    expect(wrapper.find(`#${list.attributes('aria-labelledby')}`).exists()).toBe(true)
  })

  it('omits the technology list entirely when the role has no technologies', async () => {
    const wrapper = await mountSuspended(TimelineEntry, {
      props: { experience: experience({ technologies: [] }) }
    })
    expect(wrapper.find('ul[aria-labelledby]').exists()).toBe(false)
  })

  it('renders the factual contract role verbatim at the requested heading level', async () => {
    const wrapper = await mountSuspended(TimelineEntry, {
      props: { experience: experience({ role: 'Frontend Developer' }), headingLevel: 'h2' }
    })
    // The marketing positioning must never rewrite an employment title.
    expect(wrapper.find('h2').text()).toBe('Frontend Developer')
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('defaults to h3 so the home page keeps its section-level heading order', async () => {
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: experience() } })
    expect(wrapper.find('h3').exists()).toBe(true)
  })

  it('degrades cleanly when optional text fields arrive empty', async () => {
    const wrapper = await mountSuspended(TimelineEntry, {
      props: { experience: experience({ location: '', impact: '' }) }
    })
    expect(wrapper.findAll(IMPACT_LIST)).toHaveLength(0)
    // The separator that precedes location must not render on its own.
    expect(wrapper.text()).not.toContain('·')
  })

  it('hides decorative rail and bullet markers from assistive technology', async () => {
    const wrapper = await mountSuspended(TimelineEntry, { props: { experience: experience() } })
    for (const span of wrapper.findAll('span[aria-hidden="true"]')) {
      expect(span.text()).toBe('')
    }
  })
})
