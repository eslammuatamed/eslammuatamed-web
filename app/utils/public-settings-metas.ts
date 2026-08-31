// Pure PUBLIC global-Settings meta projection (FR-DSH-052 consumption side, FE4-U2d1).
//
// WHAT THIS IS: the smallest PURE layer between the public `GET /settings/site` payload's
// site-verification/custom-meta fields and the later head wiring (U2d2). It projects exactly the
// three fields it owns into an ordered list of `<meta name="..." content="...">` descriptors:
//
//   1. googleSiteVerification → `google-site-verification` (vendor-pinned rendered name)
//   2. bingSiteVerification   → `msvalidate.01`            (vendor-pinned rendered name)
//   3. customMetas            → verbatim, in exact API order
//
// WHAT THIS DELIBERATELY IS NOT — each exclusion is a settled decision, not a TODO:
//   - NO head ownership. It never touches `useHead`/`useSeoMeta`; U2d2 renders this output from
//     the public layout's existing Settings state.
//   - NO fetching, no locale, no routes, no caching. The caller supplies already-loaded settings;
//     the shared `/settings/site` read stays owned by `useSiteSettings`.
//   - NO PageSeo ownership: title/description/OG/Twitter/canonical/hreflang/JSON-LD are owned
//     elsewhere (utils/page-seo-metadata.ts + the strictSeo writer) and are never read here.
//   - NO GTM. `gtmContainerId` and `analyticsEnabled` are outside the input type and never read —
//     GTM stays blocked on the separate CSP/runtime decision.
//
// VENDOR PIN (owner-approved, recorded in the campaign ledger): the rendered HTML `name=` values
// are the vendors' own documented identifiers — NOT the field names, and no aliases exist.
//
// BLANK SEMANTICS: verification tokens follow the house convention (`isBlank`/`pickMeta`,
// utils/metadata.ts) — null, undefined, empty and whitespace-only emit NOTHING, and a present
// token is outer-trimmed with its internal characters and case untouched. Custom metas are
// DIFFERENT BY CONTRACT: `CustomMetaEntity` declares both fields REQUIRED non-null strings, so
// they pass through VERBATIM — no trim, no filtering, no sorting, no deduplication, no
// reserved-name policy. This layer is a projection, not an admin validator; inventing stricter
// client rules than the public contract would silently rewrite operator data. Duplicate names are
// therefore legal output and stay independent entries.
//
// SECURITY BOUNDARY: the output type can only express `name`/`content` attribute pairs. Every
// descriptor is CONSTRUCTED fresh from exactly those two fields, so even a hostile runtime object
// carrying extra properties cannot leak them through — there is no way to express `<script>`,
// inline JS, event handlers, raw HTML, `http-equiv` or element injection. No escaping happens
// here on purpose: framework head rendering owns HTML attribute escaping.
import { pickMeta } from './metadata'
import type { SiteSettings } from '~/types/models'

/** Vendor-pinned rendered meta name for the Google Search Console token. */
export const GOOGLE_SITE_VERIFICATION_META_NAME = 'google-site-verification'
/** Vendor-pinned rendered meta name for the Bing Webmaster token. */
export const BING_SITE_VERIFICATION_META_NAME = 'msvalidate.01'

/**
 * Exactly the global public Settings fields this projection owns — derived from the generated
 * `PublicSiteSettingsEntity` and deliberately excluding every other field (`gtmContainerId`,
 * `analyticsEnabled`, defaults, profile links, assets…). Members are optional so a partially
 * failed read degrades field-by-field; anything missing behaves exactly like the blank case.
 */
export type PublicSettingsMetaSource = Partial<
  Pick<SiteSettings, 'googleSiteVerification' | 'bingSiteVerification' | 'customMetas'>
>

/** One public `<meta name="…" content="…">` descriptor — nothing else can be expressed. */
export interface PublicSettingsMetaDescriptor {
  name: string
  content: string
}

/**
 * Project the global public Settings verification/custom-meta fields into normalized meta
 * descriptors. Pure: no network, no Nuxt head APIs, no locale logic, no rendering.
 *
 * Deterministic order: Google verification (when present) → Bing verification (when present) →
 * customMetas verbatim in API order. A missing/blank member never shifts the others.
 */
export function projectPublicSettingsMetas(
  settings?: PublicSettingsMetaSource | null,
): PublicSettingsMetaDescriptor[] {
  if (!settings) return []

  // Verification tokens: blank → omitted entirely; present → outer-trimmed token, verbatim inside.
  const google = pickMeta(settings.googleSiteVerification)
  const bing = pickMeta(settings.bingSiteVerification)

  const descriptors: PublicSettingsMetaDescriptor[] = []
  if (google !== undefined) descriptors.push({ name: GOOGLE_SITE_VERIFICATION_META_NAME, content: google })
  if (bing !== undefined) descriptors.push({ name: BING_SITE_VERIFICATION_META_NAME, content: bing })

  // Custom metas pass through VERBATIM — API order, duplicates included, blanks tolerated as
  // supplied. Fresh objects pin the shape to name/content: extra runtime properties are dropped
  // here by construction, which is what keeps the output unable to express anything else.
  for (const meta of settings.customMetas ?? []) {
    descriptors.push({ name: meta.name, content: meta.content })
  }

  return descriptors
}
