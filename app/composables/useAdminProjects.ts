import type { Envelope, Paginated } from '~/types/models'
import type { AdminProject, CreateProjectPayload, UpdateProjectPayload } from '~/composables/admin-project-types'
import { adminProjectsRequestQuery, type AdminProjectsQuery } from '~/composables/admin-projects-query'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/projects` and the single-entity writes behind the Projects module (doc 11).
 *
 * SERVER-SIDE ONLY, WITHOUT EXCEPTION. Pagination, search, both filters and the sort are query
 * PARAMETERS. Nothing is ever fetched wholesale and narrowed in the browser: `meta.total` and
 * `meta.totalPages` are computed server-side under the server's ordering, so a client-side filter
 * would put a page count on screen that does not describe the rows beneath it — and on a library
 * that grows, it would also mean downloading every case study to render twelve.
 *
 * ORDERING IS THE API'S. Omitting `sortBy` asks for its default (`featured desc, order asc`); the
 * client never re-sorts what it received, for the same reason it never re-filters it.
 *
 * `locale: false` ON EVERY CALL. The admin DTOs are validated with `forbidNonWhitelisted` and none
 * of them declares `locale`, so an unsolicited `?locale=` is a 422 rather than a harmless extra
 * parameter (see `useApi`). Admin projects are locale-AGNOSTIC by design: the response carries the
 * whole translation map at once, which is exactly what an editor with no cross-locale fallback
 * needs.
 */
export function useAdminProjects() {
  const api = useApi()

  const items = ref<AdminProject[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no projects" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Monotonic request token. Typing in the search box issues a request per debounced keystroke and
   * the responses are not guaranteed to return in the order they were asked for — a slow `"api"`
   * landing after `"api platform"` would leave the wrong result set under the current query. Only
   * the newest request may write; a superseded one is discarded rather than displayed.
   */
  let loadSeq = 0

  async function load(query: AdminProjectsQuery): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminProject>>('/admin/projects', {
        locale: false,
        query: adminProjectsRequestQuery(query)
      })
      if (seq !== loadSeq) return
      items.value = [...res.data]
      total.value = res.meta.total
      totalPages.value = res.meta.totalPages
    } catch (error) {
      // A superseded request's failure is not the current query's failure — it must not clear the
      // newer request's rows or raise an error the operator would attach to the wrong list.
      if (seq !== loadSeq) return
      // Keep usable rows visible while the next page or filter result is unavailable. The page marks
      // them stale and offers retry; clearing them would turn a transient refresh failure into a
      // destructive whole-surface takeover.
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { items, total, totalPages, pending, forbidden, failed, load }
}

/**
 * One project: read for the editor, and the three writes.
 *
 * Every write THROWS on failure rather than swallowing it, so the editor can keep the operator's
 * unsaved input on screen and render the RFC 7807 problem — silently discarding edits it cannot
 * prove were stored is the one outcome a content editor must never produce.
 */
export function useAdminProject() {
  const api = useApi()

  const project = ref<AdminProject | null>(null)
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
      const res = await api<Envelope<AdminProject>>(`/admin/projects/${id}`, { locale: false })
      project.value = res.data
    } catch (error) {
      project.value = null
      // A deleted or mistyped id is a different answer from "you may not read this" and from "the
      // request broke", and each gets its own surface.
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else if (error instanceof ApiError && error.status === 404) notFound.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  async function create(body: CreateProjectPayload): Promise<AdminProject> {
    const res = await api<Envelope<AdminProject>>('/admin/projects', {
      method: 'POST',
      locale: false,
      body
    })
    project.value = res.data
    return res.data
  }

  /**
   * The response is the FULL updated entity and it REPLACES the held one, so what is on screen after
   * a save is confirmed server state rather than the optimistic echo of what was sent. That matters
   * here beyond the usual: the gallery comes back with server ids and the API's own `order`, and the
   * publication state comes back as the API resolved it — which is the only honest thing to re-seed
   * a publish control from.
   */
  async function update(id: string, body: UpdateProjectPayload): Promise<AdminProject> {
    const res = await api<Envelope<AdminProject>>(`/admin/projects/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    project.value = res.data
    return res.data
  }

  /**
   * `204 No Content` — there is no envelope to read back.
   *
   * `unknown`, not `void`: the endpoint answers with no body, and `void` as a type ARGUMENT is
   * rejected by `@typescript-eslint/no-invalid-void-type`. The value is discarded either way.
   */
  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/projects/${id}`, { method: 'DELETE', locale: false })
  }

  return { project, pending, forbidden, notFound, failed, load, create, update, remove }
}
