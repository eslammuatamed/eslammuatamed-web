import { describe, expect, it } from 'vitest'
import {
  ARTICLE_LOCALES,
  articleDisplayTitle,
  articleHasTranslation,
  articleIsPubliclyVisible,
  articleMissingLocales,
  articleSlug,
  articleStatusColor
} from './admin-article-form'
import type { AdminArticle, AdminArticleTranslation } from './admin-article-types'

function translation(over: Partial<AdminArticleTranslation> = {}): AdminArticleTranslation {
  return {
    title: 'A modular monolith in practice',
    slug: 'a-modular-monolith-in-practice',
    excerpt: 'e',
    body: '# b',
    readingTimeMin: 4,
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    ...over
  }
}

function article(over: Partial<AdminArticle> = {}): AdminArticle {
  return {
    id: 'a1',
    status: 'PUBLISHED',
    publishAt: '2026-08-01T09:00:00.000Z',
    categoryId: 'c1',
    coverImageId: null,
    tagIds: [],
    translations: { en: translation(), ar: translation({ title: 'الهندسة', slug: 'الهندسة' }) },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over
  }
}

describe('translation presence is read from the map, never inferred', () => {
  it('is true only when the locale has both a title and a slug', () => {
    expect(articleHasTranslation(article(), 'en')).toBe(true)
    expect(articleHasTranslation(article({ translations: { en: translation() } }), 'ar')).toBe(false)
  })

  it('treats whitespace as absent, not as content', () => {
    const blankish = article({ translations: { en: translation({ title: '   ' }) } })
    expect(articleHasTranslation(blankish, 'en')).toBe(false)
  })

  it('reports exactly which locales are missing', () => {
    expect(articleMissingLocales(article())).toEqual([])
    expect(articleMissingLocales(article({ translations: { en: translation() } }))).toEqual(['ar'])
    expect(articleMissingLocales(article({ translations: {} }))).toEqual([...ARTICLE_LOCALES])
  })
})

describe('the row heading follows the operator, and never fabricates a translation', () => {
  it('prefers the operator\'s own language', () => {
    expect(articleDisplayTitle(article(), 'ar', 'untitled')).toBe('الهندسة')
    expect(articleDisplayTitle(article(), 'en', 'untitled')).toBe('A modular monolith in practice')
  })

  it('falls back to the other language to IDENTIFY a row, which is the one place that is correct', () => {
    const enOnly = article({ translations: { en: translation() } })
    expect(articleDisplayTitle(enOnly, 'ar', 'untitled')).toBe('A modular monolith in practice')
  })

  it('falls back to a neutral label rather than to a slug or an empty heading', () => {
    expect(articleDisplayTitle(article({ translations: {} }), 'en', 'Untitled article'))
      .toBe('Untitled article')
  })
})

describe('slugs are per-locale and never borrowed', () => {
  it('returns the locale\'s own slug', () => {
    expect(articleSlug(article(), 'en')).toBe('a-modular-monolith-in-practice')
    expect(articleSlug(article(), 'ar')).toBe('الهندسة')
  })

  it('returns null for a locale that does not exist — never the other locale\'s slug', () => {
    const enOnly = article({ translations: { en: translation() } })
    expect(articleSlug(enOnly, 'ar')).toBeNull()
  })
})

describe('a public destination requires BOTH published and a translation in that locale', () => {
  it('is visible when published and translated', () => {
    expect(articleIsPubliclyVisible(article(), 'en')).toBe(true)
    expect(articleIsPubliclyVisible(article(), 'ar')).toBe(true)
  })

  /**
   * The discriminating case. `GET /articles/{slug}` resolves per-locale, so a published article
   * with no Arabic 404s in Arabic — and a `View on site` action offered there would link the
   * operator to a 404, which plan §14.2 forbids by name. Status alone is not enough.
   */
  it('is NOT visible in a locale the article does not have, even though it is PUBLISHED', () => {
    const enOnly = article({ translations: { en: translation() } })
    expect(enOnly.status).toBe('PUBLISHED')
    expect(articleIsPubliclyVisible(enOnly, 'ar')).toBe(false)
    expect(articleIsPubliclyVisible(enOnly, 'en')).toBe(true)
  })

  it.each(['DRAFT', 'SCHEDULED', 'ARCHIVED'] as const)('is NOT visible while %s', (status) => {
    expect(articleIsPubliclyVisible(article({ status }), 'en')).toBe(false)
  })
})

describe('status colour is centralised so the list and the editor cannot drift', () => {
  it('gives every contract status its own mapping', () => {
    expect(articleStatusColor('PUBLISHED')).toBe('success')
    expect(articleStatusColor('SCHEDULED')).toBe('primary')
    expect(articleStatusColor('ARCHIVED')).toBe('warning')
    expect(articleStatusColor('DRAFT')).toBe('neutral')
  })
})
