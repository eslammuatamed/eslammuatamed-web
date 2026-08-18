import { describe, expect, it } from 'vitest'
import {
  ARTICLE_LOCALES,
  articleClearedLocales,
  articleFieldErrorLocale,
  articleFieldErrorName,
  articleFormSchema,
  articleIsoToPublishAtLocal,
  articlePayload,
  articlePayloadLocales,
  articlePublishAtToIso,
  articleTranslationInUse,
  emptyArticleTranslationForm,
  initialArticleForm,
  isArticleFormDirty,
  type ArticleFormState,
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE EDITOR'S FORM MODEL
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

const T = (key: string) => key

describe('seeding the form', () => {
  it('seeds a NEW article as a draft with nothing pre-filled', () => {
    const form = initialArticleForm(null)
    expect(form.status).toBe('DRAFT')
    expect(form.publishAtLocal).toBe('')
    expect(form.categoryId).toBe('')
    expect(form.tagIds).toEqual([])
    expect(form.translations.en.title).toBe('')
    expect(form.translations.ar.title).toBe('')
  })

  it('seeds a MISSING locale EMPTY — never from its sibling', () => {
    const form = initialArticleForm(article({ translations: { en: translation() } }))
    expect(form.translations.en.title).toBe('A modular monolith in practice')
    // The list view falls back across locales to identify a row. The editor must not: a pre-filled
    // Arabic tab holding English text is how a translation nobody wrote gets saved.
    expect(form.translations.ar.title).toBe('')
    expect(form.translations.ar.body).toBe('')
  })

  it('carries a cleared server value through as the empty string, not the word "null"', () => {
    const form = initialArticleForm(article({
      translations: { en: translation({ metaTitle: null, canonicalUrl: null }) }
    }))
    expect(form.translations.en.metaTitle).toBe('')
    expect(form.translations.en.canonicalUrl).toBe('')
  })

  it('keeps server-computed fields OUT of the form model entirely', () => {
    const form = initialArticleForm(article())
    // `readingTimeMin` in the form would be sent to an API that does not declare it (a 422) and
    // would sit in the dirty baseline, making a freshly saved article look unsaved.
    expect(form.translations.en).not.toHaveProperty('readingTimeMin')
    expect(form).not.toHaveProperty('createdAt')
    expect(form).not.toHaveProperty('updatedAt')
  })
})

describe('publishAt round-trips in the OPERATOR\'s zone', () => {
  it('returns to the same instant after a round trip', () => {
    const iso = new Date('2027-03-04T10:30:00.000Z').toISOString()
    const local = articleIsoToPublishAtLocal(iso)
    expect(articlePublishAtToIso(local)).toBe(iso)
  })

  it('renders the LOCAL wall clock, not the UTC one', () => {
    const iso = '2027-03-04T10:30:00.000Z'
    const expected = new Date(iso)
    const local = articleIsoToPublishAtLocal(iso)
    // A `toISOString().slice(0,16)` implementation would print the UTC hour and silently shift a
    // scheduled article by the operator's offset.
    expect(local.slice(11, 13)).toBe(String(expected.getHours()).padStart(2, '0'))
  })

  it('treats an unset or unparseable value as null', () => {
    expect(articleIsoToPublishAtLocal(null)).toBe('')
    expect(articlePublishAtToIso('')).toBeNull()
    expect(articlePublishAtToIso('   ')).toBeNull()
    expect(articlePublishAtToIso('not-a-date')).toBeNull()
  })
})

describe('which locales the payload carries', () => {
  it('counts a locale as in use from its REQUIRED fields only', () => {
    const seo = { ...emptyArticleTranslationForm(), metaTitle: 'Just SEO' }
    // SEO alone is not a translation; treating it as one would demand four more fields.
    expect(articleTranslationInUse(seo)).toBe(false)
    expect(articleTranslationInUse({ ...emptyArticleTranslationForm(), title: 'x' })).toBe(true)
  })

  it('sends every in-use locale, not only the edited one', () => {
    const form = initialArticleForm(article())
    expect(articlePayloadLocales(form)).toEqual(['en', 'ar'])
    expect(articlePayload(form).translations).toHaveLength(2)
  })

  it('omits a locale that was never written', () => {
    const form = initialArticleForm(article({ translations: { en: translation() } }))
    expect(articlePayloadLocales(form)).toEqual(['en'])
  })
})

describe('the payload speaks D10-23 — explicit null clears', () => {
  it('sends null for an emptied optional field rather than omitting it', () => {
    const form = initialArticleForm(article())
    form.translations.en.metaTitle = ''
    form.translations.en.canonicalUrl = ''
    const sent = articlePayload(form).translations[0]
    expect(sent).toBeDefined()
    // Omission means PRESERVE. A form that omitted these could never empty a meta description
    // once one had been set.
    expect(sent?.metaTitle).toBeNull()
    expect(sent?.canonicalUrl).toBeNull()
  })

  it('sends null for a removed cover image', () => {
    const form = initialArticleForm(article({ coverImageId: 'asset-1' }))
    form.coverImageId = null
    expect(articlePayload(form).coverImageId).toBeNull()
  })

  it('trims the required text but leaves the body byte-exact', () => {
    const form = initialArticleForm(null)
    form.categoryId = 'c1'
    form.translations.en.title = '  Spaced  '
    form.translations.en.slug = '  slug  '
    form.translations.en.excerpt = '  ex  '
    // Markdown is opaque: leading spaces are indented code blocks, and trailing spaces are a hard
    // line break. Trimming the body would silently rewrite what the operator typed.
    form.translations.en.body = '  # Heading\n\n    indented code  '
    const sent = articlePayload(form).translations[0]
    expect(sent?.title).toBe('Spaced')
    expect(sent?.slug).toBe('slug')
    expect(sent?.body).toBe('  # Heading\n\n    indented code  ')
  })

  it('never sends readingTimeMin', () => {
    const form = initialArticleForm(article())
    expect(articlePayload(form).translations[0]).not.toHaveProperty('readingTimeMin')
  })
})

/**
 * THE MAPPING THIS MODULE EXISTS TO GET RIGHT.
 *
 * Reads are a locale-keyed map; writes are an array; a 422 names `translations[N].slug` where N
 * indexes the array THIS CLIENT built. Resolve it with the wrong ordering and an Arabic slug
 * collision lands on the English tab — against a field that looks fine, with no way for the
 * operator to act on it.
 */
describe('422 field paths map back onto the right locale tab', () => {
  it('follows the ORDER OF THE REQUEST, not a fixed assumption', () => {
    expect(articleFieldErrorName('translations[0].slug', ['en', 'ar'])).toBe('translations.en.slug')
    // Same index, different request ordering — the answer must move with it.
    expect(articleFieldErrorName('translations[0].slug', ['ar', 'en'])).toBe('translations.ar.slug')
    expect(articleFieldErrorName('translations[1].slug', ['en', 'ar'])).toBe('translations.ar.slug')
  })

  it('resolves the TAB the same way', () => {
    expect(articleFieldErrorLocale('translations[0].title', ['ar', 'en'])).toBe('ar')
    expect(articleFieldErrorLocale('translations[1].title', ['ar', 'en'])).toBe('en')
  })

  it('handles a single-locale request, where index 1 does not exist', () => {
    expect(articleFieldErrorName('translations[0].slug', ['ar'])).toBe('translations.ar.slug')
    // Better an unattached form-level message than one confidently pinned to the wrong field.
    expect(articleFieldErrorName('translations[1].slug', ['ar'])).toBeNull()
    expect(articleFieldErrorLocale('translations[1].slug', ['ar'])).toBeNull()
  })

  it('passes a non-translation path straight through', () => {
    expect(articleFieldErrorName('publishAt', ['en', 'ar'])).toBe('publishAt')
    expect(articleFieldErrorName('categoryId', ['en', 'ar'])).toBe('categoryId')
    expect(articleFieldErrorLocale('publishAt', ['en', 'ar'])).toBeNull()
  })
})

describe('dirty tracking', () => {
  it('is clean immediately after seeding', () => {
    const saved = article()
    expect(isArticleFormDirty(initialArticleForm(saved), initialArticleForm(saved))).toBe(false)
  })

  it('notices a real edit in either locale', () => {
    const initial = initialArticleForm(article())
    const form = initialArticleForm(article())
    form.translations.ar.excerpt = 'تغيير'
    expect(isArticleFormDirty(form, initial)).toBe(true)
  })

  it('does NOT treat re-ordering the same tags as an edit', () => {
    const initial = initialArticleForm(article({ tagIds: ['t1', 't2'] }))
    const form = initialArticleForm(article({ tagIds: ['t2', 't1'] }))
    // Otherwise the unsaved guard challenges an operator who ticked a tag off and back on.
    expect(isArticleFormDirty(form, initial)).toBe(false)
  })

  it('notices a tag actually added', () => {
    const initial = initialArticleForm(article({ tagIds: ['t1'] }))
    const form = initialArticleForm(article({ tagIds: ['t1', 't2'] }))
    expect(isArticleFormDirty(form, initial)).toBe(true)
  })
})

describe('emptying a locale that is already saved is BLOCKED, not silently dropped', () => {
  it('names the cleared locale', () => {
    const saved = article()
    const form = initialArticleForm(saved)
    form.translations.ar = emptyArticleTranslationForm()
    // The PATCH upserts and never deletes, so omitting it would report success while the old
    // Arabic text stayed live on the public site.
    expect(articleClearedLocales(form, saved)).toEqual(['ar'])
  })

  it('is not triggered for a locale that never existed', () => {
    const saved = article({ translations: { en: translation() } })
    expect(articleClearedLocales(initialArticleForm(saved), saved)).toEqual([])
  })

  it('is not triggered when creating', () => {
    expect(articleClearedLocales(initialArticleForm(null), null)).toEqual([])
  })
})

describe('the Zod schema — one validation architecture', () => {
  const parse = (form: ArticleFormState, saved: AdminArticle | null = null) =>
    articleFormSchema(T, saved).safeParse(form)

  const paths = (result: ReturnType<typeof parse>) =>
    result.success ? [] : result.error.issues.map(i => i.path.join('.'))

  function draft(): ArticleFormState {
    const form = initialArticleForm(null)
    form.categoryId = 'c1'
    form.translations.en.title = 'T'
    form.translations.en.slug = 's'
    form.translations.en.excerpt = 'e'
    form.translations.en.body = 'b'
    return form
  }

  it('accepts a single-language draft — an article need not exist in both', () => {
    expect(parse(draft()).success).toBe(true)
  })

  it('requires a category', () => {
    const form = draft()
    form.categoryId = ''
    expect(paths(parse(form))).toContain('categoryId')
  })

  it('requires at least one language to be written', () => {
    expect(paths(parse(initialArticleForm(null))).some(p => p.startsWith('translations.'))).toBe(true)
  })

  it('demands COMPLETENESS only of a language being written', () => {
    const form = draft()
    form.translations.ar.title = 'عنوان' // started Arabic, nothing else
    const failed = paths(parse(form))
    expect(failed).toContain('translations.ar.slug')
    expect(failed).toContain('translations.ar.excerpt')
    expect(failed).toContain('translations.ar.body')
    // English is complete and must not be implicated.
    expect(failed.filter(p => p.startsWith('translations.en.'))).toEqual([])
  })

  it('does NOT demand a language nobody started', () => {
    expect(paths(parse(draft())).filter(p => p.startsWith('translations.ar.'))).toEqual([])
  })

  it('blocks emptying a language the server already has', () => {
    const saved = article()
    const form = initialArticleForm(saved)
    form.translations.ar = emptyArticleTranslationForm()
    expect(paths(parse(form, saved))).toContain('translations.ar.title')
  })

  it('requires a FUTURE publish date when SCHEDULED, and nothing when not', () => {
    const form = draft()
    form.status = 'SCHEDULED'
    expect(paths(parse(form))).toContain('publishAtLocal')

    form.publishAtLocal = articleIsoToPublishAtLocal('2020-01-01T00:00:00.000Z')
    expect(paths(parse(form))).toContain('publishAtLocal')

    form.publishAtLocal = articleIsoToPublishAtLocal('2099-01-01T00:00:00.000Z')
    expect(paths(parse(form))).not.toContain('publishAtLocal')

    // A DRAFT with a past date is fine — the rule belongs to SCHEDULED alone.
    form.status = 'DRAFT'
    form.publishAtLocal = articleIsoToPublishAtLocal('2020-01-01T00:00:00.000Z')
    expect(paths(parse(form))).not.toContain('publishAtLocal')
  })

  it('resolves its messages through the translator it is given', () => {
    const arabic = articleFormSchema(() => 'رسالة', null).safeParse(initialArticleForm(null))
    expect(arabic.success).toBe(false)
    if (!arabic.success) expect(arabic.error.issues[0]?.message).toBe('رسالة')
  })
})
