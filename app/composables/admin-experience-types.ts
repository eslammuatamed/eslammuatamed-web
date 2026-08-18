import type { components } from '~/types/api'

/**
 * View-model aliases over the generated contract for the ADMIN Experiences surface (FE-3 module 1),
 * following `admin-article-types.ts` and `admin-project-types.ts` exactly: every shape here points
 * at a schema in `app/types/api.d.ts`, which `npm run api:types` generates from the committed
 * `openapi/openapi.json`. Nothing is hand-maintained, and no shape is widened or narrowed.
 *
 * They live beside the module rather than in `app/types/models.ts` for the reason recorded there:
 * that file is the shared barrel imported by public pages, and these aliases are dashboard-only.
 */
type Schemas = components['schemas']

/**
 * The full admin projection: the whole translation MAP at once, for the same reason Articles reads
 * one — an editor with no cross-locale fallback needs every locale in a single response, or "this
 * experience has no Arabic yet" becomes indistinguishable from "its Arabic is the English text".
 */
export type AdminExperience = Schemas['AdminExperienceEntity']
export type AdminExperienceTranslation = Schemas['ExperienceTranslationEntity']

/**
 * Write shapes, carrying the SAME read/write asymmetry Articles documents: reads return
 * `translations` as a locale-KEYED MAP, writes send an ARRAY of locale-tagged objects, so 422 field
 * paths are array-indexed into the array the CLIENT built.
 *
 * ⚠ `technologyIds` IS A REPLACE-WHOLESALE RELATION, and the contract says so in as many words:
 * "Skill ids; replaces the full set. Empty array clears." An OMITTED key preserves what the server
 * holds; `[]` deletes it. That is a third clearing semantic sitting beside two others in one save
 * (translations upsert and never delete; `endDate` clears on an explicit `null`) — see the module's
 * ledger note. The failure is SILENT, which is why it is written here rather than left to the form.
 */
export type CreateExperiencePayload = Schemas['CreateExperienceDto']
export type UpdateExperiencePayload = Schemas['UpdateExperienceDto']
export type ExperienceTranslationInput = Schemas['ExperienceTranslationDto']

/**
 * `FULL_TIME | PART_TIME | CONTRACT | FREELANCE`, read off the contract rather than restated.
 *
 * A closed enum of four, so the editor's control is a select — unlike Articles' `status`, nothing
 * here is server-resolved, and unlike a slug, nothing is free text.
 */
export type EmploymentType = AdminExperience['employmentType']
