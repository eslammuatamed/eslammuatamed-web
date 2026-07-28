// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useHomeData } from './useHomeData'

// T022 (NFR-DEGRADE): a single failing section endpoint must NOT reject the aggregate — each section
// captures its own error into `.error` while the others still resolve. This is the feature's core
// resilience guarantee, so it gets a dedicated regression test.
// `t` is stubbed too: the global @nuxtjs/seo fallback-title composable calls `i18n.t` during the run.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
// Home reads take the ROUTE locale (D06-6); resolution itself is covered by `useRouteLocale`'s spec.
mockNuxtImport('useRouteLocale', () => () => ref('en'))
mockNuxtImport('useApi', () => () => (path: string) => {
  if (path.startsWith('/experiences')) return Promise.reject(new Error('boom'))
  if (path.startsWith('/skills')) {
    return Promise.resolve({
      data: [{ id: 's1', label: 'TS', group: 'LANGUAGE', order: 0, brandColor: null, availableLocales: ['en'] }]
    })
  }
  return Promise.resolve({ data: [], meta: { page: 1, perPage: 6, total: 0, totalPages: 0 } })
})

describe('useHomeData — per-section error isolation (T022)', () => {
  it('a failing section does not reject the aggregate; other sections still resolve', async () => {
    let home: ReturnType<typeof useHomeData> | undefined
    const Harness = defineComponent({
      async setup() {
        home = useHomeData()
        await Promise.allSettled([
          home.skills, home.experiences, home.projects, home.articles, home.testimonials
        ])
        return () => h('div')
      }
    })

    await mountSuspended(Harness)

    // the dead endpoint errored, but the page was never rejected and other sections resolved
    expect(home!.experiences.error.value).toBeTruthy()
    expect(home!.experiences.data.value).toBeFalsy()
    expect(home!.skills.error.value).toBeFalsy()
    expect(home!.skills.data.value).toHaveLength(1)
  })
})
