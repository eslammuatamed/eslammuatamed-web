import type { Envelope, SiteSettings } from '~/types/models'

// Shared read of GET /settings/site (D10-6), keyed by locale so each locale render caches distinctly.
// The home hero and the global footer both need it; a stable key lets Nuxt dedupe the request so the
// settings load happens once per locale render, not once per consumer (doc 20 §7 — no redundant reads).
export function useSiteSettings() {
  const api = useApi()
  const { locale } = useI18n()
  return useAsyncData(
    `settings:site:${locale.value}`,
    () => api<Envelope<SiteSettings>>('/settings/site').then(res => res.data)
  )
}
