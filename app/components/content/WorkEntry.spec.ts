// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectListItem } from '~/types/models'
import WorkEntry from './WorkEntry.vue'

// Work entry (FR-PUB-012) — a project as an index row: title links to the case study, technologies are
// listed as a quiet mono line, and the year sits in the margin when present.
const stubs = {
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  UIcon: { template: '<i />', props: ['name'] }
}

const project = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  id: 'p1',
  slug: 'content-platform-api',
  title: 'Content platform API',
  summary: 'A multilingual publishing platform.',
  featured: true,
  year: 2026,
  technologies: [
    { id: 't1', label: 'NestJS' },
    { id: 't2', label: 'PostgreSQL' }
  ],
  availableLocales: ['en'],
  ...overrides
})

describe('ContentWorkEntry', () => {
  it('renders the title linking to /projects/{slug}', async () => {
    const wrapper = await mountSuspended(WorkEntry, { props: { project: project() }, global: { stubs } })
    const link = wrapper.find('h3 a')
    expect(link.text()).toBe('Content platform API')
    expect(link.attributes('href')).toBe('/projects/content-platform-api')
  })

  it('lists the technologies', async () => {
    const wrapper = await mountSuspended(WorkEntry, { props: { project: project() }, global: { stubs } })
    const labels = wrapper.findAll('ul li').map(li => li.text())
    expect(labels).toEqual(['NestJS', 'PostgreSQL'])
  })

  it('shows the year when present and omits it when null', async () => {
    const withYear = await mountSuspended(WorkEntry, { props: { project: project({ year: 2024 }) }, global: { stubs } })
    expect(withYear.text()).toContain('2024')

    const withoutYear = await mountSuspended(WorkEntry, { props: { project: project({ year: null }) }, global: { stubs } })
    expect(withoutYear.find('p.font-mono').exists()).toBe(false)
  })
})
