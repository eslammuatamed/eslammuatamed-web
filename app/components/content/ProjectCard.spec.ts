// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectListItem } from '~/types/models'
import ProjectCard from './ProjectCard.vue'

// The whole card must be a SINGLE accessible link to the case study (doc 21 §1 — no nested links).
// AppLink is stubbed to a bare anchor so the assertion is on the `to` THIS component builds, not on
// AppLink's locale resolution (covered by its own tests).
const project: ProjectListItem = {
  id: 'p1',
  slug: 'content-platform',
  title: 'Content Platform',
  summary: 'A multilingual publishing platform.',
  featured: true,
  year: 2026,
  technologies: [{ id: 't1', label: 'NestJS' }],
  availableLocales: ['en']
}

const stubs = {
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] }
}

describe('ContentProjectCard', () => {
  it('exposes exactly one accessible link, to the case study', async () => {
    const wrapper = await mountSuspended(ProjectCard, { props: { project }, global: { stubs } })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('/projects/content-platform')
  })

  it('renders title, summary, year and technologies', async () => {
    const wrapper = await mountSuspended(ProjectCard, { props: { project }, global: { stubs } })
    const text = wrapper.text()
    expect(text).toContain('Content Platform')
    expect(text).toContain('A multilingual publishing platform.')
    expect(text).toContain('2026')
    expect(text).toContain('NestJS')
  })
})
