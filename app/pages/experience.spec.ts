// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import ExperiencePage from './experience.vue'

/**
 * Page-level coverage for the state × locale combinations the e2e lanes cannot reach.
 *
 * The scenario backend selects its scenario by LOCALE (`/experience` empty, `/ar/experience` 503),
 * because the page forwards no parameter it could key off. That proves EN-empty and AR-error but
 * leaves **AR-empty** and **EN-error** never rendered anywhere. AR-empty is the one that matters
 * most: the binding web-005 constraint is that an untranslated English fallback must never appear
 * on an Arabic public route, and key parity proves the keys exist — not that the Arabic string
 * reaches the DOM.
 *
 * `t` resolves against the REAL locale files rather than echoing the key, so an assertion here
 * fails if the Arabic copy is missing, empty, or accidentally English.
 */
// `mockNuxtImport` factories are hoisted ABOVE the imports above, so they cannot close over anything
// defined at module scope. They read a hoisted holder instead, which is filled in below — by the
// time a factory is actually CALLED (during a test) the holder is populated.
const holder = vi.hoisted(() => ({
  i18n: null as unknown,
  asyncData: null as unknown,
  localePath: null as unknown
}))

mockNuxtImport('useI18n', () => () => holder.i18n)
mockNuxtImport('useExperiences', () => async () => holder.asyncData)
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => holder.localePath)
mockNuxtImport('useSchemaOrg', () => () => undefined)
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => input)
mockNuxtImport('useSeoMeta', () => () => undefined)

// Read from disk rather than importing: the i18n module transforms locale JSON at build time, so an
// import here would not necessarily be the plain message object the app ships.
const localeFile = (code: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')
  ) as Record<string, unknown>
const messages: Record<string, Record<string, unknown>> = { en: localeFile('en'), ar: localeFile('ar') }
const locale = ref<'en' | 'ar'>('en')

/**
 * Namespaces this page actually owns. A miss inside one of these is a real defect and throws — that
 * strictness is the whole point, since a silently-missing Arabic string is exactly what these tests
 * exist to catch. Anything outside them is a framework probe (`nuxt-seo-utils` looks up an optional
 * `pages.index.title` fallback, for one) and resolves to the key, as a real `t` would.
 */
const OWNED = ['experience.', 'seo.experience.', 'nav.', 'common.', 'brand.', 'home.experience.']

function translate(key: string, params: Record<string, unknown> = {}): string {
  const resolved = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[locale.value])
  if (typeof resolved !== 'string') {
    if (OWNED.some(prefix => key.startsWith(prefix))) {
      throw new Error(`missing ${locale.value} message: ${key}`)
    }
    return key
  }
  return resolved.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

const state = {
  data: ref<unknown[] | null>([]),
  status: ref('success'),
  error: ref<Error | null>(null)
}

holder.i18n = { t: translate, locale }
holder.asyncData = { data: state.data, status: state.status, error: state.error, refresh: vi.fn() }
holder.localePath = (path: string) => (locale.value === 'ar' ? `/ar${path}` : path)

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UButton: { template: '<a :href="to"><slot /></a>', props: ['to', 'variant', 'color'] },
  UiBreadcrumbs: { template: '<nav />', props: ['items', 'label'] },
  // Render whichever branch the page selected, exactly as `UiRequestState` would.
  UiRequestState: {
    template: `<div>
      <slot v-if="error" name="error" />
      <slot v-else-if="empty" name="empty" />
      <slot v-else />
    </div>`,
    props: ['pending', 'refreshing', 'error', 'empty', 'skeleton', 'count']
  }
}

async function render(options: { locale: 'en' | 'ar', data: unknown[] | null, error: Error | null }) {
  locale.value = options.locale
  state.data.value = options.data
  state.error.value = options.error
  state.status.value = options.error ? 'error' : 'success'
  return mountSuspended(ExperiencePage, { global: { stubs } })
}

describe('experience page — empty state', () => {
  it('renders the ENGLISH empty copy and an onward path that is not Contact', async () => {
    const wrapper = await render({ locale: 'en', data: [], error: null })

    expect(wrapper.text()).toContain('No roles published yet')
    expect(wrapper.text()).toContain('Browse projects')
    expect(wrapper.html()).not.toContain('/contact')
  })

  it('renders the ARABIC empty copy — never an English fallback', async () => {
    const wrapper = await render({ locale: 'ar', data: [], error: null })
    const text = wrapper.text()

    expect(text).toContain('لم تُنشر الخبرات المهنية بعد')
    expect(text).toContain('تصفّح المشاريع')
    // The specific regression this guards: English leaking onto an Arabic public route.
    expect(text).not.toContain('No roles published yet')
    expect(text).not.toContain('Browse projects')
    expect(text).not.toContain('experience.emptyTitle')
  })
})

describe('experience page — error state', () => {
  it('renders the ENGLISH error copy in an alert and leaks no technical detail', async () => {
    const wrapper = await render({ locale: 'en', data: null, error: new Error('503 upstream') })
    const alert = wrapper.find('[role="alert"]')

    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Experience could not be loaded')
    for (const leak of ['503', 'upstream', 'Error', 'fetch']) {
      expect(alert.text()).not.toContain(leak)
    }
  })

  it('renders the ARABIC error copy — never an English fallback', async () => {
    const wrapper = await render({ locale: 'ar', data: null, error: new Error('503 upstream') })
    const alert = wrapper.find('[role="alert"]')

    expect(alert.text()).toContain('تعذّر تحميل الخبرة المهنية')
    expect(alert.text()).not.toContain('Experience could not be loaded')
  })
})

describe('experience page — populated', () => {
  const role = (id: string) => ({
    id,
    role: `Role ${id}`,
    company: 'Acme',
    location: 'Remote',
    impact: '- Did the work',
    employmentType: 'FULL_TIME' as const,
    isCurrent: false,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: null,
    order: 0,
    technologies: [],
    availableLocales: ['en', 'ar']
  })

  it('renders the entries inside an ordered list, in the API order', async () => {
    const wrapper = await render({ locale: 'en', data: [role('a'), role('b')], error: null })

    expect(wrapper.find('ol').exists()).toBe(true)
    // Direct children only — impact bullets are nested `li` inside each entry.
    expect(wrapper.findAll('ol > li').map(li => li.find('h2').text())).toEqual(['Role a', 'Role b'])
  })

  it('enables technologies on this page — the home summary does not (FR-PUB-021 vs FR-PUB-013)', async () => {
    const withStack = { ...role('a'), technologies: [{ id: 't1', label: 'Nuxt.js' }, { id: 't2', label: 'Vue.js' }] }
    const wrapper = await render({ locale: 'en', data: [withStack], error: null })

    const chips = wrapper.findAll('ul[aria-labelledby] li').map(li => li.text())
    expect(chips).toEqual(['Nuxt.js', 'Vue.js'])
  })

  it('shows neither the empty nor the error copy when entries exist', async () => {
    const wrapper = await render({ locale: 'en', data: [role('a')], error: null })

    expect(wrapper.text()).not.toContain('No roles published yet')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
