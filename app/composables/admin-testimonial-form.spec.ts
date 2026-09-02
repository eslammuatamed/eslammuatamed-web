import { describe, expect, it } from 'vitest'
import {
  emptyTestimonialForm,
  initialTestimonialForm,
  isTestimonialFormDirty,
  isTestimonialTranslationComplete,
  testimonialCreatePayload,
  testimonialFormSchema,
  testimonialPayloadLocales,
  testimonialTranslationDtoSchema,
  testimonialTranslationFill,
  testimonialUpdatePayload,
  type TestimonialFormState
} from './admin-testimonial-form'

const T = (key: string) => key

const AR_COMPLETE = { quote: 'عمل ممتاز.', authorName: 'أمينة', authorRole: 'مديرة المنتج' }
const EN_COMPLETE = { quote: 'Excellent work.', authorName: 'Casey Jones', authorRole: 'COO, Acme' }

function form(over: Partial<TestimonialFormState> = {}): TestimonialFormState {
  return {
    ...emptyTestimonialForm(),
    translations: { en: EN_COMPLETE, ar: AR_COMPLETE },
    ...over
  }
}

function issues(schema: ReturnType<typeof testimonialFormSchema>, candidate: unknown) {
  const result = schema.safeParse(candidate)
  return result.success ? [] : result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
}

describe('the modeled translation contract', () => {
  it('accepts a two-letter lowercase locale and rejects everything else', () => {
    expect(testimonialTranslationDtoSchema.safeParse({
      locale: 'en', quote: 'Q', authorName: 'A', authorRole: 'R'
    }).success).toBe(true)
    for (const locale of ['EN', 'arb', 'e', '']) {
      expect(testimonialTranslationDtoSchema.safeParse({
        locale, quote: 'Q', authorName: 'A', authorRole: 'R'
      }).success, locale).toBe(false)
    }
  })

  it('enforces the API maximum lengths and non-empty text', () => {
    const valid = { locale: 'ar', quote: 'ق', authorName: 'ا', authorRole: 'ر' }
    expect(testimonialTranslationDtoSchema.safeParse({ ...valid, quote: 'q'.repeat(4000) }).success).toBe(true)
    expect(testimonialTranslationDtoSchema.safeParse({ ...valid, quote: 'q'.repeat(4001) }).success).toBe(false)
    expect(testimonialTranslationDtoSchema.safeParse({ ...valid, authorRole: 'r'.repeat(161) }).success).toBe(false)
    for (const field of ['quote', 'authorName', 'authorRole'] as const) {
      expect(testimonialTranslationDtoSchema.safeParse({ ...valid, [field]: '' }).success, field).toBe(false)
    }
  })
})

describe('the OD-14 minimum-translation rule, adapted to three required fields', () => {
  it('blocks a zero-translation save', () => {
    const found = issues(testimonialFormSchema(T), emptyTestimonialForm())
    expect(found).toContainEqual({
      path: 'translations',
      message: 'dashboard.testimonials.validation.atLeastOneLocale'
    })
  })

  it('accepts Arabic-first and English-first alike — no primary locale is privileged', () => {
    const arabicFirst = form({ translations: { en: emptyTestimonialForm().translations.en, ar: AR_COMPLETE } })
    const englishFirst = form({ translations: { en: EN_COMPLETE, ar: emptyTestimonialForm().translations.ar } })
    expect(issues(testimonialFormSchema(T), arabicFirst)).toEqual([])
    expect(issues(testimonialFormSchema(T), englishFirst)).toEqual([])
    expect(testimonialPayloadLocales(arabicFirst)).toEqual(['ar'])
    expect(testimonialPayloadLocales(englishFirst)).toEqual(['en'])
  })

  it('blocks a PARTIALLY written locale at each blank required field', () => {
    const partial = form({
      translations: {
        en: { quote: 'Written', authorName: '', authorRole: '' },
        ar: emptyTestimonialForm().translations.ar
      }
    })
    const paths = issues(testimonialFormSchema(T), partial).map(issue => issue.path)
    expect(paths).toContain('translations.en.authorName')
    expect(paths).toContain('translations.en.authorRole')
    expect(testimonialPayloadLocales(partial)).toEqual([])
  })

  it('reports one-locale completeness without substituting the other', () => {
    const one = form({ translations: { en: EN_COMPLETE, ar: emptyTestimonialForm().translations.ar } })
    expect(isTestimonialTranslationComplete(one)).toBe(false)
    expect(isTestimonialTranslationComplete(form())).toBe(true)
  })
})

