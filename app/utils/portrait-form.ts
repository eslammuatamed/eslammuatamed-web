import type { AdminSiteSettings, UpdateSettingsPayload } from '~/types/models'

/**
 * The About portrait form's rules, as pure functions (FR-PUB-020, D09-22).
 *
 * Free of Vue and i18n so the two things most likely to be got wrong — where the alt text comes
 * from, and what is sent on removal — can be asserted directly against contract shapes rather than
 * through a rendered component.
 *
 * ── THE PRECEDENCE RULE THIS MODULE EXISTS TO ENFORCE (D09-22) ──────────────────────────────────
 *
 * `MediaAssetAlt` is ASSET-LEVEL LIBRARY DEFAULT metadata. The alt that PUBLISHES on `/about` is the
 * PER-USAGE `SiteSettingsTranslation.portraitAlt`. Per-usage wins; `undefined` falls back to the
 * asset default; `null` explicitly does NOT fall back.
 *
 * `AdminSiteSettingsEntity.portrait.alt` carries the ASSET-LEVEL default, resolved in the default
 * admin locale. It is a DIFFERENT VALUE from what publishes, and the contract says so in as many
 * words: "must never be prefilled from here". A form that seeded its alt inputs from it would copy
 * an unreviewed library default into the About usage and, on the next save, publish it as though a
 * human had written it for this context — silently, and in one locale's words for both locales.
 *
 * `initialAltFor` therefore reads ONLY `translations[locale].portraitAlt`, and it takes the
 * translation map rather than the whole settings entity so that `portrait.alt` is not even in scope
 * to be reached for by mistake. The asset default is still useful to an author, so the Profile page
 * displays it separately as a clearly-labelled reference — never as an input value.
 */

/** The locales the About page publishes in. Both are required; neither falls back to the other. */
export const PORTRAIT_LOCALES = ['en', 'ar'] as const
export type PortraitLocale = (typeof PORTRAIT_LOCALES)[number]

/** The form's own state: the selected asset, and one alt per published locale. */
export interface PortraitFormState {
  readonly assetId: string | null
  readonly alt: Record<PortraitLocale, string>
}

export interface PortraitFormErrors {
  /** Locales whose alt is required-but-missing. Empty when the form may be saved. */
  readonly missingAlt: readonly PortraitLocale[]
}

/**
 * The initial alt for one locale.
 *
 * Takes the TRANSLATION MAP, not the settings entity: `portrait.alt` is the asset-level default and
 * must never reach an input (see the header). Narrowing the parameter makes that structural rather
 * than a rule someone has to remember.
 *
 * `null` (explicitly cleared) and `undefined` (no translation row) both yield `''` — the form's
 * empty input. The distinction is preserved on the way OUT, not on the way in: an empty input saves
 * as `null`, which is the no-fallback clear.
 */
export function initialAltFor(
  translations: AdminSiteSettings['translations'] | undefined,
  locale: PortraitLocale
): string {
  return translations?.[locale]?.portraitAlt ?? ''
}

/** Build the whole initial form state from an admin settings response. */
export function initialPortraitForm(settings: AdminSiteSettings | null): PortraitFormState {
  return {
    assetId: settings?.portraitAssetId ?? null,
    alt: {
      en: initialAltFor(settings?.translations, 'en'),
      ar: initialAltFor(settings?.translations, 'ar')
    }
  }
}

/**
 * Validation: BOTH locales' alt are required WHEN a portrait is selected.
 *
 * This lives in the Dashboard by deliberate design (D09-22). The API does NOT force alts — an
 * incomplete draft has to stay saveable there, and publication is already gated by the readiness
 * state (`portrait-alt-missing`, D18-7). The Dashboard is the authoring surface, so it is where
 * "you have not finished this" belongs.
 *
 * Whitespace does not satisfy it: `'   '` is an absent alt wearing a costume, and it would pass the
 * API's `@IsString()` while failing readiness on the public page — the exact split-brain this check
 * exists to prevent.
 *
 * NO PORTRAIT ⇒ NO REQUIREMENT. Alt text describes an image; requiring it with no image selected
 * would make the empty state unsaveable, which is how an operator gets stuck.
 */
export function validatePortraitForm(state: PortraitFormState): PortraitFormErrors {
  if (state.assetId === null) return { missingAlt: [] }
  return { missingAlt: PORTRAIT_LOCALES.filter(locale => state.alt[locale].trim().length === 0) }
}

export function isPortraitFormValid(state: PortraitFormState): boolean {
  return validatePortraitForm(state).missingAlt.length === 0
}

/**
 * The `PATCH /admin/settings` body.
 *
 * MINIMAL BY CONSTRUCTION. The admin DTOs are validated with `forbidNonWhitelisted`, so echoing the
 * read entity back would 422 on its read-only fields (`id`, `portrait`, …) — and even the writable
 * ones would be resent from a snapshot that another surface may have superseded, quietly reverting
 * edits this form never showed. Only the two things the Portrait section owns are sent.
 *
 * REMOVAL NULLS THE ALTS IN THE SAME REQUEST. Clearing `portraitAssetId` alone would leave the old
 * portrait's alt text behind on the translation rows, and a later selection of a DIFFERENT portrait
 * would then publish the previous image's description — a stale, confidently-wrong alt is worse for
 * a screen-reader user than a missing one, and readiness could not catch it because the field is
 * populated. Association and description are removed together because they are one fact.
 *
 * `null`, NEVER `''`, and never an omission. Omitting `portraitAlt` means "leave it alone" and would
 * re-expose the asset-level default through the D09-22 fallback; `''` means "intentionally
 * decorative", which the About portrait is not. `null` is the explicit no-fallback clear, and it is
 * the only one of the three that means what removal means.
 */
export function buildPortraitPayload(state: PortraitFormState): UpdateSettingsPayload {
  if (state.assetId === null) {
    return {
      portraitAssetId: null,
      translations: PORTRAIT_LOCALES.map(locale => ({ locale, portraitAlt: null }))
    }
  }
  return {
    portraitAssetId: state.assetId,
    translations: PORTRAIT_LOCALES.map(locale => ({
      locale,
      // Trimmed, because the value that publishes should be the value the author meant. Validation
      // has already rejected a blank, so this can never emit `''` on the selected path.
      portraitAlt: state.alt[locale].trim()
    }))
  }
}

/** Whether the form differs from the state it was loaded with — gates the Save control. */
export function isPortraitFormDirty(state: PortraitFormState, initial: PortraitFormState): boolean {
  return (
    state.assetId !== initial.assetId
    || PORTRAIT_LOCALES.some(locale => state.alt[locale] !== initial.alt[locale])
  )
}
