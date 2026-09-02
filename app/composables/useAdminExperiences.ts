import type { Envelope, Paginated, PaginationMeta } from '~/types/models'
import type {
  AdminExperience,
  CreateExperiencePayload,
  UpdateExperiencePayload
} from '~/composables/admin-experience-types'
import { ApiError } from '~/utils/api-error'
import {
  adminExperiencesQueryKey,
  adminExperiencesRequestQuery,
  type AdminExperiencesQuery
} from '~/composables/admin-experiences-query'

/**
 * `GET /admin/experiences` — the Experiences collection read (FE-3 module 1).
 *
 * The production endpoint is paginated. `page` and the fixed canonical `perPage=12` are sent on
 * every list request; received rows are rendered as-is, never sliced or sorted in the browser.
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
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no experiences" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Only the newest request may write. A late page-one response must never replace page two.
   */
  let loadSeq = 0

  /**
   * The request identity of the data on screen. A failed refresh keeps same-page rows; a failed
   * different page clears them instead of presenting the previous page as the requested one.
   */
  let loadedKey: string | null = null

  async function load(query: AdminExperiencesQuery = { page: 1 }): Promise<PaginationMeta | null> {
    const seq = ++loadSeq
    const key = adminExperiencesQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminExperience>>('/admin/experiences', {
        locale: false,
        query: adminExperiencesRequestQuery(query)
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
