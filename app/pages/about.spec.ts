// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import AboutPage from './about.vue'
import type { SiteSettings } from '~/types/models'

/**
 * Page-level coverage for the state × locale matrix.
 *
 * The scenario backend serves ONE settings variant per locale and `/settings/site` has no slug or
 * query it could key a scenario on, so the browser lane can only ever render the published page.
 * Every readiness refusal — portrait absent (the real API state today), localized alt absent, prose
 * absent — is proven here instead, in both locales.
 *
 * `t` resolves against the REAL locale files rather than echoing the key, so an assertion fails if
 * the Arabic copy is missing, empty, or accidentally English.
 */
const holder = vi.hoisted(() => ({
  i18n: null as unknown,
  asyncData: null as unknown,
  localePath: null as unknown
}))

mockNuxtImport('useI18n', () => () => holder.i18n)
mockNuxtImport('useAboutContent', () => async () => holder.asyncData)
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => holder.localePath)
// The page keys its Markdown cache on the ROUTE locale, not the UI locale, so the mock has to
// supply that separately — asserting the key would otherwise pass against the real i18n instance
// no matter which locale the test set.
mockNuxtImport('useRouteLocale', () => () => locale)
mockNuxtImport('useSchemaOrg', () => () => undefined)
mockNuxtImport('definePerson', () => (input: unknown) => input)
mockNuxtImport('defineWebPage', () => (input: unknown) => input)
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => input)
mockNuxtImport('useSeoMeta', () => () => undefined)

const localeFile = (code: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')) as Record<string, unknown>
const messages: Record<string, Record<string, unknown>> = { en: localeFile('en'), ar: localeFile('ar') }
const locale = ref<'en' | 'ar'>('en')

/** Namespaces this page owns; a miss inside one is a real defect and throws. */
const OWNED = ['about.', 'seo.about.', 'nav.', 'common.', 'brand.']

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

// The real post-D20-20 descriptor for the approved 1086×1448 portrait: the ladder stops at 640 for
// this source and a terminal rendition lands at 1086, in both public formats. Top-level
// url/width/height describe the widest public WebP (D10-14), not the private master.
const PORTRAIT = {
  id: '019f89b5-3050-7161-af37-0000000000f1',
  kind: 'IMAGE' as const,
  url: 'https://media.example.com/p/1086-webp.webp',
  width: 1086,
  height: 1448,
  blurhash: 'LA8:bcoL0LR+^NoL9uWC0zaz}@oL',
  alt: 'Eslam Muatamed against a plain wall',
  variants: [
    { format: 'AVIF' as const, width: 640, height: 853, url: 'https://media.example.com/p/640-avif.avif' },
    { format: 'WEBP' as const, width: 640, height: 853, url: 'https://media.example.com/p/640-webp.webp' },
    { format: 'AVIF' as const, width: 1086, height: 1448, url: 'https://media.example.com/p/1086-avif.avif' },
    { format: 'WEBP' as const, width: 1086, height: 1448, url: 'https://media.example.com/p/1086-webp.webp' }
  ]
}

function settings(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    siteName: 'Eslam Muatamed',
    tagline: 'Frontend Engineer',
    defaultMetaTitle: null,
    defaultMetaDescription: null,
    profileLinks: [],
    availabilityStatus: null,
    careerStartYear: 2023,
    careerStartMonth: 11,
    googleSiteVerification: null,
    bingSiteVerification: null,
    gtmContainerId: null,
    customMetas: [],
    resumeAsset: null,
    portraitAssetId: null,
    portrait: null,
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    aboutBio: 'First paragraph.\n\nSecond paragraph.',
    engineeringPhilosophy: 'I prefer maintainability over cleverness.',
    currentFocus: 'Building bilingual web products.',
    availableLocales: ['en', 'ar'],
    ...overrides
  } as SiteSettings
}

const state = {
  data: ref<SiteSettings | null>(null),
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
  UiRequestState: {
    template: `<div>
      <slot v-if="error" name="error" />
      <slot v-else />
    </div>`,
    props: ['pending', 'refreshing', 'error', 'empty', 'skeleton', 'count']
  },
  // Stands in for the Markdown pipeline: records what it was handed without rendering Markdown, so
  // these tests assert routing of content, not the renderer (which Prose.spec.ts owns).
  ContentProse: {
    template: '<div class="content-prose" :data-source="source" :data-cache-key="cacheKey" />',
    props: ['source', 'cacheKey']
  },
  AboutPortrait: {
    template: '<img :src="portrait.url" :alt="portrait.alt">',
    props: ['portrait', 'priority']
  }
}

async function render(options: {
  locale: 'en' | 'ar'
  data: SiteSettings | null
  error?: Error | null
}) {
  locale.value = options.locale
  state.data.value = options.data
  state.error.value = options.error ?? null
  state.status.value = options.error ? 'error' : 'success'
  return mountSuspended(AboutPage, { global: { stubs } })
}

