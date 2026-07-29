// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import Nameplate from './Nameplate.vue'

// Nameplate is the hero (FR-PUB-010): name/tagline are API-localized and nullable, so they fall back
// to the brand i18n strings; the availability pill and the "since" datum are each conditionally
// rendered from settings; the technology identity line is a fixed 6-item stack.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UIcon: { template: '<i />', props: ['name'] },
  UButton: { template: '<a :href="to"><slot /></a>', props: ['to'] }
}

const base = (overrides: Partial<SiteSettings> = {}): SiteSettings => ({
  siteName: null,
  tagline: null,
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  profileLinks: [],
  availabilityStatus: null,
  careerStartYear: null,
  careerStartMonth: null,
  googleSiteVerification: null,
  bingSiteVerification: null,
  customMetas: [],
  resumeAsset: null,
  aboutBio: null,
  engineeringPhilosophy: null,
  currentFocus: null,
  professionalEmail: null,
  contactEmail: null,
  portraitAssetId: null,
  portrait: null,
  availableLocales: ['en'],
  ...overrides
})

describe('HomeNameplate', () => {
  it('falls back to i18n brand.name/brand.role when settings.siteName/tagline are null, and uses settings when present', async () => {
    const fallback = await mountSuspended(Nameplate, { props: { settings: base() }, global: { stubs } })
    expect(fallback.find('h1').text()).toBe('brand.name')
    expect(fallback.text()).toContain('brand.role')

    const withValues = await mountSuspended(Nameplate, {
      props: { settings: base({ siteName: 'Eslam Muatamed', tagline: 'Software Engineer' }) },
      global: { stubs }
    })
    expect(withValues.find('h1').text()).toBe('Eslam Muatamed')
    expect(withValues.text()).toContain('Software Engineer')
  })

  it('renders the availabilityStatus pill when present and omits it when null', async () => {
    const withStatus = await mountSuspended(Nameplate, {
      props: { settings: base({ availabilityStatus: 'Open to opportunities' }) },
      global: { stubs }
    })
    expect(withStatus.find('p.rounded-full.bg-primary').exists()).toBe(true)
    expect(withStatus.text()).toContain('Open to opportunities')

    const withoutStatus = await mountSuspended(Nameplate, {
      props: { settings: base({ availabilityStatus: null }) },
      global: { stubs }
    })
    expect(withoutStatus.find('p.rounded-full.bg-primary').exists()).toBe(false)
  })

  it('renders the home.hero.since datum only when careerStartYear is set', async () => {
    const withYear = await mountSuspended(Nameplate, {
      props: { settings: base({ careerStartYear: 2019 }) },
      global: { stubs }
    })
    expect(withYear.text()).toContain('home.hero.since')

    const withoutYear = await mountSuspended(Nameplate, {
      props: { settings: base({ careerStartYear: null }) },
      global: { stubs }
    })
    expect(withoutYear.text()).not.toContain('home.hero.since')
  })

  it('renders the 6-item technology stack', async () => {
    const wrapper = await mountSuspended(Nameplate, { props: { settings: base() }, global: { stubs } })
    const items = wrapper.findAll('ul li bdi').map(bdi => bdi.text())
    expect(items).toEqual(['JavaScript', 'TypeScript', 'Vue', 'Nuxt', 'Node.js', 'Nest.js'])
  })
})
