// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectFacts from './Facts.vue'
import type { ProjectTechnology } from '~/types/models'

// The card states only what `GET /projects/{slug}` actually carries, and every one of those four
// fields is independently absent in real data: client work has no public URL, an undated project has
// no year, and a project can be seeded before its technologies are attached. So the assertion that
// matters most is the negative one — an absent fact must leave NO row, not an empty one, and no fact
// at all must leave no card.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const TECHNOLOGIES: ProjectTechnology[] = [
  { id: '019f89b5-3050-7161-af37-3e9a2cbf41ed', slug: 'nuxt', label: 'Nuxt' },
  { id: '019f89b5-3050-7161-af37-3e9a2cbf41ee', slug: 'nestjs', label: 'NestJS' }
]

const LIVE = 'https://example.com/product'
const REPO = 'https://github.com/eslammuatamed/example'

const FULL = { year: 2026, technologies: TECHNOLOGIES, liveUrl: LIVE, repoUrl: REPO }

describe('ProjectFacts', () => {
  it('renders every fact the contract provided', async () => {
    const wrapper = await mountSuspended(ProjectFacts, { props: FULL })

    expect(wrapper.findAll('dt').map(dt => dt.text())).toEqual([
      'projects.facts.year',
      'projects.facts.stack',
      'projects.facts.links'
    ])
    expect(wrapper.text()).toContain('2026')
    expect(wrapper.findAll('dd li').map(li => li.text())).toEqual(['Nuxt', 'NestJS'])
    expect(wrapper.findAll('dd a').map(a => a.attributes('href'))).toEqual([LIVE, REPO])
  })

  it('exposes a region whose accessible name is its own heading', async () => {
    const wrapper = await mountSuspended(ProjectFacts, { props: FULL })

    const heading = wrapper.get('h2')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(heading.text()).toBe('projects.facts.heading')
  })

  it('omits the year row entirely when the project is undated', async () => {
    const wrapper = await mountSuspended(ProjectFacts, { props: { ...FULL, year: null } })

    // The LABEL must be gone, not merely the value: a `<dt>` over an empty `<dd>` is the failure
    // this guards, and it renders as a visible orphan label rather than as nothing.
    expect(wrapper.findAll('dt').map(dt => dt.text())).toEqual([
      'projects.facts.stack',
      'projects.facts.links'
    ])
    expect(wrapper.findAll('dd')).toHaveLength(2)
  })

  it('omits the stack row entirely when no technologies are attached', async () => {
    const wrapper = await mountSuspended(ProjectFacts, { props: { ...FULL, technologies: [] } })

    expect(wrapper.findAll('dt').map(dt => dt.text())).toEqual([
      'projects.facts.year',
      'projects.facts.links'
    ])
    expect(wrapper.find('dd ul').exists()).toBe(false)
  })

  it('omits the links row entirely when neither URL is public', async () => {
    const wrapper = await mountSuspended(ProjectFacts, {
      props: { ...FULL, liveUrl: null, repoUrl: null }
    })

    expect(wrapper.findAll('dt').map(dt => dt.text())).toEqual([
      'projects.facts.year',
      'projects.facts.stack'
    ])
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('renders nothing at all when the contract carried no fact', async () => {
    const wrapper = await mountSuspended(ProjectFacts, {
      props: { year: null, technologies: [], liveUrl: null, repoUrl: null }
    })

    // Not an empty titled box: the heading would announce a region that contains nothing.
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })

  it('bidi-isolates each technology label so RTL cannot reorder it', async () => {
    const wrapper = await mountSuspended(ProjectFacts, { props: FULL })

    // A property of the markup, not of the current content: the labels are Latin here, but the
    // isolation has to be present for the Arabic page where they sit inside RTL text (doc 21).
    expect(wrapper.findAll('li bdi').map(bdi => bdi.text())).toEqual(['Nuxt', 'NestJS'])
  })
})
