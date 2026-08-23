import { describe, expect, it } from 'vitest'
import {
  REQUIRED_TRANSLATION_FIELDS,
  buildProjectPayload,
  changedSlugLocales,
  emptyTranslationForm,
  hasBlockingError,
  hasTranslation,
  initialProjectForm,
  isProjectFormDirty,
  newGalleryItem,
  translationFillState,
  validateProjectForm,
  type ProjectFormState,
  type ProjectTranslationForm
} from './admin-project-form'
import type { AdminProject, AdminProjectTranslation, CreateProjectPayload } from './admin-project-types'

/**
 * The editor's rules, proved without a runtime.
 *
 * These are the decisions that publish content to a live bilingual site: which locales get written,
 * whether a save changes publication, and what "cleared" means. A rendered test can prove the page
 * calls these; only this can prove they are right.
 */

function translation(over: Partial<AdminProjectTranslation> = {}): AdminProjectTranslation {
  return {
    title: 'Content platform API',
    slug: 'content-platform-api',
    summary: 'A summary.',
    overview: 'Overview.',
    businessProblem: 'Problem.',
    solution: 'Solution.',
    role: 'Role.',
    architecture: 'Architecture.',
    challenges: 'Challenges.',
    features: 'Features.',
    lessonsLearned: 'Lessons.',
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    ...over
  }
}

function project(over: Partial<AdminProject> = {}): AdminProject {
  return {
    id: 'p1',
    featured: false,
    isPublished: true,
    order: 3,
    liveUrl: 'https://example.com',
    repoUrl: null,
    year: 2026,
    technologyIds: ['skill-a', 'skill-b'],
    gallery: [],
    translations: { en: translation(), ar: translation({ title: 'منصة المحتوى', slug: 'mnst-almhtwa' }) },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...over
  }
}

function completeForm(over: Partial<ProjectTranslationForm> = {}): ProjectTranslationForm {
  const filled = { ...emptyTranslationForm() }
  for (const field of REQUIRED_TRANSLATION_FIELDS) filled[field] = `${field} value`
  return { ...filled, ...over }
}

describe('seeding — a missing translation stays MISSING', () => {
  it('seeds a new project unpublished and unfeatured', () => {
    // The only safe default for a surface that publishes to a live site: the operator opts IN to
    // visibility, never out of it.
    const form = initialProjectForm(null)
    expect(form.isPublished).toBe(false)
    expect(form.featured).toBe(false)
    expect(form.order).toBe(0)
  })

  /**
   * THE TRAP FIXTURE. English is fully written and Arabic does not exist at all — so a seeder with
   * any cross-locale fallback would put English prose in the Arabic boxes, and the next save would
   * publish it under the Arabic URL.
   */
  it('leaves EVERY Arabic field empty when the project has no Arabic translation', () => {
    const form = initialProjectForm(project({ translations: { en: translation() } }))
    expect(form.translations.en.title).toBe('Content platform API')
    for (const field of REQUIRED_TRANSLATION_FIELDS) {
      expect(form.translations.ar[field], `ar.${field} must not be seeded`).toBe('')
    }
  })

  it('maps the nullable columns onto empty boxes rather than the string "null"', () => {
    const form = initialProjectForm(project({ liveUrl: null, repoUrl: null, year: null }))
    expect(form.liveUrl).toBe('')
    expect(form.repoUrl).toBe('')
    expect(form.year).toBe('')
  })

  it('sorts the gallery by the API\'s order, so the array index can become `order` on the way out', () => {
    const form = initialProjectForm(project({
      gallery: [
        { id: 'g2', mediaAssetId: 'm2', order: 1, translations: {} },
        { id: 'g1', mediaAssetId: 'm1', order: 0, translations: { en: { caption: 'First' } } }
      ]
    }))
    expect(form.gallery.map(item => item.mediaAssetId)).toEqual(['m1', 'm2'])
    expect(form.gallery[0]?.captions.en).toBe('First')
    expect(form.gallery[1]?.captions.en).toBe('')
  })
})

describe('translation completeness — the list column', () => {
  it('counts a locale the translation map does not hold as missing', () => {
    const onlyEnglish = project({ translations: { en: translation() } })
    expect(hasTranslation(onlyEnglish, 'en')).toBe(true)
    expect(hasTranslation(onlyEnglish, 'ar')).toBe(false)
  })

  it('counts a map entry with a blank title or slug as missing, not as a translation', () => {
    const hollow = project({ translations: { en: translation({ title: '   ' }), ar: translation({ slug: '' }) } })
    expect(hasTranslation(hollow, 'en')).toBe(false)
    expect(hasTranslation(hollow, 'ar')).toBe(false)
  })

  it('counts both when both are written', () => {
    expect(hasTranslation(project(), 'en')).toBe(true)
    expect(hasTranslation(project(), 'ar')).toBe(true)
  })
})

