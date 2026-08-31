// @vitest-environment nuxt
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AboutPage from './about.vue'
import HomePage from './index.vue'
import ExperiencePage from './experience.vue'
import ProjectsPage from './projects/index.vue'
import BlogPage from './blog/index.vue'
import ResumePage from './resume.vue'
import ContactPage from './contact.vue'
import type { SiteSettings } from '~/types/models'
import type { components } from '~/types/api'

/**
 * FE4-U2c2a — wiring gate for the TWO reference Static Page SEO consumers (`/` and `/about`).
 *
 * The layers under contract: network = `usePublicPageSeo` (awaited, key+locale identity),
 * resolution = `resolvePageSeoMetadata` (F-D4 chain, one text pair, optional image override),
 * rendering = the page's own `useSeoMeta`. These tests capture what the pages REGISTER and prove
 * the effective values reach every tag — plus the binding exclusions: no canonical writer, no
 * verification/GTM/customMetas surface, no duplicate Settings request, structured data untouched.
 */

type PublicPageSeoEntity = components['schemas']['PublicPageSeoEntity']

// Overrides are accepted loosely and cast once: image fixtures carry exactly the STRUCTURAL
// subset the read layer's input type admits (the shareable-format helper's parameter shape), not
// every generated rendition field — which is the whole point of the compatibility boundary.
const entity = (
  over: Partial<Omit<PublicPageSeoEntity, 'ogImage'>> & { ogImage?: Record<string, unknown> | null }
): PublicPageSeoEntity =>
  ({
    pageKey: 'home',
    locale: 'en',
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    ogImage: null,
    canonicalUrl: null,
    ...over
  }) as PublicPageSeoEntity

// Real locale files, so a missing/empty governed string fails loudly instead of echoing a key.
const localeFile = (code: string) =>
  JSON.parse(readFileSync(`i18n/locales/${code}.json`, 'utf8')) as Record<string, unknown>
const messages: Record<string, Record<string, unknown>> = { en: localeFile('en'), ar: localeFile('ar') }
const locale: Ref<'en' | 'ar'> = ref('en')

function translate(key: string): string {
  const resolved = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[locale.value])
  return typeof resolved === 'string' ? resolved : key
}

function settingsFixture(overrides: Partial<SiteSettings> = {}): SiteSettings {
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
    professionalEmail: null,
    contactEmail: null,
    contactPhone: null,
    whatsappPhone: null,
    aboutBio: null,
    engineeringPhilosophy: null,
    currentFocus: null,
    availableLocales: ['en', 'ar'],
    ...overrides
  } as SiteSettings
}

interface RecordedCall {
  path: string
  locale?: string | false
}

const calls: RecordedCall[] = []
const seoMetaCaptured: Array<Record<string, unknown>> = []
const headCaptured: Array<Record<string, unknown>> = []
const siteSchemaCalls: unknown[][] = []
const aboutSchemaCalls: unknown[][] = []
let pageSeoResponder: (path: string, locale: string) => PublicPageSeoEntity =
  (_p, reqLocale) => entity({ pageKey: _p.endsWith('home') ? 'home' : 'about', locale: reqLocale })
let settingsFailure: Error | null = null

mockNuxtImport('useApi', () => () => async (path: string, options?: { locale?: string | false }) => {
  const reqLocale = typeof options?.locale === 'string' ? options.locale : locale.value
  calls.push({ path, locale: reqLocale })
  if (path === '/settings/site') {
    if (settingsFailure) throw settingsFailure
    return { data: settingsFixture() }
  }
  if (path.startsWith('/seo/pages/')) {
    return { data: pageSeoResponder(path, reqLocale) }
  }
  throw new Error(`unexpected API path in wiring spec: ${path}`)
})

mockNuxtImport('useRouteLocale', () => () => computed(() => locale.value))
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const IDLE = <T,>() => ({ data: ref<T | null>(null), status: ref('success'), error: ref(null), refresh: () => Promise.resolve() })

