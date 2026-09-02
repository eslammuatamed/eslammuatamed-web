import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_LOCALE_DEFAULT,
  DASHBOARD_LOCALES,
  dashboardDir,
  dashboardDrawerSide,
  isDashboardLocale,
  normalizeDashboardLocale,
  isDashboardPath
} from './dashboard-locale'

/**
 * The decidable half of the Dashboard application locale (D11-8).
 *
 * These are small functions and the temptation is to trust them, but each one sits on a path where
 * being wrong is INVISIBLE rather than loud: a bad locale renders raw key paths, a wrong direction
 * mirrors an admin layout, and a wrong path match hands a public page the dashboard's language.
 */

describe('normalizeDashboardLocale', () => {
  it.each(DASHBOARD_LOCALES)('passes %s through unchanged', (locale) => {
    expect(normalizeDashboardLocale(locale)).toBe(locale)
  })

  /**
   * The values a COOKIE actually produces. This is not defensive padding: the cookie is
   * user-writable, survives deploys, and outlives the locale list that wrote it. An unrecognized
   * value reaching `t(key, …, { locale })` renders the key path with no error anywhere.
   */
  it.each([
    ['unset', undefined],
    ['deleted', null],
    ['empty', ''],
    ['a locale we do not ship', 'fr'],
    ['right locale, wrong case', 'EN'],
    ['hand-edited nonsense', 'en; path=/'],
    ['a number', 7],
    ['an object', { code: 'ar' }]
  ])('coerces %s to the default', (_label, value) => {
    expect(normalizeDashboardLocale(value)).toBe(DASHBOARD_LOCALE_DEFAULT)
  })

  it('never returns a value outside the supported set', () => {
    expect(DASHBOARD_LOCALES).toContain(normalizeDashboardLocale('anything at all'))
  })
})

describe('isDashboardLocale', () => {
  it('rejects a non-string without throwing', () => {
    expect(isDashboardLocale(undefined)).toBe(false)
    expect(isDashboardLocale({})).toBe(false)
  })
})

describe('direction', () => {
  it('maps ar to rtl and en to ltr', () => {
    expect(dashboardDir('ar')).toBe('rtl')
    expect(dashboardDir('en')).toBe('ltr')
  })

  /**
   * The drawer used to be hard-coded to a physical `left`, correct only while the dashboard was
   * English-only LTR. This is the assertion that the correction is real in the RTL case — the one
   * the old code got wrong — rather than merely present.
   */
  it('opens the drawer from the inline-start in each direction', () => {
    expect(dashboardDrawerSide('en')).toBe('left')
    expect(dashboardDrawerSide('ar')).toBe('right')
  })
})

describe('isDashboardPath', () => {
  it.each(['/dashboard', '/dashboard/', '/dashboard/media', '/dashboard/projects/12'])(
    'recognizes %s',
    (path) => {
      expect(isDashboardPath(path)).toBe(true)
    }
  )

  /**
   * The prefix trap. A `startsWith('/dashboard')` test matches `/dashboards` and `/dashboard-notes`
   * too — public routes that would then inherit the dashboard's language and direction while their
   * `<html lang>` said otherwise. `/ar/dashboard/...` is included because it is no longer a route at
   * all (D04-7); if it ever reappears, this fails rather than quietly treating it as dashboard.
   */
  it.each(['/', '/about', '/dashboards', '/dashboard-notes', '/ar/dashboard', '/ar/dashboard/media'])(
    'rejects %s',
    (path) => {
      expect(isDashboardPath(path)).toBe(false)
    }
  )
})
