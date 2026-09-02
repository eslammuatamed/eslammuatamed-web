import { describe, expect, it } from 'vitest'
import {
  TESTIMONIAL_LOCALES,
  testimonialDisplayAuthor,
  testimonialDisplayQuote,
  testimonialHasTranslation,
  testimonialMissingLocales
} from './admin-testimonial-fields'
import type { AdminTestimonial } from './admin-testimonial-types'

const EN = { quote: 'Dependable work.', authorName: 'Alex Morgan', authorRole: 'CTO, Northstar' }
const AR = { quote: 'عمل يمكن الاعتماد عليه.', authorName: 'أليكس مورغان', authorRole: 'المدير التقني، نورث ستار' }

function testimonial(over: Partial<AdminTestimonial> = {}): AdminTestimonial {
  return {
    id: 't1',
    avatarId: null,
    order: 0,
    isVisible: true,
    translations: { en: EN, ar: AR },
    ...over
  }
}

describe('testimonialHasTranslation', () => {
  it('reads completeness from the locale-keyed map, never by substitution', () => {
    const row = testimonial({ translations: { ar: AR } })
    expect(testimonialHasTranslation(row, 'ar')).toBe(true)
    expect(testimonialHasTranslation(row, 'en')).toBe(false)
  })

  it('treats whitespace-only fields as absent', () => {
    const row = testimonial({ translations: { en: { quote: '   ', authorName: 'A', authorRole: 'R' } } })
    expect(testimonialHasTranslation(row, 'en')).toBe(false)
  })

  it('requires the fields the row shows — a name without a quote is not a translation', () => {
    const row = testimonial({ translations: { en: { quote: '', authorName: 'Alex', authorRole: 'CTO' } } })
    expect(testimonialHasTranslation(row, 'en')).toBe(false)
  })
})

describe('testimonialMissingLocales', () => {
  it('reports exactly the locales the map does not hold', () => {
    expect(testimonialMissingLocales(testimonial({ translations: { en: EN } }))).toEqual(['ar'])
    expect(testimonialMissingLocales(testimonial())).toEqual([])
  })
})

describe('testimonialDisplayAuthor', () => {
  it('prefers the requested locale', () => {
    expect(testimonialDisplayAuthor(testimonial(), 'en', 'Untitled')).toBe('Alex Morgan')
    expect(testimonialDisplayAuthor(testimonial(), 'ar', 'Untitled')).toBe('أليكس مورغان')
  })

  it('falls back across locales only to identify a row', () => {
    const row = testimonial({ translations: { en: EN } })
    expect(testimonialDisplayAuthor(row, 'ar', 'Untitled')).toBe('Alex Morgan')
  })

  it('uses the neutral label when neither locale names an author', () => {
    const row = testimonial({ translations: {} })
    expect(testimonialDisplayAuthor(row, 'en', 'Untitled testimonial')).toBe('Untitled testimonial')
  })
})

describe('testimonialDisplayQuote', () => {
  it('returns null rather than inventing a placeholder when neither locale has a quote', () => {
    expect(testimonialDisplayQuote(testimonial({ translations: {} }), 'en')).toBeNull()
  })

  it('reads the preferred locale first and the other only for recognition', () => {
    expect(testimonialDisplayQuote(testimonial(), 'ar')).toBe(AR.quote)
    expect(testimonialDisplayQuote(testimonial({ translations: { en: EN } }), 'ar')).toBe(EN.quote)
  })
})

describe('the module boundary', () => {
  it('declares exactly the two authored locales under the testimonial prefix', () => {
    expect(TESTIMONIAL_LOCALES).toEqual(['en', 'ar'])
  })
})