describe('fill state — what the operator has typed', () => {
  it('is `empty` for an untouched locale', () => {
    expect(translationFillState(emptyTranslationForm())).toBe('empty')
  })

  it('is `complete` only when all eleven required fields are filled', () => {
    expect(translationFillState(completeForm())).toBe('complete')
    expect(translationFillState(completeForm({ lessonsLearned: '' }))).toBe('partial')
    expect(translationFillState(completeForm({ role: '   ' }))).toBe('partial')
  })

  it('is `partial` when ONLY an optional SEO field was touched', () => {
    // Otherwise the locale would read as empty and be dropped, discarding what the operator typed.
    expect(translationFillState({ ...emptyTranslationForm(), metaDescription: 'A description' })).toBe('partial')
    expect(translationFillState({ ...emptyTranslationForm(), ogImageId: 'asset-1' })).toBe('partial')
  })
})

describe('validation — a half-typed language is never silently dropped', () => {
  const form = (over: Partial<ProjectFormState> = {}): ProjectFormState => ({
    ...initialProjectForm(null),
    translations: { en: completeForm(), ar: emptyTranslationForm() },
    ...over
  })

  it('accepts one complete language and one deliberately empty one', () => {
    const errors = validateProjectForm(form(), null)
    expect(hasBlockingError(errors)).toBe(false)
  })

  it('BLOCKS a partly written language and names the fields still empty', () => {
    const errors = validateProjectForm(form({
      translations: { en: completeForm(), ar: { ...emptyTranslationForm(), title: 'عنوان' } }
    }), null)
    expect(errors.partialLocales).toEqual(['ar'])
    expect(errors.missingFields.ar).toContain('slug')
    expect(errors.missingFields.ar).not.toContain('title')
    expect(hasBlockingError(errors)).toBe(true)
  })

  it('BLOCKS a save with no complete language at all', () => {
    const errors = validateProjectForm(form({
      translations: { en: emptyTranslationForm(), ar: emptyTranslationForm() }
    }), null)
    expect(errors.noTranslation).toBe(true)
    expect(hasBlockingError(errors)).toBe(true)
  })

  /**
   * The endpoint upserts translations per locale (verified in the API service — a `upsert` per
   * payload locale, no `deleteMany`), so a locale left out is untouched rather than deleted.
   * Sending this save would therefore report success while the Arabic case study stayed exactly
   * where it was. Refusing says what is true: this screen cannot delete a translation.
   */
  it('BLOCKS emptying a language the server has saved', () => {
    const saved = project()
    const errors = validateProjectForm(form({
      translations: { en: completeForm(), ar: emptyTranslationForm() }
    }), saved)
    expect(errors.clearedLocales).toEqual(['ar'])
    expect(hasBlockingError(errors)).toBe(true)
  })

  it('does NOT treat a never-saved empty language as cleared', () => {
    const saved = project({ translations: { en: translation() } })
    const errors = validateProjectForm(form(), saved)
    expect(errors.clearedLocales).toEqual([])
    expect(hasBlockingError(errors)).toBe(false)
  })

  it('BLOCKS a gallery row with no image, naming its position', () => {
    const errors = validateProjectForm(form({
      gallery: [{ ...newGalleryItem(), mediaAssetId: 'm1' }, newGalleryItem()]
    }), null)
    expect(errors.galleryWithoutAsset).toEqual([1])
    expect(hasBlockingError(errors)).toBe(true)
  })

  it('BLOCKS a non-integer year or order, and accepts an EMPTY year', () => {
    expect(validateProjectForm(form({ year: '20x6' }), null).invalidYear).toBe(true)
    expect(validateProjectForm(form({ year: '' }), null).invalidYear).toBe(false)
    expect(validateProjectForm(form({ year: '2026' }), null).invalidYear).toBe(false)
    expect(validateProjectForm(form({ order: Number.NaN }), null).invalidOrder).toBe(true)
  })
})

