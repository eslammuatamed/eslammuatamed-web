// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectListItem } from '~/types/models'
import FeaturedProjects from './FeaturedProjects.vue'

// Featured projects shows only `featured` items, capped at 3 (FR-PUB-012), and omits itself when there
// are none (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const make = (id: string, featured: boolean): ProjectListItem => ({
  id,
  slug: id,
  title: id,
  summary: 'summary',
  featured,
  year: 2026,
  technologies: [],
  availableLocales: ['en']
})

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div><slot name="action" /></div>', props: ['eyebrow', 'title'] },
  UiStateError: { template: '<div class="state-error" />' },
  UiSectionSkeleton: { template: '<div class="skeleton" />', props: ['count'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  ContentProjectCard: { template: '<article class="pcard">{{ project.id }}</article>', props: ['project'] }
}

describe('HomeFeaturedProjects', () => {
  it('renders only featured projects, capped at three', async () => {
    const projects = [make('a', true), make('b', true), make('c', false), make('d', true), make('e', true)]
    const wrapper = await mountSuspended(FeaturedProjects, { props: { projects }, global: { stubs } })
    const cardIds = wrapper.findAll('.pcard').map(card => card.text())
    // featured a,b,d,e in order → capped at the first 3; the non-featured 'c' is excluded
    expect(cardIds).toEqual(['a', 'b', 'd'])
  })

  it('omits the section when no project is featured', async () => {
    const projects = [make('a', false), make('b', false)]
    const wrapper = await mountSuspended(FeaturedProjects, { props: { projects }, global: { stubs } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
