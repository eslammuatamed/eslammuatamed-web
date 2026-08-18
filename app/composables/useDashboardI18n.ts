import type { ComputedRef, Ref } from 'vue'
import type { DashboardLocale } from '~/utils/dashboard-locale'

/**
 * Translation bound to the **Dashboard application locale** (D11-8) — the only sanctioned way for
 * dashboard chrome to read a string.
 *
 * Dashboard surfaces must not call `useI18n()` directly; an ESLint rule enforces it
 * (`eslammuatamed/dashboard-localization`). That rule exists because the failure it prevents is
 * SILENT: `useI18n().t` resolves against the ROUTE-derived public locale, which on an unprefixed
 * `/dashboard/**` route is always English (D04-7). A dashboard component that calls it renders
 * English inside an Arabic dashboard, with no error, no warning, and nothing for the type-checker
 * to catch. One missed component looks exactly like a translation nobody has written yet.
 *
 * WHY THE SAME CATALOGUE, NOT A DASHBOARD-OWNED ONE. Two message sources guarantee drift between a
 * string used in the dashboard and the same string used publicly, and doubles the surface a
 * translation sweep has to cover. So this reads `i18n/locales/{en,ar}.json` like everything else and
 * changes only WHICH locale it resolves against — `t(key, named, { locale })` is vue-i18n's own
 * per-call locale override, not a workaround.
 *
 * The returned `locale` is a drop-in replacement for `useI18n()`'s: dashboard code that formats a
 * date, a file size or a number should format it in the operator's language, which is this one.
 */
export interface DashboardI18n {
  /** The dashboard application locale. Read-only to consumers — change it via `setLocale`. */
  readonly locale: Ref<DashboardLocale>
  /** Direction of the dashboard CHROME. Field direction is independent — see `dashboardDir`. */
  readonly dir: ComputedRef<'ltr' | 'rtl'>
  /** Translate against the dashboard locale. Same call shape as vue-i18n's `t(key, named?)`. */
  t: (key: string, named?: Record<string, unknown>) => string
  /** Format a date in the dashboard locale. Digits stay `latn` in both languages (D03-4). */
  d: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string
  /** Format a number in the dashboard locale, `latn` digits (D03-4). */
  n: (value: number, options?: Intl.NumberFormatOptions) => string
  setLocale: (next: DashboardLocale) => Promise<void>
  ensureMessages: (target?: DashboardLocale) => Promise<void>
}

export function useDashboardI18n(): DashboardI18n {
  // The ONE sanctioned `useI18n()` call for dashboard chrome. Everything below reroutes it through
  // the dashboard locale so no dashboard page, component or layout needs to call it — which the
  // `eslammuatamed/dashboard-localization` ESLint rule then enforces for those surfaces.
  const { t: translate } = useI18n()
  const { locale, dir, setLocale, ensureMessages } = useDashboardLocale()

  function t(key: string, named?: Record<string, unknown>): string {
    return translate(key, named ?? {}, { locale: locale.value })
  }

  /**
   * `Intl` directly rather than vue-i18n's `d`/`n`, because those need per-locale format definitions
   * in an i18n config this project does not have — and adding one purely to format a file size would
   * be a second configuration surface for no gain.
   *
   * `numberingSystem: 'latn'` matches `utils/format.ts`: Arabic copy uses Western digits throughout
   * this product (D03-4), so an Arabic dashboard must not start rendering Arabic-Indic numerals in
   * its own chrome while the public site shows Western ones.
   */
  function d(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
    const date = value instanceof Date ? value : new Date(value)
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'long',
      numberingSystem: 'latn',
      ...options
    }).format(date)
  }

  function n(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(locale.value, { numberingSystem: 'latn', ...options }).format(value)
  }

  return { locale, dir, t, d, n, setLocale, ensureMessages }
}
