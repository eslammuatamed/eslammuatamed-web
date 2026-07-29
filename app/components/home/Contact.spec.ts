// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import Contact from './Contact.vue'

// Contact (FR-PUB-017) picks the `mailto:` profile link as the direct-email fallback and scheme-filters
// the rest for the social list (security review WD-5) — excluding the mailto itself so it is not
// duplicated. Availability is echoed here too, same null-safety as the hero.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const stubs = {
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

describe('HomeContact', () => {
  it('picks the mailto: profile link as the email button, and renders no email button when absent', async () => {
    const withEmail = await mountSuspended(Contact, {
      props: {
        settings: base({
          profileLinks: [
            { label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' },
            { label: 'Email me', url: 'mailto:hello@eslammuatamed.com' }
          ]
        })
      },
      global: { stubs }
    })
    const mailtoLink = withEmail.findAll('a').find(a => a.attributes('href') === 'mailto:hello@eslammuatamed.com')
    expect(mailtoLink?.text()).toBe('Email me')

    const withoutEmail = await mountSuspended(Contact, {
      props: { settings: base({ profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed' }] }) },
      global: { stubs }
    })
    expect(withoutEmail.findAll('a').some(a => a.attributes('href')?.startsWith('mailto:'))).toBe(false)
  })

  it('filters social links by safe scheme and excludes the mailto from the social list', async () => {
    const wrapper = await mountSuspended(Contact, {
      props: {
        settings: base({
          profileLinks: [
            { label: 'Email me', url: 'mailto:hello@eslammuatamed.com' },
            { label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' },
            { label: 'Evil', url: 'javascript:alert(1)' }
          ]
        })
      },
      global: { stubs }
    })
    const socialHrefs = wrapper.findAll('ul li a').map(a => a.attributes('href'))
    expect(socialHrefs).toEqual(['https://github.com/eslammuatamed'])
  })

  it('renders availabilityStatus when present and omits it when null', async () => {
    const withStatus = await mountSuspended(Contact, {
      props: { settings: base({ availabilityStatus: 'Open to opportunities' }) },
      global: { stubs }
    })
    expect(withStatus.text()).toContain('Open to opportunities')

    const withoutStatus = await mountSuspended(Contact, {
      props: { settings: base({ availabilityStatus: null }) },
      global: { stubs }
    })
    expect(withoutStatus.find('.bg-primary').exists()).toBe(false)
  })
})
