import type { ArticleListItem, Category, Envelope, Paginated } from '~/types/models'

/**
 * Blog index data reads (FR-PUB-040). Both go through the single API door `useApi()`, which puts
 * `?locale=` on every GET (D10-6).
 *
 * The locale is the ROUTE's, not the reactive UI locale (D06-6) — the same rule, and the same reason,
 * as `useProjects`: during the D03-13 deferred locale commit the incoming page fetches while the UI
 * locale still holds the outgoing language. The `useAsyncData` key uses the SAME value that is sent,
 * so a payload can never be cached under a key naming a different language than the request.
 *
 * Ordering and publication are the API's. The client MUST NOT re-sort.
 */

/** Reactive query inputs for the index. Getters, so the caller owns where the state lives (the URL). */
interface ArticlesListParams {
  page: () => number
  /** Category SLUG in the current locale, or `undefined` for the unfiltered list. */
  category: () => string | undefined
}

/**
 * `GET /articles` — published-only, paginated, optionally filtered by category.
 *
 * Returns the whole `{ data, meta }` envelope rather than just `data`: the index needs
 * `meta.totalPages` to decide whether pagination controls exist at all.
 */
export function useArticlesList(params: ArticlesListParams) {
  const api = useApi()
  const locale = useRouteLocale()

  return useAsyncData(
    () => `articles:${locale.value}:${params.page()}:${params.category() ?? 'all'}`,
    () => {
      const category = params.category()
      return api<Paginated<ArticleListItem>>('/articles', {
        locale: locale.value,
        // `perPage` is sent explicitly rather than inherited from the API's default of 12: the page
        // size is this page's layout decision, and an implicit one would reflow the index if the API
        // ever changed its default. Not part of the cache key, because it is a constant.
        // `category` is omitted entirely when unset; an empty string would be a 422, not "unfiltered".
        query: {
          page: params.page(),
          perPage: ARTICLES_PER_PAGE,
          ...(category ? { category } : {})
        }
      })
    },
    { watch: [locale, params.page, params.category] }
  )
}

/**
 * `GET /categories` — the source of the index's filter chips.
 *
 * **Category slugs are PER-LOCALE (D04-2).** This is the load-bearing difference from the projects
 * filter, whose Skill slugs are locale-independent: the same category has a different slug in English
 * and Arabic, so a `?category=` URL is only meaningful in the locale that produced it. The index uses
 * this list to tell "a category the visitor can actually select here" from one that is not — see
 * `app/pages/blog/index.vue`, which is where that distinction is turned into honest copy instead of a
 * silently empty list.
 */
export function useArticleCategories() {
  const api = useApi()
  const locale = useRouteLocale()

  return useAsyncData(
    () => `articles:categories:${locale.value}`,
    () => api<Envelope<Category[]>>('/categories', { locale: locale.value }).then(res => res.data),
    { watch: [locale] }
  )
}
