import type { Envelope } from '~/types/models'
import type { components } from '~/types/api'
import type { AdminTag } from '~/composables/admin-article-types'
import { ApiError } from '~/utils/api-error'

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
 * - ZERO query parameters (an unsolicited query string is a 422) and NO `meta`;
 * - `{ data: [...] }` whole, in the server's order (`createdAt` ascending) — no `.sort()` anywhere;
 * - `locale: false` on every call;
 * - ⚠ NO detail read exists — `/admin/tags/{id}` answers PATCH and DELETE only, so this composable
 *   deliberately offers no `load(id)`.
 */
type Schemas = components['schemas']

export function useAdminTags() {
  const api = useApi()

  const items = ref<AdminTag[]>([])
  const pending = ref(false)
  const forbidden = ref(false)
  const failed = ref(false)

  let loadSeq = 0
  let hasLoaded = false

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminTag[]>>('/admin/tags', { locale: false })
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
