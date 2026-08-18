/**
 * The Dashboard application locale — pure rules, no Vue, no Nuxt (D11-8).
 *
 * The Dashboard chrome ships bilingual EN/AR (**D02-15**, owner decision OD-11 option B), and its
 * language is an OPERATOR PREFERENCE rather than a route segment: dashboard routes stay unprefixed
 * in both languages and `/ar/dashboard/**` is not a route (**D04-7**).
 *
 * This module holds the parts that are decidable without a running app, so they can be unit-tested
 * directly: what counts as a valid preference, what an untrusted stored value normalizes to, and
 * which direction a locale implies. The reactive state, the cookie and the message loading live in
 * `useDashboardLocale()`; the translation binding in `useDashboardI18n()`.
 */

/** The dashboard languages, in the order the switcher presents them. */
export const DASHBOARD_LOCALES = ['en', 'ar'] as const

export type DashboardLocale = (typeof DASHBOARD_LOCALES)[number]

/**
 * Cookie name for the persisted preference.
 *
 * A cookie rather than `localStorage` for one reason that matters and one that does not. The one
 * that matters: it is the mechanism the rest of this app already uses for a UI preference
 * (`useColorMode`), so the dashboard language is stored the same way the dashboard theme is, and an
 * operator clearing site data loses both together rather than one of them. The one that does not:
 * SSR readability is irrelevant here, because `/dashboard/**` is `ssr: false` (D06-1) — nothing
 * server-renders this preference, so no hydration mismatch is possible from it either.
 *
 * NOT `httpOnly`, deliberately: this is a display preference read by client code, not a credential.
 * The dashboard's actual credentials are governed separately (D11-1 — access token in memory,
 * refresh token in an `httpOnly` cookie).
 */
export const DASHBOARD_LOCALE_COOKIE = 'dashboard_locale'

/** One year. A language preference that expires with the session would be no preference at all. */
export const DASHBOARD_LOCALE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * The fallback when nothing is stored yet.
 *
 * English, matching `i18n.defaultLocale`, so a first-ever dashboard load is identical to what
 * shipped before OD-11. Switching to Arabic is then an explicit act that is remembered — which is
 * the difference between a preference and a guess. Browser-language detection is deliberately NOT
 * used: D10-6 rules out `Accept-Language` heuristics for this product, and an admin surface is the
 * last place to start inferring.
 */
export const DASHBOARD_LOCALE_DEFAULT: DashboardLocale = 'en'

export function isDashboardLocale(value: unknown): value is DashboardLocale {
  return typeof value === 'string' && (DASHBOARD_LOCALES as readonly string[]).includes(value)
}

/**
 * Coerce anything a cookie jar can hand back into a supported locale.
 *
 * Cookies are user-writable, survive deploys, and outlive the locale list that produced them — so
 * `null`, `undefined`, `''`, `'fr'` and a hand-edited `'EN'` all reach here in practice. Every one
 * of them resolves to the default rather than propagating: an unrecognized locale reaching
 * `t(key, …, { locale })` renders the RAW KEY PATH with no error anywhere, which is precisely the
 * silent failure mode this campaign exists to remove (it is what `/ar/dashboard/**` used to do).
 */
export function normalizeDashboardLocale(value: unknown): DashboardLocale {
  return isDashboardLocale(value) ? value : DASHBOARD_LOCALE_DEFAULT
}

/**
 * Writing direction for the dashboard CHROME.
 *
 * ⚠ This is not the direction of every field inside it. Chrome direction and field direction are
 * independent (doc 11 §6): an English field renders `dir="ltr"` inside an Arabic dashboard, and an
 * Arabic field renders `dir="rtl"` inside an English one. Use this for the shell; use the
 * FIELD's own locale for the field.
 */
export function dashboardDir(locale: DashboardLocale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

/**
 * Does this path belong to the dashboard world?
 *
 * Used by the ONE place that has to serve both worlds — the app-level `<UApp>`, whose Reka
 * `ConfigProvider` is what teleported overlays read their direction from. Everything else is already
 * inside one world or the other and does not need to ask.
 *
 * Matches unprefixed paths only, because after D04-7 those are the only dashboard routes there are.
 * `/dashboards`, `/dashboard-notes` and any future public route that merely starts with the same
 * letters are excluded by requiring the segment to end — a `startsWith('/dashboard')` test would
 * silently hand a public page the dashboard's language.
 */
export function isDashboardPath(path: string): boolean {
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

/**
 * Physical side for an API that has no logical equivalent.
 *
 * Logical properties are the rule for dashboard chrome now that it is bilingual (D11-8), and every
 * layout property this app writes obeys it. Nuxt UI's `USlideover` `side` prop is the one place
 * that cannot: its accepted values are `left`/`right`, physical by definition. Deriving the
 * physical side from the direction here — rather than hard-coding `left` as the shell did while the
 * dashboard was English-only-LTR — keeps the single physical value in one tested function instead
 * of inline in a template.
 */
export function dashboardDrawerSide(locale: DashboardLocale): 'left' | 'right' {
  return dashboardDir(locale) === 'rtl' ? 'right' : 'left'
}
