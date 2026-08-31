import type { Envelope } from '~/types/models'
import type { AdminSkill } from '~/composables/admin-project-types'
import type { DashboardLocale } from '~/utils/dashboard-locale'
import { ApiError } from '~/utils/api-error'

/**
 * `GET /admin/skills` — the technology vocabulary a project's `technologyIds` are drawn from.
 *
 * TECHNOLOGIES ARE SKILLS. The contract says so in as many words ("Skill ids; the project technology
 * set is replaced on update"), and there is no separate technology entity to fetch. The admin read
 * is used rather than the public one because a project may legitimately reference a skill with
 * `isPublic: false` — hidden skills keep their project links — and the public listing would simply
 * not contain it, leaving a saved technology invisible and un-deselectable in the editor.
 *
 * THE LIST IS UNPAGINATED AND UNFILTERED, by contract: the endpoint declares no query parameters and
 * answers `{ data: [...] }` with no `meta`. So this is one request for the whole vocabulary, and the
 * picker narrows it in the browser — which is correct HERE and nowhere else in this module, because
 * this is a closed vocabulary the API hands over whole, not a paginated collection.
 *
 * `locale: false`, as every admin call must be — `forbidNonWhitelisted` turns an unsolicited
 * `?locale=` into a 422 (see `useApi`).
 */
export function useAdminSkills() {
  const api = useApi()

  const skills = ref<AdminSkill[]>([])
  const pending = ref(false)
  const forbidden = ref(false)
  const failed = ref(false)

  // Two picker mounts, or a collection retry, can overlap. Only the newest response may own the
  // shared instance's state; a slower earlier response is stale even though this endpoint has no
  // query parameters.
  let loadSeq = 0

  async function load(): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminSkill[]>>('/admin/skills', { locale: false })
      if (seq !== loadSeq) return
      skills.value = [...res.data]
    } catch (error) {
      if (seq !== loadSeq) return
      skills.value = []
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      if (seq === loadSeq) pending.value = false
    }
  }

  return { skills, pending, forbidden, failed, load }
}

/**
 * The label to show for one skill.
 *
 * Falls back to the SLUG, never to the other locale's label: a slug is a neutral, unambiguous
 * identifier the operator can still act on, while an Arabic label rendered as if it were the English
 * one is a confident wrong answer.
 *
 * THE LABEL LOCALE IS THE DASHBOARD'S, and it is a parameter rather than a hard-coded `en`. It was
 * `en` because the chrome was English-only, with the reasoning stated as such — OD-11 (D02-15)
 * removes that premise, so an Arabic-working operator now reads Arabic skill names. The
 * no-cross-locale-fallback rule is unchanged: a skill with no label in the requested language shows
 * its slug, exactly as before.
 */
export function skillLabel(skill: AdminSkill, locale: DashboardLocale): string {
  const label = skill.translations[locale]?.label
  return label && label.trim().length > 0 ? label : skill.slug
}
