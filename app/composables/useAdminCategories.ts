import type { Envelope, Paginated, PaginationMeta } from '~/types/models'
import type { components } from '~/types/api'
import type { AdminCategory } from '~/composables/admin-article-types'
import { ApiError } from '~/utils/api-error'
import {
  adminCategoriesQueryKey,
  adminCategoriesRequestQuery,
  type AdminCategoriesQuery
} from '~/composables/admin-categories-query'

/**
 * `GET /admin/categories` — the Categories collection read (FE-3 Taxonomy, `U2`).
 *
 * The contract facts that shape this file are the same ones `useAdminTestimonials` records, and
 * they are repeated HERE rather than imported, because each is a place a "shared" list composable
 * would silently diverge from its endpoint:
 *
 * - canonical `page` and fixed `perPage=12`, with `{ data, meta }` from the server;
 * - the server's order IS the contract (`createdAt` ascending); rows render in the order received,
 *   and no `.sort()` belongs anywhere near them;
 * - `locale: false` on every call: the admin DTOs are validated with `forbidNonWhitelisted` and
 *   none declares `locale`.
 *
 * ⚠ THERE IS NO DETAIL READ on this entity — `/admin/categories/{id}` answers PATCH and DELETE
 * only. This composable deliberately offers no `load(id)`: a function that cannot be called cannot
 * build a request the API cannot answer.
 *
 * It exists as its OWN composable beside `useAdminTags` — not as one parameterized reader — so each
 * section of the Taxonomy page owns independent request state with zero new shared abstraction:
 * two honest instances of the established module pattern, one per endpoint.
 */
type Schemas = components['schemas']

export function useAdminCategories() {
  const api = useApi()

  const items = ref<AdminCategory[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no categories" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /** Monotonic token: a superseded response must never overwrite fresher rows. */
  let loadSeq = 0

  /**
   * The page identity of rendered rows. A failed refresh keeps same-page rows, while a failed
   * different page clears stale rows rather than mislabelling them as the requested page.
   */
  let loadedKey: string | null = null

  async function load(query: AdminCategoriesQuery = { page: 1 }): Promise<PaginationMeta | null> {
    const seq = ++loadSeq
    const key = adminCategoriesQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminCategory>>('/admin/categories', {
        locale: false,
        query: adminCategoriesRequestQuery(query)
      })
      if (seq !== loadSeq) return null
      // Rendered in the order received — see the header. No `.sort()` belongs on this line.
      items.value = [...res.data]
      total.value = res.meta.total
      totalPages.value = res.meta.totalPages
      loadedKey = key
      return res.meta
    } catch (error) {
      if (seq !== loadSeq) return null
      if (loadedKey !== key) {
        items.value = []
        total.value = 0
        totalPages.value = 1
        loadedKey = null
      }
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
      return null
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { items, total, totalPages, pending, forbidden, failed, load }
}

/**
 * The three writes (`U3b`). Each THROWS on failure so the overlay can keep the operator's unsaved
 * input on screen and render the RFC 7807 problem — including the DOCUMENTED article-reference 409
 * on delete, which the overlay surfaces as a localized message. Silently discarding an edit it
 * cannot prove was stored is the one outcome an editor must never produce.
 *
 * ⚠ Still NO detail read: `update` PATCHes the id straight from the clicked collection row, and no
 * function here fetches `/admin/categories/{id}` with GET.
 */
export function useAdminCategoryWrites() {
  const api = useApi()

  async function create(body: Schemas['CreateCategoryDto']): Promise<Schemas['AdminCategoryEntity']> {
    const res = await api<Envelope<Schemas['AdminCategoryEntity']>>('/admin/categories', {
      method: 'POST',
      locale: false,
      body
    })
    return res.data
  }

  async function update(id: string, body: Schemas['UpdateCategoryDto']): Promise<Schemas['AdminCategoryEntity']> {
    const res = await api<Envelope<Schemas['AdminCategoryEntity']>>(`/admin/categories/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    return res.data
  }

  /** `204 No Content`; a documented 409 (article-referenced) throws as ApiError. */
  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/categories/${id}`, { method: 'DELETE', locale: false })
  }

  return { create, update, remove }
}
