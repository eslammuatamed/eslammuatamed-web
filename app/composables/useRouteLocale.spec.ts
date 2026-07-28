// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useRouteLocale } from './useRouteLocale'

/**
 * The WIRING of D06-6, as distinct from the resolution rules (`~/utils/route-locale.spec.ts`).
 *
 * Three things can only go wrong here, and all three are invisible in a rendered page:
 *   - reading the wrong source (the reactive UI locale instead of the route) — the F-1 defect itself;
 *   - reading configuration that is hard-coded rather than taken from the i18n module (Pillar 3);
 *   - being setup-only, which would throw the moment `useSlugRedirect` is used across an await.
 */

const routePath = ref('/projects/content-platform-api')

// ONLY the route is mocked. The locale configuration comes from the REAL i18n module in the test Nuxt
// app, which is the point of the last test below — hard-coded codes would pass a stubbed config and
// fail here. `useNuxtApp` is deliberately not mocked: @nuxt/test-utils' own runtime depends on it.
// Route-SHAPED, not just `{ path }`: the mock replaces the global `useRoute`, and other modules in
// the app (nuxt-seo-utils) read `meta`/`params`/`query` off it during the mount. A partial stub makes
// them throw, which would surface as an unhandled rejection rather than as a failed assertion here.
mockNuxtImport('useRoute', () => () => ({
  path: routePath.value,
  fullPath: routePath.value,
  name: 'stub',
  params: {},
  query: {},
  hash: '',
  meta: {},
  matched: []
}))

/** Read the composable inside a real Nuxt setup context. */
async function read(): Promise<string> {
  let value = ''
  const Harness = defineComponent({
    setup() {
      const locale = useRouteLocale()
      value = locale.value
      return () => h('div')
    }
  })
  await mountSuspended(Harness)
  return value
}

describe('useRouteLocale', () => {
  it('resolves the locale from the route, not from the reactive UI locale', async () => {
    // The UI locale says `en`. The route says Arabic. The route wins — this is F-1's fix in one
    // assertion: during the D03-13 deferred commit these two genuinely disagree.
    routePath.value = '/ar/projects/ssr-bilingual-ar'
    expect(await read()).toBe('ar')
  })

  it('resolves an unprefixed route to the default locale', async () => {
    routePath.value = '/projects/content-platform-api'
    expect(await read()).toBe('en')
  })

  it('tracks the route reactively, so a navigation changes the effective locale', async () => {
    routePath.value = '/blog/some-article'
    expect(await read()).toBe('en')

    routePath.value = '/ar/blog/maqal-arabi'
    expect(await read()).toBe('ar')
  })

  it('reads the configured locales rather than a hard-coded list', async () => {
    // Proves the codes come from the i18n module's own state: an unconfigured prefix is a content
    // path, not a locale, so it must fall back to the default rather than be echoed back.
    routePath.value = '/fr/projects'
    expect(await read()).toBe('en')
  })
})
