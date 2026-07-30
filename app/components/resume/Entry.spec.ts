// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import Entry from './Entry.vue'

// The compact résumé entry. Same contract data as `ContentTimelineEntry`, denser presentation —
// so these tests pin the things that must NOT differ between the two renderings: verbatim role and
// company, API technology order, machine-readable dates, and the employment label.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const experience = (overrides: Partial<Experience> = {}): Experience => ({
  id: 'e1',
  role: 'Full Stack Developer',
  company: 'WaveX',
  location: 'Egypt',
  impact: '- Built a multi-portal logistics platform\n- Owned architecture and review',
  employmentType: 'CONTRACT',
  isCurrent: false,
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-07-31T00:00:00.000Z',
  order: 0,
  technologies: [],
  availableLocales: ['en'],
  ...overrides
})

const IMPACT_LIST = 'ul:not([aria-labelledby]) li'
const TECHNOLOGY_LIST = 'ul[aria-labelledby] li'

describe('ResumeEntry', () => {
  it('renders the factual historical role and company verbatim', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.find('h3').text()).toBe('Full Stack Developer')
    expect(wrapper.text()).toContain('WaveX')
    expect(wrapper.text()).toContain('Egypt')
  })

  // The governed public positioning must never overwrite an employment title.
  it('does not substitute the governed public positioning for the employment title', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.text()).not.toContain('JavaScript Product Engineer')
  })

  it('splits the Markdown impact into list items with markers stripped', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.findAll(IMPACT_LIST).map(li => li.text())).toEqual([
      'Built a multi-portal logistics platform',
      'Owned architecture and review'
    ])
  })

  // Two <time datetime> elements carrying the contract's ISO instants — a résumé parser reads
  // these, and a single formatted string would not be machine-readable.
  it('emits both period ends as <time datetime> with the contract ISO values', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    const times = wrapper.findAll('time')
    expect(times).toHaveLength(2)
    expect(times[0]!.attributes('datetime')).toBe('2026-03-01T00:00:00.000Z')
    expect(times[1]!.attributes('datetime')).toBe('2026-07-31T00:00:00.000Z')
  })

  // A current role has no end instant, so it must render exactly one <time> and a present label
  // rather than a <time> with an empty or invented datetime.
  it('renders a current role with one <time> and the present label', async () => {
    const wrapper = await mountSuspended(Entry, {
      props: { experience: experience({ endDate: null, isCurrent: true }) }
    })
    expect(wrapper.findAll('time')).toHaveLength(1)
    expect(wrapper.text()).toContain('home.experience.present')
  })

  it('labels the employment type from the shared key namespace', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.text()).toContain('home.experience.employmentType.CONTRACT')
  })

  it('renders technologies in the API order, never re-sorted', async () => {
    const wrapper = await mountSuspended(Entry, {
      props: {
        experience: experience({
          technologies: [
            { id: 't1', label: 'Vue.js' },
            { id: 't2', label: 'Tailwind CSS' },
            { id: 't3', label: 'Angular' }
          ]
        })
      }
    })
    expect(wrapper.findAll(TECHNOLOGY_LIST).map(li => li.text())).toEqual([
      'Vue.js',
      'Tailwind CSS',
      'Angular'
    ])
  })

  it('omits the technology list entirely when the role has none', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience({ technologies: [] }) } })
    expect(wrapper.find('ul[aria-labelledby]').exists()).toBe(false)
  })

  it('omits the location segment when the contract has none', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience({ location: null }) } })
    expect(wrapper.text()).not.toContain('Egypt')
    expect(wrapper.text()).toContain('WaveX')
  })

  it('renders no bullet list when impact is empty', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience({ impact: '' }) } })
    expect(wrapper.findAll(IMPACT_LIST)).toHaveLength(0)
  })

  // Print pagination: an entry must be able to avoid splitting across a page boundary.
  it('carries the resume-entry hook the print stylesheet targets', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.find('li').classes()).toContain('resume-entry')
  })

  // The entry is an <li>: the page wraps entries in an ordered list so reverse-chronological
  // order survives with CSS off.
  it('is a list item so the ordered sequence survives without CSS', async () => {
    const wrapper = await mountSuspended(Entry, { props: { experience: experience() } })
    expect(wrapper.element.tagName).toBe('LI')
  })
})
