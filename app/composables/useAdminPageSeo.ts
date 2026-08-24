import type { components } from '~/types/api'
import { ApiError } from '~/utils/api-error'

type Schemas = components['schemas']
export type AdminPageSeo = Schemas['AdminPageSeoEntity']

/**
 * The CLOSED static-page vocabulary (D09-24), in the Dashboard's PRODUCT PRESENTATION ORDER.
 *
 * ⚠ THE ADMIN LIST DOES NOT PROMISE AN ORDER — its contract declares zero parameters and no
 * ordering, so server array position carries no meaning. This constant is a UI decision about
 * what an operator sees first, never a claim about persistence; it must never be applied to the
 * server response with `.sort()`. Rendering walks THIS list and looks rows up BY KEY.
 */
export const PAGE_SEO_PAGE_ORDER = [
  'home',
  'about',
  'experience',
  'projects',
  'blog',
  'resume',
  'contact'
] as const

export type PageSeoPageKey = (typeof PAGE_SEO_PAGE_ORDER)[number]

/** Rows indexed by their page key — the only honest way to reach one, given no promised order. */
export function pageSeoRowsByKey(items: readonly AdminPageSeo[]): Map<PageSeoPageKey, AdminPageSeo> {
  return new Map(items.map(row => [row.pageKey as PageSeoPageKey, row]))
}

/**
 * The known pages in PRODUCT order, whatever order the server sent. A row for an unknown key would
 * be contract-impossible (the set is closed), so it is dropped rather than invented into position.
 */
export function orderedPageSeoPages(items: readonly AdminPageSeo[]): Array<{ key: PageSeoPageKey, row: AdminPageSeo }> {
  const byKey = pageSeoRowsByKey(items)
  return PAGE_SEO_PAGE_ORDER.flatMap((key) => {
    const row = byKey.get(key)
    return row ? [{ key, row }] : []
  })
}

/**
 * `GET /admin/seo/pages` — the Static Page SEO collection read (FE4-U1c). READ ONLY.
 *
 * The contract facts that shape this file are the Taxonomy/Categories ones verbatim, restated here
 * because each is a place a "shared" list composable silently diverges:
 *
 * - ZERO query parameters and NO `meta` — no pagination, no filter, no query state;
 * - `{ data: [...] }` whole — ONE read delivers EVERY static page with EVERY enabled locale
 *   (an unauthored locale arrives all-null), so this surface never needs a per-page detail read;
 * - the server's array order carries NO meaning (see `PAGE_SEO_PAGE_ORDER` above);
 * - `locale: false`, like every admin call (`forbidNonWhitelisted`).
 *
 * ⚠ READ ONLY IN U1c — there is deliberately NO write method here yet, and no detail GET either:
 * the list rows are complete edit sources when U1d needs them. A function that cannot be called
 * cannot build a request the surface must not send.
 */
export function useAdminPageSeo() {
  const api = useApi()

  const items = ref<AdminPageSeo[]>([])
  const pending = ref(false)
  /** `403` is not "no pages" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /** Monotonic token: a superseded response must never overwrite fresher rows. */
  let loadSeq = 0

  /** Has anything ever loaded successfully? Keep-or-clear on failure reduces to "is anything shown?". */
  let hasLoaded = false

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<{ data: AdminPageSeo[] }>('/admin/seo/pages', { locale: false })
      if (seq !== loadSeq) return
      // Stored in the order received; presentation order is applied at render time.
      items.value = [...res.data]
      hasLoaded = true
    } catch (error) {
      if (seq !== loadSeq) return
      if (!hasLoaded) items.value = []
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { items, pending, forbidden, failed, load }
}
