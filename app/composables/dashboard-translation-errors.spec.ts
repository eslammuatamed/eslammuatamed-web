import { describe, expect, it } from 'vitest'
import {
  translationFieldErrorLocale,
  translationFieldErrorName
} from './dashboard-translation-errors'

/**
 * The contract rule every translatable Dashboard module shares.
 *
 * These assertions were written against the Articles editor and moved here with the rule, because
 * the rule belongs to the contract rather than to Articles: sixteen admin write DTOs carry
 * translations as an array and answer a 422 with array-indexed field paths.
 */

describe('the index is resolved against the REQUEST, not a canonical list', () => {
  it('follows the order the client actually sent', () => {
    expect(translationFieldErrorName('translations[0].slug', ['en', 'ar'])).toBe('translations.en.slug')
    // The same index, a different request ordering — the answer must move with it.
    expect(translationFieldErrorName('translations[0].slug', ['ar', 'en'])).toBe('translations.ar.slug')
    expect(translationFieldErrorName('translations[1].slug', ['en', 'ar'])).toBe('translations.ar.slug')
  })

  it('resolves the LOCALE the same way', () => {
    expect(translationFieldErrorLocale('translations[0].title', ['ar', 'en'])).toBe('ar')
    expect(translationFieldErrorLocale('translations[1].title', ['ar', 'en'])).toBe('en')
  })

  /**
   * THE CASE THAT ACTUALLY BITES, and the one a canonical-list implementation gets wrong.
   *
   * An entity authored in ONE language sends one entry, so index 0 is that language — Arabic here.
   * Resolving against `['en', 'ar']` would attach the error to a field the operator deliberately
   * left empty, while the real problem stayed invisible on the other tab.
   */
  it('maps index 0 of a SINGLE-locale request to that locale', () => {
    expect(translationFieldErrorName('translations[0].slug', ['ar'])).toBe('translations.ar.slug')
    expect(translationFieldErrorLocale('translations[0].slug', ['ar'])).toBe('ar')
  })

  it('returns null for an index outside the sent array, rather than guessing', () => {
    // Better an unattached form-level message than one confidently pinned to the wrong field.
    expect(translationFieldErrorName('translations[1].slug', ['ar'])).toBeNull()
    expect(translationFieldErrorLocale('translations[1].slug', ['ar'])).toBeNull()
  })

  it('passes a non-translation path straight through', () => {
    expect(translationFieldErrorName('publishAt', ['en', 'ar'])).toBe('publishAt')
    expect(translationFieldErrorName('categoryId', ['en', 'ar'])).toBe('categoryId')
    expect(translationFieldErrorLocale('publishAt', ['en', 'ar'])).toBeNull()
  })

  it('handles a nested field path, not only a leaf', () => {
    expect(translationFieldErrorName('translations[1].seo.metaTitle', ['en', 'ar']))
      .toBe('translations.ar.seo.metaTitle')
  })
})
