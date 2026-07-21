// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import Footer from './Footer.vue'

// The footer adds settings-driven chrome (FR-PUB-003) — social links, availability, résumé download —
// on top of the nav shell, and degrades to just the nav shell when settings are unavailable.
const settingsRef = ref<SiteSettings | null>(null)

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useSiteSettings', () => () => ({ data: settingsRef }))

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UIcon: { template: '<i />', props: ['name'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  LayoutLocaleSwitcher: { template: '<div />' },
  LayoutThemeToggle: { template: '<div />' }
}

const full: SiteSettings = {
  siteName: 'Eslam',
  tagline: 'Frontend Engineer',
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' }],
  availabilityStatus: 'Open to opportunities',
  careerStartYear: null,
  careerStartMonth: null,
  googleSiteVerification: null,
  bingSiteVerification: null,
  customMetas: [],
  resumeAsset: { id: 'r1', kind: 'PDF', url: 'https://media.example.com/cv.pdf', filename: 'cv.pdf', sizeBytes: 100 },
  availableLocales: ['en']
}

describe('LayoutFooter', () => {
  it('renders social links, availability and a résumé download when settings are present', async () => {
    settingsRef.value = full
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('https://github.com/eslammuatamed')
    expect(hrefs).toContain('https://media.example.com/cv.pdf')
    expect(wrapper.text()).toContain('Open to opportunities')
    // nav shell still present (regression): the six repeated targets resolve to raw paths for AppLink
    expect(hrefs).toContain('/blog')
    expect(hrefs).toContain('/projects')
  })

  it('degrades to the nav shell when settings are unavailable', async () => {
    settingsRef.value = null
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).not.toContain('https://github.com/eslammuatamed')
    expect(hrefs).toContain('/blog')
  })

  it('drops social links with an unsafe URL scheme (security WD-5)', async () => {
    settingsRef.value = {
      ...full,
      profileLinks: [
        { label: 'Evil', url: 'javascript:alert(1)' },
        { label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' }
      ]
    }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).not.toContain('javascript:alert(1)')
    expect(hrefs).toContain('https://github.com/eslammuatamed')
  })
})
