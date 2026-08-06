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
  // The affordance is now icon-only, so its accessible name lives in `aria-label` rather than in
  // visible text. The absence assertions below still key on the NAME for the reason above — they
  // just have to read it from the attribute now.
  const WA_LABEL = 'footer.whatsappLabel'
  const waLinks = (wrapper: { findAll: (s: string) => { attributes: (a: string) => string | undefined }[] }) =>
    wrapper.findAll('a').filter(a => a.attributes('aria-label') === WA_LABEL)

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
    // Icon-only now, so the accessible name is the aria-label — an icon with no name is unusable.
    expect(links[0]!.attributes('aria-label')).toBe(WA_LABEL)
    // The Footer is an action, not a directory: the number itself belongs on /contact.
    expect(wrapper.text()).not.toContain('+201002785408')
  })

  // The correction itself: WhatsApp belongs INSIDE the social icon row, not under it.
  it('renders WhatsApp as the last chip inside the social icon row, not as a standalone row', async () => {
    settingsRef.value = full
    const wrapper = await mountSuspended(Footer, { global: { stubs } })

    const row = wrapper.find('ul.flex-wrap')
    expect(row.exists()).toBe(true)

    // Inside the row — and specifically the LAST item, so the order is GitHub → LinkedIn → Email →
    // WhatsApp rather than merely "somewhere in the group".
    const items = row.findAll('li')
    const last = items[items.length - 1]!
    const wa = last.find('a')
    expect(wa.attributes('aria-label')).toBe(WA_LABEL)
    expect(IS_WA(wa.attributes('href'))).toBe(true)

    // No WhatsApp anchor may exist outside the row — that is exactly the standalone block removed.
    expect(waLinks(wrapper)).toHaveLength(1)
    expect(row.findAll('a').filter(a => IS_WA(a.attributes('href')))).toHaveLength(1)

    // The old standalone visible label is gone, in both the key and any rendered text.
    expect(wrapper.text()).not.toContain('footer.whatsapp"')
    expect(wa.text().trim()).toBe('')
  })

  // "Match the existing buttons" has to be structural, not approximate: the WhatsApp chip must carry
  // the same class list as its siblings, so size, border, hover, focus ring and theme response are
  // the same by construction rather than by two lists that happen to agree today.
  it('gives WhatsApp the same chip classes as the other social buttons', async () => {
    settingsRef.value = full
    const wrapper = await mountSuspended(Footer, { global: { stubs } })

    const anchors = wrapper.find('ul.flex-wrap').findAll('a')
    const wa = anchors.find(a => IS_WA(a.attributes('href')))!
    const sibling = anchors.find(a => !IS_WA(a.attributes('href')))!
    expect([...wa.classes()].sort()).toEqual([...sibling.classes()].sort())
  })

  // The row still renders when WhatsApp is the ONLY affordance — a guard on `socialLinks.length`
  // alone would silently drop it for an owner with no profile links configured.
  it('renders the row with WhatsApp alone when there are no profile links', async () => {
    settingsRef.value = { ...full, profileLinks: [] }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })

    const row = wrapper.find('ul.flex-wrap')
    expect(row.exists()).toBe(true)
    expect(waLinks(wrapper)).toHaveLength(1)
  })

  it('renders no WhatsApp affordance at all when the number is absent', async () => {
    settingsRef.value = { ...full, whatsappPhone: null }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    expect(waLinks(wrapper)).toHaveLength(0)
    expect(wrapper.findAll('a').filter(a => IS_WA(a.attributes('href')))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
  })

  it('renders no WhatsApp affordance when the number is not a plausible E.164 value', async () => {
    // Bad data must not become a link to nowhere — the shared gate is the same one /contact uses.
    settingsRef.value = { ...full, whatsappPhone: '0100 not a number' }
    const wrapper = await mountSuspended(Footer, { global: { stubs } })
    expect(waLinks(wrapper)).toHaveLength(0)
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
