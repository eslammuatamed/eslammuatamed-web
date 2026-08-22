import type { Envelope } from '~/types/models'
import type { AdminCategory } from '~/composables/admin-article-types'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/categories` — the Categories collection read (FE-3 Taxonomy, `U2`).
 *
 * The contract facts that shape this file are the same ones `useAdminTestimonials` records, and
 * they are repeated HERE rather than imported, because each is a place a "shared" list composable
 * would silently diverge from its endpoint:
 *
 * - ZERO query parameters (an unsolicited query string is a 422) and NO `meta` — no pagination,
 *   no filter, no query state;
 * - `{ data: [...] }` whole — the collection arrives in one read because that is what the
 *   contract offers;
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
export function useAdminCategories() {
  const api = useApi()

  const items = ref<AdminCategory[]>([])
  const pending = ref(false)
  /** `403` is not "no categories" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /** Monotonic token: a superseded response must never overwrite fresher rows. */
  let loadSeq = 0

  /**
   * Has anything ever loaded successfully? One endpoint view, no query parameters, so keep-or-clear
   * on failure reduces to "is anything shown?" — the Experiences/Testimonials reasoning verbatim.
   */
  let hasLoaded = false

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminCategory[]>>('/admin/categories', { locale: false })
      if (seq !== loadSeq) return
      // Rendered in the order received — see the header. No `.sort()` belongs on this line.
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
