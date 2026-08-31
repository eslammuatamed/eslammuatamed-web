import type { Envelope } from '~/types/models'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'
import type {
  CreateTestimonialPayload,
  UpdateTestimonialPayload
} from '~/composables/admin-testimonial-form'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/testimonials` — the Testimonials collection read (FE-3 module 3, `T·U2`).
 *
 * ── THIS IS NOT A PAGINATED LIST, AND THAT IS A CONTRACT FACT ───────────────────────────────────
 * The endpoint declares ZERO query parameters — the instrument answers an unsolicited query string
 * with a 422 rather than silently ignoring it — and answers `{ data: [...] }` with NO `meta`. So:
 *
 *   · no `page`, no `total`, no `totalPages`, and no `Paginated<T>` — reading `res.meta.total` here
 *     would read `undefined` off a response that never carries it;
 *   · no status filter, no search, and therefore NO query-state module. Articles has
 *     `admin-articles-query.ts` because its endpoint takes real parameters; inventing one here would
 *     build a URL contract the API does not honour.
 *
 * The whole collection arrives in one read, which is correct HERE: it is what the contract offers,
 * the same way `useAdminSkills` reads its closed vocabulary whole and `useAdminExperiences` reads
 * roles whole.
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
  const pending = ref(false)
  /** `403` is not "no testimonials" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Monotonic request token, kept even though this endpoint takes no parameters.
   *
   * Two loads can still overlap — the operator retries a slow request, or a refresh fires while the
   * first is in flight — and responses are not guaranteed to return in order. Without this, a slow
   * EARLIER response can land after a fast later one and overwrite fresher rows with staler ones.
   */
  let loadSeq = 0

  /**
   * Has anything ever loaded successfully?
   *
   * §10.3 rule 2 (keep-or-clear on failure) via the same reasoning as Experiences: this endpoint has
   * exactly ONE view — no query parameters mean there is no second view to request — so "is this a
   * refresh of what is shown?" is answered by "is anything shown?". A query key here would be a
   * constant string dressed up as a variable.
   */
  let hasLoaded = false

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminTestimonial[]>>('/admin/testimonials', { locale: false })
      if (seq !== loadSeq) return
      // Rendered in the order received — see the header. No `.sort()` belongs on this line.
      items.value = [...res.data]
      hasLoaded = true
    } catch (error) {
      // A superseded request's failure is not the current request's failure — it must not clear the
      // newer request's rows or raise an error the operator would attach to the wrong list.
      if (seq !== loadSeq) return

      // A failed FIRST load has nothing usable underneath it, so the error surface is the only thing
      // that can be shown. A failed REFRESH keeps the rows, which is what makes a stale notice
      // expressible rather than blanking a working list.
      if (!hasLoaded) items.value = []

      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { items, pending, forbidden, failed, load }
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
