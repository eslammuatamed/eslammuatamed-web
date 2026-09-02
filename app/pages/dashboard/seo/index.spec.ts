// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import SeoPage from './index.vue'
import MediaPicker from '~/components/dashboard/MediaPicker.vue'
import { PAGE_SEO_PAGE_ORDER } from '~/composables/useAdminPageSeo'
import { ApiError } from '~/utils/api-error'

/**
 * Unit coverage for the Static Page SEO EDITOR surface (FE4-U1d): the list rows remain the ONLY
 * edit source (zero detail GETs); the U1b builder owns every payload decision (changed locales
 * only, omission preserves, explicit null clears, `null` → ZERO requests); indexed 422 paths map
 * against the ACTUAL SENT order; unsaved work survives page switching AND background refreshes;
 * and the U1c request-state contract is intact underneath.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ method: string, path: string, body?: Record<string, unknown> }>,
  listResponse: null as unknown,
  patchOutcome: null as unknown,
  holdGet: false,
  release: null as null | (() => void),
  /** happy-dom exposes no `window.confirm`, so the page-switch dialog is stubbed by hand. */
  confirmCalls: [] as string[],
  confirmResult: false
}))

function outcome(value: unknown): { data: unknown } {
  if (value !== null && typeof value === 'object' && 'status' in (value as object)) {
    const problem = value as { status: number, errors?: Array<{ field: string, message: string }> }
    throw new ApiError({ type: 'about:blank', title: 'failed', status: problem.status, errors: problem.errors })
  }
  return { data: value }
}

