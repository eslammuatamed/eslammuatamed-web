import type { Envelope, Paginated, PaginationMeta } from '~/types/models'
import type { components } from '~/types/api'
import type { AdminTag } from '~/composables/admin-article-types'
import { ApiError } from '~/utils/api-error'
import {
  adminTagsQueryKey,
  adminTagsRequestQuery,
  type AdminTagsQuery
} from '~/composables/admin-tags-query'

/**
 * `GET /admin/tags` — the Tags collection read (FE-3 Taxonomy, `U2`).
 *
 * A sibling of `useAdminCategories`, kept as its OWN composable so the two sections of the
 * Taxonomy page own independent request state without inventing a shared list abstraction: the two
 * endpoints differ in nothing observable today, and a parameter that exists only to be constant is
 * exactly what §10.2 declines to extract on.
 *
 * The contract facts are the module's, restated where they bind:
 *
 * - canonical `page` and fixed `perPage=12`, with `{ data, meta }` from the server;
 * - `locale: false` on every call;
 * - ⚠ NO detail read exists — `/admin/tags/{id}` answers PATCH and DELETE only, so this composable
 *   deliberately offers no `load(id)`.
 */
type Schemas = components['schemas']

export function useAdminTags() {
  const api = useApi()

  const items = ref<AdminTag[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  const forbidden = ref(false)
  const failed = ref(false)

  let loadSeq = 0
  let loadedKey: string | null = null

  async function load(query: AdminTagsQuery = { page: 1 }): Promise<PaginationMeta | null> {
    const seq = ++loadSeq
    const key = adminTagsQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminTag>>('/admin/tags', {
        locale: false,
        query: adminTagsRequestQuery(query)
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
 * The three writes (`U3b`), throwing on failure for the same reason as every editor write. Tags
 * document NO relation conflict — `remove` models only the 204/400/404 contract, and no 409 branch
 * exists here to invent one.
 *
 * ⚠ Still NO detail read: `update` PATCHes the id straight from the clicked collection row.
 */
export function useAdminTagWrites() {
  const api = useApi()

  async function create(body: Schemas['CreateTagDto']): Promise<Schemas['AdminTagEntity']> {
    const res = await api<Envelope<Schemas['AdminTagEntity']>>('/admin/tags', {
      method: 'POST',
      locale: false,
      body
    })
    return res.data
  }

  async function update(id: string, body: Schemas['UpdateTagDto']): Promise<Schemas['AdminTagEntity']> {
    const res = await api<Envelope<Schemas['AdminTagEntity']>>(`/admin/tags/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    return res.data
  }

  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/tags/${id}`, { method: 'DELETE', locale: false })
  }

  return { create, update, remove }
}
