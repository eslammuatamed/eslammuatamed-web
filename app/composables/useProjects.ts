import type { Envelope, Paginated, ProjectDetail, ProjectListItem, Skill } from '~/types/models'

/**
 * Projects data reads (FR-PUB-030, FR-PUB-031). Both go through the single API door `useApi()`, which
 * injects `?locale=` on every GET (D10-6) — the locale is never passed by hand.
 *
 * Ordering is the API's: `featured desc, order asc` (doc 09 D09-8). The client MUST NOT re-sort, or the
 * curated order the owner controls in the CMS stops being what visitors see. The home page's
 * "top 3 featured" filter is a home concern and is deliberately not repeated here.
 */

/** Reactive query inputs for the index. Getters, so the caller owns where the state lives (the URL). */
interface ProjectsListParams {
  page: () => number
  /** Canonical technology UUID, or `undefined` for the unfiltered list. */
  technology: () => string | undefined
}

/**
 * `GET /projects` — featured-first, published-only, paginated.
 *
 * Returns the whole `{ data, meta }` envelope rather than just `data`: the index needs `meta.totalPages`
 * to decide whether pagination controls exist at all, and `meta.total` for the empty-state distinction
 * between "no projects" and "no matches for this filter".
 *
 * The key includes locale, page and filter so each combination caches separately and a filter change
 * cannot show the previous result set; `watch` re-runs the fetch when any of them changes.
 */
export function useProjectsList(params: ProjectsListParams) {
  const api = useApi()
  const { locale } = useI18n()

  return useAsyncData(
    () => `projects:${locale.value}:${params.page()}:${params.technology() ?? 'all'}`,
    () => {
      const technology = params.technology()
      return api<Paginated<ProjectListItem>>('/projects', {
        // Omit `technology` entirely when unset — sending an empty string would be a 422.
        query: { page: params.page(), ...(technology ? { technology } : {}) }
      })
    },
    { watch: [locale, params.page, params.technology] }
  )
}

/**
 * `GET /projects/{slug}` — one case study in the requested locale.
 *
 * Slugs are per-locale (`slugs` on the response maps locale → that locale's slug), so a locale switch
 * changes the slug rather than reusing the current one. A slug with no translation in the requested
 * locale is a 404 by contract, which the page turns into redirect resolution and then a real 404.
 */
export function useProjectDetail(slug: () => string) {
  const api = useApi()
  const { locale } = useI18n()

  return useAsyncData(
    () => `project:${slug()}:${locale.value}`,
    () =>
      api<Envelope<ProjectDetail>>(`/projects/${encodeURIComponent(slug())}`).then(res => res.data),
    { watch: [locale] }
  )
}

/**
 * `GET /skills` — the source of the index's technology filter options (doc 04 §: technologies are drawn
 * from the Skills registry, not free text). The filter sends the skill's UUID as `?technology=`, which
 * is the only accepted form; labels are display-only.
 */
export function useProjectTechnologies() {
  const api = useApi()
  const { locale } = useI18n()

  return useAsyncData(
    () => `projects:technologies:${locale.value}`,
    () => api<Envelope<Skill[]>>('/skills').then(res => res.data),
    { watch: [locale] }
  )
}
