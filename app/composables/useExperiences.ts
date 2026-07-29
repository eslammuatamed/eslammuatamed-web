import type { Envelope, Experience } from '~/types/models'

/**
 * `GET /experiences` — the experience timeline (FR-PUB-021), through the single API door `useApi()`,
 * which puts `?locale=` on every GET (D10-6).
 *
 * The locale is the ROUTE's, not the reactive UI locale (D06-6). During the D03-13 deferred locale
 * commit the incoming page fetches while the UI locale still holds the outgoing language, so reading
 * the UI locale would request the wrong language for the page being rendered. The `useAsyncData` key
 * uses the SAME value that is sent, so a payload can never be cached under a key naming a different
 * language than the request that produced it.
 *
 * ORDER IS THE API'S, RENDERED VERBATIM. The API returns `startDate desc` tie-broken by `order asc`
 * — that IS the reverse-chronological requirement in FR-PUB-021, satisfied server-side — and orders
 * each entry's `technologies` by `Skill.order`. The client MUST NOT re-sort either one: the curated
 * order the owner controls in the CMS would stop being what visitors see (same rule as
 * `useProjects.ts`).
 *
 * Returns the unwrapped array: `/experiences` is a single read with a `{ data }` envelope and no
 * pagination, so there is no `meta` for a caller to need.
 */
export function useExperiences() {
  const api = useApi()
  const locale = useRouteLocale()

  return useAsyncData(
    () => `experiences:${locale.value}`,
    () => api<Envelope<Experience[]>>('/experiences', { locale: locale.value }).then(res => res.data),
    { watch: [locale] }
  )
}
