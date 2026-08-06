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
  LayoutLangToggle: { template: '<div />' },
  LayoutThemeToggle: { template: '<div />' },
  UiBrandMark: { template: '<svg />', props: ['size'] }
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
  aboutBio: null,
  engineeringPhilosophy: null,
  currentFocus: null,
  professionalEmail: null,
  contactEmail: null,
  contactPhone: '+201002785408',
  whatsappPhone: '+201002785408',
  portraitAssetId: null,
  portrait: null,
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

  // WhatsApp chrome (018). Counted on the `wa.me` href rather than on the number of anchors, and
  // absence is asserted as COUNT ZERO rather than as a hidden class — a hidden control is still in
  // the accessibility tree and still focusable, which is not what "no number, no affordance" means.
  //
  // Absence is asserted on the AFFORDANCE (its accessible name), not only on the `wa.me` href.
  // Asserting the href alone is worthless here and was measured to be: deleting the `v-if` gate
  // leaves `:href="null"`, which Vue renders as NO href attribute at all, so an href-only count
  // stays at zero while a live, focusable, labelled link to nowhere sits in the footer. The name is
  // what a visitor and a screen reader actually encounter, so that is what must be absent.
  const IS_WA = (href: string | undefined) => (href ?? '').startsWith('https://wa.me/')
  const WA_LABEL = 'footer.whatsapp'

  it('renders one WhatsApp action, opening safely, when the number is present', async () => {
    settingsRef.value = full
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    const links = wrapper.findAll('a').filter(a => IS_WA(a.attributes('href')))
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe(
      `https://wa.me/201002785408?text=${encodeURIComponent('contact.whatsappMessage')}`
    )
    expect(links[0]!.attributes('target')).toBe('_blank')
    expect(links[0]!.attributes('rel')).toBe('noopener noreferrer')
    // The accessible name comes from the visible label, so it cannot drift out of sync with it.
    expect(links[0]!.text()).toContain('footer.whatsapp')
    // The Footer is an action, not a directory: the number itself belongs on /contact.
    expect(wrapper.text()).not.toContain('+201002785408')
  })

  it('renders no WhatsApp affordance at all when the number is absent', async () => {
    settingsRef.value = { ...full, whatsappPhone: null }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    expect(wrapper.findAll('a').filter(a => a.text().includes(WA_LABEL))).toHaveLength(0)
    expect(wrapper.findAll('a').filter(a => IS_WA(a.attributes('href')))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
  })

  it('renders no WhatsApp affordance when the number is not a plausible E.164 value', async () => {
    // Bad data must not become a link to nowhere — the shared gate is the same one /contact uses.
    settingsRef.value = { ...full, whatsappPhone: '0100 not a number' }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    expect(wrapper.findAll('a').filter(a => a.text().includes(WA_LABEL))).toHaveLength(0)
    expect(wrapper.findAll('a').filter(a => IS_WA(a.attributes('href')))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
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