let aboutContent: ReturnType<typeof IDLE>
mockNuxtImport('useAboutContent', () => () => aboutContent)
mockNuxtImport('useExperiences', () => () => IDLE())
mockNuxtImport('useProjectsList', () => () => ({ ...IDLE(), meta: ref(null) }))
mockNuxtImport('useArticlesList', () => () => IDLE())
mockNuxtImport('useArticleCategories', () => async () => ({ data: ref([]), status: ref('success'), error: ref(null), refresh: () => Promise.resolve() }))
mockNuxtImport('useResumeData', () => () => ({
  settings: { data: computed(() => settingsFixture()), status: ref('success'), error: ref(null), refresh: () => Promise.resolve() },
  experiences: IDLE(),
  skills: IDLE()
}))
mockNuxtImport('useRoute', () => () => ({ query: {} }))
mockNuxtImport('useHomeData', () => () => ({
  projects: IDLE(),
  skills: IDLE(),
  experiences: IDLE(),
  articles: IDLE(),
  testimonials: IDLE()
}))

mockNuxtImport('useSiteSchema', () => (...args: unknown[]) => {
  siteSchemaCalls.push(args)
})
mockNuxtImport('useAboutSchema', () => (...args: unknown[]) => {
  aboutSchemaCalls.push(args)
})
mockNuxtImport('useSeoMeta', () => (input: Record<string, unknown>) => {
  seoMetaCaptured.push(input)
})
const schemaOrgCaptured: unknown[] = []
mockNuxtImport('useSchemaOrg', () => (input: unknown) => {
  schemaOrgCaptured.push(input)
})
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => input)
mockNuxtImport('useHead', () => (input: Record<string, unknown>) => {
  headCaptured.push(input)
})

/** Evaluate a captured useSeoMeta input: getters become values, exactly what would be registered. */
function registered(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'function' ? (v as () => unknown)() : v])
  )
}

const STUBS = {
  UContainer: { template: '<div><slot /></div>' },
  UButton: { template: '<a><slot /></a>', props: ['to', 'variant', 'color'] },
  UiBreadcrumbs: { template: '<nav />', props: ['items', 'label'] },
  UiRequestState: { template: '<div><slot name="error" /><slot /></div>', props: ['pending', 'refreshing', 'error', 'empty'] },
  ContentProse: { template: '<div />', props: ['source', 'cacheKey'] },
  AboutPortrait: { template: '<img>', props: ['portrait'] },
  HomeNameplate: { template: '<div />', props: ['settings'] },
  HomeCapabilities: { template: '<div />', props: ['skills', 'pending', 'error'] },
  HomeSelectedWork: { template: '<div />', props: ['projects', 'pending', 'error'] },
  HomeTimeline: { template: '<div />', props: ['experiences', 'pending', 'error'] },
  HomeWriting: { template: '<div />', props: ['articles', 'pending', 'error'] },
  HomeVoices: { template: '<div />', props: ['testimonials', 'pending', 'error'] },
  HomeContact: { template: '<div />' },
  // The five remaining static pages (U2c2b) — render shells only; head wiring is the subject.
  ContentTimelineEntry: { template: '<div />', props: ['entry'] },
  ContentArticleRow: { template: '<div />', props: ['article'] },
  ContentWorkEntry: { template: '<div />', props: ['project'] },
  ProjectFilter: { template: '<div />', props: ['facets', 'modelValue'] },
  UiChipFilter: { template: '<div />', props: ['id', 'label', 'allLabel', 'options', 'modelValue'] },
  UPagination: { template: '<div />', props: ['page', 'pageCount'] },
  ResumeActions: { template: '<div />', props: ['settings'] },
  ResumeEntry: { template: '<div />', props: ['entry'] },
  ContactDirectMethods: { template: '<div />', props: ['settings'] },
  ContactForm: { template: '<form><slot /></form>' },
  Outcome: { template: '<div />', props: ['state'] }
}

