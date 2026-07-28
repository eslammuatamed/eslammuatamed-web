import type { NitroFetchOptions } from 'nitropack'

/**
 * Options for one API call: ofetch's own options plus the locale override defined by D06-6.
 */
export interface ApiRequestOptions extends NitroFetchOptions<string> {
  /**
   * Locale to send as `?locale=` on a public read (D06-6, doc 06 §4).
   *
   * Public content composables pass the ROUTE-resolved locale (`useRouteLocale()`), because during
   * the D03-13 deferred locale commit the reactive UI locale still holds the OUTGOING language while
   * the incoming page is already fetching its content. Omit it — as dashboard, auth and mutation
   * callers do — to keep the previous behaviour of using the current UI locale.
   */
  locale?: string
}

/**
 * The single API door (doc 06 §2, principle 12). Every call to the NestJS API goes through
 * here — base URL from env, bearer from the memory store (D11-1), locale on public reads
 * (D10-6), one RFC 7807 error shape, and a single silent-refresh retry on 401 (flow F-D1).
 * Raw `$fetch` against the API anywhere else is a defect, enforced by the `no-restricted-syntax`
 * ban in eslint.config.mjs (doc 15 §2); the one legitimate internal `/api/prose` Nitro call carries
 * a targeted disable citing the internal-route exemption.
 */
export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  // `$i18n` is the request-scoped i18n Composer, typed by @nuxtjs/i18n (`$i18n: Composer`). It is
  // the SSR-safe way to read the current locale from a composable that ALSO runs outside component
  // setup — the auth store actions and the `auth` route middleware both call `useApi()`, where the
  // setup-only `useI18n()` throws MUST_BE_CALL_SETUP_TOP (principle 16: the documented composable
  // pattern for this context, not the fabricated `as {…}` cast this replaced).
  const { $i18n } = useNuxtApp()

  const client = $fetch.create({
    baseURL: config.public.apiBase,
    // Refresh cookie rides on auth/admin calls; same-site in every environment (D19-3), so
    // sending it on public reads is harmless and keeps one client config.
    credentials: 'include',
    onRequest({ options }) {
      const headers = (options.headers = new Headers(options.headers))
      if (auth.accessToken) {
        headers.set('Authorization', `Bearer ${auth.accessToken}`)
      }
    }
  })

  return async function apiFetch<T>(request: string, options: ApiRequestOptions = {}): Promise<T> {
    const { locale, ...fetchOptions } = options
    const method = (fetchOptions.method ?? 'GET').toUpperCase()

    // Public reads are locale-scoped (D10-6); content arrives already localized from the API. WHICH
    // locale is D06-6: the caller's explicit one when it knows the content language of the page it is
    // building, otherwise the current UI locale, which is correct everywhere except inside the D03-13
    // deferred locale commit. Resolved here rather than in `onRequest` so there is exactly one place
    // the parameter can come from. An explicit `query.locale` still wins, as it always did.
    const localized: NitroFetchOptions<string> = method === 'GET'
      ? { ...fetchOptions, query: { locale: locale ?? $i18n.locale.value, ...fetchOptions.query } }
      : fetchOptions

    // Never retry the refresh endpoint itself — a 401 there means the session is truly gone.
    const isAuthRoute = request.startsWith('/auth/')
    return requestWithRefreshRetry<T>(
      // `client` is Nuxt's Nitro-typed $fetch; against an external API the response maps to the
      // caller's T, which the generic passthrough cannot prove — assert Promise<T> at this one door.
      () => client<T>(request, localized) as Promise<T>,
      () => auth.refresh(),
      { retry: !isAuthRoute }
    )
  }
}