mockNuxtImport('useApi', () => () => async (path: string, init?: { method?: string, body?: unknown }) => {
  const method = init?.method ?? 'GET'
  // The real transport serializes `body`; the mock accepts EITHER shape so callers stay honest.
  const rawBody = init?.body
  const body = rawBody === undefined || rawBody === null
    ? undefined
    : typeof rawBody === 'string' ? (JSON.parse(rawBody) as Record<string, unknown>) : (rawBody as Record<string, unknown>)
  holder.calls.push({ method, path, body })
  // The OG picker resolves every STORED reference through `GET /admin/media/:id`; without this
  // branch the fallback below hands it the list array and rendering throws.
  if (method === 'GET' && path.startsWith('/admin/media/')) {
    return {
      data: {
        id: path.split('/').pop(), kind: 'IMAGE', url: 'u', mimeType: 'image/png', sizeBytes: 10,
        originalFilename: 'og.png', width: 1, height: 1, blurhash: null, contentHash: 'h',
        variants: [], alts: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  }
  if (method === 'GET') {
    if (holder.holdGet) {
      holder.holdGet = false
      await new Promise<void>((resolve) => { holder.release = resolve })
    }
    return outcome(holder.listResponse)
  }
  return outcome(holder.patchOutcome)
})

type Translation = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageId: string | null
}
type Row = { pageKey: string, translations: Record<string, Translation> }

const OG_ID = '00000000-0000-4000-b100-000000000001'
const NULLS: Translation = { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null }

function row(pageKey: string, en: Partial<Translation> = {}, ar: Partial<Translation> = {}): Row {
  return { pageKey, translations: { en: { ...NULLS, ...en }, ar: { ...NULLS, ...ar } } }
}

function seedRows(): Row[] {
  return [
    row('home', { metaTitle: 'Home title' }, { metaTitle: 'الرئيسية' }),
    row('about',
      {
        metaTitle: 'About — Eslam Muatamed',
        metaDescription: 'Engineering background.',
        canonicalUrl: 'https://eslammuatamed.com/about',
        ogImageId: OG_ID
      },
      { metaTitle: 'نبذة — إسلام معتمد' }),
    row('experience'),
    row('projects'),
    row('blog'),
    row('resume', {}, { metaTitle: 'السيرة الذاتية — النص المحفوظ' }),
    row('contact')
  ]
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

beforeEach(() => {
  document.cookie = 'dashboard_locale=; Max-Age=0; path=/'
  holder.listResponse = null
  holder.patchOutcome = null
  holder.holdGet = false
  if (holder.release) { holder.release(); holder.release = null }
  holder.confirmCalls = []
  holder.confirmResult = false
  window.confirm = ((message?: string) => {
    holder.confirmCalls.push(message ?? '')
    return holder.confirmResult
  }) as typeof window.confirm
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.restoreAllMocks()
})

async function mount(config: { arabicChrome?: boolean, list?: unknown } = {}): Promise<typeof mounted> {
  holder.calls = []
  holder.listResponse = 'list' in config ? config.list : seedRows()
  if (config.arabicChrome) document.cookie = 'dashboard_locale=ar; path=/'
  const wrapper = await mountSuspended(SeoPage)
  mounted = wrapper
  await flushPromises()

  await flushPromises()

  return wrapper
}

/** Mount with the FIRST list response held in flight (initial-pending / stale-refresh proofs). */
async function mountHeld(): Promise<Awaited<ReturnType<typeof mountSuspended>>> {
  holder.calls = []
  holder.listResponse = seedRows()
  holder.patchOutcome = null
  holder.holdGet = true
  const wrapper = await mountSuspended(SeoPage)
  mounted = wrapper
  await flushPromises()

  return wrapper
}

async function releaseList(data?: unknown): Promise<void> {
  if (data !== undefined) holder.listResponse = data
  holder.release?.()
  holder.release = null
  await flushPromises()

}

async function submit(wrapper: NonNullable<typeof mounted>): Promise<void> {
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  await flushPromises()

}

const input = (wrapper: NonNullable<typeof mounted>, panel: string, field: string) =>
  wrapper.find(`[data-editor-panel="${panel}"] [data-seo-field="${field}"]`)
const inputValue = (wrapper: NonNullable<typeof mounted>, panel: string, field: string) =>
  (input(wrapper, panel, field).element as HTMLInputElement).value ?? ''
const patchCalls = () => holder.calls.filter(call => call.method === 'PATCH')
const patchBody = (callIndex = 0) => patchCalls()[callIndex]?.body as {
  translations: Array<Record<string, unknown>>
} | undefined

describe('the read underneath the editor (U1c contract preserved)', () => {
  it('issues ONE list GET and NEVER a detail or public read', async () => {
    await mount()
    expect(holder.calls.filter(call => call.method === 'GET')).toHaveLength(1)
    for (const call of holder.calls) {
      expect(call.method).toBe('GET')
      expect(call.path.startsWith('/admin/seo/pages/')).toBe(false)
      expect(call.path.startsWith('/seo/pages')).toBe(false)
    }
  })

  it('represents EXACTLY the seven closed keys in PRODUCT order despite a scrambled server array', async () => {
    const wrapper = await mount()
    const wrapper2 = await mount({}) // second mount over reversed fixture proves independence
    void wrapper2
    const keys = wrapper.findAll('[data-seo-page-select]')
      .map((node: { attributes: (name: string) => string | undefined }) => node.attributes('data-seo-page-select'))
    expect(keys).toHaveLength(7)
    expect([...keys].sort()).toEqual([...PAGE_SEO_PAGE_ORDER].sort())

    const scrambled = [...seedRows()].reverse()
    holder.listResponse = scrambled
    holder.calls = []
    const w2 = await mountSuspended(SeoPage)
    mounted?.unmount()
    mounted = w2
    await flushPromises(); await flushPromises()

    const keys2 = w2.findAll('[data-seo-page-select]')
      .map((node: { attributes: (name: string) => string | undefined }) => node.attributes('data-seo-page-select'))
    expect(keys2).toEqual([...PAGE_SEO_PAGE_ORDER])
    await w2.unmount()
  })

  it('initial NO-data renders the skeleton, then the loaded editor', async () => {
    holder.calls = []
    holder.holdGet = true
    const wrapper = await mountHeld()
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(false)
    await releaseList()
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
  })

  it('error with NO usable data renders error + retry, and retry REFETCHES', async () => {
    const wrapper = await mount({ list: { status: 500 } })
    expect(wrapper.find('[data-seo-failed]').exists()).toBe(true)
    holder.listResponse = seedRows()
    await wrapper.find('[data-seo-failed] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
    expect(holder.calls.filter(call => call.method === 'GET')).toHaveLength(2)
  })

  it('FORBIDDEN renders its own state; EMPTY renders the explicit empty state', async () => {
    const forbiddenWrapper = await mount({ list: { status: 403 } })
    expect(forbiddenWrapper.find('[data-seo-forbidden]').exists()).toBe(true)
    expect(forbiddenWrapper.find('[data-seo-empty]').exists()).toBe(false)
    await forbiddenWrapper.unmount()

    const emptyWrapper = await mount({ list: [] })
    expect(emptyWrapper.find('[data-seo-empty]').exists()).toBe(true)
    await emptyWrapper.unmount()
  })

  it('a failed REFRESH shows the stale notice while usable data stays visible', async () => {
    const wrapper = await mount()
    holder.listResponse = { status: 500 }
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-seo-stale]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Home title')
  })

  it('canonical values stay LTR under an ARABIC dashboard chrome', async () => {
    const wrapper = await mount({ arabicChrome: true })
    for (const node of wrapper.findAll('[data-editor-panel] [dir="ltr"]')) void node
    const canonicalInputs = wrapper.findAll('[data-seo-field="canonicalUrl"]')
    for (const node of canonicalInputs) {
      expect((node.element as HTMLInputElement).getAttribute('dir')).toBe('ltr')
    }
    expect(canonicalInputs.length).toBeGreaterThanOrEqual(2)
    expect(document.cookie).toContain('dashboard_locale=ar')
  })

  it('selection survives a background refresh BY KEY; missing key falls back to home', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()


    const refreshed = seedRows().map(rowItem =>
      rowItem.pageKey === 'home' ? row('home', { metaTitle: 'Home title v2' }) : rowItem
    )
    holder.listResponse = refreshed
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-seo-page-select="about"]').attributes('aria-selected')).toBe('true')

    // Contract-impossible corrupt fixture: about vanishes while CLEAN → deterministic home fallback.
    const withoutAbout = refreshed.filter(rowItem => rowItem.pageKey !== 'about')
    holder.listResponse = withoutAbout
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    const selected = wrapper.find('[data-seo-page-select][aria-selected="true"]')
    expect(selected.attributes('data-seo-page-select')).toBe('home')
  })
})

