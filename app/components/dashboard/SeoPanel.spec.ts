// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import SeoPanel from './SeoPanel.vue'
import MediaPicker from './MediaPicker.vue'

/**
 * The shared SEO panel, asserted through the real rendered component.
 *
 * The panel is PRESENTATION ONLY, and these tests pin both halves of that claim: the four
 * fields render, bind and emit mechanically (including the `null`-on-clear contract of the
 * media picker travelling through untouched), AND the file stays entity-blind — a source scan
 * rejects any mention of a consuming module by name, so the boundary cannot erode by drift.
 *
 * Labels are asserted against the REAL catalogue files (not copies): a key missing from either
 * catalogue renders its raw path and fails here, and `i18n/locale-parity.spec.ts` guards the
 * two catalogues against each other.
 */

const holder = vi.hoisted(() => ({ locale: 'en' as 'en' | 'ar' }))

function catalogue(locale: 'en' | 'ar'): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${locale}.json`), 'utf8'))
}

function lookup(root: Record<string, unknown>, key: string): string {
  let node: unknown = root
  for (const part of key.split('.')) node = (node as Record<string, unknown>)?.[part]
  return typeof node === 'string' ? node : key
}

mockNuxtImport('useDashboardI18n', () => () => ({
  locale: computed(() => holder.locale),
  dir: computed(() => (holder.locale === 'ar' ? 'rtl' : 'ltr')),
  t: (key: string) => lookup(catalogue(holder.locale), key),
  setLocale: async () => {},
  ensureMessages: async () => {}
}))

interface PanelProps {
  metaTitle?: string
  metaDescription?: string
  canonicalUrl?: string
  ogImageId?: string | null
  contentDir?: 'ltr' | 'rtl'
  disabled?: boolean
  metaTitleError?: string
  canonicalUrlError?: string
}

const defaults: Required<Pick<PanelProps, 'metaTitle' | 'metaDescription' | 'canonicalUrl' | 'ogImageId'>> = {
  metaTitle: 'Stored title',
  metaDescription: 'Stored description',
  canonicalUrl: 'https://eslammuatamed.com/stored',
  ogImageId: null
}

async function mount(over: PanelProps = {}) {
  const wrapper = await mountSuspended(SeoPanel, { props: { ...defaults, ...over } })
  return wrapper
}

afterEach(() => { holder.locale = 'en' })

describe('the four SEO fields render and bind', () => {
  it('renders the meta title control holding its value', async () => {
    const wrapper = await mount()
    const input = wrapper.find('input[data-seo-field="metaTitle"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Stored title')
  })

  it('renders the meta description textarea holding its value', async () => {
    const wrapper = await mount()
    const area = wrapper.find('textarea[data-seo-field="metaDescription"]')
    expect(area.exists()).toBe(true)
    expect((area.element as HTMLTextAreaElement).value).toBe('Stored description')
  })

  it('renders the canonical URL input holding its value', async () => {
    const wrapper = await mount()
    const input = wrapper.find('input[data-seo-field="canonicalUrl"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('https://eslammuatamed.com/stored')
  })

  it('renders the OG image media picker', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-seo-picker]').exists()).toBe(true)
    // The real picker is mounted, not a lookalike: its empty-state copy is its own.
    expect(wrapper.find('[data-picker-empty]').exists()).toBe(true)
  })

  it('propagates an edit on every text field to its own event', async () => {
    const wrapper = await mount()
    await wrapper.find('input[data-seo-field="metaTitle"]').setValue('Next title')
    await wrapper.find('textarea[data-seo-field="metaDescription"]').setValue('Next description')
    await wrapper.find('input[data-seo-field="canonicalUrl"]').setValue('https://example.com/next')

    expect(wrapper.emitted('update:metaTitle')?.at(-1)).toEqual(['Next title'])
    expect(wrapper.emitted('update:metaDescription')?.at(-1)).toEqual(['Next description'])
    expect(wrapper.emitted('update:canonicalUrl')?.at(-1)).toEqual(['https://example.com/next'])
  })

  it('forwards the picker selection verbatim, including a cleared null', async () => {
    const wrapper = await mount({ ogImageId: null })
    const picker = wrapper.findComponent(MediaPicker)
    expect(picker.exists()).toBe(true)

    picker.vm.$emit('update:modelValue', 'asset-9')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:ogImageId')?.at(-1)).toEqual(['asset-9'])

    picker.vm.$emit('update:modelValue', null)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:ogImageId')?.at(-1)).toEqual([null])
    // The null arrived as null, not coerced to an empty string.
    expect(wrapper.emitted('update:ogImageId')?.at(-1)?.[0]).toBeNull()
  })
})

describe('direction is per field, never inherited from chrome', () => {
  it('canonical URL is LTR even under RTL content direction', async () => {
    const wrapper = await mount({ contentDir: 'rtl' })
    expect(wrapper.find('input[data-seo-field="canonicalUrl"]').attributes('dir')).toBe('ltr')
  })

  it('natural-language fields follow the content direction', async () => {
    const rtl = await mount({ contentDir: 'rtl' })
    expect(rtl.find('input[data-seo-field="metaTitle"]').attributes('dir')).toBe('rtl')
    expect(rtl.find('textarea[data-seo-field="metaDescription"]').attributes('dir')).toBe('rtl')

    const ltr = await mount()
    expect(ltr.find('input[data-seo-field="metaTitle"]').attributes('dir')).toBe('ltr')
    expect(ltr.find('input[data-seo-field="canonicalUrl"]').attributes('dir')).toBe('ltr')
  })
})

describe('the media picker is constrained and shareable', () => {
  it('restricts the picker to IMAGE assets', async () => {
    const wrapper = await mount()
    expect(wrapper.findComponent(MediaPicker).props('allowedKind')).toBe('IMAGE')
  })

  it('propagates disabled to every control including the picker', async () => {
    const wrapper = await mount({ disabled: true })
    for (const field of ['metaTitle', 'canonicalUrl']) {
      expect(wrapper.find(`input[data-seo-field="${field}"]`).attributes('disabled')).toBeDefined()
    }
    expect(wrapper.find('textarea[data-seo-field="metaDescription"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(MediaPicker).props('disabled')).toBe(true)
  })
})

describe('server field errors surface where the caller provides them', () => {
  it('renders provided error strings on their own fields only', async () => {
    const wrapper = await mount({
      metaTitleError: 'Meta title is invalid',
      canonicalUrlError: 'Canonical URL must be a URI'
    })
    const body = wrapper.text()
    expect(body).toContain('Meta title is invalid')
    expect(body).toContain('Canonical URL must be a URI')
  })
})

describe('labels come from the one shared dashboard.seo namespace', () => {
  it('renders English catalogue copy', async () => {
    holder.locale = 'en'
    const wrapper = await mount()
    const en = catalogue('en')
    expect(wrapper.find('legend').text()).toBe(lookup(en, 'dashboard.seo.title'))
    expect(wrapper.text()).toContain(lookup(en, 'dashboard.seo.field.metaTitle'))
    expect(wrapper.text()).toContain(lookup(en, 'dashboard.seo.field.metaDescription'))
    expect(wrapper.text()).toContain(lookup(en, 'dashboard.seo.field.canonicalUrl'))
    expect(wrapper.text()).toContain(lookup(en, 'dashboard.seo.field.ogImage'))
  })

  it('renders Arabic catalogue copy', async () => {
    holder.locale = 'ar'
    const wrapper = await mount()
    const ar = catalogue('ar')
    expect(wrapper.find('legend').text()).toBe(lookup(ar, 'dashboard.seo.title'))
    expect(wrapper.text()).toContain(lookup(ar, 'dashboard.seo.field.metaTitle'))
    expect(wrapper.text()).toContain(lookup(ar, 'dashboard.seo.field.ogImage'))
  })
})

describe('the panel is entity-blind by source, not by convention', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/components/dashboard/SeoPanel.vue'), 'utf8')

  it('mentions no consuming module by name anywhere in the file', () => {
    const offenders = source.match(/.*(?:article|project).*/gi) ?? []
    expect(offenders, `entity-specific wording found:\n${offenders.join('\n')}`).toEqual([])
  })

  it('imports no module form machinery or API layer', () => {
    expect(source).not.toMatch(/from\s+['"]~?\/?composables\/admin-/)
    expect(source).not.toMatch(/\buseApi\b/)
    expect(source).not.toMatch(/dashboard-translation-errors/)
  })

  it('keeps the media picker on the LAZY boundary the editors' + "'" + ' governed routes rely on', () => {
    // Both consuming editors sit on routes whose media subsystem was deliberately moved off the
    // eager closure (a measured 24,769 B). A static <DashboardMediaPicker> here would quietly
    // pull it back onto every caller at once — this pin makes that regression a test failure.
    expect(source).toMatch(/<LazyDashboardMediaPicker/)
    expect(source).not.toMatch(/<DashboardMediaPicker[ /\n]/)
  })
})
