import { describe, expect, it } from 'vitest'
import { resolveRouteLocale } from './route-locale'

/**
 * D06-6's resolver. Every case here is a rule the rendered page cannot show you is broken: a wrong
 * answer produces a localized 404 or silently the wrong language, never an obvious failure.
 */

/** The shipped configuration, read from `nuxt.config` at runtime — restated here as data, not logic. */
const CONFIG = { codes: ['en', 'ar'], defaultLocale: 'en' }

describe('resolveRouteLocale — prefix_except_default', () => {
  it('resolves an unprefixed route to the default locale', () => {
    expect(resolveRouteLocale('/', CONFIG)).toBe('en')
    expect(resolveRouteLocale('/projects', CONFIG)).toBe('en')
    expect(resolveRouteLocale('/projects/content-platform-api', CONFIG)).toBe('en')
  })

  it('resolves a prefixed route to the prefix locale', () => {
    expect(resolveRouteLocale('/ar', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('/ar/projects', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('/ar/projects/content-platform-api-ar', CONFIG)).toBe('ar')
  })

  it('matches the WHOLE first segment, never a prefix of it', () => {
    // `/arabic-typography` is an English slug that happens to start with "ar". Treating it as Arabic
    // would request the wrong language for every such URL — silently, and forever.
    expect(resolveRouteLocale('/arabic-typography', CONFIG)).toBe('en')
    expect(resolveRouteLocale('/blog/arabic-typography', CONFIG)).toBe('en')
    expect(resolveRouteLocale('/article', CONFIG)).toBe('en')
  })

  it('ignores a query string and a hash', () => {
    // The projects index carries `?technology=`, and the switcher can produce a hash.
    expect(resolveRouteLocale('/ar/projects?technology=abc', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('/ar?x=1', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('/projects?technology=abc', CONFIG)).toBe('en')
    expect(resolveRouteLocale('/ar/projects#gallery', CONFIG)).toBe('ar')
  })

  it('tolerates trailing and duplicated slashes', () => {
    expect(resolveRouteLocale('/ar/', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('//ar//projects', CONFIG)).toBe('ar')
    expect(resolveRouteLocale('', CONFIG)).toBe('en')
  })

  it('does not treat a prefixed DEFAULT locale as a locale prefix', () => {
    // Under `prefix_except_default` there is no `/en/...` route, so `en` in first position is an
    // ordinary segment. The answer is the same either way, which is why this needs pinning: a future
    // strategy change must fail this test rather than pass by coincidence.
    expect(resolveRouteLocale('/en/projects', CONFIG)).toBe('en')
  })

  it('is driven by configuration, so a new locale needs no change here (Pillar 3)', () => {
    const withFrench = { codes: ['en', 'ar', 'fr'], defaultLocale: 'en' }
    expect(resolveRouteLocale('/fr/projects', withFrench)).toBe('fr')
    // Still unknown under the shipped config — an unconfigured prefix is a content path, not a locale.
    expect(resolveRouteLocale('/fr/projects', CONFIG)).toBe('en')
  })

  it('honours a different default locale', () => {
    const arabicDefault = { codes: ['en', 'ar'], defaultLocale: 'ar' }
    expect(resolveRouteLocale('/projects', arabicDefault)).toBe('ar')
    expect(resolveRouteLocale('/en/projects', arabicDefault)).toBe('en')
    expect(resolveRouteLocale('/ar/projects', arabicDefault)).toBe('ar')
  })
})