describe('the payload — publication is always stated, never inferred', () => {
  const base = (over: Partial<ProjectFormState> = {}): ProjectFormState => ({
    ...initialProjectForm(null),
    translations: { en: completeForm(), ar: emptyTranslationForm() },
    ...over
  })

  /**
   * Publication is a decision this form owns and states on screen before the save, so the switch,
   * the notice and the payload all say the same thing. (Omitting the field would also be safe —
   * the API's `isPublished` is `@IsOptional()` with no runtime default — but a request whose shape
   * changes with what was touched is harder to reason about than one that always states it.)
   */
  it('SENDS isPublished on every save, in both states', () => {
    expect(buildProjectPayload(base({ isPublished: false }))).toHaveProperty('isPublished', false)
    expect(buildProjectPayload(base({ isPublished: true }))).toHaveProperty('isPublished', true)
  })

  it('carries the featured flag and the order as the form holds them', () => {
    const payload = buildProjectPayload(base({ featured: true, order: 7 }))
    expect(payload.featured).toBe(true)
    expect(payload.order).toBe(7)
  })

  it('sends NULL, not an omission, for an emptied live or repository URL', () => {
    // These are nullable columns: an operator who cleared the box means "there is no live URL",
    // which the API has to be told rather than left to guess.
    const payload = buildProjectPayload(base({ liveUrl: '', repoUrl: '  ' }))
    expect(payload.liveUrl).toBeNull()
    expect(payload.repoUrl).toBeNull()
  })

  it('sends the trimmed URLs when they are filled', () => {
    const payload = buildProjectPayload(base({ liveUrl: ' https://example.com ', repoUrl: 'https://github.com/x/y' }))
    expect(payload.liveUrl).toBe('https://example.com')
    expect(payload.repoUrl).toBe('https://github.com/x/y')
  })

  it('sends a null year for an empty box and a number for a filled one', () => {
    expect(buildProjectPayload(base({ year: '' })).year).toBeNull()
    expect(buildProjectPayload(base({ year: '2026' })).year).toBe(2026)
  })

  it('sends ONLY the complete languages, and sends ALL of them', () => {
    // Both, not just the edited one: correct under a per-locale upsert AND under a whole-set
    // replace, so the client does not depend on which the API implements.
    const both = buildProjectPayload(base({ translations: { en: completeForm(), ar: completeForm() } }))
    expect(both.translations.map(t => t.locale)).toEqual(['en', 'ar'])

    const one = buildProjectPayload(base())
    expect(one.translations.map(t => t.locale)).toEqual(['en'])
  })

  it('omits blank optional SEO fields on a CREATE, where there is nothing stored to clear', () => {
    // No baseline → create semantics: an absent field starts unset either way, so omission and
    // explicit `null` are indistinguishable to the API here.
    const payload = buildProjectPayload(base())
    expect(payload.translations[0]).not.toHaveProperty('metaTitle')
    expect(payload.translations[0]).not.toHaveProperty('canonicalUrl')
    expect(payload.translations[0]).not.toHaveProperty('ogImageId')
  })

  it('sends the optional SEO fields on a CREATE when they are filled', () => {
    const payload = buildProjectPayload(base({
      translations: {
        en: completeForm({ metaTitle: 'Meta', canonicalUrl: 'https://example.com/x', ogImageId: 'asset-9' }),
        ar: emptyTranslationForm()
      }
    }))
    expect(payload.translations[0]).toMatchObject({
      metaTitle: 'Meta',
      canonicalUrl: 'https://example.com/x',
      ogImageId: 'asset-9'
    })
  })

  it('numbers the gallery from the ARRAY, and nulls a blank caption', () => {
    const payload = buildProjectPayload(base({
      gallery: [
        { key: 'a', mediaAssetId: 'm1', captions: { en: 'First', ar: '' } },
        { key: 'b', mediaAssetId: 'm2', captions: { en: '', ar: 'ثانٍ' } }
      ]
    }))
    expect(payload.gallery.map(item => [item.mediaAssetId, item.order])).toEqual([['m1', 0], ['m2', 1]])
    expect(payload.gallery[0]?.translations.en?.caption).toBe('First')
    expect(payload.gallery[0]?.translations.ar?.caption).toBeNull()
    expect(payload.gallery[1]?.translations.ar?.caption).toBe('ثانٍ')
  })

  it('sends the technology set as the form holds it — the API replaces the relation with it', () => {
    expect(buildProjectPayload(base({ technologyIds: ['s1', 's2'] })).technologyIds).toEqual(['s1', 's2'])
    expect(buildProjectPayload(base({ technologyIds: [] })).technologyIds).toEqual([])
  })
})

