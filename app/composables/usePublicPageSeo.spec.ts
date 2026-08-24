// @vitest-environment nuxt
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { components } from '~/types/api'
import { usePublicPageSeo, type PublicPageSeoKey } from './usePublicPageSeo'

/**
 * Trust gate for the FE4-U2c1 public Page SEO read layer.
 *
 * The load-bearing properties: public endpoint ONLY, closed seven-key vocabulary, awaited SSR,
 * identity = page key + route locale (reactive), locale switches refetch, all-null is success,
 * failures fall through silently with zero retries, and NO ownership of head/canonical/structured
 * data/Settings. Negative controls A–F were cut against this suite.
 */

type PublicPageSeoEntity = components['schemas']['PublicPageSeoEntity']

const entity = (over: Partial<PublicPageSeoEntity> = {}): PublicPageSeoEntity => ({
  pageKey: 'about',
  locale: 'en',
  metaTitle: null,
  metaDescription: null,
  ogImageId: null,
  ogImage: null,
  canonicalUrl: null,
  ...over
})

const PAGE_EN = entity({ metaTitle: 'About from EN', locale: 'en' })
const PAGE_AR = entity({ metaTitle: 'عنوان من AR', locale: 'ar' })
const HOME_EN = entity({ pageKey: 'home', metaTitle: 'Home from EN', locale: 'en' })

interface RecordedCall {
  path: string
  locale?: string | false
  retry?: number
}

const calls: RecordedCall[] = []
let responder: (path: string, locale?: string) => PublicPageSeoEntity = (_path, _locale) => PAGE_EN

mockNuxtImport('useApi', () => () => async (path: string, options?: { locale?: string | false; retry?: number }) => {
  calls.push({ path, locale: options?.locale, retry: options?.retry })
  return { data: responder(path, typeof options?.locale === 'string' ? options.locale : 'en') }
})

const routeLocale: Ref<'en' | 'ar'> = ref('en')
mockNuxtImport('useRouteLocale', () => () => computed(() => routeLocale.value))

const MOUNTED_WRAPPERS: Array<{ unmount(): void }> = []

async function mountPage(pageKey: PublicPageSeoKey) {
  const captured: { data: PublicPageSeoEntity | null | undefined; error: unknown; pending: boolean } = {
    data: null,
    error: null,
    pending: true
  }
  const Harness = defineComponent({
    async setup() {
      const seo = await usePublicPageSeo(pageKey)
      captured.data = seo.data.value
      captured.error = seo.error.value ? (seo.error.value as unknown) : null
      captured.pending = seo.status.value === 'pending'
      return () => h('div', { 'data-harness': pageKey })
    }
  })
  const wrapper = await mountSuspended(Harness)
  // Every live instance's reactive key re-fires on a locale flip, so an unmounted-in-spirit-but-
  // still-mounted harness from a previous test would pollute later call counts. Track and unmount.
  MOUNTED_WRAPPERS.push(wrapper)
  return { ...captured, wrapper }
}

beforeEach(async () => {
  calls.length = 0
  routeLocale.value = 'en'
  responder = (_path, _locale) => PAGE_EN
  // The nuxt runtime environment shares ONE app/payload across every test in this file. Without
  // this purge, a settled `seo:page:*` entry from an earlier test is served by getCachedData and
  // later assertions measure the PREVIOUS test's fetch behaviour.
  const { useNuxtApp } = await import('#app')
  const nuxtApp = useNuxtApp()
  const payloadData = nuxtApp.payload.data as Record<string, unknown>
  for (const key of Object.keys(payloadData)) {
    if (key.includes('seo:page:') || key.includes('settings:site:')) Reflect.deleteProperty(payloadData, key)
  }
  const asyncDataStore = (nuxtApp as unknown as { _asyncData?: Record<string, unknown> })._asyncData
  if (asyncDataStore) {
    for (const key of Object.keys(asyncDataStore)) Reflect.deleteProperty(asyncDataStore, key)
  }
})

afterEach(() => {
  for (const wrapper of MOUNTED_WRAPPERS) wrapper.unmount()
  MOUNTED_WRAPPERS.length = 0
})

