import type { Envelope } from '~/types/models'
import type {
  AdminExperience,
  CreateExperiencePayload,
  UpdateExperiencePayload
} from '~/composables/admin-experience-types'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/experiences` — the Experiences collection read (FE-3 module 1).
 *
 * ── THIS IS NOT A PAGINATED LIST, AND THAT IS A CONTRACT FACT ───────────────────────────────────
 * The endpoint declares ZERO query parameters and answers `{ data: [...] }` with NO `meta`. So:
 *
 *   · no `page`, no `total`, no `totalPages`, and no `Paginated<T>` — reading `res.meta.total`
 *     here would read `undefined` off a response that never carries it;
 *   · no status filter, no search, and therefore NO `admin-experiences-query.ts`. Articles has
 *     `admin-articles-query.ts` because its endpoint takes real parameters; inventing one here
 *     would build a URL contract the API does not honour.
 *
 * The whole collection arrives in one read, which is correct HERE and is not a licence to fetch
 * other collections wholesale — it is what the contract offers, the same way `useAdminSkills`
 * reads a closed vocabulary whole.
 *
 * ── ⚠ THE CLIENT NEVER RE-SORTS ─────────────────────────────────────────────────────────────────
 * The API's order is four-key: `isCurrent` DESC, then `startDate` DESC, then the owner-controlled
 * `order` ASC, then `id`. A naive `startDate desc` is WRONG and has already shipped once — an ended
 * role outranked the current one on the live site, which is the defect `compareExperiences` records
 * in the API source and which the `EXP.endedLater` fixture reproduces exactly.
 *
 * So rows are rendered in the order received, for the same reason `useAdminArticles` does not
 * re-sort: the list endpoint takes no sort parameter, so the server's order IS the contract. A
 * client-side sort would also be unfixable from the server later.
 *
 * `locale: false` ON EVERY CALL. The admin DTOs are validated with `forbidNonWhitelisted` and none
 * declares `locale`, so an unsolicited `?locale=` is a 422 rather than a harmless extra parameter.
 * Admin experiences are locale-AGNOSTIC by design: the response carries the whole translation map,
 * which is what an editor with no cross-locale fallback needs.
 */
export function useAdminExperiences() {
  const api = useApi()

  const items = ref<AdminExperience[]>([])
  const pending = ref(false)
  /** `403` is not "no experiences" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Monotonic request token, kept even though this endpoint takes no parameters.
   *
   * Two loads can still overlap — the operator retries a slow request, or a refresh fires while the
   * first is in flight — and responses are not guaranteed to return in order. Without this, a slow
   * EARLIER response can land after a fast later one and overwrite fresher rows with staler ones.
   * That is a real race here, unlike the filter/page race Articles guards, and it survives the
   * absence of query parameters.
   */
  let loadSeq = 0

  /**
   * Has anything ever loaded successfully?
   *
   * ── WHY THIS IS A BOOLEAN AND NOT A QUERY KEY ───────────────────────────────────────────────
   * §10.3 rule 2 (keep-or-clear on failure) says: compare the failed request's view identity to
   * what is on screen — a failed REFRESH keeps the rows, a failed request for a DIFFERENT view
   * clears them. `useAdminArticles` expresses that with a query key, because its view identity is
   * the status filter plus the page.
   *
   * Experiences has exactly ONE view. With no query parameters there is no second view to request,
   * so "is this a refresh of what is shown?" is answered by "is anything shown?". The rule is
   * unchanged and still applied — its discriminating case simply does not exist on this endpoint.
   * A query key here would be a constant string dressed up as a variable.
   */
  let hasLoaded = false

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminExperience[]>>('/admin/experiences', { locale: false })
      if (seq !== loadSeq) return
      // Rendered in the order received — see the header. No `.sort()` belongs on this line.
      items.value = [...res.data]
      hasLoaded = true
    } catch (error) {
      // A superseded request's failure is not the current request's failure — it must not clear the
      // newer request's rows or raise an error the operator would attach to the wrong list.
      if (seq !== loadSeq) return

      // A failed FIRST load has nothing usable underneath it, so there is nothing to keep and the
      // error surface is the only thing that can be shown. A failed REFRESH keeps the rows, which
      // is what makes the stale notice expressible rather than blanking a working list.
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
 * One experience: the editor's read and its three writes (FE-3 module 1, `M1·U3`).
 *
 * Lives beside the collection read for the reason `useAdminArticles.ts` gives — one module, one
 * file, and the editor and the list share the entity type — while staying a SEPARATE composable, so
 * the collection route never instantiates the write paths it has no use for.
 *
 * Every write THROWS on failure rather than swallowing it, so the editor can keep the operator's
 * unsaved input on screen and render the RFC 7807 problem. Silently discarding edits it cannot
 * prove were stored is the one outcome a content editor must never produce.
 *
 * `locale: false` ON EVERY CALL, as every admin call must be: the admin DTOs are validated with
 * `forbidNonWhitelisted` and none declares `locale`, so an unsolicited `?locale=` is a 422.
 */
export function useAdminExperience() {
  const api = useApi()

  const experience = ref<AdminExperience | null>(null)
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
      const res = await api<Envelope<AdminExperience>>(`/admin/experiences/${id}`, { locale: false })
      experience.value = res.data
    } catch (error) {
      experience.value = null
      // A deleted or mistyped id is a different answer from "you may not read this" and from "the
      // request broke". Each gets its own surface (D11-2).
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else if (error instanceof ApiError && error.status === 404) notFound.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  async function create(body: CreateExperiencePayload): Promise<AdminExperience> {
    const res = await api<Envelope<AdminExperience>>('/admin/experiences', {
      method: 'POST',
      locale: false,
      body
    })
    experience.value = res.data
    return res.data
  }

  /**
   * The response is the FULL updated entity and it REPLACES the held one, so what is on screen
   * after a save is confirmed server state rather than the optimistic echo of what was sent.
   *
   * That is load-bearing for the skill relation in particular: `technologyIds` is REPLACED by the
   * write, so re-seeding from the response is what proves to the operator which skills the role
   * actually has — rather than showing them the set they believe they sent.
   */
  async function update(id: string, body: UpdateExperiencePayload): Promise<AdminExperience> {
    const res = await api<Envelope<AdminExperience>>(`/admin/experiences/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    experience.value = res.data
    return res.data
  }

  /**
   * `204 No Content` — there is no envelope to read back.
   *
   * `unknown`, not `void`: the endpoint answers with no body, and `void` as a type ARGUMENT is
   * rejected by `@typescript-eslint/no-invalid-void-type`. The value is discarded either way.
   */
  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/experiences/${id}`, { method: 'DELETE', locale: false })
  }

  return { experience, pending, forbidden, notFound, failed, load, create, update, remove }
}
