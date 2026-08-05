import type { Envelope, Skill } from '~/types/models'

/**
 * The three public reads that compose the HTML résumé (FR-PUB-023).
 *
 * ## FR-PUB-024 is satisfied by construction, not by convention
 *
 * "No second source of truth" is enforced here by *reusing the reads themselves* rather
 * than by agreeing not to duplicate them:
 *
 * - **Experience** calls `useExperiences()` — the very composable `/experience` uses. Not a
 *   copy of it, not a second request with the same URL: the same function, so the same
 *   `experiences:{locale}` key, the same API-owned ordering, the same verbatim rendering
 *   contract. If Experience ever changes shape or ordering, both pages change together and
 *   neither can silently drift.
 * - **Skills** reads `/skills` under its own key. The home page and `/projects` each keep
 *   their own key for the same endpoint (`home:skills:`, `projects:technologies:`), which is
 *   the established idiom: one key per consuming surface, one endpoint, one owner of order.
 * - **Settings** calls `useSettingsRead()` — the same function the chrome (`useSiteSettings()`)
 *   and `/about` (`useAboutContent()`) call, so the page body and the persistent footer resolve
 *   from ONE request whenever their locales agree: every SSR render and every initial load. The
 *   shared key alone dedupes nothing during SSR; it takes `sharedSettingsCachedData` on the
 *   healthy path and `sharedSettingsRequest` on the outage path (BLK-2). See
 *   utils/settings-cache.ts, utils/settings-request.ts and evidence/ab-request-count.md.
 *
 * ## Locale
 *
 * Route locale (D06-6) for all three, like every other public content read: during the
 * D03-13 deferred locale commit the incoming page's `setup()` still sees the OUTGOING
 * reactive locale, so reading it would fetch the wrong language for the page being
 * rendered. Each `useAsyncData` key uses the SAME value that is sent, so a payload can never
 * be cached under a key naming a different language than the request that produced it.
 *
 * The settings read deliberately diverges from the chrome's UI-locale read only during that
 * transition window — the page gets the incoming language, the chrome finishes the outgoing
 * frame, and the chrome then finds the payload already cached. No request is duplicated in
 * either direction.
 *
 * ## Independent failure
 *
 * Three separate `useAsyncData` calls, not one aggregate: each captures its own failure into
 * its own `.error` so a dead `/skills` degrades the Skills section alone and never blanks a
 * résumé whose Experience loaded fine (NFR-DEGRADE, doc 13 §2).
 */
export function useResumeData() {
  const api = useApi()
  const locale = useRouteLocale()

  const settings = useSettingsRead(locale)

  // The shared composable, called — not re-implemented. This line IS the FR-PUB-024 proof.
  const experiences = useExperiences()

  const skills = useAsyncData(
    () => `skills:${locale.value}`,
    () => api<Envelope<Skill[]>>('/skills', { locale: locale.value }).then(res => res.data),
    { watch: [locale] }
  )

  return { settings, experiences, skills }
}
