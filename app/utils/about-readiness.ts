import type { SiteSettings } from '~/types/models'

/**
 * Publication readiness for `/about` (FR-PUB-020, D18-7).
 *
 * The approved Profile contract gates publication on complete localized About content AND a real
 * portrait carrying localized alt text. This module is the single place that decides, so the page,
 * its tests and the structured data cannot disagree about what "ready" means.
 *
 * Pure and free of Vue/i18n so it can be unit-tested against contract shapes directly.
 */
export type AboutReadiness =
  /** Everything the contract requires is present — render the full published page. */
  | 'ready'
  /** No portrait configured. The real API state; an honest interim, not an error. */
  | 'portrait-missing'
  /**
   * A portrait exists but carries no alt for THIS locale. `alt: null` means "no translation" in the
   * contract, distinct from `alt: ""` which means "intentionally decorative". The portrait is
   * meaningful content here, so neither an empty string nor the other locale's alt is acceptable —
   * borrowing across locales is exactly the cross-locale fallback D10-6 forbids.
   */
  | 'portrait-alt-missing'
  /** The prose the page exists to present is absent. Defensive: nullable fields, no invented copy. */
  | 'content-missing'

/** The governed About fields, all of which must be present for the page to be publishable. */
function hasAboutContent(settings: SiteSettings): boolean {
  return Boolean(
    settings.aboutBio?.trim()
    && settings.engineeringPhilosophy?.trim()
    && settings.currentFocus?.trim()
  )
}

/**
 * Resolves readiness for the locale the response was fetched in.
 *
 * Order matters: content is checked first because a page with no prose has nothing to publish even
 * with a perfect portrait, and reporting the portrait as the blocker would misdirect the fix.
 */
export function resolveAboutReadiness(settings: SiteSettings): AboutReadiness {
  if (!hasAboutContent(settings)) {
    return 'content-missing'
  }
  if (!settings.portrait) {
    return 'portrait-missing'
  }
  // `?? ''` is NOT a fallback to decorative: a null alt fails readiness on the next line. It only
  // keeps the trim() total. `alt: ''` fails too — a decorative portrait cannot satisfy a slot the
  // contract defines as meaningful content.
  if (!(settings.portrait.alt ?? '').trim()) {
    return 'portrait-alt-missing'
  }
  return 'ready'
}

/** Whether the full published About layout may render. */
export function isAboutPublishable(readiness: AboutReadiness): boolean {
  return readiness === 'ready'
}
