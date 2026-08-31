import type { components } from '~/types/api'

/**
 * The CLOSED vocabulary of public Static Page SEO reads — derived from the adopted contract, never
 * hand-listed: `PublicPageSeoEntity['pageKey']` is exactly home/about/experience/projects/blog/
 * resume/contact. Arbitrary ids/slugs are therefore unrepresentable at the type level; admin SEO
 * surfaces (`/admin/seo/pages…`) are a different API and are unreachable through this composable.
 */
export type PublicPageSeoKey = components['schemas']['PublicPageSeoEntity']['pageKey']

/**
 * The PUBLIC read layer for one static page's SEO override — `GET /seo/pages/{pageKey}`
 * (FR-DSH-051 consumption; FE4-U2c1). The smallest reusable door the seven static pages will
 * `await` during SSR before computing final head metadata (U2c2 wires them).
 *
 * ## What this deliberately is NOT
 *
 * - **No head ownership**: zero `useHead`/`useSeoMeta`/canonical/OG/Twitter/verification/GTM/
 *   JSON-LD anywhere here — U2b resolves effective metadata and U2c2 owns the wiring.
 * - **No Settings read**: `/settings/site` stays owned and deduplicated by the public layout;
 *   combining PageSeo with Settings state happens in U2c2's callers.
 * - **No canonical policy**: the response may carry `canonicalUrl` because the CONTRACT does
 *   (storage/editing-only per the owner ruling); this layer neither validates, filters nor
 *   publishes it. strictSeo remains the sole rendered canonical/hreflang writer (D22-7/D22-8).
 * - **Not a fetch framework**: plain `useAsyncData` with a composite key. The Settings
 *   promise-sharing machinery (`utils/settings-request.ts`) is deliberately NOT reused — its
 *   ownership and its BLK-2 outage invariant belong to that read.
 *
 * ## Load-bearing behaviours (each pinned by the focused suite)
 *
 * - **Awaited SSR**: the caller writes `await usePublicPageSeo(key)`; there is no `lazy` and no
 *   `server: false`, so the first render already holds the final data — the established
 *   Settings-read pattern (an unawaited read serialises the fallback tier and swaps later, a head
 *   hydration mismatch).
 * - **Identity = page key + ROUTE locale** (`seo:page:{key}:{locale}`, reactive getter): Home can
 *   never reuse About's payload and EN can never reuse AR's. The locale is the ROUTE-resolved one
 *   (D06-6 `useRouteLocale()`), passed EXPLICITLY to `useApi` so the deferred-commit window cannot
 *   send the outgoing language; `useApi` injects exactly that one `?locale=` — none added here.
 * - **Client-side locale switch**: the key getter reads the reactive route locale, so a switch
 *   produces a NEW identity and Nuxt refetches into it (measured: the payload entry moves from
 *   `seo:page:about:en` to `seo:page:about:ar`). An explicit `watch: [locale]` is deliberately NOT
 *   added: paired with the reactive key it triggered TWO identical requests per switch (measured),
 *   and unlike the persistent public layout (whose WD-6 footer needs `watch` because it never
 *   remounts), these PAGE-scoped reads remount on the `/en ↔ /ar` navigation anyway.
 * - **Optional metadata, silent failures**: an unexpected 404/5xx/network failure lands in the
 *   returned `error` with `data === null`; the caller keeps rendering baseline metadata. No
 *   `createError`/`showError`, no retry UX — and `retry: 0` because an automatic retry against a
 *   just-failed optional read is hidden cost, not resilience (the same reasoning as Settings BLK-2,
 *   minus the visible-state part).
 * - **All-null is success**: a known page with nothing authored answers 200 with nullable fields
 *   (D10-24); it arrives here as a normal entity and falls through field-by-field in U2b.
 */
export function usePublicPageSeo(pageKey: PublicPageSeoKey) {
  const api = useApi()
  const routeLocale = useRouteLocale()

  return useAsyncData<components['schemas']['PublicPageSeoEntity'] | null>(
    () => `seo:page:${pageKey}:${routeLocale.value}`,
    () =>
      api<{ data: components['schemas']['PublicPageSeoEntity'] }>(`/seo/pages/${pageKey}`, {
        locale: routeLocale.value,
        retry: 0
      }).then(res => res.data)
  )
}
