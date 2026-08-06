import type { AdminSiteSettings, Envelope, UpdateSettingsPayload } from '~/types/models'
import { ApiError } from '~/utils/api-error'

/**
 * `GET`/`PATCH /admin/settings` for the Dashboard Profile surface.
 *
 * DISTINCT FROM `useSettingsRead()`, which is the PUBLIC `/settings/site` read. They are different
 * endpoints answering different questions: the public one resolves ONE locale and hides everything
 * unpublishable, the admin one returns the full translation MAP and the read-only `portrait`
 * descriptor. Reusing the public read here would have made the Arabic alt invisible whenever the
 * Dashboard happened to be in English.
 *
 * `locale: false`, as every admin call must be — `forbidNonWhitelisted` turns an unsolicited
 * `?locale=` into a 422 (see `useApi`).
 */
export function useAdminSettings() {
  const api = useApi()

  const settings = ref<AdminSiteSettings | null>(null)
  const pending = ref(false)
  const forbidden = ref(false)
  const failed = ref(false)

  async function load(): Promise<void> {
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Envelope<AdminSiteSettings>>('/admin/settings', { locale: false })
      settings.value = res.data
    } catch (error) {
      settings.value = null
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      pending.value = false
    }
  }

  /**
   * PARTIAL update — the caller sends only the fields its surface owns (D10-2).
   *
   * The response is the FULL updated entity and it REPLACES the held one, so what is on screen after
   * a save is confirmed server state rather than the optimistic echo of what was sent. That matters
   * here beyond the usual: the read-only `portrait` descriptor is re-resolved by the API from the new
   * `portraitAssetId`, so the preview only ever shows an association the server actually made.
   *
   * Throws on failure so the caller can keep the operator's unsaved input on screen and surface the
   * error, rather than silently discarding edits it cannot prove were stored.
   */
  async function patch(body: UpdateSettingsPayload): Promise<AdminSiteSettings> {
    const res = await api<Envelope<AdminSiteSettings>>('/admin/settings', {
      method: 'PATCH',
      locale: false,
      body
    })
    settings.value = res.data
    return res.data
  }

  return { settings, pending, forbidden, failed, load, patch }
}
