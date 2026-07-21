import type { Envelope, SiteSettings } from '~/types/models'

// Shared read of GET /settings/site (D10-6). The key is a reactive getter and `watch:[locale]` re-runs
// the fetch on a client-side locale switch — this matters because the footer lives in the persistent
// `default` layout and never remounts, so without the watch its API-localized `availabilityStatus`
// would stay on the previous locale (a locale-parity regression, code-review WD-6). The per-locale key
// still dedupes the shared page+footer read (doc 20 §7). Mirrors the blog/index reactive-key idiom.
export function useSiteSettings() {
  const api = useApi()
  const { locale } = useI18n()
  return useAsyncData(
    () => `settings:site:${locale.value}`,
    () => api<Envelope<SiteSettings>>('/settings/site').then(res => res.data),
    { watch: [locale] }
  )
}
