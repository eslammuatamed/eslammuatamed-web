// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useResumeData } from './useResumeData'

/**
 * FR-PUB-024 — "no second source of truth" — enforced as a test, not as a convention.
 *
 * The risk this file exists to catch is a future edit that quietly adds résumé content from
 * somewhere else: a hard-coded skills array, a second endpoint, a locally-authored summary. None
 * of that is visible in a screenshot, and all of it would still render a plausible résumé. So the
 * assertions here are about the REQUESTS the page makes — the only place a second source can hide.
 */
const apiMock = vi.fn()
let currentLocale = 'en'

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useApi', () => () => apiMock)
mockNuxtImport('useRouteLocale', () => () => ref(currentLocale))

async function run<T>(factory: () => T): Promise<T> {
  let captured: T | undefined
  const Harness = defineComponent({
    async setup() {
      captured = factory()
      return () => h('div')
    }
  })
  await mountSuspended(Harness)
  return captured!
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockImplementation((path: string) => {
    if (path === '/settings/site') return Promise.resolve({ data: { siteName: 'Eslam Muatamed' } })
    if (path === '/experiences') return Promise.resolve({ data: [] })
    if (path === '/skills') return Promise.resolve({ data: [] })
    throw new Error(`unexpected endpoint: ${path}`)
  })
})

describe('useResumeData — FR-PUB-024', () => {
  it('reads exactly three endpoints and invents no fourth content source', async () => {
    currentLocale = 'fr-a'
    await run(() => useResumeData())

    const paths = apiMock.mock.calls.map(call => call[0] as string).sort()
    expect(paths).toEqual(['/experiences', '/settings/site', '/skills'])
  })

  // The résumé must not become a place where Experience is fetched differently — same endpoint,
  // same locale parameter, same envelope. A divergence here IS the second source of truth.
  it('requests Experience the same way /experience does', async () => {
    currentLocale = 'fr-b'
    await run(() => useResumeData())

    const call = apiMock.mock.calls.find(([path]) => path === '/experiences')
    expect(call?.[1]).toEqual({ locale: 'fr-b' })
  })

  it('requests Skills from the shared registry endpoint with the route locale', async () => {
    currentLocale = 'fr-c'
    await run(() => useResumeData())

    const call = apiMock.mock.calls.find(([path]) => path === '/skills')
    expect(call?.[1]).toEqual({ locale: 'fr-c' })
  })

  // D06-6: content follows the ROUTE, not the reactive UI locale. `useI18n().locale` is pinned to
  // 'en' above while the route says otherwise — if any read used the UI locale it would show here.
  it('takes every locale from the route, never from the UI locale', async () => {
    currentLocale = 'fr-d'
    await run(() => useResumeData())

    for (const [, options] of apiMock.mock.calls) {
      expect((options as { locale: string }).locale).toBe('fr-d')
    }
  })

  it('exposes the three reads independently so one failure cannot blank the others', async () => {
    currentLocale = 'fr-e'
    const data = await run(() => useResumeData())

    expect(Object.keys(data).sort()).toEqual(['experiences', 'settings', 'skills'])
    for (const read of [data.settings, data.experiences, data.skills]) {
      expect(read).toHaveProperty('data')
      expect(read).toHaveProperty('error')
      expect(read).toHaveProperty('refresh')
    }
  })

  /**
   * The settings read must share the `settings:site:{locale}` key namespace with the chrome read
   * (`useSiteSettings`) and `/about` (`useAboutContent`), so the page body and the persistent
   * footer resolve from ONE request whenever their locales agree.
   *
   * Proven by behaviour rather than by reading the key string: a second `useResumeData()` at the
   * same locale must not produce a second `/settings/site` request, because `useAsyncData` dedupes
   * on the key. A renamed key would break this immediately.
   */
  it('dedupes the settings read across callers at the same locale', async () => {
    currentLocale = 'fr-f'
    await run(() => useResumeData())
    const afterFirst = apiMock.mock.calls.filter(([path]) => path === '/settings/site').length

    await run(() => useResumeData())
    const afterSecond = apiMock.mock.calls.filter(([path]) => path === '/settings/site').length

    expect(afterFirst).toBe(1)
    expect(afterSecond).toBe(1)
  })

  it('dedupes Experience and Skills the same way', async () => {
    currentLocale = 'fr-g'
    await run(() => useResumeData())
    await run(() => useResumeData())

    expect(apiMock.mock.calls.filter(([path]) => path === '/experiences')).toHaveLength(1)
    expect(apiMock.mock.calls.filter(([path]) => path === '/skills')).toHaveLength(1)
  })
})
