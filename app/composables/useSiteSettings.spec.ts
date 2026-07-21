// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSiteSettings } from './useSiteSettings'

// WD-6: the reactive key + watch:[locale] must re-fetch on a client-side locale switch, so the
// persistent-layout footer's API-localized fields don't go stale. This pins that behavior.
const localeRef = ref('en')
const fetchedLocales: string[] = []

// `t` is stubbed too: the global @nuxtjs/seo fallback-title composable calls `i18n.t` during the run.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: localeRef }))
mockNuxtImport('useApi', () => () => (_path: string) => {
  fetchedLocales.push(localeRef.value)
  return Promise.resolve({ data: { siteName: 'x', tagline: null, profileLinks: [], availableLocales: ['en', 'ar'] } })
})

describe('useSiteSettings — reactive locale key', () => {
  it('re-fetches when the locale changes (footer stays in sync without remount)', async () => {
    const Harness = defineComponent({
      async setup() {
        await useSiteSettings()
        return () => h('div')
      }
    })

    await mountSuspended(Harness)
    expect(fetchedLocales).toContain('en')
    const before = fetchedLocales.length

    localeRef.value = 'ar'
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchedLocales.length).toBeGreaterThan(before)
    expect(fetchedLocales).toContain('ar')
  })
})
