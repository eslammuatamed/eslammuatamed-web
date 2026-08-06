// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import Profile from './profile.vue'

/**
 * The Profile page's D09-22 obligations, asserted through the REAL rendered page rather than only
 * through the pure helpers it delegates to.
 *
 * `portrait-form.spec.ts` proves the rules. This proves the page actually obeys them — that the
 * inputs the operator sees are seeded from the per-usage alt, that the asset-level default reaches
 * the screen only as a labelled reference, and that a save is refused with one locale missing. A
 * correct helper wired to the wrong value is exactly the defect the contract warns about, and only
 * a rendered assertion can catch it.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  settings: null as unknown
}))

mockNuxtImport('useApi', () => () => (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (path === '/admin/settings' && (options.method ?? 'GET') === 'GET') {
    return Promise.resolve({ data: holder.settings })
  }
  if (path === '/admin/settings' && options.method === 'PATCH') {
    return Promise.resolve({ data: holder.settings })
  }
  // The picker resolves its preview through `GET /admin/media/:id`.
  return Promise.resolve({ data: { id: 'asset-1', kind: 'IMAGE', url: 'u', mimeType: 'image/webp', sizeBytes: 10, originalFilename: 'portrait.jpg', width: 1, height: 1, blurhash: null, contentHash: 'h', variants: [], alts: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } })
})

const translation = (portraitAlt: string | null) => ({
  siteName: null, tagline: null, availabilityStatus: null, defaultMetaTitle: null,
  defaultMetaDescription: null, aboutBio: null, engineeringPhilosophy: null, currentFocus: null,
  portraitAlt
})

/**
 * THE TRAP FIXTURE. The asset-level default is populated and BOTH per-usage alts are null — so a
 * page that prefilled from `portrait.alt` would show "ASSET DEFAULT" in the inputs, and a page that
 * reads the translations shows nothing.
 */
function trapSettings(enAlt: string | null = null, arAlt: string | null = null) {
  return {
    id: 's1', profileLinks: [], resumeAssetId: null,
    portraitAssetId: 'asset-1',
    portrait: { id: 'asset-1', url: 'u', alt: 'ASSET DEFAULT', width: 1, height: 1, blurhash: null, variants: [] },
    professionalEmail: null, contactEmail: null, contactPhone: null, whatsappPhone: null,
    careerStartYear: null, careerStartMonth: null, googleSiteVerification: null,
    bingSiteVerification: null, analyticsProvider: null, analyticsMeasurementId: null,
    analyticsEnabled: false, customMetas: [],
    translations: { en: translation(enAlt), ar: translation(arAlt) }
  }
}

async function mount(settings: unknown) {
  holder.settings = settings
  holder.calls = []
  const wrapper = await mountSuspended(Profile)
  await flushPromises()
  await flushPromises()
  return wrapper
}

const altInput = (wrapper: Awaited<ReturnType<typeof mount>>, locale: 'en' | 'ar') =>
  wrapper.find<HTMLInputElement>(`[data-portrait-alt="${locale}"]`)

describe('the alt inputs are NEVER prefilled from the asset-level default (D09-22)', () => {
  it('leaves both inputs EMPTY when the per-usage alt is null but an asset default exists', async () => {
    const wrapper = await mount(trapSettings(null, null))

    // The default really is present in the loaded data — otherwise this would pass vacuously.
    expect(wrapper.html()).toContain('ASSET DEFAULT')

    expect(altInput(wrapper, 'en').element.value).toBe('')
    expect(altInput(wrapper, 'ar').element.value).toBe('')
  })

  it('shows the asset-level default only as a LABELLED REFERENCE, outside the inputs', async () => {
    const wrapper = await mount(trapSettings(null, null))
    const reference = wrapper.find('[data-portrait-library-default]')
    expect(reference.exists()).toBe(true)
    expect(reference.text()).toBe('ASSET DEFAULT')
    // And it is not the value of either field.
    expect(altInput(wrapper, 'en').element.value).not.toBe('ASSET DEFAULT')
    expect(altInput(wrapper, 'ar').element.value).not.toBe('ASSET DEFAULT')
  })

  it('seeds each input from ITS OWN locale per-usage alt, not from the default or the other locale', async () => {
    const wrapper = await mount(trapSettings('Per-usage English', 'نص عربي'))
    expect(altInput(wrapper, 'en').element.value).toBe('Per-usage English')
    expect(altInput(wrapper, 'ar').element.value).toBe('نص عربي')
  })

  it('leaves ONLY the untranslated locale empty when one locale has a per-usage alt', async () => {
    // The no-cross-locale-fallback rule (D10-6) seen from the authoring side.
    const wrapper = await mount(trapSettings('English only', null))
    expect(altInput(wrapper, 'en').element.value).toBe('English only')
    expect(altInput(wrapper, 'ar').element.value).toBe('')
  })
})

describe('both locales are required before a portrait can be saved', () => {
  async function saveWith(en: string, ar: string) {
    const wrapper = await mount(trapSettings(null, null))
    await altInput(wrapper, 'en').setValue(en)
    await altInput(wrapper, 'ar').setValue(ar)
    holder.calls = []
    await wrapper.find('[data-profile-save]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('does NOT send a PATCH when the Arabic alt is missing, and says which field', async () => {
    const wrapper = await saveWith('An English description', '')
    expect(holder.calls.filter(c => c.options.method === 'PATCH')).toHaveLength(0)
    expect(wrapper.find('[data-portrait-alt-error="ar"]').exists()).toBe(true)
    expect(wrapper.find('[data-portrait-alt-error="en"]').exists()).toBe(false)
  })

  it('does NOT send a PATCH when the English alt is missing', async () => {
    const wrapper = await saveWith('', 'وصف بالعربية')
    expect(holder.calls.filter(c => c.options.method === 'PATCH')).toHaveLength(0)
    expect(wrapper.find('[data-portrait-alt-error="en"]').exists()).toBe(true)
  })

  it('does NOT send a PATCH when both are whitespace only', async () => {
    await saveWith('   ', '  ')
    expect(holder.calls.filter(c => c.options.method === 'PATCH')).toHaveLength(0)
  })

  it('SENDS the PATCH once both locales are filled, carrying only the two owned fields', async () => {
    await saveWith('An English description', 'وصف بالعربية')
    const patch = holder.calls.find(c => c.options.method === 'PATCH')
    expect(patch).toBeDefined()
    expect(patch?.options.body).toEqual({
      portraitAssetId: 'asset-1',
      translations: [
        { locale: 'en', portraitAlt: 'An English description' },
        { locale: 'ar', portraitAlt: 'وصف بالعربية' }
      ]
    })
  })
})

describe('the admin settings read is locale-agnostic', () => {
  it('sends `locale: false`, because an unsolicited ?locale= is a 422 on a forbidNonWhitelisted DTO', async () => {
    await mount(trapSettings())
    const read = holder.calls.find(c => c.path === '/admin/settings')
    expect(read?.options.locale).toBe(false)
  })
})

describe('scope — the Portrait is the only implemented section', () => {
  it('renders no tagline, availability, profile-link or resume editor, not even a disabled one', async () => {
    const wrapper = await mount(trapSettings())
    const html = wrapper.html()
    // Owner decision (design §10): the durable route was chosen for later sections, NOT to be
    // filled now. A stub here would be a surface the owner has to review and a claim the dashboard
    // cannot honour.
    for (const absent of ['tagline', 'availability', 'profileLink', 'resumeAsset']) {
      expect(html).not.toContain(absent)
    }
  })
})
