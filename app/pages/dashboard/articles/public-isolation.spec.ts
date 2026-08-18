import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

/**
 * The admin Articles module must not reach the public site (D06-1, doc 20 §5).
 *
 * The same gate `pages/dashboard/projects/public-isolation.spec.ts` establishes, applied to this
 * module — and it is needed for the identical reason: this module's composables live in
 * `app/composables/`, NOT under a `dashboard/` directory, so the `eslammuatamed/boundaries` ESLint
 * rule (which matches on the path `**\/dashboard/**`) cannot see them, while Nuxt auto-imports that
 * whole directory. A public page could call `useAdminArticles()` with no import statement at all
 * and no other gate would say a word until someone read a bundle report.
 *
 * The stakes are higher for Articles than for Projects: `/blog` and `/blog/[slug]` are PUBLIC pages
 * about the same entity, served by a different contract (`GET /articles`, locale-resolved). The
 * nearest-miss assertion below is therefore about a real adjacency, not a hypothetical one.
 *
 * TEXT-BASED by design, following the Projects gate and `scripts/e2e/lane-isolation.spec.mjs`: an
 * auto-imported symbol has no import statement to follow, so the NAME is the reference.
 *
 * What this does NOT prove is bytes — that is `size:routes` and `check-forbidden-modules.mjs`.
 */

const ROOT = process.cwd()
const APP = resolve(ROOT, 'app')

/** Every file this module owns. They are allowed to name themselves; nothing else is. */
const MODULE_FILES = [
  'composables/admin-article-form.ts',
  'composables/admin-article-types.ts',
  'composables/admin-articles-query.ts',
  'composables/useAdminArticles.ts',
  'components/dashboard/ArticleEditor.vue',
  'pages/dashboard/articles/index.vue',
  'pages/dashboard/articles/new.vue',
  'pages/dashboard/articles/[id].vue'
]

/**
 * Dashboard-only files belonging to ANOTHER dashboard module.
 *
 * The Projects module's composables sit in `app/composables/` for the same reason this module's do,
 * and they are guarded by their own isolation gate. They are excluded from the "public surface" for
 * the same reason this module's files are excluded from theirs: neither is public.
 */
const OTHER_DASHBOARD_MODULE_FILES = [
  'composables/admin-project-form.ts',
  'composables/admin-project-types.ts',
  'composables/admin-projects-query.ts',
  'composables/useAdminProjects.ts',
  'composables/useAdminSkills.ts'
]

/**
 * The names a public file would have to mention to pull any of this in — the auto-imported
 * composables and the module specifiers.
 *
 * `useAdminArticle` is listed separately from `useAdminArticles` on purpose: it is a distinct
 * export (the single-entity composable), and a substring check for the plural would not catch a
 * public file that called only the singular.
 */
const FORBIDDEN_REFERENCES = [
  'useAdminArticles',
  'useAdminArticle',
  'useAdminTaxonomy',
  'admin-article-form',
  'admin-article-types',
  'admin-articles-query',
  'parseAdminArticlesQuery',
  'adminArticlesRequestQuery',
  'articleHasTranslation',
  'articleIsPubliclyVisible',
  'articleStatusColor',
  'ARTICLE_LOCALES',
  // The auto-imported component tag, in both spellings a template may use. A public page could
  // render the whole editor with no import statement at all.
  'DashboardArticleEditor',
  'dashboard-article-editor'
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

/** The public surface: everything under `app/`, minus the dashboard world and the two modules. */
const publicFiles = sourceFiles(APP)
  .map(file => relative(APP, file).split('\\').join('/'))
  .filter(file => !file.includes('dashboard/'))
  .filter(file => !MODULE_FILES.includes(file))
  .filter(file => !OTHER_DASHBOARD_MODULE_FILES.includes(file))

describe('the admin Articles module is invisible to the public surface', () => {
  it('scans a non-trivial number of public files, so a passing result is not vacuous', () => {
    // A scan that found nothing would pass every assertion below while proving nothing at all.
    expect(publicFiles.length).toBeGreaterThan(20)
  })

  it('actually sees the public blog pages, which are the nearest miss by name', () => {
    // Positive control on the SCAN SET rather than on the assertion: if `pages/blog/index.vue` ever
    // stopped being scanned, the module could be referenced from the one place most likely to do it
    // and this file would still be green.
    expect(publicFiles).toContain('pages/blog/index.vue')
    expect(publicFiles).toContain('pages/blog/[slug].vue')
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

  it('keeps the public blog pages on the PUBLIC read, which is locale-scoped', () => {
    // `/blog` and `/dashboard/articles` are different surfaces over the same entity with different
    // contracts. The public one must never reach an `/admin/` endpoint.
    for (const file of publicFiles.filter(f => f.startsWith('pages/blog'))) {
      expect(readFileSync(join(APP, file), 'utf8'), file).not.toContain('/admin/')
    }
  })

  it('leaves every module file inside a dashboard directory or the composables lane', () => {
    for (const file of MODULE_FILES) {
      expect(
        file.startsWith('composables/') || file.includes('dashboard/'),
        `${file} is neither dashboard-scoped nor a composable`
      ).toBe(true)
    }
  })
})
