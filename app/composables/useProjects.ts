import type { Envelope, Paginated, ProjectDetail, ProjectListItem, Skill } from '~/types/models'

/**
 * Projects data reads (FR-PUB-030, FR-PUB-031). Both go through the single API door `useApi()`, which
 * puts `?locale=` on every GET (D10-6).
 *
 * The locale is the ROUTE's, not the reactive UI locale (D06-6). During the D03-13 deferred locale
 * commit the incoming page fetches while the UI locale still holds the outgoing language, and because
 * project slugs are per-locale (D04-2) that asks for the Arabic slug in English — a legitimate 404 for
 * a project that exists. The `useAsyncData` key uses the SAME value that is sent, so a payload can
 * never be cached under a key naming a different language than the request that produced it.
 *
 * Ordering is the API's: `featured desc, order asc` (doc 09 D09-8). The client MUST NOT re-sort, or the
 * curated order the owner controls in the CMS stops being what visitors see. The home page's
 * "top 3 featured" filter is a home concern and is deliberately not repeated here.
 */

/** Reactive query inputs for the index. Getters, so the caller owns where the state lives (the URL). */
interface ProjectsListParams {
  page: () => number
  /**
   * The technology filter value, or `undefined` for the unfiltered list.
   *
   * The CANONICAL form is the Skill's `slug` (D10-17). A Skill uuid is still accepted by the API for
   * backward compatibility only, so this stays a plain string rather than a narrowed slug type: a
   * link shared before the slug contract landed carries a uuid, and narrowing here would silently
   * unfilter it instead of honouring it.
   */
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
  const locale = useRouteLocale()

  return useAsyncData(
    () => `projects:${locale.value}:${params.page()}:${params.technology() ?? 'all'}`,
    () => {
      const technology = params.technology()
      return api<Paginated<ProjectListItem>>('/projects', {
        locale: locale.value,
        // `perPage` is sent explicitly rather than inherited from the API's default of 12: the page
        // size is this page's layout decision, and an implicit one would reflow the index if the API
        // ever changed its default. It is NOT part of the cache key because it is a constant — a key
        // naming an invariant only makes the key longer.
        // `technology` is omitted entirely when unset; sending an empty string would be a 422.
        query: {
          page: params.page(),
          perPage: PROJECTS_PER_PAGE,
          ...(technology ? { technology } : {})
        }
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
  const locale = useRouteLocale()

  return useAsyncData(
    () => `project:${slug()}:${locale.value}`,
    () =>
      api<Envelope<ProjectDetail>>(`/projects/${encodeURIComponent(slug())}`, {
        locale: locale.value
      }).then(res => res.data),
    { watch: [locale] }
  )
}

/**
 * `GET /skills` — the source of the index's technology filter options (doc 04 §: technologies are drawn
 * from the Skills registry, not free text). The filter sends the skill's `slug` as `?technology=` —
 * the canonical form (D10-17), stable across locales and readable in a shared URL. Labels are
 * display-only and arrive already localized, so they must never become the filter value.
 */
export function useProjectTechnologies() {
  const api = useApi()
  const locale = useRouteLocale()

  return useAsyncData(
    () => `projects:technologies:${locale.value}`,
    () => api<Envelope<Skill[]>>('/skills', { locale: locale.value }).then(res => res.data),
    { watch: [locale] }
  )
}
