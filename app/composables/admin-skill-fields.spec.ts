import { describe, expect, it } from 'vitest'
import {
  ADMIN_SKILL_GROUPS,
  SKILL_LOCALES,
  adminSkillDisplayLabel,
  adminSkillHasTranslation,
  adminSkillMissingLocales
} from './admin-skill-fields'
import type { AdminSkill } from './admin-project-types'

function skill(over: Partial<AdminSkill> = {}): AdminSkill {
  return {
    id: 's1',
    slug: 'typescript',
    group: 'LANGUAGE',
    order: -1.25,
    brandColor: 'not-limited-to-hex',
    isPublic: true,
    translations: { en: { label: 'TypeScript' }, ar: { label: 'تايب سكربت' } },
    ...over
  }
}

describe('translation completeness', () => {
  it('reports the missing locale without cross-locale substitution', () => {
    const enOnly = skill({ translations: { en: { label: 'TypeScript' } } })
    expect(adminSkillHasTranslation(enOnly, 'en')).toBe(true)
    expect(adminSkillHasTranslation(enOnly, 'ar')).toBe(false)
    expect(adminSkillMissingLocales(enOnly)).toEqual(['ar'])
  })

  it('treats a whitespace-only label as absent', () => {
    expect(adminSkillHasTranslation(skill({ translations: { ar: { label: '   ' } } }), 'ar')).toBe(false)
  })
})

describe('collection row identity', () => {
  it('prefers the dashboard locale, then another authored label, then the neutral slug', () => {
    expect(adminSkillDisplayLabel(skill(), 'ar')).toBe('تايب سكربت')
    expect(adminSkillDisplayLabel(skill({ translations: { en: { label: 'TypeScript' } } }), 'ar')).toBe('TypeScript')
    expect(adminSkillDisplayLabel(skill({ translations: {} }), 'ar')).toBe('typescript')
  })
})

describe('contract constants', () => {
  it('carries exactly the configured locales and the four API groups', () => {
    expect(SKILL_LOCALES).toEqual(['en', 'ar'])
    expect(ADMIN_SKILL_GROUPS).toEqual(['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'])
  })
})
