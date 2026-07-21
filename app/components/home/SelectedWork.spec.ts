// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectListItem } from '~/types/models'
import SelectedWork from './SelectedWork.vue'

// Selected Work filters the API's featured-first project list down to `featured` items and caps at 3
// (FR-PUB-012). Empty result omits the section unless loading/erroring (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiSectionHead: {
    props: ['eyebrow', 'title', 'titleId'],
    template: '<div><h2 :id="titleId">{{ title }}</h2><slot name="action" /></div>'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  UiSectionSkeleton: { template: '<div class="section-skeleton" />', props: ['count'] },
  ContentWorkEntry: { template: '<div class="work-entry">{{ project.slug }}</div>', props: ['project'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  UIcon: { template: '<i />', props: ['name'] }
}

const project = (overrides: Partial<ProjectListItem>): ProjectListItem => ({
  id: overrides.slug ?? 'id',
  slug: 'project',
  title: 'Project',
  summary: 'Summary',
  featured: false,
  year: 2026,
  technologies: [],
  availableLocales: ['en'],
  ...overrides
})

describe('HomeSelectedWork', () => {
  it('filters to featured projects and caps at 3, preserving order', async () => {
    const projects: ProjectListItem[] = [
      project({ slug: 'a', featured: true }),
      project({ slug: 'b', featured: false }),
      project({ slug: 'c', featured: true }),
      project({ slug: 'd', featured: true }),
      project({ slug: 'e', featured: true })
    ]
    const wrapper = await mountSuspended(SelectedWork, { props: { projects }, global: { stubs } })
    const slugs = wrapper.findAll('.work-entry').map(el => el.text())
    expect(slugs).toEqual(['a', 'c', 'd'])
  })

  it('hides when there are no featured projects and the section is idle', async () => {
    const wrapper = await mountSuspended(SelectedWork, {
      props: { projects: [project({ slug: 'a', featured: false })], pending: false, error: false },
      global: { stubs }
    })
    expect(wrapper.find('#work-title').exists()).toBe(false)
  })

  it('shows a skeleton while pending, even with no projects yet', async () => {
    const wrapper = await mountSuspended(SelectedWork, {
      props: { projects: null, pending: true },
      global: { stubs }
    })
    expect(wrapper.find('#work-title').exists()).toBe(true)
    expect(wrapper.find('.section-skeleton').exists()).toBe(true)
  })

  it('renders an inline error and emits retry', async () => {
    const wrapper = await mountSuspended(SelectedWork, {
      props: { projects: null, error: true },
      global: { stubs }
    })
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