/**
 * The D10-23 three-state rule over the four optional SEO fields, decided by ORIGINAL-vs-CURRENT.
 *
 * This is the suite that pins the defect the SEO investigation found: the pre-campaign builder
 * omitted blank values unconditionally, so an operator could never clear a stored SEO value —
 * the PATCH reported success while the server kept everything. Each clear-case here fails against
 * that omission-on-clear behavior (proven by negative controls A/B below in the ledger record).
 */
describe('PATCH SEO fields — omitted when untouched, null when cleared', () => {
  const saved = project({
    translations: {
      en: translation({
        metaTitle: 'Held title',
        metaDescription: 'Held description',
        canonicalUrl: 'https://held.example.com/en',
        ogImageId: 'asset-held-en'
      }),
      ar: translation({
        title: 'منصة المحتوى',
        slug: 'mnst-almhtwa',
        metaTitle: 'عنوان محفوظ',
        // Arabic holds NO meta description and NO OG image server-side — the already-empty case.
        metaDescription: null,
        canonicalUrl: 'https://held.example.com/ar',
        ogImageId: null
      })
    }
  })

  const patch = (mutate: (form: ProjectFormState) => void): CreateProjectPayload => {
    const form = initialProjectForm(saved)
    mutate(form)
    return buildProjectPayload(form, initialProjectForm(saved))
  }

  const entryFor = (payload: CreateProjectPayload, locale: string) =>
    payload.translations.find(item => item.locale === locale)

  it('omits an UNTOUCHED populated SEO set — preservation needs no wire presence', () => {
    const en = entryFor(patch((form) => { form.translations.en.summary = 'Edited summary.' }), 'en')
    expect(en).not.toHaveProperty('metaTitle')
    expect(en).not.toHaveProperty('metaDescription')
    expect(en).not.toHaveProperty('canonicalUrl')
    expect(en).not.toHaveProperty('ogImageId')
  })

  it('sends explicit NULL for a meta title the operator cleared, and the new string for a changed one', () => {
    const cleared = patch((form) => { form.translations.en.metaTitle = '' })
    expect(entryFor(cleared, 'en')).toHaveProperty('metaTitle', null)

    const whitespace = patch((form) => { form.translations.en.metaTitle = '   ' })
    expect(entryFor(whitespace, 'en')).toHaveProperty('metaTitle', null)

    const changed = patch((form) => { form.translations.en.metaTitle = 'Next title' })
    expect(entryFor(changed, 'en')).toHaveProperty('metaTitle', 'Next title')
  })

  it('sends explicit NULL for a cleared meta description, and the new string for a changed one', () => {
    const cleared = patch((form) => { form.translations.en.metaDescription = '' })
    expect(entryFor(cleared, 'en')).toHaveProperty('metaDescription', null)

    const changed = patch((form) => { form.translations.en.metaDescription = 'Next description' })
    expect(entryFor(changed, 'en')).toHaveProperty('metaDescription', 'Next description')
  })

  it('sends explicit NULL for a cleared canonical URL, and the new string for a changed one', () => {
    const cleared = patch((form) => { form.translations.en.canonicalUrl = '' })
    expect(entryFor(cleared, 'en')).toHaveProperty('canonicalUrl', null)

    const changed = patch((form) => { form.translations.en.canonicalUrl = 'https://next.example.com' })
    expect(entryFor(changed, 'en')).toHaveProperty('canonicalUrl', 'https://next.example.com')
  })

  it('omits an untouched held OG image, sends NULL for a cleared one, and the NEW id for a replaced one', () => {
    const untouched = patch(() => {})
    expect(entryFor(untouched, 'en')).not.toHaveProperty('ogImageId')

    const cleared = patch((form) => { form.translations.en.ogImageId = null })
    expect(entryFor(cleared, 'en')).toHaveProperty('ogImageId', null)

    const replaced = patch((form) => { form.translations.en.ogImageId = 'asset-next' })
    expect(entryFor(replaced, 'en')).toHaveProperty('ogImageId', 'asset-next')
  })

  it('omits an ALREADY-EMPTY field left alone, without inventing a null for it', () => {
    // Arabic holds no meta description and no OG image server-side; leaving them alone must not
    // manufacture clears for values that do not exist.
    const ar = entryFor(patch((form) => { form.translations.ar.summary = 'ملخص معدّل.' }), 'ar')
    expect(ar).not.toHaveProperty('metaDescription')
    expect(ar).not.toHaveProperty('ogImageId')
  })

  it('clearing ENGLISH SEO leaves the untouched ARABIC SEO out of the payload entirely', () => {
    const payload = patch((form) => {
      form.translations.en.metaTitle = ''
      form.translations.en.metaDescription = ''
      form.translations.en.canonicalUrl = ''
      form.translations.en.ogImageId = null
    })
    // Both locales are complete so both entries travel; only their SEO keys differ.
    expect(payload.translations.map(item => item.locale)).toEqual(['en', 'ar'])

    const en = entryFor(payload, 'en')
    expect(en).toHaveProperty('metaTitle', null)
    expect(en).toHaveProperty('metaDescription', null)
    expect(en).toHaveProperty('canonicalUrl', null)
    expect(en).toHaveProperty('ogImageId', null)

    // Arabic's HELD meta title and canonical URL are untouched → omitted → server preserves them.
    const ar = entryFor(payload, 'ar')
    expect(ar).not.toHaveProperty('metaTitle')
    expect(ar).not.toHaveProperty('canonicalUrl')
    expect(ar?.title).toBe('منصة المحتوى')
    expect(ar?.slug).toBe('mnst-almhtwa')
  })

  it('clearing ARABIC SEO produces the correct Arabic entry while English stays omission-clean', () => {
    const payload = patch((form) => {
      form.translations.ar.canonicalUrl = ''
      form.translations.ar.metaTitle = 'عنوان جديد'
    })
    const ar = entryFor(payload, 'ar')
    expect(ar).toHaveProperty('canonicalUrl', null)
    expect(ar).toHaveProperty('metaTitle', 'عنوان جديد')

    const en = entryFor(payload, 'en')
    expect(en).not.toHaveProperty('metaTitle')
    expect(en).not.toHaveProperty('canonicalUrl')
    expect(en).not.toHaveProperty('ogImageId')
  })

  it('a locale with no SEO edits keeps every SEO key absent — nothing is resent or nulled wholesale', () => {
    const payload = patch((form) => { form.order = 9 })
    for (const locale of ['en', 'ar']) {
      const entry = entryFor(payload, locale)
      expect(entry).not.toHaveProperty('metaTitle')
      expect(entry).not.toHaveProperty('metaDescription')
      expect(entry).not.toHaveProperty('canonicalUrl')
      expect(entry).not.toHaveProperty('ogImageId')
    }
  })
})