describe('order validation', () => {
  it('blocks negative and fractional order before any request exists', () => {
    for (const order of [-1, -40, 2.75]) {
      const found = issues(testimonialFormSchema(T), form({ order }))
      expect(found.some(issue => issue.path === 'order'), String(order)).toBe(true)
    }
    expect(issues(testimonialFormSchema(T), form({ order: 0 }))).toEqual([])
    expect(issues(testimonialFormSchema(T), form({ order: 12 }))).toEqual([])
  })
})

describe('payload builders — create', () => {
  it('requires order, isVisible and the translations array; avatar defaults to explicit null', () => {
    const single = form({
      avatarId: null,
      translations: { en: EN_COMPLETE, ar: emptyTestimonialForm().translations.ar }
    })
    const payload = testimonialCreatePayload(single)
    expect(payload.order).toBe(0)
    expect(payload.isVisible).toBe(true)
    expect(payload.avatarId).toBeNull()
    expect(payload.translations).toEqual([
      { locale: 'en', quote: 'Excellent work.', authorName: 'Casey Jones', authorRole: 'COO, Acme' }
    ])
    expect(testimonialTranslationDtoSchema.safeParse(payload.translations[0]).success).toBe(true)
  })
})

describe('payload builders — update discriminates avatar omission from explicit null', () => {
  it('OMITS avatarId when untouched, so the server preserves the linked asset', () => {
    const initial = initialTestimonialForm({
      id: 't1',
      avatarId: '00000000-0000-4000-b300-000000000001',
      order: 3,
      isVisible: true,
      translations: { en: EN_COMPLETE, ar: AR_COMPLETE }
    })
    const edited = structuredClone(initial) satisfies TestimonialFormState
    edited.order = 9
    const body = testimonialUpdatePayload(edited, initial)
    expect(body).not.toHaveProperty('avatarId')
    expect(body.order).toBe(9)
  })

  it('sends EXPLICIT null only when the operator cleared a previously linked avatar', () => {
    const initial = initialTestimonialForm({
      id: 't1',
      avatarId: '00000000-0000-4000-b300-000000000001',
      order: 3,
      isVisible: true,
      translations: { en: EN_COMPLETE, ar: AR_COMPLETE }
    })
    const cleared = structuredClone(initial)
    cleared.avatarId = null
    expect(testimonialUpdatePayload(cleared, initial).avatarId).toBeNull()
  })

  it('sends the replacement id when a different asset is chosen', () => {
    const initial = initialTestimonialForm({
      id: 't1',
      avatarId: '00000000-0000-4000-b300-000000000001',
      order: 3,
      isVisible: true,
      translations: { en: EN_COMPLETE, ar: AR_COMPLETE }
    })
    const replaced = structuredClone(initial)
    replaced.avatarId = '00000000-0000-4000-b300-000000000003'
    expect(testimonialUpdatePayload(replaced, initial).avatarId)
      .toBe('00000000-0000-4000-b300-000000000003')
  })

  it('never sends a clear-all: the translations array is an upsert of complete locales only', () => {
    const initial = form()
    const edited = structuredClone(initial)
    edited.translations.en.quote = 'Edited.'
    const body = testimonialUpdatePayload(edited, initial)
    // Both complete locales are supplied (upsert rewrites them); nothing here could delete Arabic.
    expect(body.translations?.map(entry => entry.locale).sort()).toEqual(['ar', 'en'])
    expect(body.translations?.find(entry => entry.locale === 'en')?.quote).toBe('Edited.')
    // A locale cleared in the form drops out of the array — upsert PRESERVES it server-side rather
    // than replacing the whole set.
    const halfCleared = structuredClone(initial)
    halfCleared.translations.ar = emptyTestimonialForm().translations.ar
    expect(
      testimonialUpdatePayload(halfCleared, initial).translations?.map(entry => entry.locale)
    ).toEqual(['en'])
  })
})

describe('dirty tracking and tab fill', () => {
  it('detects edits against the loaded state', () => {
    const initial = initialTestimonialForm({
      id: 't1',
      avatarId: null,
      order: 2,
      isVisible: false,
      translations: { en: EN_COMPLETE, ar: AR_COMPLETE }
    })
    expect(isTestimonialFormDirty(structuredClone(initial), initial)).toBe(false)
    const edited = structuredClone(initial)
    edited.isVisible = true
    expect(isTestimonialFormDirty(edited, initial)).toBe(true)
  })

  it('reads each tab as empty, partial or complete from its own three fields', () => {
    expect(testimonialTranslationFill(emptyTestimonialForm().translations.en)).toBe('empty')
    expect(testimonialTranslationFill({ quote: 'Q', authorName: '', authorRole: '' })).toBe('partial')
    expect(testimonialTranslationFill(EN_COMPLETE)).toBe('complete')
  })
})