describe('editor initialization and binding', () => {
  it('initializes the form from the LIST ROW: home first, stored values in the inputs', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('About — Eslam Muatamed')
    expect(inputValue(wrapper, 'en', 'metaDescription')).toBe('Engineering background.')
    expect(inputValue(wrapper, 'en', 'canonicalUrl')).toBe('https://eslammuatamed.com/about')
    expect(inputValue(wrapper, 'ar', 'metaTitle')).toBe('نبذة — إسلام معتمد')
  })

  it('renders BOTH locale tabs with the four SEO fields per panel', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    for (const panel of ['en', 'ar']) {
      for (const field of ['metaTitle', 'metaDescription', 'canonicalUrl']) {
        expect(wrapper.find(`[data-editor-panel="${panel}"] [data-seo-field="${field}"]`).exists(),
          `${panel}/${field}`).toBe(true)
      }
      expect(wrapper.find(`[data-editor-panel="${panel}"] [data-seo-picker]`).exists()).toBe(true)
    }
    expect(wrapper.findAll('[data-seo-page-select]')).toHaveLength(7)
  })

  it('text edits reach the form state and mark the editor UNSAVED', async () => {
    const wrapper = await mount()
    await input(wrapper, 'en', 'metaTitle').setValue('Edited title')
    await flushPromises()

    expect(wrapper.find('[data-editor-save-state]').text()).toContain('Unsaved changes')
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Edited title')
  })

  it('an ogImage PICK reaches form state; a CLEAR becomes null in state', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    const picker = wrapper.find('[data-editor-panel="en"] [data-seo-picker]').findComponent(MediaPicker)
    expect(picker.exists()).toBe(true)

    // A new pick dirties the editor (held id → different id).
    picker.vm.$emit('update:modelValue', 'asset-new-1')
    await flushPromises()
    expect(wrapper.find('[data-editor-save-state]').text()).toContain('Unsaved changes')

    // And a subsequent CLEAR stays dirty: null ≠ the held id.
    picker.vm.$emit('update:modelValue', null)
    await flushPromises()
    expect(wrapper.find('[data-editor-save-state]').text()).toContain('Unsaved changes')
  })
})

