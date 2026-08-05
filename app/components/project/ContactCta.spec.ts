// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings } from '~/types/models'
import ContactCta from './ContactCta.vue'

// The closing case-study CTA. Email is the GUARANTEED path (D05-4 — the conversion must never dead
// end) and WhatsApp is additive chrome that vanishes with the number, so every case below asserts
// the email action as well as the WhatsApp one.
const settingsRef = ref<SiteSettings | null>(null)

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useSiteSettings', () => () => ({ data: settingsRef }))

const stubs = {
  UButton: {
    template: '<a :href="to" :target="target" :rel="rel">{{ label }}<slot /></a>',
    props: ['to', 'external', 'target', 'rel', 'color', 'variant', 'icon', 'label']
  }
}

const full: SiteSettings = {
  siteName: 'Eslam',
  tagline: 'Frontend Engineer',
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  profileLinks: [{ label: 'Email', url: 'mailto:contact@eslammuatamed.com' }],
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
  contactPhone: '+201002785408',
  whatsappPhone: '+201002785408',
  portraitAssetId: null,
  portrait: null,
  availableLocales: ['en']
}

const hrefs = (wrapper: { findAll: (selector: string) => { attributes: (name: string) => string | undefined }[] }) =>
  wrapper.findAll('a').map(a => a.attributes('href') ?? '')

// Absence is asserted on the affordance's NAME, not only on its href: with the `v-if` gate removed,
// `:to="null"` renders no href attribute at all, so an href-only count stays at zero while a
// labelled control to nowhere sits beside the email button. Measured, not assumed — the same trap
// caught in `Footer.spec.ts`.
const WA_LABEL = 'projects.contact.whatsappAction'

describe('ProjectContactCta', () => {
  it('offers both actions when the WhatsApp number is present', async () => {
    settingsRef.value = full
    const wrapper = await mountSuspended(ContactCta, { global: { stubs } })
    const links = wrapper.findAll('a')
    expect(hrefs(wrapper)).toContain('mailto:contact@eslammuatamed.com')

    const whatsapp = links.filter(a => (a.attributes('href') ?? '').startsWith('https://wa.me/'))
    expect(whatsapp).toHaveLength(1)
    expect(whatsapp[0]!.attributes('href')).toBe(
      `https://wa.me/201002785408?text=${encodeURIComponent('contact.whatsappMessage')}`
    )
    expect(whatsapp[0]!.attributes('target')).toBe('_blank')
    expect(whatsapp[0]!.attributes('rel')).toBe('noopener noreferrer')
  })

  it('keeps the email action and drops WhatsApp entirely when the number is absent', async () => {
    settingsRef.value = { ...full, whatsappPhone: null }
    const wrapper = await mountSuspended(ContactCta, { global: { stubs } })
    expect(hrefs(wrapper)).toContain('mailto:contact@eslammuatamed.com')
    expect(hrefs(wrapper).filter(href => href.startsWith('https://wa.me/'))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
  })

  it('keeps the email action and drops WhatsApp when the number is implausible', async () => {
    settingsRef.value = { ...full, whatsappPhone: '0100 not a number' }
    const wrapper = await mountSuspended(ContactCta, { global: { stubs } })
    expect(hrefs(wrapper)).toContain('mailto:contact@eslammuatamed.com')
    expect(hrefs(wrapper).filter(href => href.startsWith('https://wa.me/'))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
  })

  it('falls back to the public website address, and offers no WhatsApp, when settings are unreachable', async () => {
    // The fallback address is the visitor-facing one by owner decision — never the internal inbox.
    settingsRef.value = null
    const wrapper = await mountSuspended(ContactCta, { global: { stubs } })
    expect(hrefs(wrapper)).toContain('mailto:contact@eslammuatamed.com')
    expect(hrefs(wrapper).filter(href => href.startsWith('https://wa.me/'))).toHaveLength(0)
    expect(wrapper.text()).not.toContain(WA_LABEL)
  })
})
