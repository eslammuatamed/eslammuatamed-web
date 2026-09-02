import type { Envelope, Paginated, PaginationMeta } from '~/types/models'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'
import type {
  CreateTestimonialPayload,
  UpdateTestimonialPayload
} from '~/composables/admin-testimonial-form'
import { ApiError } from '~/utils/api-error'
import {
  adminTestimonialsQueryKey,
  adminTestimonialsRequestQuery,
  type AdminTestimonialsQuery
} from '~/composables/admin-testimonials-query'

/**
 * `GET /admin/testimonials` — the Testimonials collection read (FE-3 module 3, `T·U2`).
 *
 * The production endpoint is paginated. It receives canonical `page` and fixed `perPage=12`; the
 * browser renders the server page as received and never slices or sorts a fetched whole collection.
 *
 * ── ⚠ THE CLIENT NEVER RE-SORTS ─────────────────────────────────────────────────────────────────
 * The list endpoint takes no sort parameter, so the server's order IS the contract. Rows are
 * rendered in the order received, for the same reason `useAdminExperiences` does not re-sort — and
 * a client-side sort here would also be unfixable from the server later. The browser lane pins this
 * against fixtures whose `order` values are deliberately OUT of sequence, so sorting by `order`
 * fails loudly instead of passing by coincidence.
 *
 * `locale: false` ON EVERY CALL. The admin DTOs are validated with `forbidNonWhitelisted` and none
 * declares `locale`, so an unsolicited `?locale=` is a 422 rather than a harmless extra parameter.
 * Admin testimonials are locale-AGNOSTIC by design: the response carries the whole translation map,
 * which is what an editor with no cross-locale fallback needs.
 */
export function useAdminTestimonials() {
  const api = useApi()

  const items = ref<AdminTestimonial[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no testimonials" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Only the newest request may write; a late page-one response cannot overwrite page two.
   */
  let loadSeq = 0

  /**
   * The request identity of displayed rows. This distinguishes a failed same-page refresh from a
   * failed request for another page, which must not leave misleading old rows behind.
   */
  let loadedKey: string | null = null

  async function load(query: AdminTestimonialsQuery = { page: 1 }): Promise<PaginationMeta | null> {
    const seq = ++loadSeq
    const key = adminTestimonialsQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminTestimonial>>('/admin/testimonials', {
        locale: false,
        query: adminTestimonialsRequestQuery(query)
      })
      if (seq !== loadSeq) return null
      // Rendered in the order received — see the header. No `.sort()` belongs on this line.
      items.value = [...res.data]
      total.value = res.meta.total
      totalPages.value = res.meta.totalPages
      loadedKey = key
      return res.meta
    } catch (error) {
      // A superseded request's failure is not the current request's failure — it must not clear the
      // newer request's rows or raise an error the operator would attach to the wrong list.
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
 * One testimonial: the editor's read and its three writes (FE-3 module 3, `T·U3`).
 *
 * Lives beside the collection read for the reason `useAdminExperiences.ts` gives — one module, one
 * file, the editor and the list share the entity type — while staying a SEPARATE composable, so the
 * collection route never instantiates the write paths it has no use for.
 *
 * Every write THROWS on failure rather than swallowing it, so the editor can keep the operator's
 * unsaved input on screen and render the RFC 7807 problem. Silently discarding edits it cannot
 * prove were stored is the one outcome a content editor must never produce.
 *
 * `locale: false` ON EVERY CALL, as every admin call must be: the admin DTOs are validated with
 * `forbidNonWhitelisted` and none declares `locale`, so an unsolicited `?locale=` is a 422.
 */
export function useAdminTestimonial() {
  const api = useApi()

  const testimonial = ref<AdminTestimonial | null>(null)
  const pending = ref(false)
  const forbidden = ref(false)
  const notFound = ref(false)
  const failed = ref(false)

  async function load(id: string): Promise<void> {
    pending.value = true
    forbidden.value = false
    notFound.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminTestimonial>>(`/admin/testimonials/${id}`, { locale: false })
      testimonial.value = res.data
    } catch (error) {
      testimonial.value = null
      // A deleted or mistyped id is a different answer from "you may not read this" and from "the
      // request broke". Each gets its own surface (D11-2). A malformed id answers 400 upstream;
      // that is still "this address names nothing readable" to an operator, so it reads as
      // not-found here rather than as a transport failure.
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  async function create(body: CreateTestimonialPayload): Promise<AdminTestimonial> {
    const res = await api<Envelope<AdminTestimonial>>('/admin/testimonials', {
      method: 'POST',
      locale: false,
      body
    })
    testimonial.value = res.data
    return res.data
  }

  /**
   * The response is the FULL updated entity and it REPLACES the held one, so what is on screen
   * after a save is confirmed server state — including translations the upsert preserved but this
   * client did not send.
   */
  async function update(id: string, body: UpdateTestimonialPayload): Promise<AdminTestimonial> {
    const res = await api<Envelope<AdminTestimonial>>(`/admin/testimonials/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    testimonial.value = res.data
    return res.data
  }

  /** `204 No Content` — there is no envelope to read back. */
  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/testimonials/${id}`, { method: 'DELETE', locale: false })
  }

  return { testimonial, pending, forbidden, notFound, failed, load, create, update, remove }
}
