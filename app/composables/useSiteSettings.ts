import type { Envelope, SiteSettings } from '~/types/models'

// Shared read of GET /settings/site (D10-6). The key is a reactive getter and `watch:[locale]` re-runs
// the fetch on a client-side locale switch — this matters because the footer lives in the persistent
// `default` layout and never remounts, so without the watch its API-localized `availabilityStatus`
// would stay on the previous locale (a locale-parity regression, code-review WD-6). The per-locale key
// still dedupes the shared page+footer read (doc 20 §7). Mirrors the blog/index reactive-key idiom.
//
// THE LOCALE HERE IS THE UI LOCALE, NOT THE ROUTE'S — deliberately, and it is the one public read that
// differs. D06-6 exists to stop a per-locale-slug read (D04-2) asking for the incoming slug in the
// outgoing language, which 404s. This read has no slug and cannot 404 on a locale mismatch; what it
// feeds is PERSISTENT CHROME (the footer, in the `default` layout), which the D03-13 page transition
// does not conceal. Switching it to the route locale was tried and measured: the footer's Arabic
// `availabilityStatus` appeared while the header was still English —
//     footerAR=false navAR=false → footerAR=TRUE navAR=FALSE → footerAR=true navAR=true
// i.e. a visible mixed-language frame, which is precisely what D03-13's single-frame commit exists to
// prevent. Following the UI locale keeps this text flipping in the same frame as the rest of the
// chrome. Page CONTENT stays on the route locale, because it is concealed during the transition.
export function useSiteSettings() {
  const api = useApi()
  const { locale } = useI18n()
  return useAsyncData(
    () => `settings:site:${locale.value}`,
    () => api<Envelope<SiteSettings>>('/settings/site', { locale: locale.value }).then(res => res.data),
    { watch: [locale] }
  )
}