describe('about page — published state', () => {
  it('renders every governed section in order, the portrait, and no Contact CTA', async () => {
    const wrapper = await render({
      locale: 'en',
      data: settings({ portraitAssetId: PORTRAIT.id, portrait: PORTRAIT })
    })
    const html = wrapper.html()

    // Section order is fixed by FR-PUB-020: bio, philosophy, current focus.
    const headings = wrapper.findAll('h2').map(h => h.text())
    expect(headings).toEqual(['Background', 'How I approach engineering', 'What I am working on now'])

    // Markdown fields go through the single renderer; currentFocus is plain text and must not.
    const prose = wrapper.findAll('.content-prose')
    expect(prose).toHaveLength(2)
    expect(prose[0]!.attributes('data-source')).toBe('First paragraph.\n\nSecond paragraph.')
    expect(prose[1]!.attributes('data-source')).toBe('I prefer maintainability over cleverness.')
    expect(wrapper.text()).toContain('Building bilingual web products.')

    expect(wrapper.find('img').attributes('alt')).toBe(PORTRAIT.alt)

    // Contact does not exist yet; linking to it would 404.
    expect(html).not.toContain('/contact')
    expect(html).not.toContain(t_readinessTitle('en'))
  })

  it('renders the Arabic published page with Arabic headings, never an English fallback', async () => {
    const wrapper = await render({
      locale: 'ar',
      data: settings({
        portraitAssetId: PORTRAIT.id,
        portrait: { ...PORTRAIT, alt: 'إسلام معتمد أمام جدار سادة' }
      })
    })
    const text = wrapper.text()

    expect(text).toContain('خلفيتي')
    expect(text).toContain('منهجي في الهندسة')
    expect(text).toContain('ما أعمل عليه الآن')
    expect(text).not.toContain('Background')
    expect(text).not.toContain('How I approach engineering')
    expect(wrapper.find('img').attributes('alt')).toBe('إسلام معتمد أمام جدار سادة')
  })

  it('keeps the heading order flat under the h1 — no skipped level', async () => {
    const wrapper = await render({
      locale: 'en',
      data: settings({ portraitAssetId: PORTRAIT.id, portrait: PORTRAIT })
    })

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('h3')).toHaveLength(0)
  })

  it('gives each Markdown block a locale-scoped cache key so locales cannot share rendered HTML', async () => {
    const wrapper = await render({
      locale: 'ar',
      data: settings({ portraitAssetId: PORTRAIT.id, portrait: { ...PORTRAIT, alt: 'بديل' } })
    })

    const keys = wrapper.findAll('.content-prose').map(node => node.attributes('data-cache-key'))
    expect(keys).toEqual(['about:bio:ar', 'about:philosophy:ar'])
  })
})

describe('about page — readiness states', () => {
  it('renders the readiness notice for the real portrait-null API state, not an error', async () => {
    const wrapper = await render({ locale: 'en', data: settings() })
    const text = wrapper.text()

    expect(text).toContain('This page is still being finished')
    // Not an error: no alert role, no retry affordance.
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(text).not.toContain('Try again')
    // The governed prose is NOT published behind a notice.
    expect(wrapper.findAll('.content-prose')).toHaveLength(0)
    expect(text).not.toContain('First paragraph.')
    // Navigation is preserved; Contact is not invented.
    expect(wrapper.html()).toContain('/experience')
    expect(wrapper.html()).toContain('/projects')
    expect(wrapper.html()).not.toContain('/contact')
  })

  it('never exposes a technical concept in the readiness copy', async () => {
    const wrapper = await render({ locale: 'en', data: settings() })
    const text = wrapper.text().toLowerCase()

    for (const term of ['portraitassetid', 'null', 'api', 'endpoint', 'media asset', 'seed']) {
      expect(text).not.toContain(term)
    }
  })

  it('renders the ARABIC readiness notice on the Arabic route', async () => {
    const wrapper = await render({ locale: 'ar', data: settings() })
    const text = wrapper.text()

    expect(text).toContain('هذه الصفحة قيد الإنجاز')
    expect(text).toContain('اطّلع على خبرتي')
    expect(text).not.toContain('This page is still being finished')
    expect(text).not.toContain('about.readiness.title')
  })

  it('refuses to publish when the localized alt is missing — and does not borrow the other locale', async () => {
    const wrapper = await render({
      locale: 'ar',
      // A portrait exists, but this locale's response carries no alt for it.
      data: settings({ portraitAssetId: PORTRAIT.id, portrait: { ...PORTRAIT, alt: null } })
    })
    const text = wrapper.text()

    expect(text).toContain('هذه الصفحة قيد الإنجاز')
    expect(wrapper.find('img').exists()).toBe(false)
    // The English alt travelled in on the fixture spread; it must not reach the DOM.
    expect(wrapper.html()).not.toContain(PORTRAIT.alt)
  })

  it.each([
    ['aboutBio', { aboutBio: null }],
    ['engineeringPhilosophy', { engineeringPhilosophy: null }],
    ['currentFocus', { currentFocus: null }]
  ])('renders the readiness state without inventing copy when %s is null', async (_label, override) => {
    const wrapper = await render({
      locale: 'en',
      data: settings({ portraitAssetId: PORTRAIT.id, portrait: PORTRAIT, ...override })
    })

    expect(wrapper.text()).toContain('This page is still being finished')
    expect(wrapper.findAll('.content-prose')).toHaveLength(0)
  })
})

describe('about page — error state', () => {
  it('renders localized error copy in an alert with retry, leaking no technical detail', async () => {
    const wrapper = await render({ locale: 'en', data: null, error: new Error('503 upstream') })
    const alert = wrapper.find('[role="alert"]')

    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('This page could not be loaded')
    expect(alert.text()).toContain('Try again')
    expect(wrapper.text()).not.toContain('503')
    expect(wrapper.text()).not.toContain('upstream')
  })

  it('renders the ARABIC error copy on the Arabic route', async () => {
    const wrapper = await render({ locale: 'ar', data: null, error: new Error('503 upstream') })
    const alert = wrapper.find('[role="alert"]')

    expect(alert.text()).toContain('تعذّر تحميل هذه الصفحة')
    expect(alert.text()).not.toContain('This page could not be loaded')
  })
})

/** Reads the readiness title straight from the locale file, so the assertion cannot drift from copy. */
function t_readinessTitle(code: 'en' | 'ar'): string {
  const about = messages[code]!.about as Record<string, Record<string, string>>
  return about.readiness!.title!
}
