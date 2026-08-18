import type { DashboardLocale } from '~/utils/dashboard-locale'
import {
  DASHBOARD_LOCALE_COOKIE,
  DASHBOARD_LOCALE_MAX_AGE,
  dashboardDir,
  normalizeDashboardLocale
} from '~/utils/dashboard-locale'

/**
 * The Dashboard application locale — reactive state, persistence, and message readiness (D11-8).
 *
 * ONE MECHANISM FOR THE WHOLE DASHBOARD. Owner decision OD-11 (option B) makes the header control a
 * real application-language switcher, and explicitly forbids competing per-module localization
 * mechanisms. Everything that renders dashboard chrome reads its language from here, through
 * `useDashboardI18n()`.
 *
 * WHY THIS IS NOT `setLocale()`.
 * The obvious implementation — flip `@nuxtjs/i18n`'s global locale — is wrong here, and the reason
 * is structural rather than stylistic. Under `prefix_except_default` the global locale is DERIVED
 * FROM THE ROUTE. Setting it therefore does one of two things, both unacceptable:
 *
 *   1. it navigates to `/ar/dashboard/…` — a duplicate localized route tree, which D04-7 forbids
 *      and which the owner ruled out by name; or
 *   2. with navigation suppressed, locale and URL disagree, and every subsequent PUBLIC navigation
 *      inherits the mismatch — the exact route↔locale coupling that `useRouteLocale()` (D06-6) and
 *      the strict-SEO head contract (D22-7) are built on.
 *
 * So the dashboard keeps its own locale and leaves the global one alone. The global locale still
 * governs the public site; on a dashboard route it simply is not what the chrome reads.
 *
 * MESSAGE READINESS IS PART OF THE CONTRACT, not an afterthought. `@nuxtjs/i18n` v10 always
 * code-splits locale messages, so `t(key, …, { locale: 'ar' })` issued before `ar.json` has loaded
 * returns the RAW KEY PATH — silently, with no error and no warning in production. The first paint
 * of a cookie-`ar` dashboard is exactly that case, and it is entirely client-side because
 * `/dashboard/**` is `ssr: false`. `ensureMessages()` exists so a caller can await readiness before
 * the shell renders, and `setLocale()` awaits it before flipping so a switch can never paint a
 * frame of key paths either.
 */
export function useDashboardLocale() {
  const nuxtApp = useNuxtApp()

  /**
   * The persisted preference. `useCookie` is read once per request/mount and is reactive, so writing
   * to it here both updates the in-memory value and sets the cookie — no second write path.
   *
   * `default` is not used: an unset cookie and a corrupt one must resolve identically, and
   * `normalizeDashboardLocale` is the single place that decides. See its comment for why a bad value
   * must never propagate.
   */
  const cookie = useCookie<string | null | undefined>(DASHBOARD_LOCALE_COOKIE, {
    maxAge: DASHBOARD_LOCALE_MAX_AGE,
    sameSite: 'lax',
    path: '/'
  })

  /**
   * `useState`, not a module-scope `ref`: state shared across components must be per-request on the
   * server and per-app on the client, and a module-scope ref is neither (it leaks between requests).
   * Seeded from the cookie on first access.
   */
  const locale = useState<DashboardLocale>('dashboard:locale', () =>
    normalizeDashboardLocale(cookie.value)
  )

  const dir = computed(() => dashboardDir(locale.value))

  /**
   * Load the message catalogue for a dashboard locale, if it is not already in memory.
   *
   * `loadLocaleMessages` is `@nuxtjs/i18n`'s own composer extension (it is not part of vue-i18n) and
   * is idempotent — repeat calls for a loaded locale resolve immediately — so callers may await it
   * on every navigation without paying for it more than once.
   */
  async function ensureMessages(target: DashboardLocale = locale.value): Promise<void> {
    await nuxtApp.$i18n.loadLocaleMessages(target)
  }

  /**
   * Switch the dashboard language.
   *
   * AWAITS THE MESSAGES BEFORE FLIPPING. If the state changed first, every mounted dashboard
   * component would re-render against a locale whose catalogue is still in flight and paint key
   * paths for as long as the request takes. Ordering it this way makes that frame impossible rather
   * than unlikely.
   *
   * NO NAVIGATION, deliberately and testably. Switching language must not move the operator off the
   * entity they are editing, and must not discard unsaved translation state (D02-15) — which a
   * route change would do by remounting the page.
   */
  async function setLocale(next: DashboardLocale): Promise<void> {
    const target = normalizeDashboardLocale(next)
    if (target === locale.value) return

    await ensureMessages(target)
    locale.value = target
    cookie.value = target
  }

  return { locale, dir, setLocale, ensureMessages }
}
