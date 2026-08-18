import { describe, expect, it } from 'vitest'
import {
  EXPERIENCE_EMPLOYMENT_TYPES,
  EXPERIENCE_LOCALES,
  EXPERIENCE_REQUIRED_TRANSLATION_FIELDS,
  experienceDisplayCompany,
  experienceDisplayRole,
  experienceHasTranslation,
  experienceIsCurrent,
  experienceMissingLocales
} from './admin-experience-fields'
import type { AdminExperience, AdminExperienceTranslation } from './admin-experience-types'

function translation(over: Partial<AdminExperienceTranslation> = {}): AdminExperienceTranslation {
  return { role: 'Senior Frontend Engineer', company: 'Findropica', location: 'Cairo', impact: '- x', ...over }
}

function experience(over: Partial<AdminExperience> = {}): AdminExperience {
  return {
    id: 'e1',
    startDate: '2025-01-15T00:00:00.000Z',
    endDate: null,
    isCurrent: true,
    employmentType: 'FULL_TIME',
    order: 0,
    technologyIds: [],
    translations: { en: translation(), ar: translation({ role: 'مهندس واجهات أول', company: 'فايندروبيكا' }) },
    ...over
  }
}

describe('experienceHasTranslation', () => {
  it('is true only when the MAP holds the locale', () => {
    const enOnly = experience({ translations: { en: translation() } })
    expect(experienceHasTranslation(enOnly, 'en')).toBe(true)
    expect(experienceHasTranslation(enOnly, 'ar')).toBe(false)
  })

  it('treats a whitespace-only role or company as absent, not as authored', () => {
    expect(experienceHasTranslation(experience({ translations: { en: translation({ role: '   ' }) } }), 'en')).toBe(false)
    expect(experienceHasTranslation(experience({ translations: { en: translation({ company: '' }) } }), 'en')).toBe(false)
  })

  /**
   * The discriminating one: a helper that fell back to the other locale would report Arabic as
   * present for an English-only row, which is exactly the confusion the indicator exists to prevent.
   */
  it('never substitutes the other locale', () => {
    const enOnly = experience({ translations: { en: translation() } })
    expect(experienceMissingLocales(enOnly)).toEqual(['ar'])
  })
})

describe('experienceDisplayRole / experienceDisplayCompany', () => {
  it('prefers the operator language', () => {
    expect(experienceDisplayRole(experience(), 'ar', 'x')).toBe('مهندس واجهات أول')
    expect(experienceDisplayCompany(experience(), 'ar')).toBe('فايندروبيكا')
  })

  it('falls back across locales to IDENTIFY a row, which is the one place that is correct', () => {
    const enOnly = experience({ translations: { en: translation() } })
    expect(experienceDisplayRole(enOnly, 'ar', 'Untitled')).toBe('Senior Frontend Engineer')
    expect(experienceDisplayCompany(enOnly, 'ar')).toBe('Findropica')
  })

  it('uses the caller-supplied label when NO locale has a role, and null for no company', () => {
    const none = experience({ translations: {} })
    expect(experienceDisplayRole(none, 'en', 'Untitled role')).toBe('Untitled role')
    expect(experienceDisplayCompany(none, 'en')).toBeNull()
  })
})

describe('experienceIsCurrent', () => {
  /**
   * ⚠ THE DISCRIMINATING TEST FOR THIS HELPER.
   *
   * `isCurrent` and `endDate` can contradict each other, because the API enforces NO cross-field
   * rule — the mock backend accepts such a payload deliberately, and the real service does too.
   * A helper that re-derived currency from `endDate === null` would return `false` here and the
   * list would disagree with both the stored record and the order the server sorted by.
   */
  it('reads the stored flag even when endDate contradicts it', () => {
    expect(experienceIsCurrent(experience({ isCurrent: true, endDate: '2026-07-31T00:00:00.000Z' }))).toBe(true)
    expect(experienceIsCurrent(experience({ isCurrent: false, endDate: null }))).toBe(false)
  })
})

describe('the contract constants', () => {
  it('names all four REQUIRED translation fields — the shape that differs from Articles', () => {
    expect(EXPERIENCE_REQUIRED_TRANSLATION_FIELDS).toEqual(['role', 'company', 'location', 'impact'])
  })

  it('names the four employment types in contract order', () => {
    expect(EXPERIENCE_EMPLOYMENT_TYPES).toEqual(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'])
  })

  it('authors exactly the two locales', () => {
    expect(EXPERIENCE_LOCALES).toEqual(['en', 'ar'])
  })
})
