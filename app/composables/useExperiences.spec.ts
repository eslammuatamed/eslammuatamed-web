// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Experience } from '~/types/models'
import { useExperiences } from './useExperiences'

// FR-PUB-021's contract with the API: the server owns reverse-chronological ordering, technology
// ordering (`Skill.order`, D02-9) and locale resolution; the client owns only the request. These
// tests pin the request shape and the no-client-sort rule — both invisible in the rendered output
// until they are wrong.
const apiMock = vi.fn()
// A plain string read into a FRESH ref per call, not one shared reactive ref: `mountSuspended`
// leaves each harness mounted, so a shared ref would make every earlier test's `watch: [locale]`
// refetch when a later test changes the locale, and payloads would bleed between tests.
let currentLocale = 'en'
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useApi', () => () => apiMock)
// The effective content locale is route-resolved (D06-6); `useRouteLocale` has its own spec, so it
// is stubbed here to keep these tests about the REQUEST rather than about locale resolution.
mockNuxtImport('useRouteLocale', () => () => ref(currentLocale))

const role = (id: string, startDate: string, technologies: Experience['technologies'] = []) => ({
  id,
  role: id,
  company: 'Acme',
  location: 'Remote',
  impact: '',
  employmentType: 'FULL_TIME' as const,
  isCurrent: false,
  startDate,
  endDate: null,
  order: 0,
  technologies,
  availableLocales: ['en', 'ar']
})

/**
 * Runs the composable inside a real Nuxt setup context and resolves its request.
 *
 * NOTE ON KEYS: `useAsyncData` caches per key and that cache is shared across tests in one Nuxt
 * instance. `useExperiences` has a single key per locale, so tests that need a fresh fetch vary the
 * locale — which doubles as proof that the key really is derived from the route locale.
 */
async function run<T>(factory: () => T): Promise<T> {
  let captured: T | undefined
  const Harness = defineComponent({
    async setup() {
      captured = factory()
      await Promise.allSettled([captured])
      return () => h('div')
    }
  })
  await mountSuspended(Harness)
  return captured!
}

describe('useExperiences', () => {
  it('requests /experiences with the route-resolved locale', async () => {
    apiMock.mockClear()
    currentLocale = 'en'
    apiMock.mockResolvedValue({ data: [] })

    await run(() => useExperiences())

    expect(apiMock).toHaveBeenCalledWith('/experiences', { locale: 'en' })
  })

  it('sends the ROUTE locale, not the UI locale (D06-6)', async () => {
    apiMock.mockClear()
    // The mocked UI locale stays 'en' throughout this file; only the route locale moves. If the
    // composable read the UI locale, this would request 'en' and the Arabic page would render
    // English content during the D03-13 deferred commit.
    currentLocale = 'ar'
    apiMock.mockResolvedValue({ data: [] })

    await run(() => useExperiences())

    expect(apiMock).toHaveBeenCalledWith('/experiences', { locale: 'ar' })
  })

  it('preserves the API order verbatim — the client never re-sorts (FR-PUB-021)', async () => {
    apiMock.mockClear()
    currentLocale = 'de'
    // Deliberately NOT sorted by startDate: the API already applied `startDate desc`, so any client
    // sort would reorder this array.
    apiMock.mockResolvedValue({
      data: [
        role('middle', '2023-01-01T00:00:00.000Z'),
        role('newest', '2025-01-01T00:00:00.000Z'),
        role('oldest', '2021-01-01T00:00:00.000Z')
      ]
    })

    const result = await run(() => useExperiences())

    expect(result.data.value?.map(e => e.id)).toEqual(['middle', 'newest', 'oldest'])
  })

  it('preserves each entry technology order verbatim (Skill.order is the API\'s)', async () => {
    apiMock.mockClear()
    currentLocale = 'fr'
    apiMock.mockResolvedValue({
      data: [
        role('r1', '2025-01-01T00:00:00.000Z', [
          { id: 't3', slug: 'vue', label: 'Vue.js' },
          { id: 't1', slug: 'nuxt', label: 'Nuxt.js' },
          { id: 't2', slug: 'typescript', label: 'TypeScript' }
        ])
      ]
    })

    const result = await run(() => useExperiences())

    expect(result.data.value?.[0]?.technologies.map(t => t.label)).toEqual([
      'Vue.js',
      'Nuxt.js',
      'TypeScript'
    ])
  })

  it('never substitutes another locale — an empty list stays empty (no cross-locale fallback)', async () => {
    apiMock.mockClear()
    currentLocale = 'pt'
    // The API drops entries untranslated in the requested locale (D10-6). The client must surface
    // that as the empty state, never retry in a different language.
    apiMock.mockResolvedValue({ data: [] })

    const result = await run(() => useExperiences())

    expect(result.data.value).toEqual([])
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledWith('/experiences', { locale: 'pt' })
  })

  it('unwraps the envelope to the array itself', async () => {
    apiMock.mockClear()
    currentLocale = 'it'
    apiMock.mockResolvedValue({ data: [role('only', '2025-01-01T00:00:00.000Z')] })

    const result = await run(() => useExperiences())

    expect(result.data.value?.map(e => e.id)).toEqual(['only'])
  })

  it('captures a failed request into error instead of rejecting the page (NFR-DEGRADE)', async () => {
    apiMock.mockClear()
    currentLocale = 'es'
    apiMock.mockRejectedValue(new Error('boom'))

    const result = await run(() => useExperiences())

    expect(result.error.value).toBeTruthy()
    expect(result.data.value).toBeFalsy()
  })
})
