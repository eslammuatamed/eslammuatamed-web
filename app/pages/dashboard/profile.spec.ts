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

const STAMP = '2026-08-01T00:00:00.000Z'

/** An `AdminMediaAssetEntity`, contract-shaped. `width`/`height`/`variants` are empty for a PDF. */
const asset = (id: string, kind: 'IMAGE' | 'PDF', originalFilename: string) => ({
  id,
  kind,
  url: `https://media.example/${id}`,
  mimeType: kind === 'PDF' ? 'application/pdf' : 'image/webp',
  sizeBytes: kind === 'PDF' ? 245123 : 10,
  originalFilename,
  width: kind === 'PDF' ? null : 1,
  height: kind === 'PDF' ? null : 1,
  blurhash: null,
  contentHash: `hash-${id}`,
  variants: [],
  alts: [],
  createdAt: STAMP,
  updatedAt: STAMP
})

mockNuxtImport('useApi', () => () => (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (path === '/admin/settings' && (options.method ?? 'GET') === 'GET') {
    return Promise.resolve({ data: holder.settings })
  }
  if (path === '/admin/settings' && options.method === 'PATCH') {
    // The contract says the response is the FULL UPDATED entity, and the page depends on that: each
    // section re-seeds its baseline from it, so a mock that echoed the pre-save settings back would
    // leave Save enabled after a successful save and hide that regression rather than expose it.
    // Only the scalar ids are merged — `translations` arrives as an array of upserts and folding it
    // into the response's map shape is a second implementation of the API, which a mock must not be.
    const body = (options.body ?? {}) as Record<string, unknown>
    const merged = { ...(holder.settings as Record<string, unknown>) }
    for (const key of ['resumeAssetId', 'portraitAssetId']) {
      if (key in body) merged[key] = body[key]
    }
    holder.settings = merged
    return Promise.resolve({ data: merged })
  }
  // The picker's BROWSER lists through `GET /admin/media`. Returning the paginated envelope rather
  // than falling through to the single-asset branch matters: `useMediaLibrary` reads `meta.total`,
  // and a wrong shape would throw into its catch and render the failure state instead of a grid.
  if (path === '/admin/media') {
    return Promise.resolve({ data: [], meta: { total: 0, totalPages: 1, page: 1, perPage: 12 } })
  }
  // The picker resolves its preview through `GET /admin/media/:id`. The kind is keyed off the id so
  // the résumé slot resolves a real PDF descriptor and the portrait an IMAGE.
  const id = path.replace('/admin/media/', '')
  return id.startsWith('resume-')
    ? Promise.resolve({ data: asset(id, 'PDF', `${id}.pdf`) })
    : Promise.resolve({ data: asset(id, 'IMAGE', 'portrait.jpg') })
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
function trapSettings(enAlt: string | null = null, arAlt: string | null = null, resumeAssetId: string | null = null) {
  return {
    id: 's1', profileLinks: [], resumeAssetId,
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

  it('HIDES the reference once the selection differs from the saved portrait', async () => {
    // `settings` changes only on load and save, while the selection changes immediately — so an
    // ungated block would keep describing the PREVIOUS portrait under a label saying "this image",
    // for the whole replace flow. Showing nothing is the honest answer.
    const wrapper = await mount(trapSettings(null, null))
    expect(wrapper.find('[data-portrait-library-default]').exists()).toBe(true)

    await wrapper.findComponent({ name: 'DashboardMediaPicker' }).vm.$emit('update:modelValue', 'asset-2')
    await flushPromises()

    expect(wrapper.find('[data-portrait-library-default]').exists()).toBe(false)
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

describe('scope — Portrait and Résumé are the implemented sections', () => {
  it('renders no tagline, availability or profile-link editor, not even a disabled one', async () => {
    const wrapper = await mount(trapSettings())
    const html = wrapper.html()
    // Owner decision (design §10): the durable route was chosen for later sections, NOT to be
    // filled now. A stub here would be a surface the owner has to review and a claim the dashboard
    // cannot honour.
    //
    // `resumeAsset` WAS on this list and has been removed deliberately — the résumé is now an
    // implemented section, so its absence is no longer the correct assertion. The remaining three
    // are still genuinely unbuilt.
    for (const absent of ['tagline', 'availability', 'profileLink']) {
      expect(html).not.toContain(absent)
    }
  })
})

/**
 * ── THE RÉSUMÉ SECTION ──────────────────────────────────────────────────────────────────────────
 *
 * The owner manages the résumé PDF end to end from this page: see what is selected, pick or upload
 * one, replace it, withdraw it. Every assertion below goes through the RENDERED page and the calls
 * it actually issues, because the whole feature is wiring — the picker, the transport and the
 * settings endpoint all already existed, so a test that checked props rather than requests would
 * prove nothing about whether they were wired together correctly.
 */

const resumePicker = (wrapper: Awaited<ReturnType<typeof mount>>) => {
  const pickers = wrapper.findAllComponents({ name: 'DashboardMediaPicker' })
  // Asserted, not assumed: the existing portrait tests reach their picker with `findComponent`,
  // which returns the FIRST match, so this ordering is load-bearing for the suite above as well.
  expect(pickers).toHaveLength(2)
  return pickers[1]!
}

const patchBodies = () =>
  holder.calls.filter(c => c.options.method === 'PATCH').map(c => c.options.body)

async function selectResume(wrapper: Awaited<ReturnType<typeof mount>>, id: string | null) {
  resumePicker(wrapper).vm.$emit('update:modelValue', id)
  await flushPromises()
}

async function saveResume(wrapper: Awaited<ReturnType<typeof mount>>) {
  await wrapper.find('[data-resume-save]').trigger('click')
  await flushPromises()
}

describe('the current résumé selection is visible, including when there is none', () => {
  it('renders the selected PDF by filename', async () => {
    const wrapper = await mount(trapSettings(null, null, 'resume-1'))
    const filename = wrapper.find('[data-resume-section] [data-picker-filename]')
    expect(filename.exists()).toBe(true)
    expect(filename.text()).toBe('resume-1.pdf')
  })

  it('renders the EMPTY state when no résumé is configured', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    expect(wrapper.find('[data-resume-section] [data-picker-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-resume-section] [data-picker-filename]').exists()).toBe(false)
  })

  it('scopes the two sections to their own asset — the résumé does not show the portrait', async () => {
    const wrapper = await mount(trapSettings(null, null, 'resume-1'))
    expect(wrapper.find('[data-resume-section] [data-picker-filename]').text()).toBe('resume-1.pdf')
    // The portrait picker resolves `asset-1`, an IMAGE, and is unaffected by the résumé selection.
    expect(wrapper.html()).toContain('portrait.jpg')
  })
})

describe('the résumé picker EXCLUDES image assets', () => {
  /** Open a picker's dialog and return the media-list query its browser issued. */
  async function listQueryFor(wrapper: Awaited<ReturnType<typeof mount>>, index: number) {
    holder.calls = []
    await wrapper.findAll('[data-picker-open]')[index]!.trigger('click')
    await flushPromises()
    const list = holder.calls.find(c => c.path === '/admin/media')
    return (list?.options.query ?? null) as Record<string, unknown> | null
  }

  it('asks the API for PDFs ONLY — the exclusion is the request, not a client-side filter', async () => {
    // This is the assertion that matters. Filtering a mixed page in the browser would still show
    // the operator a short grid, but it would also break the pagination counts and let an IMAGE
    // through on any page the filter did not see. `?kind=PDF` is the contract's own mechanism
    // (`MediaListQueryDto`), so the API never returns an image to exclude in the first place.
    const wrapper = await mount(trapSettings(null, null, null))
    expect(await listQueryFor(wrapper, 1)).toMatchObject({ kind: 'PDF' })
  })

  it('still asks for IMAGEs in the portrait section — the kind is per-section, not global', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    expect(await listQueryFor(wrapper, 0)).toMatchObject({ kind: 'IMAGE' })
  })

  it('locks the kind so the operator cannot widen it back to images', async () => {
    // `MediaBrowser` hides its kind filter whenever `allowedKind` is set, and `effectiveKind`
    // prefers the prop over browse state — so there is no control, and no stale state, that could
    // put an IMAGE into the résumé grid.
    const wrapper = await mount(trapSettings(null, null, null))
    expect(resumePicker(wrapper).props('allowedKind')).toBe('PDF')
  })
})

describe('selecting and replacing a résumé persists through PATCH /admin/settings', () => {
  it('sends `resumeAssetId` and NOTHING else when a PDF is selected', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    await selectResume(wrapper, 'resume-1')
    holder.calls = []
    await saveResume(wrapper)

    // Exact equality, not a subset match: a body that also carried `portraitAssetId` or
    // `translations` would resend a snapshot the Portrait section may have moved past, silently
    // reverting an edit this save never showed (D10-2).
    expect(patchBodies()).toEqual([{ resumeAssetId: 'resume-1' }])
  })

  it('sends the NEW id when the résumé is replaced', async () => {
    const wrapper = await mount(trapSettings(null, null, 'resume-1'))
    await selectResume(wrapper, 'resume-2')
    holder.calls = []
    await saveResume(wrapper)

    expect(patchBodies()).toEqual([{ resumeAssetId: 'resume-2' }])
    expect(wrapper.find('[data-resume-section] [data-picker-filename]').text()).toBe('resume-2.pdf')
  })

  it('sends an explicit `null` when the résumé is withdrawn, never an omission', async () => {
    // Omitting the key means "leave it alone" on a PATCH, so a removal that omitted it would
    // silently no-op and the download would stay live on the public page.
    const wrapper = await mount(trapSettings(null, null, 'resume-1'))
    await selectResume(wrapper, null)
    holder.calls = []
    await saveResume(wrapper)

    expect(patchBodies()).toEqual([{ resumeAssetId: null }])
  })

  it('sends `locale: false`, because an unsolicited ?locale= is a 422', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    await selectResume(wrapper, 'resume-1')
    holder.calls = []
    await saveResume(wrapper)

    expect(holder.calls.find(c => c.options.method === 'PATCH')?.options.locale).toBe(false)
  })

  it('confirms the save and settles back to "no unsaved changes"', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    await selectResume(wrapper, 'resume-1')
    await saveResume(wrapper)

    expect(wrapper.find('[data-resume-saved]').exists()).toBe(true)
    // Re-seeded from the RESPONSE, so Save going quiet is confirmed server state rather than an
    // optimistic echo of what was sent.
    expect(wrapper.find('[data-resume-save]').attributes('disabled')).toBeDefined()
  })

  it('does not offer Save until something changes', async () => {
    const wrapper = await mount(trapSettings(null, null, 'resume-1'))
    expect(wrapper.find('[data-resume-save]').attributes('disabled')).toBeDefined()
  })
})

describe('the two sections do not destroy each other\'s unsaved work', () => {
  /**
   * `admin.patch()` replaces the held settings and BOTH sections watch that ref, so either save
   * fires the other section's re-seed. Ungated, this is silent data loss: alt text the operator
   * typed disappears because they saved something else entirely.
   */
  it('KEEPS unsaved portrait alt text when the résumé is saved', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    await altInput(wrapper, 'en').setValue('Typed but not yet saved')
    await altInput(wrapper, 'ar').setValue('لم يُحفظ بعد')

    await selectResume(wrapper, 'resume-1')
    await saveResume(wrapper)

    expect(altInput(wrapper, 'en').element.value).toBe('Typed but not yet saved')
    expect(altInput(wrapper, 'ar').element.value).toBe('لم يُحفظ بعد')
  })

  it('KEEPS an unsaved résumé selection when the portrait is saved', async () => {
    const wrapper = await mount(trapSettings(null, null, null))
    await selectResume(wrapper, 'resume-1')

    await altInput(wrapper, 'en').setValue('An English description')
    await altInput(wrapper, 'ar').setValue('وصف بالعربية')
    await wrapper.find('[data-profile-save]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-resume-section] [data-picker-filename]').text()).toBe('resume-1.pdf')
    // And it is still UNSAVED — the portrait's save must not have quietly committed it either.
    expect(patchBodies()).toEqual([{
      portraitAssetId: 'asset-1',
      translations: [
        { locale: 'en', portraitAlt: 'An English description' },
        { locale: 'ar', portraitAlt: 'وصف بالعربية' }
      ]
    }])
  })
})
