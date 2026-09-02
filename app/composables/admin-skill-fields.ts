import type { AdminSkill } from '~/composables/admin-project-types'

/**
 * Skills collection field rules. This file stays free of Zod so the collection route does not pay
 * for the editor schema; Articles measured a 6,211 B recovery from keeping the `*-fields.ts` /
 * `*-form.ts` boundary.
 */
export const SKILL_LOCALES = ['en', 'ar'] as const
export type SkillLocale = (typeof SKILL_LOCALES)[number]

/** `AdminSkillGroup`, not `SkillGroup`: the latter is already a Nuxt auto-import from resume.ts. */
export const ADMIN_SKILL_GROUPS = ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'] as const
export type AdminSkillGroup = (typeof ADMIN_SKILL_GROUPS)[number]

const present = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Completeness reads the locale-keyed map and never substitutes another locale. */
export function adminSkillHasTranslation(skill: AdminSkill, locale: SkillLocale): boolean {
  return present(skill.translations[locale]?.label)
}

export function adminSkillMissingLocales(skill: AdminSkill): SkillLocale[] {
  return SKILL_LOCALES.filter(locale => !adminSkillHasTranslation(skill, locale))
}

/**
 * Cross-locale fallback is allowed only to identify a collection row. Completeness remains visible
 * beside the label, while editors seed an absent locale empty and the picker keeps its stricter
 * slug fallback through `skillLabel`.
 */
export function adminSkillDisplayLabel(skill: AdminSkill, preferred: SkillLocale): string {
  const preferredLabel = skill.translations[preferred]?.label
  if (present(preferredLabel)) return preferredLabel
  const other = SKILL_LOCALES.find(locale => locale !== preferred)
  const otherLabel = other ? skill.translations[other]?.label : undefined
  return present(otherLabel) ? otherLabel : skill.slug
}
