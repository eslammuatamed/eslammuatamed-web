import { resolveRouteLocale } from '~/utils/route-locale'

/**
 * The effective locale for public content reads (D06-6, doc 06 §4) — resolved from the ROUTE, not
 * from the reactive UI locale.
 *
 * Use this for every public content request and for the `useAsyncData` key that names it; the two
 * must agree, or a payload gets cached under a key that claims a different language than the one it
 * was fetched in.
 *
 * Not for dashboard, auth or mutation calls: those are not route-locale-scoped content reads, and
 * `useApi()` keeps injecting the current UI locale for them.
 *
 * The configuration comes from the i18n module's own public composer state (`locales`,
 * `defaultLocale`), so adding a configured locale needs no change here and nothing reads an
 * `@internal` field (principle 16 — the rejected `__pendingLocale` alternative in D06-6).
 */
export function useRouteLocale() {
  const route = useRoute()
  // `$i18n`, not `useI18n()` — the same reason `useApi()` documents for its own locale read: `$i18n`
  // is the request-scoped Composer and is safe outside component setup, whereas the setup-only
  // `useI18n()` throws MUST_BE_CALL_SETUP_TOP. `useSlugRedirect()` returns a function that callers
  // hold across awaits, so this composable must not be setup-only.
  const { $i18n } = useNuxtApp()

  return computed(() =>
    resolveRouteLocale(route.path, {
      codes: $i18n.locales.value.map(locale => (typeof locale === 'string' ? locale : locale.code)),
      defaultLocale: $i18n.defaultLocale
    })
  )
}
