import type { NuxtApp, AsyncDataRequestStatus  } from '#app'
import type { SiteSettings } from '~/types/models'

/**
 * `getCachedData` for the shared `settings:site:{locale}` reads.
 *
 * ## Why this is required, and why the shared key alone was not enough
 *
 * Three composables deliberately share one async-data key so the chrome, the page body and the
 * public layout resolve `GET /settings/site` from a SINGLE request: `useSiteSettings()` (chrome,
 * UI locale), `useAboutContent()` (`/about`, route locale) and `useResumeData()` (`/resume`,
 * route locale). That collapse was documented as a property of the shared key. **It never
 * happened.** Nuxt's default resolver (`nuxt@4.4.8`, `app/composables/asyncData.js:485`) is
 *
 * ```js
 * if (nuxtApp.isHydrating) return nuxtApp.payload.data[key]   // client only
 * if (cause !== 'refresh:manual' && cause !== 'refresh:hook')
 *   return nuxtApp.static.data[key]                           // prerendered payloads only
 * ```
 *
 * During a normal SSR render `isHydrating` is false and `static.data` is empty, so it returns
 * `undefined` for every call site. The only other dedupe path, `nuxtApp._asyncDataPromises[key]`,
 * matches CONCURRENT calls and is cleared on settle — and these sites `await` sequentially as
 * nested component setups run, so no promise is ever in flight when the next one starts. Measured:
 * `/about` issued one request per call site (2 on the pre-013 tree, 3 once the public layout began
 * reading tier 2). See `e2e/dedupe/settings-dedupe.spec.ts`.
 *
 * Reading `payload.data` — which `asyncData.js:432` populates on settle, during the render — makes
 * the documented single-request invariant actually true.
 *
 * ## Deliberate behaviours
 *
 * - **A manual `refresh()` always refetches.** `index.vue` exposes retry after a failed settings
 *   read (D13-1); serving it the cached miss would make the retry button inert.
 * - **A failed read is never cached.** `asyncData.js` only writes `payload.data[key]` on success, so
 *   a failure never reaches this resolver at all and every `pickMeta` still falls through to the
 *   committed tier-3 value. The metadata floor is untouched. That success-only behaviour is also why
 *   this resolver cannot fix the outage path on its own, and must not be made to try: returning a
 *   value for a failed key would make `asyncData.js` clear the shared `error`. Sharing the failure is
 *   `utils/settings-request.ts`'s job, at the promise level, where the error survives (BLK-2).
 * - **A locale change still refetches**, because the key itself carries the locale: the incoming
 *   `settings:site:{newLocale}` has no payload entry yet. The UI-locale/route-locale divergence
 *   during the D03-13 deferred commit therefore keeps working exactly as documented — each side
 *   reads its own key, and the one that catches up finds the payload already there.
 * - **Client-side navigation reuses the session payload.** This is the intended shared-read
 *   behaviour, not a new cache: site chrome does not change mid-session, and an explicit
 *   `refresh()` still bypasses it.
 */
export function sharedSettingsCachedData(
  key: string,
  nuxtApp: NuxtApp,
  ctx: { cause: AsyncDataRequestStatus | string }
): SiteSettings | undefined {
  if (ctx.cause === 'refresh:manual' || ctx.cause === 'refresh:hook') return undefined
  return (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]) as SiteSettings | undefined
}
