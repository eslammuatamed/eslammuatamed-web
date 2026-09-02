import type { Paginated, PaginationMeta } from '~/types/models'
import type { AdminSkill } from '~/composables/admin-project-types'
import { ApiError } from '~/utils/api-error'
import {
  adminSkillsQueryKey,
  adminSkillsRequestQuery,
  type AdminSkillsQuery
} from '~/composables/admin-skills-query'

/**
 * The Skills COLLECTION read only. It is deliberately separate from `useAdminSkills`, which still
 * owns the shared Project/Experience picker vocabulary until its dedicated all-page migration.
 */
export function useAdminSkillsCollection() {
  const api = useApi()
  const items = ref<AdminSkill[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  const forbidden = ref(false)
  const failed = ref(false)
  let loadSeq = 0
  let loadedKey: string | null = null

  async function load(query: AdminSkillsQuery = { page: 1 }): Promise<PaginationMeta | null> {
    const seq = ++loadSeq
    const key = adminSkillsQueryKey(query)
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<AdminSkill>>('/admin/skills', {
        locale: false,
        query: adminSkillsRequestQuery(query)
      })
      if (seq !== loadSeq) return null
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