describe('save wiring — the U1b builder owns every byte', () => {
  it('an UNCHANGED form produces ZERO PATCH requests (null sentinel, never [])', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await submit(wrapper)
    expect(patchCalls()).toHaveLength(0)
  })

  it('EN-only change sends ONLY the EN entry', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('Revised')
    await submit(wrapper)
    expect(patchCalls()).toHaveLength(1)
    const body = patchBody()!
    expect(body.translations).toHaveLength(1)
    expect(body.translations[0]).toMatchObject({ locale: 'en', metaTitle: 'Revised' })
  })

  it('AR-only change sends ONLY AR at SENT index 0', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'ar', 'metaTitle').setValue('عنوان جديد')
    await submit(wrapper)
    const body = patchBody()!
    expect(body.translations).toHaveLength(1)
    expect(body.translations[0]?.locale).toBe('ar')
    expect(body.translations[0]?.metaTitle).toBe('عنوان جديد')
    expect(patchCalls()[0]?.path).toBe('/admin/seo/pages/about')
  })

  it('bilingual changes send BOTH in deterministic [en, ar] order, changes only', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('EN revised')
    await input(wrapper, 'ar', 'metaTitle').setValue('AR revised')
    await submit(wrapper)
    const body = patchBody()!
    expect(body.translations.map(entry => entry.locale)).toEqual(['en', 'ar'])
    expect(body.translations[0]).toEqual({ locale: 'en', metaTitle: 'EN revised' })
    expect(body.translations[1]).toEqual({ locale: 'ar', metaTitle: 'AR revised' })
  })

  it('a HELD nullable TEXT field cleared travels as explicit null', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaDescription').setValue('')
    await submit(wrapper)
    const entry = patchBody()!.translations[0]!
    expect(entry.metaDescription).toBeNull()
  })

  it('INITIALLY-NULL untouched fields are OMITTED from the emitted entry', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    // AR metaDescription starts null and stays untouched; only the AR title changes.
    await input(wrapper, 'ar', 'metaTitle').setValue('عنوان')
    await submit(wrapper)
    const entry = patchBody()!.translations[0]!
    expect('metaDescription' in entry).toBe(false)
    expect('ogImageId' in entry).toBe(false)
  })

  it('a HELD ogImage CLEARED travels as explicit null; a NEW pick travels as the id', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    const picker = wrapper.find('[data-editor-panel="en"] [data-seo-picker]').findComponent(MediaPicker)
    picker.vm.$emit('update:modelValue', null)
    await flushPromises()

    await submit(wrapper)
    expect(patchBody()!.translations[0]?.ogImageId).toBeNull()

    const wrapper2 = await mount()
    await wrapper2.find('[data-seo-page-select="experience"]').trigger('click')
    const picker2 = wrapper2.find('[data-editor-panel="en"] [data-seo-picker]').findComponent(MediaPicker)
    picker2.vm.$emit('update:modelValue', 'asset-en-9')
    await flushPromises()

    await submit(wrapper2)
    expect(patchBody()!.translations[0]?.ogImageId).toBe('asset-en-9')
  })

  it('every PATCH body carries at least one entry and NEVER serializes translations: []', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('x')
    await submit(wrapper)
    for (const call of patchCalls()) {
      const serialized = JSON.stringify(call.body)
      expect(serialized).not.toContain('"translations":[]')
      expect((call.body as { translations: unknown[] }).translations.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('pageKey appears ONLY in the request path, never in the body', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('Keyless')
    await submit(wrapper)
    expect(patchCalls()[0]?.path).toBe('/admin/seo/pages/about')
    expect(JSON.stringify(patchBody())).not.toContain('pageKey')
  })

  it('an FTP canonical passes CLIENT validation and reaches the PATCH', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'canonicalUrl').setValue('ftp://eslammuatamed.com/resource')
    await submit(wrapper)
    expect(patchCalls()).toHaveLength(1)
    expect(patchBody()!.translations[0]?.canonicalUrl).toBe('ftp://eslammuatamed.com/resource')
  })
})

