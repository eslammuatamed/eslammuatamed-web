import type { components } from '~/types/api'

/**
 * View-model aliases over the generated contract for the ADMIN Articles surface (D06-2), following
 * `admin-project-types.ts` exactly: every shape here points at a schema in `app/types/api.d.ts`,
 * which `npm run api:types` generates from the committed `openapi/openapi.json`. Nothing is
 * hand-maintained, and no shape is widened or narrowed on the way through.
 *
 * They live beside the module rather than in `app/types/models.ts` for the reason recorded there:
 * that file is the shared barrel imported by public pages, and these aliases are dashboard-only.
 */
type Schemas = components['schemas']

/**
 * The full admin projection: every status, and the whole translation MAP at once.
 *
 * The map is the important half. An editor with no cross-locale fallback needs every locale in one
 * response — a locale-resolved read would make "this article has no Arabic yet" indistinguishable
 * from "this article's Arabic is the English text", which is the exact confusion the translation
 * completeness indicator exists to prevent.
 */
export type AdminArticle = Schemas['AdminArticleEntity']
export type AdminArticleTranslation = Schemas['AdminArticleTranslationEntity']

/**
 * Write shapes. Note the ASYMMETRY, which is load-bearing rather than incidental: reads carry
 * `translations` as a locale-KEYED MAP, writes carry it as an ARRAY of locale-tagged objects. The
 * API's 422 field paths are therefore array-indexed (`translations[0].slug`) into the array the
 * CLIENT built, so attributing a field error back to a locale tab depends on the request's own
 * ordering — see `articleFieldErrorLocale()` in `admin-article-form.ts`.
 */
export type CreateArticlePayload = Schemas['CreateArticleDto']
export type UpdateArticlePayload = Schemas['UpdateArticleDto']
export type ArticleTranslationInput = Schemas['ArticleTranslationDto']

/** `DRAFT | SCHEDULED | PUBLISHED | ARCHIVED`, read off the contract rather than restated. */
export type ArticleStatus = AdminArticle['status']

/** Taxonomy, both unpaginated by contract — the whole vocabulary arrives in one read. */
export type AdminCategory = Schemas['AdminCategoryEntity']
export type AdminTag = Schemas['AdminTagEntity']

/** Minted per article, for previewing a draft that has no public destination yet. */
export type PreviewToken = Schemas['PreviewTokenEntity']