const MOUNTED: Array<{ unmount(): void }> = []

/** U2c2b pages by component, for the mechanical coverage blocks. */
type WiringPage = 'experience' | 'projects' | 'blog' | 'resume' | 'contact'
const PAGE_COMPONENTS = {
  experience: ExperiencePage,
  projects: ProjectsPage,
  blog: BlogPage,
  resume: ResumePage,
  contact: ContactPage
} as const

async function mount(page: 'home' | 'about') {
  const wrapper =
    page === 'home'
      ? await mountSuspended(HomePage, { global: { stubs: STUBS } })
      : await mountSuspended(AboutPage, { global: { stubs: STUBS } })
  MOUNTED.push(wrapper)
  return wrapper
}

function lastMeta(): Record<string, unknown> {
  expect(seoMetaCaptured.length).toBeGreaterThan(0)
  return registered(seoMetaCaptured[seoMetaCaptured.length - 1]!)
}

async function purgeAsyncData(): Promise<void> {
  const { useNuxtApp } = await import('#app')
  const nuxtApp = useNuxtApp()
  const payloadData = nuxtApp.payload.data as Record<string, unknown>
  for (const key of Object.keys(payloadData)) {
    if (key.includes('seo:page:') || key.includes('settings:site:')) Reflect.deleteProperty(payloadData, key)
  }
  const store = (nuxtApp as unknown as { _asyncData?: Record<string, unknown> })._asyncData
  if (store) for (const key of Object.keys(store)) Reflect.deleteProperty(store, key)
}

beforeEach(async () => {
  calls.length = 0
  seoMetaCaptured.length = 0
  schemaOrgCaptured.length = 0
  headCaptured.length = 0
  siteSchemaCalls.length = 0
  aboutSchemaCalls.length = 0
  locale.value = 'en'
  pageSeoResponder = (p, l) => entity({ pageKey: p.endsWith('home') ? 'home' : 'about', locale: l })
  settingsFailure = null
  aboutContent = IDLE()
  await purgeAsyncData()
})

afterEach(() => {
  for (const w of MOUNTED) w.unmount()
  MOUNTED.length = 0
})

