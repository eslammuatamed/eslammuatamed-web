import type { Envelope } from '~/types/models'
import type { AdminSkill } from '~/composables/admin-project-types'
import type { CreateSkillPayload, UpdateSkillPayload } from '~/composables/admin-skill-form'
import { ApiError } from '~/utils/api-error'


/** The single Skill read/write surface used by the create and edit editor. */
export function useAdminSkill() {
  const api = useApi()

  const skill = ref<AdminSkill | null>(null)
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
      const res = await api<Envelope<AdminSkill>>(`/admin/skills/${id}`, { locale: false })
      skill.value = res.data
    } catch (error) {
      skill.value = null
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else if (error instanceof ApiError && error.status === 404) notFound.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  async function create(body: CreateSkillPayload): Promise<AdminSkill> {
    const res = await api<Envelope<AdminSkill>>('/admin/skills', {
      method: 'POST',
      locale: false,
      body
    })
    skill.value = res.data
    return res.data
  }

  async function update(id: string, body: UpdateSkillPayload): Promise<AdminSkill> {
    const res = await api<Envelope<AdminSkill>>(`/admin/skills/${id}`, {
      method: 'PATCH',
      locale: false,
      body
    })
    skill.value = res.data
    return res.data
  }

  async function remove(id: string): Promise<void> {
    await api<unknown>(`/admin/skills/${id}`, { method: 'DELETE', locale: false })
  }

  return { skill, pending, forbidden, notFound, failed, load, create, update, remove }
}
