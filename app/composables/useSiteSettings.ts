// Shared read of GET /settings/site (D10-6). The key is a reactive getter and `watch:[locale]` re-runs
// the fetch on a client-side locale switch — this matters because the footer lives in the persistent
// `default` layout and never remounts, so without the watch its API-localized `availabilityStatus`
// would stay on the previous locale (a locale-parity regression, code-review WD-6).
// Mirrors the blog/index reactive-key idiom.
//
// The per-locale key is what makes the shared page+footer+layout read ONE request — but
// the key alone does not dedupe anything. It takes BOTH mechanisms in `useSettingsRead`:
// `sharedSettingsCachedData` (shares a settled VALUE via `payload.data`, success only) and
// `sharedSettingsRequest` (shares the request-scoped PROMISE, which is what makes the OUTAGE path one
// request too — BLK-2). See utils/settings-cache.ts, utils/settings-request.ts and
// e2e/dedupe/settings-dedupe.spec.ts.
//
// This line previously cited "doc 20 §7" as the governing requirement. That citation was FALSE —
// doc 20 §7 is API Performance (Prisma query discipline, N+1, caching layers) and the document never
// mentions this read. A documentation audit found that NO canonical document specifies the Settings
// read pattern at all, so the single-request rule is an IMPLEMENTATION invariant whose authority is
// the lane that measures it, not a governed requirement. Recorded plainly because a comment that
// invents a citation is worse than one that admits the gap.
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
  const { locale } = useI18n()
  return useSettingsRead(locale)
}
