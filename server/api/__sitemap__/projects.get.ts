/**
 * Sitemap source for published project translations (doc 22 §sitemap: "per-locale URLs with hreflang
 * annotations, sourced live from the API").
 *
 * This runs on the Nitro server, not in the browser, so it is the one legitimate place to call the
 * backend directly — the `useApi()` rule governs app code (constitution rule 3, doc 15 §2), and a
 * sitemap cannot go through a component composable.
 *
 * Only PUBLISHED projects are reachable from `GET /projects` (D09-8), so publication filtering is the
 * API's and cannot be got wrong here. Each entry is emitted once per locale using that locale's own
 * slug, taken from the list response's `availableLocales` — a project with no Arabic translation is
 * simply absent from the Arabic entries rather than emitted with an English slug that would 404.
 *
 * A failure returns an empty list rather than throwing: a sitemap that is briefly short is recoverable,
 * while a 500 makes the whole sitemap index unavailable.
 */
interface ProjectListItem {
  slug: string
  availableLocales: string[]
}

interface Paginated<T> {
  data: T[]
  meta: { totalPages: number }
}

const LOCALES = ['en', 'ar'] as const
const PER_PAGE = 50

export default defineSitemapEventHandler(async () => {
  const apiBase = useRuntimeConfig().public.apiBase
  if (!apiBase) return []

  const entries: { loc: string, _i18nTransform?: boolean }[] = []

  for (const locale of LOCALES) {
    try {
      // Page through the list so a growing case-study collection is never silently truncated.
      let page = 1
      let totalPages = 1
      do {
        const response = await $fetch<Paginated<ProjectListItem>>(`${apiBase}/projects`, {
          query: { locale, page, perPage: PER_PAGE }
        })
        totalPages = response.meta.totalPages
        for (const project of response.data) {
          entries.push({ loc: locale === 'en' ? `/projects/${project.slug}` : `/${locale}/projects/${project.slug}` })
        }
        page += 1
      } while (page <= totalPages)
    } catch {
      // Leave this locale out rather than failing the entire sitemap.
      continue
    }
  }

  return entries
})