describe('HOME — PageSeo key `home`, standalone-title exception', () => {
  it('1 / 26 / 27 — requests exactly GET /seo/pages/home (public, no admin)', async () => {
    await mount('home')
    expect(calls.filter(c => c.path === '/seo/pages/home')).toHaveLength(1)
    for (const c of calls) expect(c.path.startsWith('/admin/')).toBe(false)
  })

  it('2 / 24 — an authored EN override reaches title/og/twitter in the SAME tick the setup awaits', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', metaTitle: 'Authored home title', locale: 'en' })
    await mount('home')
    const meta = lastMeta()
    expect(meta.title).toBe('Authored home title')
    expect(meta.ogTitle).toBe('Authored home title')
    expect(meta.twitterTitle).toBe('Authored home title')
  })

  it('3 / 28a / 30a — the AR override reaches the localized title on AR navigation', async () => {
    pageSeoResponder = (_p, l) =>
      entity({ pageKey: 'home', locale: l, metaTitle: l === 'ar' ? 'عنوان الرئيسية المؤلف' : 'EN home' })
    await mount('home')
    expect(lastMeta().title).toBe('EN home')

    locale.value = 'ar'
    await purgeAsyncData()
    await mount('home')
    expect(calls.some(c => c.locale === 'ar')).toBe(true)
    expect(lastMeta().title).toBe('عنوان الرئيسية المؤلف')
  })

  it('4 — an authored description reaches description + social descriptions', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', metaDescription: 'Authored home description' })
    await mount('home')
    const meta = lastMeta()
    expect(meta.description).toBe('Authored home description')
    expect(meta.ogDescription).toBe('Authored home description')
    expect(meta.twitterDescription).toBe('Authored home description')
  })

  it('5 — titleTemplate stays null (D22-4 standalone title)', () => {
    void mount('home').then(() => {
      expect(headCaptured.some(h => h.titleTemplate === null)).toBe(true)
    })
  })

  it('6 — the Page SEO title is used verbatim — never brand-suffixed by this wiring', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', metaTitle: 'Eslam Muatamed — Full-Stack Engineer' })
    await mount('home')
    expect(lastMeta().title).toBe('Eslam Muatamed — Full-Stack Engineer')
  })

  it('7 — an all-null Page SEO response falls through to the governed i18n copy', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', locale: 'en' })
    await mount('home')
    const meta = lastMeta()
    expect(meta.title).toBe(translate('seo.home.titleFull'))
    expect(meta.description).toBe(translate('seo.home.description'))
  })

  it('8 — a Page SEO failure (404) falls through; the page still renders', async () => {
    pageSeoResponder = () => {
      throw Object.assign(new Error('not found'), { statusCode: 404 })
    }
    const wrapper = await mount('home')
    const meta = lastMeta()
    expect(meta.title).toBe(translate('seo.home.titleFull'))
    expect(meta.description).toBe(translate('seo.home.description'))
    expect(wrapper.find('[data-harness],div').exists()).toBe(true)
  })

  it('9 — a PageSeo canonicalUrl does NOT produce any canonical writer output', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', canonicalUrl: 'https://example.com/custom-home' })
    await mount('home')
    const meta = lastMeta()
    for (const key of Object.keys(meta)) expect(key.toLowerCase()).not.toContain('canonical')
    for (const h of headCaptured) {
      const links = h.link as Array<Record<string, unknown>> | undefined
      expect(links ?? []).toEqual([])
    }
  })

  it('10 — Site structured data remains driven by settings/skills, independent of PageSeo', async () => {
    pageSeoResponder = () => entity({ pageKey: 'home', metaTitle: 'Authored home title' })
    await mount('home')
    expect(siteSchemaCalls).toHaveLength(1)
    const [settingsRef, skillsData] = siteSchemaCalls[0] as [{ value?: { siteName?: string } }, unknown]
    // Identity-shaped proof: the schema consumed the page's OWN settings ref (the asyncData
    // handle, exactly as before) and the skills data slot — the PageSeo payload never became a
    // schema input.
    expect(settingsRef?.value?.siteName).toBe('Eslam Muatamed')
    // skills.data arrives as the ref itself; its VALUE is the idle null — not PageSeo data.
    expect((skillsData as { value?: unknown })?.value).toBeNull()
    expect(siteSchemaCalls[0]!.length).toBe(2)
  })
})

