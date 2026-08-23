import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

/**
 * The admin Experiences module must not reach the public site (D06-1, doc 20 §5).
 *
 * The gate the Projects and Articles modules establish, applied to FE-3 module 1 — and it matters
 * MORE here than for either of them, because the name collision is closer than any so far:
 *
 *   PUBLIC   `app/pages/experience.vue`, `app/composables/useExperiences.ts`   (`GET /experiences`)
 *   ADMIN    `app/pages/dashboard/experiences/`, `useAdminExperiences.ts`      (`GET /admin/experiences`)
 *
 * Two composables one letter apart in intent and five in spelling, both auto-imported from the same
 * directory, both about the same entity. `useExperiences()` where `useAdminExperiences()` was meant
 * would leak the admin projection — every locale's translations, plus `technologyIds` — into a
 * public page; the reverse would quietly ship an unauthenticated call to an admin route. Neither
 * typechecks differently, and the `eslammuatamed/boundaries` ESLint rule matches on the path
 * `**\/dashboard/**`, so it cannot see either file.
 *
 * TEXT-BASED by design, following both existing gates: an auto-imported symbol has no import
 * statement to follow, so the NAME is the reference.
 *
 * What this does NOT prove is bytes — that is `size:routes` and `check-forbidden-modules.mjs`.
 */

const ROOT = process.cwd()
const APP = resolve(ROOT, 'app')

/** Every file this module owns. They are allowed to name themselves; nothing else is. */
const MODULE_FILES = [
  'composables/admin-experience-form.ts',
  'composables/admin-experience-fields.ts',
  'composables/admin-experience-types.ts',
  'composables/useAdminExperiences.ts',
  'pages/dashboard/experiences/index.vue'
]

/** Dashboard-only files belonging to ANOTHER dashboard module — not public, guarded by their own gates. */
const OTHER_DASHBOARD_MODULE_FILES = [
  'composables/admin-article-form.ts',
  'composables/admin-article-fields.ts',
  'composables/admin-article-types.ts',
  'composables/admin-articles-query.ts',
  'composables/useAdminArticles.ts',
  'composables/admin-project-form.ts',
  'composables/admin-project-types.ts',
  'composables/admin-projects-query.ts',
  'composables/useAdminProjects.ts',
  // FE-3 modules 2–3 and Taxonomy — registered for the same reason as every sibling above.
  'composables/admin-skill-fields.ts',
  'composables/admin-skill-form.ts',
  'composables/useAdminSkills.ts',
  'composables/useAdminSkill.ts',
  'composables/admin-testimonial-fields.ts',
  'composables/admin-testimonial-form.ts',
  'composables/admin-testimonial-types.ts',
  'composables/useAdminTestimonials.ts',
  'composables/admin-category-form.ts',
  'composables/admin-tag-form.ts',
  'composables/admin-taxonomy-fields.ts',
  'composables/useAdminCategories.ts',
  'composables/useAdminTags.ts',
  'composables/useAdminTaxonomy.ts',
  'composables/useAdminSkills.ts'
]

/**
 * The names a public file would have to mention to pull any of this in.
 *
 * ⚠ `useAdminExperiences` is listed, `useExperiences` is NOT — the latter is the legitimate PUBLIC
 * composable and appears in public pages by design. A substring check for `Experiences` alone would
 * flag the public page for using its own data source, which is the false positive that would get
 * this gate muted.
 */
const FORBIDDEN_REFERENCES = [
  'useAdminExperiences',
  'admin-experience-fields',
  'admin-experience-types',
  'EXPERIENCE_LOCALES',
  'EXPERIENCE_REQUIRED_TRANSLATION_FIELDS',
  'experienceHasTranslation',
  'experienceDisplayRole',
  // `M1·U3` — the editor's form model. Auto-imported like everything in `app/composables/`, so a
  // public page could name any of these with no import statement for a scanner to follow.
  'admin-experience-form',
  'initialExperienceForm',
  'experiencePayload',
  'experienceFormSchema',
  'DashboardExperienceEditor',
  'dashboard-experience-editor'
]

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full))
      continue
    }
    if (/\.(ts|vue)$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)) found.push(full)
  }
  return found
}

/** The public surface: everything under `app/`, minus the dashboard world and the module files. */
const publicFiles = sourceFiles(APP)
  .map(file => relative(APP, file).split('\\').join('/'))
  .filter(file => !file.includes('dashboard/'))
  .filter(file => !MODULE_FILES.includes(file))
  .filter(file => !OTHER_DASHBOARD_MODULE_FILES.includes(file))

describe('the admin Experiences module is invisible to the public surface', () => {
  it('scans a non-trivial number of public files, so a passing result is not vacuous', () => {
    expect(publicFiles.length).toBeGreaterThan(20)
  })

  /**
   * Positive control on the SCAN SET, and the nearest miss in the entire codebase: if the public
   * experience page ever stopped being scanned, the admin module could be referenced from the ONE
   * file most likely to do it and this gate would still be green.
   */
  it('actually sees the public experience page and its composable', () => {
    expect(publicFiles).toContain('pages/experience.vue')
    expect(publicFiles).toContain('composables/useExperiences.ts')
  })

  it('finds no public file that names any part of the module', () => {
    const offenders: string[] = []
    for (const file of publicFiles) {
      const source = readFileSync(join(APP, file), 'utf8')
      for (const reference of FORBIDDEN_REFERENCES) {
        if (source.includes(reference)) offenders.push(`${file} → ${reference}`)
      }
    }
    expect(offenders).toEqual([])
  })

  /**
   * The discriminating direction: the public page must still use the PUBLIC composable. A gate that
   * only forbade the admin name would pass just as well against a public page that had been
   * gutted — so this asserts what the page SHOULD say, not only what it must not.
   */
  it('keeps the public experience page on the PUBLIC composable', () => {
    const source = readFileSync(join(APP, 'pages/experience.vue'), 'utf8')
    expect(source).toContain('useExperiences')
    expect(source).not.toContain('useAdminExperiences')
  })
})
