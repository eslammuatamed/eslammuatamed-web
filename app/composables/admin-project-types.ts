import type { components } from '~/types/api'

/**
 * View-model aliases over the generated contract for the ADMIN Projects surface — the same rule
 * `app/types/models.ts` states for every other slice (D06-2): every shape below points at a schema
 * in `app/types/api.d.ts`, which `npm run api:types` generates from the committed
 * `openapi/openapi.json`. Nothing here is hand-maintained.
 *
 * WHY THESE ARE NOT IN `app/types/models.ts`, where the rest of the aliases live. That file is the
 * shared type barrel imported by public pages, and this release holds it open for another lane. The
 * aliases are zero-runtime and additive, so parking them in the dashboard lane's own directory costs
 * nothing at build time and avoids a merge conflict in a file this module has no other reason to
 * touch. Folding them back into `models.ts` alongside `AdminSiteSettings` is a pure move whenever
 * that file is free.
 */
type Schemas = components['schemas']

/** The full admin projection: BOTH publication states, the whole translation map, all relations. */
export type AdminProject = Schemas['AdminProjectEntity']
export type AdminProjectTranslation = Schemas['AdminProjectTranslationEntity']
export type AdminProjectGalleryItem = Schemas['AdminProjectGalleryItemEntity']

/** Write shapes. `POST` takes the whole entity; `PATCH` is partial (see `admin-project-form.ts`). */
export type CreateProjectPayload = Schemas['CreateProjectDto']
export type UpdateProjectPayload = Schemas['UpdateProjectDto']
export type ProjectTranslationInput = Schemas['ProjectTranslationDto']
export type ProjectGalleryItemInput = Schemas['ProjectGalleryItemDto']

/** Technologies ARE skills: `technologyIds` holds skill ids, resolved from `GET /admin/skills`. */
export type AdminSkill = Schemas['AdminSkillEntity']