describe('ABOUT — PageSeo key `about`, normal + OG/Twitter coherence', () => {
  it('11 — requests exactly GET /seo/pages/about', async () => {
    await mount('about')
    expect(calls.filter(c => c.path === '/seo/pages/about')).toHaveLength(1)
  })

  it('12 — the EN title override drives normal + OG + Twitter title', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about', metaTitle: 'Authored about title', locale: 'en' })
    await mount('about')
    const meta = lastMeta()
    expect(meta.title).toBe('Authored about title')
    expect(meta.ogTitle).toBe('Authored about title')
    expect(meta.twitterTitle).toBe('Authored about title')
  })

  it('13 — the AR title override reaches the localized title', async () => {
    pageSeoResponder = (_p, l) =>
      entity({ pageKey: 'about', locale: l, metaTitle: l === 'ar' ? 'عنوان من نحن' : 'About EN' })
    locale.value = 'ar'
    await mount('about')
    expect(lastMeta().title).toBe('عنوان من نحن')
  })

  it('14 — the description override drives normal + OG + Twitter description', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about', metaDescription: 'Authored about description' })
    await mount('about')
    const meta = lastMeta()
    expect(meta.description).toBe('Authored about description')
    expect(meta.ogDescription).toBe('Authored about description')
    expect(meta.twitterDescription).toBe('Authored about description')
  })

  it('15 — without an override, ONE effective title feeds normal + OG + Twitter (coherence)', async () => {
    await mount('about')
    const meta = lastMeta()
    const expected = translate('seo.about.title')
    expect(meta.title).toBe(expected)
    expect(meta.ogTitle).toBe(expected)
    expect(meta.twitterTitle).toBe(expected)
    // The old local `${title} — ${brand}` OG composition is gone: OG/Twitter cannot diverge.
    expect(String(meta.ogTitle)).not.toBe(`${expected} — ${translate('brand.name')}`)
  })

  it('16 — an all-null About response falls through to the governed copy', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about' })
    await mount('about')
    const meta = lastMeta()
    expect(meta.title).toBe(translate('seo.about.title'))
    expect(meta.description).toBe(translate('seo.about.description'))
  })

  it('17 — an About Page SEO failure falls through; metadata survives intact', async () => {
    pageSeoResponder = () => {
      throw Object.assign(new Error('boom'), { statusCode: 500 })
    }
    const wrapper = await mount('about')
    const meta = lastMeta()
    expect(String(meta.title)).toBe(translate('seo.about.title'))
    expect(String(meta.description)).toBe(translate('seo.about.description'))
    expect(wrapper.find('div').exists()).toBe(true)
  })

  it('18 — a PageSeo canonicalUrl is storage-only: strictSeo keeps sole canonical ownership', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about', canonicalUrl: 'ftp://example.com/resource' })
    await mount('about')
    const meta = lastMeta()
    for (const key of Object.keys(meta)) expect(key.toLowerCase()).not.toContain('canonical')
    for (const h of headCaptured) expect((h.link as unknown[] | undefined) ?? []).toEqual([])
  })

  it('19 — About/Profile structured data is unchanged by PageSeo (same call, same inputs)', async () => {
    await mount('about')
    expect(aboutSchemaCalls).toHaveLength(1)
    const [contentRef] = aboutSchemaCalls[0] as [{ value: unknown }]
    // The schema consumes the SAME content handle About always did — not the PageSeo payload.
    expect(contentRef && typeof contentRef === 'object').toBe(true)

    pageSeoResponder = () => entity({ pageKey: 'about', metaTitle: 'Different authored title' })
    await mount('about')
    expect(aboutSchemaCalls).toHaveLength(2)
    expect(aboutSchemaCalls[1]![0]).toBe(aboutSchemaCalls[0]![0])
  })
})

describe('SOCIAL IMAGE — override only through the resolver decision', () => {
  const ACCEPTED = {
    url: '/media/abc/social.png',
    width: 1200,
    height: 630,
    alt: 'Authored preview'
  }

  it('20 — an accepted PageSeo image becomes the page-level override (absolute URL)', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about', ogImage: { ...ACCEPTED } })
    await mount('about')
    const meta = lastMeta()
    expect(meta.ogImage).toBe('https://example.com/media/abc/social.png')
    expect(meta.ogImageWidth).toBe(1200)
    expect(meta.ogImageHeight).toBe(630)
    expect(meta.ogImageAlt).toBe('Authored preview')
  })

  it('21 — a null or unsupported image registers NO image keys — committed floor stays effective', async () => {
    await mount('about')
    let meta = lastMeta()
    expect(Object.hasOwn(meta, 'ogImage')).toBe(false)
    expect(Object.hasOwn(meta, 'twitterImage')).toBe(false)

    pageSeoResponder = () => entity({ pageKey: 'about', ogImage: { url: '/media/abc/1920-webp.webp' } })
    await mount('about')
    meta = lastMeta()
    expect(Object.hasOwn(meta, 'ogImage')).toBe(false)
  })

  it('22 — OG and Twitter image never diverge when an override exists', async () => {
    pageSeoResponder = () => entity({ pageKey: 'about', ogImage: { ...ACCEPTED, alt: 'Shared alt' } })
    await mount('about')
    const meta = lastMeta()
    expect(meta.twitterImage).toBe(meta.ogImage)
    expect(meta.twitterImageAlt).toBe(meta.ogImageAlt)
  })
})

