// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSiteSettings } from './useSiteSettings'

// WD-6: the reactive key + watch must re-fetch on a client-side locale switch, so the
// persistent-layout footer's API-localized fields don't go stale. This pins that behavior.
//
// The driver is now the ROUTE locale (D06-6), which is what a locale switch actually changes — and the
// assertion is stronger than before: it reads the locale the request CARRIED, not merely that some
// refetch happened. A key that updated while the request kept the old locale would now fail.
const routeLocale = ref('en')
const fetchedLocales: string[] = []

// `t` is stubbed too: the global @nuxtjs/seo fallback-title composable calls `i18n.t` during the run.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useRouteLocale', () => () => routeLocale)
mockNuxtImport('useApi', () => () => (_path: string, options?: { locale?: string }) => {
  fetchedLocales.push(options?.locale ?? '(none sent)')
  return Promise.resolve({ data: { siteName: 'x', tagline: null, profileLinks: [], availableLocales: ['en', 'ar'] } })
})

describe('useSiteSettings — reactive locale key', () => {
  it('re-fetches with the new route locale when it changes (footer stays in sync without remount)', async () => {
    const Harness = defineComponent({
      async setup() {
        await useSiteSettings()
        return () => h('div')
      }
    })

    await mountSuspended(Harness)
    expect(fetchedLocales).toContain('en')
    const before = fetchedLocales.length

    routeLocale.value = 'ar'
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchedLocales.length).toBeGreaterThan(before)
    expect(fetchedLocales).toContain('ar')
  })
})
