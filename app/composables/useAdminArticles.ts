import type { Envelope, Paginated } from '~/types/models'
import type {
  AdminArticle,
  AdminCategory,
  AdminTag,
  CreateArticlePayload,
  PreviewToken,
  UpdateArticlePayload
} from '~/composables/admin-article-types'
import {
  adminArticlesQueryKey,
  adminArticlesRequestQuery,
  type AdminArticlesQuery
} from '~/composables/admin-articles-query'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/articles` and the single-entity writes behind the Articles module (doc 11).
 *
 * SERVER-SIDE ONLY. Pagination and the status filter are query PARAMETERS; nothing is fetched
 * wholesale and narrowed in the browser, for the reasons `admin-articles-query.ts` records.
 *
 * ORDERING IS THE API'S. The admin list takes no sort parameter at all, so the client never
 * re-sorts what it received — for the same reason it never re-filters it.
 *
 * `locale: false` ON EVERY CALL. The admin DTOs are validated with `forbidNonWhitelisted` and none
 * declares `locale`, so an unsolicited `?locale=` is a 422 rather than a harmless extra parameter
 * (see `useApi`). Admin articles are locale-AGNOSTIC by design: the response carries the whole
 * translation map at once, which is exactly what an editor with no cross-locale fallback needs.
 */
export function useAdminArticles() {
  const api = useApi()

  const items = ref<AdminArticle[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no articles" — a different answer gets a different surface (D11-2). */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Monotonic request token. Changing the status filter and paging quickly issue overlapping
   * requests whose responses are not guaranteed to return in order — a slow `DRAFT` landing after
   * `PUBLISHED` would leave the wrong rows under the current filter. Only the newest request may
   * write; a superseded one is discarded rather than displayed.
   */
  let loadSeq = 0

  /**
   * The query the rows currently ON SCREEN describe, or `null` while nothing has loaded.
   *
   * This is what makes §14.9 criterion 2 expressible. "Keep usable content visible on a failed
   * request" is only true when the failed request was a REFRESH of what is already shown. If the
   * operator changed the status filter and THAT request failed, the rows underneath describe the
   * previous filter, and leaving them up would be the page asserting something false — the exact
   * failure `useAdminProjects` clears unconditionally to avoid. Distinguishing the two cases keeps
   * both properties instead of trading one for the other.
   */
  let loadedKey: string | null = null

  async function load(query: AdminArticlesQuery): Promise<void> {
    const seq = ++loadSeq
    const key = adminArticlesQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminArticle>>('/admin/articles', {
        locale: false,
        query: adminArticlesRequestQuery(query)
      })
      if (seq !== loadSeq) return
      items.value = [...res.data]
      total.value = res.meta.total
      totalPages.value = res.meta.totalPages
      loadedKey = key
    } catch (error) {
      // A superseded request's failure is not the current query's failure — it must not clear the
      // newer request's rows or raise an error the operator would attach to the wrong list.
      if (seq !== loadSeq) return

      const isRefreshOfWhatIsShown = loadedKey !== null && loadedKey === key
      if (!isRefreshOfWhatIsShown) {
        // A DIFFERENT view was requested and could not be produced. Whatever is on screen belongs
        // to the previous view, so it is cleared rather than left pretending to be current.
        items.value = []
        total.value = 0
        totalPages.value = 1
        loadedKey = null
      }

      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { items, total, totalPages, pending, forbidden, failed, load }
}

/**
 * One article: the editor's read, the three writes, and the preview token.
 *
 * Every write THROWS on failure rather than swallowing it, so the editor can keep the operator's
 * unsaved input on screen and render the RFC 7807 problem — silently discarding edits it cannot
 * prove were stored is the one outcome a content editor must never produce.
 */
export function useAdminArticle() {
  const api = useApi()

  const article = ref<AdminArticle | null>(null)
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
      const res = await api<Envelope<AdminArticle>>(`/admin/articles/${id}`, { locale: false })
      article.value = res.data
    } catch (error) {
      article.value = null
      // A deleted or mistyped id is a different answer from "you may not read this" and from "the
      // request broke", and each gets its own surface.
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else if (error instanceof ApiError && error.status === 404) notFound.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  async function create(body: CreateArticlePayload): Promise<AdminArticle> {
    const res = await api<Envelope<AdminArticle>>('/admin/articles', {
      method: 'POST',
      locale: false,
      body
    })
    article.value = res.data
    return res.data
  }

  /**
   * The response is the FULL updated entity and it REPLACES the held one, so what is on screen
   * after a save is confirmed server state rather than the optimistic echo of what was sent.
   *
   * That matters more here than it does for projects: `readingTimeMin` is computed server-side per
   * translation and `status` comes back as the API resolved it, so re-seeding from the response is
   * the only honest way to show what was actually stored.
   */
  async function update(id: string, body: UpdateArticlePayload): Promise<AdminArticle> {
    const res = await api<Envelope<AdminArticle>>(`/admin/articles/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    article.value = res.data
    return res.data
  }

  /**
   * `204 No Content` — there is no envelope to read back.
   *
   * `unknown`, not `void`: the endpoint answers with no body, and `void` as a type ARGUMENT is
   * rejected by `@typescript-eslint/no-invalid-void-type`. The value is discarded either way.
   */
  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/articles/${id}`, { method: 'DELETE', locale: false })
  }

  /**
   * Mint a short-lived preview URL for an article of ANY status, drafts included.
   *
   * Minted on demand rather than held on the entity because it expires (30 minutes) — a token
   * fetched when the editor opened would be stale by the time a long authoring session used it.
   */
  async function mintPreviewToken(id: string): Promise<PreviewToken> {
    const res = await api<Envelope<PreviewToken>>(`/admin/articles/${id}/preview-token`, {
      method: 'POST',
      locale: false
    })
    return res.data
  }

  return { article, pending, forbidden, notFound, failed, load, create, update, remove, mintPreviewToken }
}

/**
 * The taxonomy vocabularies the editor's category and tag controls read.
 *
 * Both endpoints are UNPAGINATED by contract, so this is one read each and the whole vocabulary is
 * in memory — the same shape `useAdminSkills` already uses for the project technology picker.
 *
 * A failure here is deliberately NOT fatal to the editor: it degrades the two pickers, and an
 * article's text is worth more than its taxonomy. The caller decides what to show.
 */
export function useAdminTaxonomy() {
  const api = useApi()

  const categories = ref<AdminCategory[]>([])
  const tags = ref<AdminTag[]>([])
  const pending = ref(false)
  const failed = ref(false)

  async function load(): Promise<void> {
    pending.value = true
    failed.value = false
    try {
      const [categoryRes, tagRes] = await Promise.all([
        api<Envelope<readonly AdminCategory[]>>('/admin/categories', { locale: false }),
        api<Envelope<readonly AdminTag[]>>('/admin/tags', { locale: false })
      ])
      categories.value = [...categoryRes.data]
      tags.value = [...tagRes.data]
    } catch {
      categories.value = []
      tags.value = []
      failed.value = true
    } finally {
      pending.value = false
    }
  }

  return { categories, tags, pending, failed, load }
}
