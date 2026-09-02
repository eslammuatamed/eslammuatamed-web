// Effective PUBLIC Static Page SEO metadata resolution (FR-DSH-051 consumption, FE4-U2b).
//
// WHAT THIS IS: the smallest PURE layer between the public `GET /seo/pages/{pageKey}` payload and
// the later route-level head wiring (U2c). It resolves the EFFECTIVE title/description pair and an
// OPTIONAL page-level social-image override for one already-localized Page SEO response.
//
// WHAT THIS DELIBERATELY IS NOT — each exclusion is a settled decision, not a TODO:
//   - NO fetching, no routes, no locale choice. The caller supplies an already-resolved response
//     and already-resolved localized strings (plan.md §8 pins SSR-head-from-seo/pages with
//     locale-reactive `useAsyncData` keys as U2c's job).
//   - NO head ownership. It never touches `useHead`/`useSeoMeta`; U2c wires the output.
//   - NO canonical output, ever. Owner ruling for Frontend v1: Page SEO `canonicalUrl` remains
//     STORAGE/EDITING ONLY — `@nuxtjs/i18n` strictSeo stays the sole rendered canonical/hreflang
//     writer (D22-7/D22-8), so there is deliberately no second canonical writer and nothing here
//     reads the field. The input keeps the whole entity admissible so callers may pass it whole;
//     the focused suite proves varying `canonicalUrl` cannot change any output.
//   - ONE text pair, not four. The contract has no separate og/twitter copy fields, so the later
//     wiring feeds `title` → title + og:title + twitter:title and `description` likewise.
//   - NO brand/template handling. The title returns VERBATIM; Home's D22-4 standalone-title
//     exception stays the Home caller's `titleTemplate: null` responsibility.
//
// PRECEDENCE is doc 22 §3's visible chain (F-D4): authored page meta → localized site defaults →
// committed constants — expressed over the CURRENT static-page tiers, where the page-localized
// i18n string IS today's committed page tier (each static route's own `useSeoMeta`). Blank or
// whitespace overrides fall through exactly like every CMS string in this architecture
// (`isBlank`/`pickMeta` semantics, utils/metadata.ts).
import { entitySocialImage } from './entity-social-image'
import { pickMeta } from './metadata'

/** Exactly the image shape the EXISTING social-image helper accepts — no second media resolver. */
export type PageSeoImageDescriptor = Parameters<typeof entitySocialImage>[0]

/**
 * One locale's resolved Static Page SEO override, or the whole generated entity.
 *
 * `canonicalUrl` is intentionally ABSENT from this structural type yet tolerated on any object
 * passed whole: it must be able to arrive, change, or hold any API-valid value without ever being
 * read. See the module header and the canonical-storage-only tests.
 */
export interface PageSeoTextAndImageOverride {
  metaTitle: string | null
  metaDescription: string | null
  ogImage: PageSeoImageDescriptor
}

export interface PageSeoMetadataInput {
  /** The resolved override for ONE locale; null/undefined means unauthored or fetch-failed. */
  pageSeo?: PageSeoTextAndImageOverride | null
  /** Current page-localized i18n strings — today's tier-1 `useSeoMeta` values, verbatim. */
  pageTitle?: string | null
  pageDescription?: string | null
  /** Localized Site Settings defaults (`defaultMetaTitle` / `defaultMetaDescription`). */
  settingsDefaultTitle?: string | null
  settingsDefaultDescription?: string | null
  /** Committed application floor — the same constants `app.vue` emits today. */
  fallbackTitle: string
  fallbackDescription: string
  /** Governed absolute site URL, used only to absolutize an ACCEPTED page-level image. */
  siteUrl: unknown
}

export interface EffectivePageSeoMetadata {
  /** Effective title, verbatim — intended for title, og:title AND twitter:title. */
  title: string
  /** Effective description — intended for description, og:description AND twitter:description. */
  description: string
  /**
   * Page-level social-image override, present ONLY when Page SEO supplies a descriptor the
   * existing shareable-format helper ACCEPTS. Absent → the caller inherits `app.vue`'s committed
   * card floor untouched. All-or-nothing tags come from that helper, never re-derived here.
   */
  socialImageOverride?: Exclude<ReturnType<typeof entitySocialImage>, undefined>
}

/**
 * Resolve the effective public Static Page SEO metadata for one locale. Pure: no network, no
 * Nuxt head APIs, no locale logic, no canonical, no structured data.
 */
export function resolvePageSeoMetadata(input: PageSeoMetadataInput): EffectivePageSeoMetadata {
  const { pageSeo } = input

  // Authored override → current page tier → localized Settings default → committed floor.
  // A blank override NEVER masks a lower tier; the last candidates are the constants `app.vue`
  // already emits, so the chain ends somewhere non-blank by construction.
  const title = pickMeta(pageSeo?.metaTitle, input.pageTitle, input.settingsDefaultTitle, input.fallbackTitle) ?? ''
  const description = pickMeta(pageSeo?.metaDescription, input.pageDescription, input.settingsDefaultDescription, input.fallbackDescription) ?? ''

  // Image override ONLY through the existing helper: its shareable-format gate and absolute-URL
  // behaviour are the documented policy (WebP-rendition reality included); unsupported or unusable
  // descriptors yield undefined, which leaves the committed card owning the image.
  const socialImageOverride = pageSeo?.ogImage
    ? entitySocialImage(pageSeo.ogImage, input.siteUrl) ?? undefined
    : undefined

  return {
    title,
    description,
    ...(socialImageOverride !== undefined ? { socialImageOverride } : {})
  }
}
