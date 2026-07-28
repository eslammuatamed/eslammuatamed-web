import type { Envelope } from '~/types/models'

/**
 * Shared loader for the draft-preview routes (`/preview/{articles|projects}/{id}?token=`, D10-11:
 * the API signs, the Web renders). It centralises the load-bearing security of a preview surface in
 * ONE place so an individual page can never drift out of policy:
 *
 *  - a `noindex, nofollow` robots meta and a `no-referrer` referrer meta, complementing the
 *    `X-Robots-Tag` / `Referrer-Policy` / `Cache-Control: no-store` response headers set for
 *    `/preview/**` in `nuxt.config` route rules — a preview must never be indexed, cached, or leak
 *    its (token-bearing) URL through the `Referer` of any subresource;
 *  - the token rides on the one API call and nowhere else. Any failure collapses to a single
 *    `unavailable` flag WITHOUT re-throwing: the API returns 404 for an absent / expired / tampered /
 *    wrong-type token (draft concealment — never 401/403, FR-PUB-046), and by not throwing we keep
 *    the token out of Nuxt's error flow / error page and reveal nothing about WHY validation failed.
 *
 * Locale follows the i18n route (auto-injected as `?locale=` by `useApi`), exactly like the public
 * detail pages; the optional `?locale=` query on the minted link is normalised into the route by the
 * `preview-locale` middleware, so the route locale stays the single source of truth for chrome,
 * `<html dir>`, and the API locale.
 */
export async function usePreview<T>(resource: 'articles' | 'projects') {
  const route = useRoute()
  const api = useApi()

  const id = computed(() => String(route.params.id))
  const token = computed(() => {
    const raw = route.query.token
    return (Array.isArray(raw) ? raw[0] : raw) ?? ''
  })

  // Route-resolved, per D06-6 — which is what the paragraph above already claims the preview surface
  // does. Reading the reactive UI locale instead would break that claim during a locale switch.
  const locale = useRouteLocale()

  // Registered before the await so it runs in a valid Nuxt context (auto-import caution). The robots
  // meta mirrors error.vue's established `useSeoMeta({ robots })` pattern; the referrer meta backs up
  // the response header for in-app navigation, where fresh headers are not re-issued.
  useSeoMeta({ robots: 'noindex, nofollow' })
  useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })

  // The error is SWALLOWED inside the handler, never surfaced as `useAsyncData`'s `error`. A failed
  // fetch's error message embeds the token-bearing request URL, and Nuxt serialises `error` into the
  // client hydration payload — so surfacing it would leak the token into the HTML (verified). Since
  // the API already conceals draft existence (404 for any absent/expired/tampered/wrong-type token,
  // never 401/403), we need no detail from it: every failure collapses to one opaque result.
  const { data } = await useAsyncData(
    () => `preview:${resource}:${id.value}:${locale.value}`,
    async () => {
      try {
        const res = await api<Envelope<T>>(`/preview/${resource}/${id.value}`, {
          locale: locale.value,
          query: { token: token.value }
        })
        return { document: res.data, ok: true }
      } catch {
        return { document: null, ok: false }
      }
    }
  )

  const document = computed(() => data.value?.document ?? null)
  const unavailable = computed(() => !data.value?.ok || !data.value.document)

  return { document, unavailable }
}
