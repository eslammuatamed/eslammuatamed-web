import type { Ref } from 'vue'
import type { Envelope, SiteSettings } from '~/types/models'

/**
 * The ONE `GET /settings/site` read. Three public surfaces consume it under the shared
 * `settings:site:{locale}` key — `useSiteSettings()` (chrome, UI locale), `useAboutContent()`
 * (`/about`, route locale) and `useResumeData()` (`/resume`, route locale) — and they differ in
 * exactly one thing: WHICH locale ref they follow. That difference is deliberate and documented in
 * each caller; everything else is identical and now lives here.
 *
 * ## Why this is a shared function rather than three identical call sites
 *
 * It was three verbatim copies of the same `useAsyncData(key, fetcher, options)` triple. Every
 * property BLK-2 depends on — the shared-promise handler, the retry policy, the payload resolver,
 * the reactive key, `watch: [locale]` — had to hold in all three or the invariant broke silently in
 * whichever copy was missed, and the request-count gate only measures the routes it visits. Coupling
 * them by construction is the point: there is now no copy that can drift.
 *
 * ## `retry: 0` is required, not an optimization
 *
 * ofetch retries a failed GET once by default, so each reader cost TWO requests on the outage path —
 * the ×2 in BLK-2's measured 6 (3 readers × 2). Sharing the promise alone would have left 2. An
 * automatic retry against an API that just failed is also the wrong behaviour for this particular
 * read: it is a HARD dependency whose failure is a governed, user-visible state (D13-1) with its own
 * "Try again" control, so the retry decision belongs to the visitor, who can see that it failed,
 * rather than to a silent doubling inside the render. The 401 silent-refresh retry in `useApi` is
 * untouched — that is a different mechanism for a different cause, and this is a public read that
 * never carries a session.
 */
export function useSettingsRead(locale: Ref<string>) {
  const api = useApi()
  const nuxtApp = useNuxtApp()

  // Derived once. Writing the key expression twice inside the very function whose purpose is that no
  // copy can drift would be the same defect at a smaller scale: the async-data key and the key the
  // request is shared under MUST be the same string, and here they are the same expression.
  const key = () => `settings:site:${locale.value}`

  return useAsyncData(
    key,
    () =>
      sharedSettingsRequest(nuxtApp, key(), () =>
        api<Envelope<SiteSettings>>('/settings/site', { locale: locale.value, retry: 0 }).then(
          res => res.data
        )
      ),
    { watch: [locale], getCachedData: sharedSettingsCachedData }
  )
}