describe('slug changes on a published project (D04-6)', () => {
  it('names only the locales whose slug actually moved', () => {
    const saved = project()
    const form = initialProjectForm(saved)
    form.translations.en.slug = 'content-platform'
    expect(changedSlugLocales(form, saved)).toEqual(['en'])
  })

  it('names both when both moved', () => {
    const saved = project()
    const form = initialProjectForm(saved)
    form.translations.en.slug = 'a'
    form.translations.ar.slug = 'b'
    expect(changedSlugLocales(form, saved)).toEqual(['en', 'ar'])
  })

  it('is empty while creating, and ignores a locale that had no slug to begin with', () => {
    expect(changedSlugLocales(initialProjectForm(null), null)).toEqual([])
    const saved = project({ translations: { en: translation() } })
    const form = initialProjectForm(saved)
    form.translations.ar.slug = 'new-arabic-slug'
    expect(changedSlugLocales(form, saved)).toEqual([])
  })
})

describe('dirty tracking', () => {
  it('reports a freshly seeded form as clean', () => {
    const saved = project()
    expect(isProjectFormDirty(initialProjectForm(saved), initialProjectForm(saved))).toBe(false)
  })

  it('notices a content edit, a publication change and a reorder', () => {
    const saved = project({ gallery: [
      { id: 'g1', mediaAssetId: 'm1', order: 0, translations: {} },
      { id: 'g2', mediaAssetId: 'm2', order: 1, translations: {} }
    ] })
    const initial = initialProjectForm(saved)

    const edited = initialProjectForm(saved)
    edited.translations.ar.summary = 'ملخص جديد'
    expect(isProjectFormDirty(edited, initial)).toBe(true)

    const published = initialProjectForm(saved)
    published.isPublished = !published.isPublished
    expect(isProjectFormDirty(published, initial)).toBe(true)

    const reordered = initialProjectForm(saved)
    reordered.gallery = [...reordered.gallery].reverse()
    expect(isProjectFormDirty(reordered, initial)).toBe(true)
  })

  it('does NOT treat a re-ticked technology as a change — the selection is a set', () => {
    const saved = project()
    const initial = initialProjectForm(saved)
    const shuffled = initialProjectForm(saved)
    shuffled.technologyIds = [...shuffled.technologyIds].reverse()
    expect(isProjectFormDirty(shuffled, initial)).toBe(false)
  })
})