describe('endpoint — public read of the closed vocabulary only', () => {
  it('1 — home reads GET /seo/pages/home', async () => {
    responder = () => HOME_EN
    await mountPage('home')
    expect(calls[0]?.path).toBe('/seo/pages/home')
  })

  it('2 — about reads GET /seo/pages/about', async () => {
    await mountPage('about')
    expect(calls[0]?.path).toBe('/seo/pages/about')
  })

  it('3 — an arbitrary unsupported key cannot be used through the typed public interface', () => {
    // Compile-time proof: vue-tsc must reject anything outside the generated union. The directive
    // is two-sided — if the union ever widens to accept arbitrary strings, typecheck FAILS here.
    const bogus = 'articles'
    function typeGuard(): void {
      // @ts-expect-error — only the seven known static page keys are admissible
      usePublicPageSeo(bogus)
    }
    expect(typeGuard).toBeTypeOf('function')
  })

  it('4 / 26 / 4b — admin SEO surfaces are never touched', async () => {
    for (const key of ['about', 'home'] as const) {
      routeLocale.value = 'en'
      await mountPage(key)
    }
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.path.startsWith('/admin/')).toBe(false)
      expect(call.path).not.toBe('/admin/seo/pages')
      expect(call.path).not.toMatch(/^\/admin\/seo\/pages\//)
    }
    for (const call of calls) expect(call.path).toMatch(/^\/seo\/pages\//)
  })
})

describe('locale — explicit route-resolved locale, no fallback', () => {
  it('5 — EN request resolves EN PageSeo and sends ?locale=en exactly once', async () => {
    await mountPage('about')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.locale).toBe('en')
  })

  it('6 — AR request resolves AR PageSeo', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    routeLocale.value = 'ar'
    const page = await mountPage('about')
    expect(calls[0]?.locale).toBe('ar')
    expect(page.data?.metaTitle).toBe('عنوان من AR')
  })

  it('7 — no cross-locale fallback: the requested locale response is authoritative even when the other locale has content', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    const enPage = await mountPage('about')
    expect(enPage.data?.metaTitle).toBe('About from EN')

    calls.length = 0
    routeLocale.value = 'ar'
    const arPage = await mountPage('about')
    expect(arPage.data?.metaTitle).toBe('عنوان من AR')
    expect(calls[0]?.locale).toBe('ar')
  })
})

describe('async-data identity — page key AND route locale', () => {
  it('8 / 9 — the cache identity contains BOTH the page key and the locale', async () => {
    const { useNuxtApp } = await import('#app')
    const payloadData = useNuxtApp().payload.data as Record<string, unknown>
    await mountPage('about')
    const keys = Object.keys(payloadData)
    expect(keys.some(k => k.includes('seo:page:') && k.includes('about') && k.includes(':en'))).toBe(true)
  })

  it('10 — Home EN and About EN resolve under DIFFERENT identities and never share payloads', async () => {
    responder = (path) => (path === '/seo/pages/home' ? HOME_EN : PAGE_EN)
    const about = await mountPage('about')
    const home = await mountPage('home')
    expect(about.data?.pageKey).toBe('about')
    expect(home.data?.pageKey).toBe('home')
    expect(home.data?.metaTitle).toBe('Home from EN')
    expect(home.data?.metaTitle).not.toBe(about.data?.metaTitle)
  })

  it('11 — About EN and About AR resolve under DIFFERENT identities (key moves, no merge)', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    await mountPage('about')
    routeLocale.value = 'ar'
    await flushLocaleSwitch()

    const { useNuxtApp } = await import('#app')
    const keys = Object.keys(useNuxtApp().payload.data as Record<string, unknown>).filter(k =>
      k.includes('seo:page:')
    )
    // The identity now answering for `about` is the AR one…
    expect(keys.some(k => k === 'seo:page:about:ar')).toBe(true)
    // …the EN identity no longer claims it (Nuxt renames the entry on reactive-key change)…
    expect(keys).not.toContain('seo:page:about:en')
    // …and no OTHER page's identity was created by this switch.
    expect(keys.filter(k => k.includes('home'))).toEqual([])
    const stored = await payloadFor('seo:page:about:ar')
    expect(stored?.locale).toBe('ar')
  })
})

describe('SSR flow — awaited, not lazy, not client-only', () => {
  it('12 — data is fully resolved when setup finishes awaiting (no post-mount wait)', async () => {
    const page = await mountPage('about')
    expect(page.pending).toBe(false)
    expect(page.data?.metaTitle).toBe('About from EN')
    expect(page.wrapper.find('[data-harness]').exists()).toBe(true)
  })

  it('13 — first read is neither lazy nor client-only (structural)', () => {
    const code = readFileSync('app/composables/usePublicPageSeo.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/lazy\s*:\s*true/)
    expect(code).not.toMatch(/server\s*:\s*false/)
  })
})

async function payloadFor(key: string): Promise<PublicPageSeoEntity | undefined> {
  const { useNuxtApp } = await import('#app')
  return (useNuxtApp().payload.data as Record<string, PublicPageSeoEntity>)[key]
}

async function flushLocaleSwitch(): Promise<void> {
  await nextTick()
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 20))
  await nextTick()
}

