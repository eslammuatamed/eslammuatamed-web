// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSiteSettings } from './useSiteSettings'

// WD-6: the reactive key + watch must re-fetch on a client-side locale switch, so the
// persistent-layout footer's API-localized fields don't go stale. This pins that behavior.
//
// The driver is the UI locale, NOT the route (the one public read where that is correct — see the
// composable's own note: it feeds persistent chrome, which the D03-13 transition does not conceal).
// The assertion is stronger than before: it reads the locale the request CARRIED, not merely that
// some refetch happened. A key that updated while the request kept the old locale would now fail.
const uiLocale = ref('en')
const fetchedLocales: string[] = []

// `t` is stubbed too: the global @nuxtjs/seo fallback-title composable calls `i18n.t` during the run.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: uiLocale }))
mockNuxtImport('useApi', () => () => (_path: string, options?: { locale?: string }) => {
  fetchedLocales.push(options?.locale ?? '(none sent)')
  return Promise.resolve({ data: { siteName: 'x', tagline: null, profileLinks: [], availableLocales: ['en', 'ar'] } })
})

describe('useSiteSettings — reactive locale key', () => {
  it('re-fetches with the new UI locale when it changes (footer stays in sync without remount)', async () => {
    const Harness = defineComponent({
      async setup() {
        await useSiteSettings()
        return () => h('div')
      }
    })

    await mountSuspended(Harness)
    expect(fetchedLocales).toContain('en')
    const before = fetchedLocales.length

    uiLocale.value = 'ar'
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchedLocales.length).toBeGreaterThan(before)
    expect(fetchedLocales).toContain('ar')
  })
})
