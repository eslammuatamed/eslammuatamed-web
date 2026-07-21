// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import Hero from './Hero.vue'

// The hero answers who / what level / available (FR-PUB-010). Name and tagline are nullable in the
// contract, so they fall back to the brand strings rather than rendering empty.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const base: SiteSettings = {
  siteName: 'Eslam Muatamed',
  tagline: 'Frontend Engineer — Vue.js & Nuxt.js',
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  profileLinks: [],
  availabilityStatus: 'Open to opportunities',
  careerStartYear: null,
  careerStartMonth: null,
  googleSiteVerification: null,
  bingSiteVerification: null,
  customMetas: [],
  resumeAsset: null,
  availableLocales: ['en']
}

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UButton: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  UIcon: { template: '<i />', props: ['name'] }
}

describe('HomeHero', () => {
  it('renders name, tagline, availability and both CTAs', async () => {
    const wrapper = await mountSuspended(Hero, { props: { settings: base }, global: { stubs } })
    expect(wrapper.find('h1').text()).toBe('Eslam Muatamed')
    expect(wrapper.text()).toContain('Frontend Engineer — Vue.js & Nuxt.js')
    expect(wrapper.text()).toContain('Open to opportunities')
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/projects')
    expect(hrefs).toContain('/contact')
  })

  it('falls back to the brand strings when name and tagline are null', async () => {
    const settings: SiteSettings = { ...base, siteName: null, tagline: null }
    const wrapper = await mountSuspended(Hero, { props: { settings }, global: { stubs } })
    expect(wrapper.find('h1').text()).toBe('brand.name')
    expect(wrapper.text()).toContain('brand.role')
  })

  it('states the value proposition and the identity stack, anchored by the brand mark', async () => {
    const wrapper = await mountSuspended(Hero, { props: { settings: base }, global: { stubs } })
    expect(wrapper.text()).toContain('home.hero.valueProp')
    expect(wrapper.text()).toContain('home.hero.stackLabel')
    // The six-technology identity stack (owner-profile §8), Latin proper nouns.
    for (const tech of ['JavaScript', 'TypeScript', 'Vue', 'Nuxt', 'Node.js', 'Nest.js']) {
      expect(wrapper.text()).toContain(tech)
    }
    // The Monolith mark renders as inline SVG (decorative — the h1 carries the identity).
    expect(wrapper.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })
})