describe('client-side locale switch — refetch under the new identity', () => {
  it('14 — EN -> AR fetches the AR record into the AR identity, exactly once', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    const enCallsBefore = calls.length
    const page = await mountPage('about')
    void page
    routeLocale.value = 'ar'
    await flushLocaleSwitch()

    const arCalls = calls.slice(enCallsBefore).filter(c => c.locale === 'ar')
    expect(arCalls).toHaveLength(1)
    const stored = await payloadFor('seo:page:about:ar')
    expect(stored?.locale).toBe('ar')
    expect(stored?.metaTitle).toBe(PAGE_AR.metaTitle)
  })

  it('15 — AR -> EN fetches the EN record back into the EN identity', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    routeLocale.value = 'ar'
    await mountPage('about')

    const callsBefore = calls.length
    routeLocale.value = 'en'
    await flushLocaleSwitch()

    const enCalls = calls.slice(callsBefore).filter(c => c.locale === 'en')
    expect(enCalls).toHaveLength(1)
    const stored = await payloadFor('seo:page:about:en')
    expect(stored?.locale).toBe('en')
    expect(stored?.metaTitle).toBe(PAGE_EN.metaTitle)
  })

  it('16 — stale EN data is never presented as the AR result after the switch settles', async () => {
    responder = (_p, locale) => (locale === 'ar' ? PAGE_AR : PAGE_EN)
    await mountPage('about')
    const staleEn = await payloadFor('seo:page:about:en')
    expect(staleEn?.metaTitle).toBe(PAGE_EN.metaTitle)

    routeLocale.value = 'ar'
    await flushLocaleSwitch()

    // The identity that now answers for `about` in this app state is the AR one, and its payload
    // is the AR entity — the resolved result can never be the stale EN record.
    const arResult = await payloadFor('seo:page:about:ar')
    expect(arResult?.metaTitle).toBe(PAGE_AR.metaTitle)
    expect(arResult?.locale).toBe('ar')
    expect(arResult?.metaTitle).not.toBe(staleEn?.metaTitle)
  })
})

describe('success semantics — known page, nothing authored', () => {
  const ALL_NULL = entity({ metaTitle: null, metaDescription: null, ogImageId: null, ogImage: null, canonicalUrl: null })

  it('17 / 18 — a 200 all-null response remains a successful entity, not an error', async () => {
    responder = () => ALL_NULL
    const page = await mountPage('about')
    expect(page.data).toStrictEqual(ALL_NULL)
    expect(page.error).toBeNull()
    expect(page.pending).toBe(false)
  })
})

describe.each([
  ['404', Object.assign(new Error('page not found'), { statusCode: 404 })],
  ['500', Object.assign(new Error('boom'), { statusCode: 500 })],
  ['network failure', new TypeError('fetch failed')]
])('failure semantics — %s', (_label, failure) => {
  it('19 / 20 / 21 — leaves optional PageSeo unavailable without a fatal route error', async () => {
    responder = () => {
      throw failure
    }
    const page = await mountPage('about')
    expect(page.data ?? null).toBeNull()
    expect(page.error).toBeTruthy()
    // The harness finished rendering its sentinel — the "route" did not fail.
    expect(page.wrapper.find('[data-harness="about"]').exists()).toBe(true)
  })

  it('22 — no retry loop occurs (exactly one request)', async () => {
    responder = () => {
      throw failure
    }
    await mountPage('about')
    expect(calls.filter(c => c.path === '/seo/pages/about')).toHaveLength(1)
    for (const call of calls) expect(call.retry).toBe(0)
  })
})

describe('isolation & boundary', () => {
  it('23 / 24 — different pages and different locales hold separate payload state', async () => {
    responder = (path, locale) =>
      path === '/seo/pages/home' ? HOME_EN : locale === 'ar' ? PAGE_AR : PAGE_EN

    const aboutEn = await mountPage('about')
    const home = await mountPage('home')
    expect(aboutEn.data?.metaTitle).not.toBe(home.data?.metaTitle)

    routeLocale.value = 'ar'
    const aboutAr = await mountPage('about')
    expect(aboutAr.data?.metaTitle).toBe(PAGE_AR.metaTitle)
    expect(aboutAr.data?.locale).toBe('ar')
    expect(aboutEn.data?.locale).toBe('en')
  })

  it('25 — no Settings request is made', async () => {
    await mountPage('about')
    for (const call of calls) expect(call.path).not.toBe('/settings/site')
  })

  it('27–30 — zero ownership of head/canonical/structured-data/GTM surfaces', () => {
    const code = readFileSync('app/composables/usePublicPageSeo.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    expect(code).not.toMatch(/useHead|useSeoMeta|useServerSeoMeta/)
    expect(code).not.toMatch(/canonical/i)
    expect(code).not.toMatch(/ld\+json|useSchemaOrg/i)
    expect(code).not.toMatch(/gtm|googletagmanager|verification|customMeta/i)
    expect(code).not.toMatch(/settings\/site/)
    expect(code).not.toMatch(/createError|showError/)
  })
})
