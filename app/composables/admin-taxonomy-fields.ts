/**
 * Taxonomy FIELD RULES — what a translation is, and how a row is presented (FE-3 Taxonomy, `U2`).
 *
 * Nuxt-free and zod-free, so it unit-tests without a runtime and costs the list route nothing.
 *
 * ── THE SPLIT FROM A FUTURE FORM MODULE IS MADE NOW, BEFORE IT COSTS ANYTHING ───────────────────
 * There is no `admin-taxonomy-form.ts` yet — it arrives with the create/edit unit. This file is
 * separated NOW anyway, because Articles measured what happens when it is not: the collection
 * route's app-owned bytes rose 8,889 B when the editor's form model landed in the file the list
 * imported from, and splitting them recovered 6,211 B (§10.1).
 *
 * ── EVERY EXPORT IS PREFIXED ─────────────────────────────────────────────────────────────────────
 * `app/composables/` is auto-imported WHOLESALE and Nuxt resolves a duplicated name by SILENTLY
 * ignoring one of them (§10.3 rule 12). The sibling modules already export `*HasTranslation` /
 * `*Display*` names under their own prefixes, so everything here carries `taxonomy`.
 *
 * ── ONE SHAPE FOR BOTH SECTIONS ──────────────────────────────────────────────────────────────────
 * Categories and Tags share exactly this entity shape in the contract — `{ id, translations map }`
 * whose translations require `locale`, `name` and `slug` — so these helpers read that minimal
 * structural shape (`TaxonomyRowLike`) and BOTH sections use them. The generated aliases stay the
 * types of record at the call sites; nothing here widens or narrows them.
 */

/** The structural shape these readers need — satisfied by BOTH generated admin taxonomy rows. */
export interface TaxonomyRowLike {
  translations: Record<string, { name: string, slug: string, description?: string | null }>
}

/** The two authored locales. Same set as every module, named per module. */
export const TAXONOMY_LOCALES = ['en', 'ar'] as const
export type TaxonomyLocale = (typeof TAXONOMY_LOCALES)[number]

/**
 * What makes a translation PRESENT on a taxonomy row: non-blank `name` AND `slug`.
 *
 * Both are required by the contract on every translation item, so a present locale always has
 * them; testing BOTH (rather than trusting presence of the key) keeps this honest against a
 * hand-built fixture that holds an empty shell. Tags carry no description at all, and a category's
 * description is nullable BY DESIGN — "no description yet" is a complete, valid state there, never
 * an incompleteness signal.
 */
export function taxonomyHasTranslation(row: TaxonomyRowLike, locale: TaxonomyLocale): boolean {
  const translation = row.translations[locale]
  if (!translation) return false
  return translation.name.trim().length > 0 && translation.slug.trim().length > 0
}

/** Which locales are missing — the row's completeness summary. */
export function taxonomyMissingLocales(row: TaxonomyRowLike): TaxonomyLocale[] {
  return TAXONOMY_LOCALES.filter(locale => !taxonomyHasTranslation(row, locale))
}

/**
 * A row's heading: the localized NAME.
 *
 * The ONE place a cross-locale read is correct, exactly like every sibling module's display
 * helper: it identifies a row, it is not an authored-completeness claim, and the badges beside it
 * state plainly which languages actually exist. Falls back to the caller's neutral untitled label
 * rather than rendering a blank `<h3>` — an empty heading is an accessibility failure and a silent
 * one.
 */
export function taxonomyDisplayName(row: TaxonomyRowLike, preferred: string, fallbackLabel: string): string {
  const inPreferred = row.translations[preferred]?.name
  if (inPreferred && inPreferred.trim().length > 0) return inPreferred
  const other = TAXONOMY_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? row.translations[other]?.name : undefined
  if (inOther && inOther.trim().length > 0) return inOther
  return fallbackLabel
}

/**
 * The slug of the preferred locale if it exists, else the other locale's, else null.
 *
 * Displayed AS DATA beside the name — slugs are routing material, shown verbatim so the operator
 * can see what public URLs are built from. No slug is ever synthesized from a name here: the list
 * shows what is stored, and generating one is an editor decision, not a reader's invention.
 */
export function taxonomyDisplaySlug(row: TaxonomyRowLike, preferred: string): string | null {
  const inPreferred = row.translations[preferred]?.slug
  if (inPreferred && inPreferred.trim().length > 0) return inPreferred
  const other = TAXONOMY_LOCALES.find(locale => locale !== preferred)
  const inOther = other ? row.translations[other]?.slug : undefined
  if (inOther && inOther.trim().length > 0) return inOther
  return null
}
