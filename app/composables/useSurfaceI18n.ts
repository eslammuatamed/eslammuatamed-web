import { isDashboardPath } from '~/utils/dashboard-locale'

/**
 * Translation for a component that renders in **both worlds** — the public site and the Dashboard.
 *
 * ## The defect this exists for (plan §14.9, F-1)
 *
 * `useDashboardI18n()` is the sanctioned translator for dashboard chrome, and an ESLint rule
 * (`eslammuatamed/dashboard-localization`) forces dashboard surfaces to use it instead of
 * `useI18n()`. That rule is scoped by SURFACE — `app/pages/dashboard/**`,
 * `app/components/dashboard/**`, and the two dashboard layouts by name.
 *
 * The 007 loading system does not live on any of those paths. `UiContentSkeleton`,
 * `UiDataLoadingOverlay` and `UiStateError` sit in `app/components/ui/`, are shared by both worlds,
 * and each called `useI18n()` directly. On an unprefixed `/dashboard/**` route (D04-7) `useI18n()`
 * resolves the ROUTE locale, which is always `en` — so an Arabic dashboard would have rendered
 * English `Loading` / `Updating` / `Try again`, silently. Neither the rule nor the type-checker
 * could see it: the components were never wrong on the surface they were written for.
 *
 * ## Why the fix is here and not at the call sites
 *
 * The alternative was to let every caller pass its own translated strings down as props — the
 * components already accept `label` / `updatingLabel` / `message`. That was rejected: it makes
 * correct behaviour opt-in at every future call site, and the failure mode of forgetting is the
 * same silent English-in-Arabic. The component should ask which locale owns the surface it is
 * rendering on; that question has exactly one right answer and it belongs in one place.
 *
 * ## Why the route decides
 *
 * The dashboard IS a route subtree — `isDashboardPath` is the same predicate `<UApp>` already uses
 * to pick the direction teleported overlays read. A provide/inject from the dashboard shell would
 * be more literally "ownership", but it reintroduces the failure it is meant to remove: a layout
 * that forgets to provide falls back to public copy, silently, which is exactly F-1 again.
 *
 * ## Message catalogue and SSR
 *
 * Same catalogue as everything else — `t(key, named, { locale })` is vue-i18n's own per-call
 * override, and `state.*` / `common.*` already exist in both locales. **No key is duplicated.**
 *
 * Reading `useDashboardLocale()` unconditionally is safe: `app.vue` already calls it on every
 * route, and it deliberately seeds the constant default on the SERVER so a visitor's preference
 * cannot reach a cached public payload (see its comment, and `e2e/dashboard-locale-payload.spec.ts`).
 * This composable adds no new read of the cookie.
 */
export function useSurfaceI18n(): { t: (key: string, named?: Record<string, unknown>) => string } {
  // The ONE sanctioned `useI18n()` call for the shared loading components, mirroring the role the
  // same call plays inside `useDashboardI18n()`.
  const { t: translate } = useI18n()
  const { locale: dashboardLocale } = useDashboardLocale()
  const route = useRoute()

  const onDashboard = computed(() => isDashboardPath(route.path))

  function t(key: string, named?: Record<string, unknown>): string {
    return onDashboard.value
      ? translate(key, named ?? {}, { locale: dashboardLocale.value })
      : translate(key, named ?? {})
  }

  return { t }
}