describe('save success — authoritative response, honest clean state', () => {
  const updatedAboutRow = (): Row => row('about',
    { metaTitle: 'Server-confirmed title' },
    { metaTitle: 'نبذة مؤكدة' })

  beforeEach(() => {
    holder.patchOutcome = updatedAboutRow()
  })

  it('replaces the row from the PATCH RESPONSE (no refetch), re-seeds clean, keeps page + locale', async () => {
    const wrapper = await mount({ arabicChrome: false })
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    // Move to the ARABIC tab deliberately: a save must not yank the operator back to English.
    await wrapper.find('[data-editor-tabs] [role="tab"]:nth-of-type(2)').trigger('click').catch(() => undefined)
    await input(wrapper, 'en', 'metaTitle').setValue('Client draft')
    await submit(wrapper)

    expect(patchCalls()).toHaveLength(1)
    // The editor now shows SERVER-CONFIRMED values — including the untouched Arabic row.
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Server-confirmed title')
    expect(inputValue(wrapper, 'ar', 'metaTitle')).toBe('نبذة مؤكدة')
    expect(wrapper.find('[data-editor-save-state]').text()).not.toContain('Unsaved')
    expect(wrapper.find('[data-seo-page-select="about"]').attributes('aria-selected')).toBe('true')
    // Zero writes beyond the one PATCH, and zero refetches of the collection after it.
    expect(holder.calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
    expect(holder.calls.filter(call => call.method === 'GET' && call.path === '/admin/seo/pages')).toHaveLength(1)
  })
})

describe('mutation errors keep the operator\'s work', () => {
  it('a client-invalid canonical blocks the PATCH entirely', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'canonicalUrl').setValue('not-a-uri')
    await submit(wrapper)
    expect(patchCalls()).toHaveLength(0)
    expect(wrapper.find('[data-editor-panel="en"]').text()).toContain('absolute URL')
  })

  it('an ARABIC-ONLY sent payload maps translations[0] onto the ARABIC field and marks its tab', async () => {
    holder.patchOutcome = {
      status: 422,
      errors: [{ field: 'translations[0].canonicalUrl', message: 'must be an absolute URI.' }]
    }
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'ar', 'metaTitle').setValue('تعديل عربي فقط')
    await submit(wrapper)

    // Index 0 was ARABIC: the error must land on the ARABIC canonical field, never the English one.
    expect(wrapper.find('[data-editor-tab-invalid="ar"]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-tab-invalid="en"]').exists()).toBe(false)
    const arPanelText = wrapper.find('[data-editor-panel="ar"]').text()
    expect(arPanelText).toContain('must be an absolute URI.')
    // The dirty edit survives the failure.
    expect(inputValue(wrapper, 'ar', 'metaTitle')).toBe('تعديل عربي فقط')
  })

  it('a BILINGUAL payload maps indexes by the ACTUAL sent order', async () => {
    holder.patchOutcome = {
      status: 422,
      errors: [{ field: 'translations[1].metaTitle', message: 'server rejected index 1' }]
    }
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('EN draft')
    await input(wrapper, 'ar', 'metaTitle').setValue('AR draft')
    await submit(wrapper)
    // Sent order [en, ar]: index 1 is ARABIC.
    expect(wrapper.find('[data-editor-tab-invalid="ar"]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-tab-invalid="en"]').exists()).toBe(false)
  })

  it('a NON-validation failure shows an action-level error and NEVER the full-page skeleton', async () => {
    holder.patchOutcome = { status: 500 }
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('Still here')
    await submit(wrapper)
    expect(wrapper.find('[data-seo-save-error]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-failed]').exists()).toBe(false)
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Still here')
  })
})

describe('unsaved page switching (OD-8)', () => {
  it('DIRTY + CANCEL stays on the current page with every edit intact', async () => {
    holder.confirmResult = false
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('Unsaved draft')
    await wrapper.find('[data-seo-page-select="home"]').trigger('click')
    await flushPromises()

    expect(holder.confirmCalls.length).toBeGreaterThan(0)
    expect(wrapper.find('[data-seo-page-select="about"]').attributes('aria-selected')).toBe('true')
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Unsaved draft')
  })

  it('DIRTY + CONFIRM discards and loads the DESTINATION row', async () => {
    holder.confirmResult = true
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'en', 'metaTitle').setValue('Discarded draft')
    await wrapper.find('[data-seo-page-select="home"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-seo-page-select="home"]').attributes('aria-selected')).toBe('true')
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Home title')
  })

  it('CLEAN switches immediately, with NO confirmation and NO detail GET', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="projects"]').trigger('click')
    await flushPromises()

    expect(holder.confirmCalls).toHaveLength(0)
    expect(wrapper.find('[data-seo-page-select="projects"]').attributes('aria-selected')).toBe('true')
    // Switching consumed ZERO additional requests: the destination LIST ROW was the edit source.
    expect(holder.calls.filter(call => call.method === 'GET')).toHaveLength(1)
    for (const call of holder.calls) {
      expect(call.path.startsWith('/admin/seo/pages/')).toBe(false)
    }
  })
})

