// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useSurfaceI18n } from './useSurfaceI18n'

/**
 * `useSurfaceI18n` picks the locale that owns the SURFACE (plan §14.9, F-1).
 *
 * ## Why the fake `translate` records its arguments instead of returning a fixed string
 *
 * The whole defect is *which locale a translation is resolved against*, and both the broken and the
 * fixed version return a perfectly plausible string. A test that asserted on the returned text alone
 * would need a real message catalogue to tell them apart, and would then be testing vue-i18n. So the
 * fake records the third argument — vue-i18n's per-call locale override — and the assertions are
 * about **what was asked for**. Passing NO override is the defect: that is what makes the route
 * locale win, and on `/dashboard/**` the route locale is always `en` (D04-7).
 */
const path = ref('/about')
const dashboardLocale = ref<'en' | 'ar'>('ar')
/** The translator's real call shape — vue-i18n's `t(key, named?, options?)`. Typing the fake with
 *  the narrow `(key: string)` signature made every argument-index assertion below a type error, and
 *  those indices are the entire point of this spec. */
type TranslateArgs = [key: string, named?: Record<string, unknown>, options?: { locale?: string }]
const translate = vi.fn((key: string, _named?: Record<string, unknown>, _options?: { locale?: string }) => key)

mockNuxtImport('useI18n', () => () => ({ t: translate }))
mockNuxtImport('useRoute', () => () => ({ get path() { return path.value } }))
mockNuxtImport('useDashboardLocale', () => () => ({ locale: dashboardLocale }))

function callT(currentPath: string, key = 'state.updating'): TranslateArgs {
  path.value = currentPath
  translate.mockClear()
  useSurfaceI18n().t(key)
  const call = translate.mock.calls[0]
  // Guards the guard: if `t` stopped calling the translator at all, every assertion that reads an
  // argument would otherwise report `undefined` and read as "no locale override", i.e. a pass.
  expect(call, 'the composable must call the translator exactly once').toBeDefined()
  return call as TranslateArgs
}

describe('useSurfaceI18n', () => {
  it('resolves against the DASHBOARD locale on a dashboard route', () => {
    const [key, named, options] = callT('/dashboard/articles')
    expect(key).toBe('state.updating')
    expect(named).toEqual({})
    // The assertion that fails against the pre-fix components: they passed no options at all.
    expect(options).toEqual({ locale: 'ar' })
  })

  it('follows a later dashboard-language switch rather than the value at setup', () => {
    dashboardLocale.value = 'en'
    expect(callT('/dashboard')[2]).toEqual({ locale: 'en' })
    dashboardLocale.value = 'ar'
    expect(callT('/dashboard')[2]).toEqual({ locale: 'ar' })
  })

  it('does NOT override the locale on a public route', () => {
    // Public copy must keep following the route locale — overriding it here would hand a public
    // page the operator's dashboard preference, which is the mirror-image defect.
    expect(callT('/about')[2]).toBeUndefined()
  })

  it('treats only the real dashboard subtree as the dashboard', () => {
    // `startsWith('/dashboard')` would wrongly claim these. The predicate is shared with `<UApp>`,
    // so a regression here would also mis-set the direction of teleported overlays.
    for (const publicPath of ['/dashboards', '/dashboard-notes', '/ar/about']) {
      expect(callT(publicPath)[2], `${publicPath} must not be treated as dashboard`).toBeUndefined()
    }
    for (const dashPath of ['/dashboard', '/dashboard/', '/dashboard/articles/new']) {
      expect(callT(dashPath)[2], `${dashPath} must be treated as dashboard`).toEqual({ locale: 'ar' })
    }
  })

  it('forwards named interpolation values unchanged', () => {
    path.value = '/dashboard'
    translate.mockClear()
    useSurfaceI18n().t('state.count', { n: 3 })
    expect(translate.mock.calls[0]?.[1]).toEqual({ n: 3 })
    expect(translate.mock.calls[0]?.[2]).toEqual({ locale: 'ar' })
  })
})
