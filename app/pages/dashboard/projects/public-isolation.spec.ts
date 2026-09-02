import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

/**
 * The Projects module must not reach the public site (D06-1, doc 20 §5).
 *
 * ── WHAT THIS TEST PROVES, AND WHAT IT DOES NOT ─────────────────────────────────────────────────
 *
 * It proves that NO file on the public surface REFERENCES this module — not by import, not by
 * auto-imported component tag, not by symbol name. That is a static source guarantee, and it is the
 * honest limit of what a unit test can assert: it does not read a built bundle, so it is not by
 * itself proof about bytes.
 *
 * The byte-level guarantee is measured elsewhere and deliberately not duplicated here:
 *   - `npm run size:routes` resolves each PUBLIC route's asset set from its rendered HTML and each
 *     DASHBOARD route's closure from Rollup provenance, so a chunk crossing the line shows up as
 *     bytes on a route that should not have them;
 *   - `scripts/check-forbidden-modules.mjs` scans the built public chunks for editor-weight
 *     dependencies;
 *   - the `eslammuatamed/boundaries` ESLint rule bans a public file from importing `**\/dashboard/**`.
 *
 * This one closes the gap those three leave. The composables this module adds live in
 * `app/composables/`, NOT under a `dashboard/` directory — the same placement as `useAdminSettings`
 * and `useMediaLibrary` — so the ESLint path rule cannot see them, and Nuxt auto-imports that whole
 * directory. A public page could therefore call `useAdminProjects()` with no import statement at
 * all and no existing gate would say a word until someone read a bundle report. This does.
 *
 * Deliberately TEXT-BASED rather than import-graph based: an auto-imported symbol has no import
 * statement to follow, so the name IS the reference. (This used to cite
 * `scripts/e2e/lane-isolation.spec.mjs` as the precedent. That gate now asserts against the typed lane
 * registry rather than the config's text, so the citation was removed rather than left to read as a
 * description of something that changed — the reason above never depended on it.)
 */

const ROOT = process.cwd()
const APP = resolve(ROOT, 'app')

/** Every file this module owns. They are allowed to name themselves; nothing else is. */
const MODULE_FILES = [
  'composables/admin-project-form.ts',
  'composables/admin-project-types.ts',
  'composables/admin-projects-query.ts',
  'composables/useAdminProjects.ts',
  'composables/useAdminSkills.ts',
  'components/dashboard/ProjectEditor.vue',
  'components/dashboard/ProjectGalleryEditor.vue',
  'components/dashboard/SkillPicker.vue',
  'components/dashboard/ProjectTranslationFields.vue',
  'pages/dashboard/projects/index.vue',
  'pages/dashboard/projects/new.vue',
  'pages/dashboard/projects/[id].vue'
]

/**
 * The names a public file would have to mention to pull any of this in — the auto-imported
 * composables, the module specifiers, and the auto-imported component tags in both the PascalCase
 * and the kebab-case spelling a template may use.
 */
const FORBIDDEN_REFERENCES = [
  'useAdminProjects',
  'useAdminProject',
  'useAdminSkills',
  'admin-project-form',
  'admin-project-types',
  'admin-projects-query',
  'parseAdminProjectsQuery',
  'adminProjectsRequestQuery',
  'buildProjectPayload',
  'initialProjectForm',
  'validateProjectForm',
  'DashboardProjectEditor',
  'DashboardProjectGalleryEditor',
  'DashboardSkillPicker',
  'DashboardProjectTranslationFields',
  'dashboard-project-editor',
  'dashboard-project-gallery-editor',
  'dashboard-skill-picker',
  'dashboard-project-translation-fields'
]

/**
 * Dashboard-only files belonging to ANOTHER dashboard module.
 *
 * These are the Articles module's composables. They are not public surface — they live in
 * `app/composables/` for the same reason this module's do, and they are guarded by their own
 * `pages/dashboard/articles/public-isolation.spec.ts` exactly as these files are guarded here.
 *
 * They are excluded because they legitimately NAME this module in PROSE: Articles was written
 * against Projects as its precedent, and its comments cite `admin-project-form.ts`,
 * `useAdminProjects` and `useAdminSkills` to explain what it copied and what it deliberately did
 * differently. This gate is text-based by design (an auto-imported symbol has no import statement
 * to follow), so it cannot tell a citation from a call — and deleting the citations to satisfy it
 * would trade real explanation for a green scan. Their own gate is what keeps them honest.
 */
const OTHER_DASHBOARD_MODULE_FILES = [
  // FE-3 module 1 (Experiences). Registered for the same reason the Projects files above
  // are: `app/composables/` holds dashboard modules too, and the scan's public set is defined by
  // PATH, so an unregistered dashboard composable is treated as public surface.
  'composables/admin-experience-form.ts',
  'composables/admin-experience-fields.ts',
  'composables/admin-experience-types.ts',
  'composables/useAdminExperiences.ts',
  'composables/admin-article-form.ts',
  'composables/admin-article-fields.ts',
  'composables/admin-article-types.ts',
  'composables/admin-articles-query.ts',
  'composables/useAdminArticles.ts',
  // FE-3 modules 2–3 and Taxonomy — registered for the same reason as every sibling above.
  'composables/admin-skill-fields.ts',
  'composables/admin-skill-form.ts',
  'composables/useAdminSkills.ts',
  'composables/useAdminSkill.ts',
  'composables/useAdminSkillsCollection.ts',
  'composables/admin-testimonial-fields.ts',
  'composables/admin-testimonial-form.ts',
  'composables/admin-testimonial-types.ts',
  'composables/useAdminTestimonials.ts',
  'composables/admin-category-form.ts',
  'composables/admin-tag-form.ts',
  'composables/admin-taxonomy-fields.ts',
  'composables/useAdminCategories.ts',
  'composables/useAdminTags.ts',
  'composables/useAdminTaxonomy.ts'
]
// `components/dashboard/**` and `pages/dashboard/**` files need no entry here — the public-surface
// filter already drops anything under a `dashboard/` directory. Only the `app/composables/` files
// need naming, because that directory serves both worlds.

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

/** The public surface: everything under `app/`, minus the dashboard world and this module. */
const publicFiles = sourceFiles(APP)
  .map(file => relative(APP, file).split('\\').join('/'))
  .filter(file => !file.includes('dashboard/'))
  .filter(file => !MODULE_FILES.includes(file))
  .filter(file => !OTHER_DASHBOARD_MODULE_FILES.includes(file))

describe('the admin Projects module is invisible to the public surface', () => {
  it('scans a non-trivial number of public files, so a passing result is not vacuous', () => {
    // A scan that found nothing would pass every assertion below while proving nothing at all.
    expect(publicFiles.length).toBeGreaterThan(20)
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

  it('keeps the public Projects pages on the PUBLIC read, which is locale-scoped', () => {
    // The nearest miss by name: `/projects` and `/dashboard/projects` are different surfaces with
    // different contracts, and the public one must never reach an `/admin/` endpoint.
    for (const file of publicFiles.filter(f => f.startsWith('pages/projects'))) {
      expect(readFileSync(join(APP, file), 'utf8'), file).not.toContain('/admin/')
    }
  })

  it('leaves every module file inside a dashboard directory or the composables lane', () => {
    // Nothing of this module may sit in `app/pages/` (outside `dashboard/`), `app/layouts/` or a
    // public component directory, where Nuxt would wire it into the public surface for free.
    for (const file of MODULE_FILES) {
      expect(
        file.startsWith('composables/') || file.includes('dashboard/'),
        `${file} is neither dashboard-scoped nor a composable`
      ).toBe(true)
    }
  })
})