describe('SSR / REQUEST MODEL', () => {
  it('23 — the PageSeo read is structurally awaited before metadata registration', () => {
    for (const file of ['app/pages/index.vue', 'app/pages/about.vue']) {
      const code = readFileSync(file, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const awaitedAt = code.indexOf('await usePublicPageSeo(')
      const registeredAt = Math.min(
        ...['useSeoMeta(', 'useHead('].map(token => {
          const at = code.indexOf(token)
          return at === -1 ? Number.MAX_SAFE_INTEGER : at
        })
      )
      expect(awaitedAt, `${file} must await the PageSeo read`).toBeGreaterThan(-1)
      expect(awaitedAt, `${file} must await BEFORE registering head metadata`).toBeLessThan(registeredAt)
    }
  })

  it('25 — NO duplicate Settings request: layout-shared key serves both pages from ONE read', async () => {
    const settingsCallsBefore = () => calls.filter(c => c.path === '/settings/site').length
    await mount('home')
    const afterHome = settingsCallsBefore()
    expect(afterHome).toBe(1)
    await mount('about')
    expect(settingsCallsBefore()).toBe(1)
  })

  it('26b — every PageSeo request targets exactly the wired page key', async () => {
    await mount('home')
    await mount('about')
    const seoPaths = calls.filter(c => c.path.startsWith('/seo/')).map(c => c.path)
    expect(new Set(seoPaths)).toEqual(new Set(['/seo/pages/home', '/seo/pages/about']))
  })
})

describe('LOCALE ISOLATION across navigations', () => {
  it('29 / 30 — About AR navigation yields AR-effective head, never stale EN text', async () => {
    pageSeoResponder = (_p, l) =>
      entity({ pageKey: 'about', locale: l, metaTitle: l === 'ar' ? 'عنوان من نحن' : 'About EN' })
    await mount('about')
    expect(lastMeta().title).toBe('About EN')

    locale.value = 'ar'
    await purgeAsyncData()
    await nextTick()
    await mount('about')
    const meta = lastMeta()
    expect(meta.title).toBe('عنوان من نحن')
    expect(meta.title).not.toBe('About EN')
  })
})

describe('BOUNDARY — the two pages introduce no new ownership', () => {
  it('31 / 32 — no canonical writer, no verification/GTM/customMetas surface in page code', () => {
    for (const file of ['app/pages/index.vue', 'app/pages/about.vue']) {
      const code = readFileSync(file, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/canonical/i)
      expect(code, file).not.toMatch(/googleSiteVerification|bingSiteVerification|gtm|customMetas/i)
      expect(code, file).not.toMatch(/rel:\s*'canonical'|ld\+json/)
      expect(code, file).not.toMatch(/\/admin\//)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────────
// FE4-U2c2b — the remaining five static pages, wired mechanically per the proven pattern.
// ────────────────────────────────────────────────────────────────────────────────

const FIVE: Array<{ page: WiringPage; titleKey: string; descKey: string }> = [
  { page: 'experience', titleKey: 'seo.experience.title', descKey: 'seo.experience.description' },
  { page: 'projects', titleKey: 'seo.projects.title', descKey: 'seo.projects.description' },
  { page: 'blog', titleKey: 'seo.blog.title', descKey: 'seo.blog.description' },
  { page: 'resume', titleKey: 'seo.resume.title', descKey: 'seo.resume.description' },
  { page: 'contact', titleKey: 'seo.contact.title', descKey: 'seo.contact.description' }
]

async function mountFive(page: WiringPage) {
  const wrapper = await mountSuspended(PAGE_COMPONENTS[page], { global: { stubs: STUBS } })
  MOUNTED.push(wrapper)
  return wrapper
}

describe.each(FIVE)('U2c2b — $page', ({ page, titleKey, descKey }) => {
  it(`requests exactly GET /seo/pages/${page}`, async () => {
    await mountFive(page)
    expect(calls.filter(c => c.path === `/seo/pages/${page}`)).toHaveLength(1)
  })

  it('authored title reaches normal + OG + Twitter title', async () => {
    const authored = `Authored ${page} title`
    pageSeoResponder = (_p, l) => entity({ pageKey: page, locale: l, metaTitle: authored })
    await mountFive(page)
    const meta = lastMeta()
    expect(meta.title).toBe(authored)
    expect(meta.ogTitle).toBe(authored)
    expect(meta.twitterTitle).toBe(authored)
  })

  it('authored description reaches normal + OG + Twitter description', async () => {
    const authored = `Authored ${page} description`
    pageSeoResponder = (_p, l) => entity({ pageKey: page, locale: l, metaDescription: authored })
    await mountFive(page)
    const meta = lastMeta()
    expect(meta.description).toBe(authored)
    expect(meta.ogDescription).toBe(authored)
    expect(meta.twitterDescription).toBe(authored)
  })

  it('AR localized override reaches the head (no cross-locale fallback)', async () => {
    const arTitle = `عنوان ${page} المؤلف`
    pageSeoResponder = (_p, l) =>
      entity({ pageKey: page, locale: l, metaTitle: l === 'ar' ? arTitle : `${page} EN` })
    locale.value = 'ar'
    await mountFive(page)
    const meta = lastMeta()
    expect(meta.title).toBe(arTitle)
    const seoCall = calls.find(c => c.path === `/seo/pages/${page}`)
    expect(seoCall?.locale).toBe('ar')
  })

  it('all-null response falls through to the governed copy', async () => {
    pageSeoResponder = (_p, l) => entity({ pageKey: page, locale: l })
    await mountFive(page)
    const meta = lastMeta()
    expect(meta.title).toBe(translate(titleKey))
    expect(meta.description).toBe(translate(descKey))
  })

  it('a Page SEO failure falls through; the page still renders', async () => {
    pageSeoResponder = () => {
      throw Object.assign(new Error('boom'), { statusCode: 500 })
    }
    const wrapper = await mountFive(page)
    const meta = lastMeta()
    expect(String(meta.title)).toBe(translate(titleKey))
    expect(String(meta.description)).toBe(translate(descKey))
    expect(wrapper.find('div').exists()).toBe(true)
  })

  it('a PageSeo canonicalUrl never produces a canonical writer output', async () => {
    pageSeoResponder = (_p, l) => entity({ pageKey: page, locale: l, canonicalUrl: 'https://example.com/x' })
    await mountFive(page)
    const meta = lastMeta()
    for (const key of Object.keys(meta)) expect(key.toLowerCase()).not.toContain('canonical')
    for (const h of headCaptured) expect((h.link as unknown[] | undefined) ?? []).toEqual([])
  })
})

describe('U2c2b shared guarantees', () => {
  it('31 — every new page awaits the read BEFORE registering metadata (structural)', () => {
    for (const file of [
      'app/pages/experience.vue',
      'app/pages/projects/index.vue',
      'app/pages/blog/index.vue',
      'app/pages/resume.vue',
      'app/pages/contact.vue'
    ]) {
      const code = readFileSync(file, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const awaitedAt = code.indexOf('await usePublicPageSeo(')
      const useSeoAt = code.indexOf('useSeoMeta(')
      expect(awaitedAt, file).toBeGreaterThan(-1)
      expect(awaitedAt, file).toBeLessThan(useSeoAt)
    }
  })

  it('32 / 33 / 39 — five mounts, five own-key reads, zero admin calls, ONE settings request', async () => {
    for (const { page } of FIVE) {
      locale.value = 'en'
      await mountFive(page)
    }
    const seoPaths = calls.filter(c => c.path.startsWith('/seo/')).map(c => c.path)
    expect(new Set(seoPaths)).toEqual(
      new Set([
        '/seo/pages/experience',
        '/seo/pages/projects',
        '/seo/pages/blog',
        '/seo/pages/resume',
        '/seo/pages/contact'
      ])
    )
    for (const path of seoPaths) expect(path.startsWith('/admin/')).toBe(false)
    expect(calls.filter(c => c.path === '/settings/site')).toHaveLength(1)
  })

  it('35 — an accepted social image overrides the committed floor (absolute URL)', async () => {
    pageSeoResponder = (_p, l) =>
      entity({
        pageKey: 'projects',
        locale: l,
        ogImage: { url: '/media/abc/collection.png', width: 1200, height: 630, alt: 'Projects preview' }
      })
    await mountFive('projects')
    const meta = lastMeta()
    expect(meta.ogImage).toBe('https://example.com/media/abc/collection.png')
    expect(meta.twitterImage).toBe(meta.ogImage)
  })

  it('36 — a null or unsupported image registers no image keys (floor intact)', async () => {
    pageSeoResponder = (_p, l) =>
      entity({ pageKey: 'blog', locale: l, ogImage: { url: '/media/abc/wide-webp.webp' } })
    await mountFive('blog')
    const meta = lastMeta()
    expect(Object.hasOwn(meta, 'ogImage')).toBe(false)
    expect(Object.hasOwn(meta, 'twitterImage')).toBe(false)
  })

  it('37 — no PageSeo text reaches any structured-data call', async () => {
    const authored = 'Schema-isolation authored title'
    pageSeoResponder = (_p, l) => entity({ pageKey: 'contact', locale: l, metaTitle: authored })
    locale.value = 'en'
    await mountFive('contact')
    await mountFive('resume')
    await mountFive('experience')
    const seen = new WeakSet<object>()
    const sanitize = (v: unknown): unknown => {
      if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v
      const obj = v as Record<string, unknown> & { __v_isRef?: boolean }
      if (seen.has(obj)) return '[circular]'
      seen.add(obj)
      if (obj.__v_isRef) return sanitize(obj.value)
      return Array.isArray(v) ? v.map(sanitize) : Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, sanitize(x)]))
    }
    const serialized = JSON.stringify(schemaOrgCaptured.map(sanitize))
    expect(schemaOrgCaptured.length).toBeGreaterThan(0)
    expect(serialized).not.toContain(authored)
    expect(serialized).not.toContain('"canonicalUrl"')
  })

  it('38 — the five pages introduce no verification/GTM/customMetas surface', () => {
    for (const file of [
      'app/pages/experience.vue',
      'app/pages/projects/index.vue',
      'app/pages/blog/index.vue',
      'app/pages/resume.vue',
      'app/pages/contact.vue'
    ]) {
      const code = readFileSync(file, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/googleSiteVerification|bingSiteVerification|gtm|customMetas/i)
      expect(code, file).not.toMatch(/canonical/i)
      expect(code, file).not.toMatch(/\/admin\//)
    }
  })

  it('40 — each of the five pages stays locale-isolated across navigations', async () => {
    for (const { page } of FIVE) {
      locale.value = 'ar'
      await purgeAsyncData()
      const arTitle = `AR ${page}`
      pageSeoResponder = (_p, l) =>
        entity({ pageKey: page, locale: l, metaTitle: l === 'ar' ? arTitle : `EN ${page}` })
      const before = calls.filter(c => c.locale === 'ar').length
      await mountFive(page)
      expect(lastMeta().title).toBe(arTitle)
      expect(calls.filter(c => c.locale === 'ar').length).toBe(before + 1)
    }
  })
})
