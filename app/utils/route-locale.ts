/**
 * Effective locale for public content requests (D06-6, doc 06 §4).
 *
 * Public reads must use the locale THE ROUTE represents, not whatever the reactive UI locale holds at
 * that instant. In normal rendering the two agree and this is invisible. They diverge in exactly one
 * situation: the branded `page-spread` transition (D03-13) defers the locale commit until the outgoing
 * page is off screen, so `<html lang dir>`, the chrome copy and the UI locale pack flip in one frame
 * instead of repainting the still-visible outgoing page mirrored. The incoming page's `setup()` — and
 * therefore its data reads — runs INSIDE that window. A read taking its locale from reactive state
 * would ask for the incoming route's slug in the OUTGOING language, and because public slugs are
 * per-locale (D04-2) that is a legitimate contract 404 for content that exists.
 *
 * Pure and Nuxt-free so every rule below is unit-tested rather than observed in a browser. The
 * configuration is passed in — codes, default, and the `prefix_except_default` strategy — so adding a
 * configured locale needs no change here (Pillar 3); nothing is hard-coded to `en`/`ar`.
 */

export interface RouteLocaleConfig {
  /** Every configured locale code (`nuxt.config` i18n `locales[].code`). */
  readonly codes: readonly string[]
  /** The locale served WITHOUT a path prefix under `prefix_except_default` (D01-3). */
  readonly defaultLocale: string
}

/**
 * The locale a route path represents under `prefix_except_default`.
 *
 * The default locale has no prefix, so anything that does not begin with a configured non-default
 * code is the default: `/projects` → `en`, `/ar/projects` → `ar`, `/` → `en`.
 *
 * Matching is on the WHOLE first segment. `/arabic-typography` starts with the letters `ar` but is an
 * English article slug, and treating it as Arabic would request the wrong language for every such
 * URL — a silent, permanent wrong-content bug rather than a visible one.
 */
export function resolveRouteLocale(path: string, config: RouteLocaleConfig): string {
  // A full-path route can carry a query or hash (`/ar/projects?technology=…`); neither is part of the
  // locale prefix. Splitting first keeps `/ar?x=1` resolving to `ar` rather than falling through.
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  const [firstSegment] = pathname.split('/').filter(Boolean)

  if (firstSegment === undefined) return config.defaultLocale

  // The default locale is deliberately excluded: under `prefix_except_default` a prefixed default
  // route does not exist, so `/en/...` is not a locale prefix — it is an ordinary first segment.
  return config.codes.includes(firstSegment) && firstSegment !== config.defaultLocale
    ? firstSegment
    : config.defaultLocale
}
