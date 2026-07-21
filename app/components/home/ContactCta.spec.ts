// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import ContactCta from './ContactCta.vue'

// The contact section always exposes the form link and, when a `mailto:` profile link exists, a
// data-driven direct-email fallback (D05-4) — never a hardcoded address.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const base: SiteSettings = {
  siteName: 'Eslam',
  tagline: 'Frontend Engineer',
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
  availableLocales: ['en']
}

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div />', props: ['eyebrow', 'title'] },
  UButton: { template: '<a :href="to"><slot /></a>', props: ['to'] }
}

describe('HomeContactCta', () => {
  it('shows a direct-email fallback when a mailto profile link is present', async () => {
    const settings: SiteSettings = { ...base, profileLinks: [{ label: 'Email', url: 'mailto:hi@example.com' }] }
    const wrapper = await mountSuspended(ContactCta, { props: { settings }, global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('mailto:hi@example.com')
    expect(hrefs).toContain('/contact')
  })

  it('shows only the form link when no email is configured', async () => {
    const wrapper = await mountSuspended(ContactCta, { props: { settings: base }, global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual(['/contact'])
  })
})
