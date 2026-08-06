/**
 * `GET /settings/site` for ABOUT PAGE CONTENT — the About prose, the portrait descriptor and the
 * positioning that feed `/about` (FR-PUB-020).
 *
 * ## Why this is not `useSiteSettings()`
 *
 * `useSiteSettings()` deliberately follows the reactive UI locale, and documents why: it feeds
 * PERSISTENT CHROME (the footer, in the `default` layout), which the D03-13 page transition does not
 * conceal, so its text must flip in the same frame as the rest of the chrome or a mixed-language
 * frame becomes visible.
 *
 * This read feeds PAGE CONTENT, which is concealed during that transition, so it takes the ROUTE's
 * locale (D06-6) like every other public content read. Reusing the chrome composable here would put
 * the page body on the outgoing language during the deferred locale commit — the exact cross-locale
 * bleed D10-6 and D06-6 exist to prevent, and the one thing the About slice must not do, since the
 * governed copy is locale-specific and must never be borrowed across locales.
 *
 * ## Why this does not double the request
 *
 * The `useAsyncData` key uses the SAME `settings:site:{locale}` namespace as `useSiteSettings()`,
 * only derived from the route instead of the UI. Whenever the two locales agree — every SSR render
 * and every initial load — the keys are identical and both callers resolve from one request.
 * They diverge only during the D03-13 deferred commit, and then divergence is the point: the page
 * gets the incoming language while the chrome still holds the outgoing one, each under its own key,
 * and the chrome finds the payload already cached when it catches up.
 *
 * That collapse comes from the two mechanisms inside `useSettingsRead`, NOT from the shared key by
 * itself. Nuxt's default resolver returns nothing during SSR, so before `sharedSettingsCachedData`
 * this page issued its own request on top of the footer's — measured, 2 on `/about`; and on the
 * outage path, where no payload is ever written, it takes `sharedSettingsRequest` as well (BLK-2).
 * See utils/settings-cache.ts and utils/settings-request.ts.
 */
export function useAboutContent() {
  return useSettingsRead(useRouteLocale())
}