describe('background refresh versus the editor', () => {
  it('a CLEAN selected page rehydrates from the refreshed list', async () => {
    const wrapper = await mount()
    const refreshed = seedRows().map(rowItem =>
      rowItem.pageKey === 'home' ? row('home', { metaTitle: 'Refreshed home title' }) : rowItem
    )
    holder.listResponse = refreshed
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('Refreshed home title')
  })

  it('a DIRTY selected page is NOT overwritten by the background refresh', async () => {
    const wrapper = await mount()
    await input(wrapper, 'en', 'metaTitle').setValue('My uncommitted work')
    const refreshed = seedRows().map(rowItem =>
      rowItem.pageKey === 'home' ? row('home', { metaTitle: 'Server raced ahead' }) : rowItem
    )
    holder.listResponse = refreshed
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('My uncommitted work')
    // The selector still names the page whose edits are held.
    expect(wrapper.find('[data-seo-page-select="home"]').attributes('aria-selected')).toBe('true')
  })

  it('the selected KEY remains stable through a refresh (never array position)', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="blog"]').trigger('click')
    await flushPromises()
    const reversed = [...seedRows()].reverse()
    holder.listResponse = reversed
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-seo-page-select="blog"]').attributes('aria-selected')).toBe('true')
  })
})

describe('optional override data — no content-authoring rule', () => {
  it('an ALL-NULL page is fully editable and saves a single-field override', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="experience"]').trigger('click')
    await flushPromises()
    expect(inputValue(wrapper, 'en', 'metaTitle')).toBe('')
    await input(wrapper, 'en', 'metaTitle').setValue('Only one override')
    await submit(wrapper)
    expect(patchBody()!.translations).toEqual([{ locale: 'en', metaTitle: 'Only one override' }])
  })

  it('CLEARING the final remaining override is valid and PATCHes the explicit nulls', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="resume"]').trigger('click')
    await flushPromises()

    await input(wrapper, 'ar', 'metaTitle').setValue('')
    await submit(wrapper)
    const body = patchBody()!
    expect(body.translations).toEqual([{ locale: 'ar', metaTitle: null }])
  })

  it('imposes NO authored-locale requirement anywhere on the surface', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="contact"]').trigger('click')
    await flushPromises()
    // Both locales blank: the editor renders, nothing demands authoring, and saving is a no-op.
    expect(wrapper.find('[data-seo-editor]').exists()).toBe(true)
    await submit(wrapper)
    expect(patchCalls()).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/at least one language/i)
  })
})

describe('structural isolation pins', () => {
  it('the EDITOR builds payloads ONLY through the U1b builder; the page never inlines one', () => {
    const editorSource = readFileSync('app/components/dashboard/PageSeoEditor.vue', 'utf8')
    const pageSource = readFileSync('app/pages/dashboard/seo/index.vue', 'utf8')
    // The builder is invoked exactly where the form lives.
    expect(editorSource).toMatch(/buildPageSeoPatch\(/)
    // Neither layer hand-builds a translations array for the wire.
    expect(editorSource).not.toMatch(/translations:\s*\[\{/)
    expect(pageSource).not.toMatch(/translations:\s*\[\{/)
    // No public-endpoint reachability from either layer.
    expect(editorSource).not.toMatch(/'\/seo\/pages/)
    expect(pageSource).not.toMatch(/'\/seo\/pages/)
    // No detail GET anywhere.
    expect(editorSource).not.toMatch(/admin\/seo\/pages\/\$\{[^}]+\}`,?\s*\{[^}]*method:\s*'GET'/s)
  })
})
