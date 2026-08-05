import type { NuxtApp } from '#app'
import type { SiteSettings } from '~/types/models'

/**
 * The request-scoped shared `GET /settings/site` OPERATION (BLK-2).
 *
 * ## What this fixes that `sharedSettingsCachedData` could not
 *
 * `utils/settings-cache.ts` shares a settled **value** by reading `nuxtApp.payload.data[key]`. Nuxt
 * writes that entry **only on success** (`asyncData.js`), so on the outage path nothing is shared and
 * every call site refetches. Measured on one SSR render of `/` with `/settings/site` answering 503:
 * **6 requests** — the three readers (chrome, public layout, page) each retried once, because ofetch
 * retries a failed GET by default. The amplification landed precisely on an API already failing.
 *
 * This shares the **promise** instead of the value, so all readers in one render await ONE settled
 * outcome — success *or* failure. The two mechanisms are complementary, not alternatives: the payload
 * resolver still short-circuits the successful path before a handler ever runs (and across a client
 * navigation), while this collapses whatever does reach the handler.
 *
 * ## Why not a cached failure value — proven unsafe, not merely disliked
 *
 * Teaching `getCachedData` to return something for a known-failed key is the obvious fix and it is
 * wrong. `asyncData.js` executes `asyncData.error.value = void 0` whenever `getCachedData` returns a
 * value, so the later readers would receive `data = null` with **no error**. Setup order is
 * `app.vue` → layout → page, so the layout would consume the single real failure and `index.vue` —
 * which owns the governed D13-1 "API unavailable" state — could be left with nothing to render. That
 * trades a request count for a user-visible correctness regression in a hard-dependency state.
 *
 * A rejected promise has the opposite property: every awaiting reader observes the same rejection,
 * and because `useAsyncData` builds `error` as `toRef(nuxtApp.payload._errors, key)`, all same-key
 * readers already share ONE error ref. The failure reaches every consumer by construction.
 *
 * ## Scope, and why it differs between server and client
 *
 * The map is keyed by `NuxtApp` in a `WeakMap`, which IS the request scope: the server builds a fresh
 * `NuxtApp` per request and drops it afterwards, so entries cannot leak between visitors — the reason
 * this is not a module-level `Map`, which on the server would be shared by every concurrent request
 * and would serve one visitor's settings (or outage) to another.
 *
 * - **Server: the entry survives for the whole render.** SSR readers do not run concurrently — nested
 *   component setups `await` in sequence, so nothing is ever in flight when the next reader starts.
 *   Sharing only in-flight work would therefore share nothing at all, which is exactly why Nuxt's own
 *   `_asyncDataPromises` (cleared on settle) never deduped these call sites.
 * - **Client: the entry is dropped when it settles.** There the readers that matter ARE concurrent —
 *   a locale switch fires all three `watch: [locale]` callbacks in one reactive flush — so in-flight
 *   sharing is sufficient. Dropping it keeps a failure from being pinned for the rest of the session:
 *   the governed D13-1 retry, and any later navigation, issue a real request against an API that may
 *   have recovered. Nothing here caches `null`; a failure is re-attempted, never masked.
 */
const settingsRequests = new WeakMap<NuxtApp, Map<string, Promise<SiteSettings>>>()

export function sharedSettingsRequest(
  nuxtApp: NuxtApp,
  key: string,
  fetcher: () => Promise<SiteSettings>
): Promise<SiteSettings> {
  let byKey = settingsRequests.get(nuxtApp)
  if (!byKey) {
    byKey = new Map()
    settingsRequests.set(nuxtApp, byKey)
  }

  const existing = byKey.get(key)
  if (existing) return existing

  const request = fetcher()
  byKey.set(key, request)

  // ONE detached observer, doing both jobs, because they must not be two chains.
  //
  // 1. It SETTLES the rejection. Readers attach one after another as nested setups run, so between
  //    the first reader's failure and the next reader arriving there is a window in which the
  //    rejection has no handler. Without this it surfaces as an unhandled rejection — measured, in
  //    this file's own unit spec.
  // 2. On the client it RELEASES the entry, so a settled failure is never pinned for the session.
  //
  // Deliberately `then(onFulfilled, onRejected)` rather than `catch()` + `finally()`: `finally()`
  // returns a DERIVED promise that re-raises the same rejection, which is a second unhandled
  // rejection of its own — the exact defect this shape replaced. Supplying both handlers here means
  // the derived promise settles cleanly and nothing propagates. Callers still receive `request`
  // itself, so the rejection they observe is the original, untouched.
  const release = () => {
    // Guard the identity: a manual retry may already have replaced this entry, and deleting a newer
    // in-flight request would silently un-share it.
    if (import.meta.client && byKey.get(key) === request) byKey.delete(key)
  }
  void request.then(release, release)

  return request
}
