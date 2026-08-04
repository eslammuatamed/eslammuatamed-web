/**
 * View-model aliases over the generated API contract (D06-2). Every shape below points at a schema
 * in `app/types/api.d.ts`, which `npm run api:types` generates from the committed
 * `openapi/openapi.json` — the contract is the single source of truth, so nothing here is
 * hand-maintained. The app imports these stable names; the underlying contract schema can be
 * renamed without touching call sites.
 *
 * `Envelope`/`Paginated` are the only generics: the contract inlines its response envelope
 * (`{ data }` for reads, `{ data, meta }` for lists) per response rather than exposing a named
 * schema, so these thin wrappers mirror that envelope over the contract entities.
 */
import type { components } from './api'

type Schemas = components['schemas']

/** RFC 7807 problem detail (doc 10 §3). `errors[]` is present on 422 responses only. */
export type ProblemDetail = Schemas['ProblemDetailsDto']
export type FieldError = Schemas['FieldErrorDto']

/** Response envelopes (D10-3): single reads resolve to `{ data }`, list reads add `meta`. */
export type Envelope<T> = { readonly data: T }
export type PaginationMeta = Schemas['PageMeta']
export type Paginated<T> = { readonly data: readonly T[], readonly meta: PaginationMeta }

/** `GET /settings/site` — resolved single-locale public settings (D10-6). */
export type SiteSettings = Schemas['PublicSiteSettingsEntity']
export type ProfileLink = Schemas['ProfileLinkEntity']

/** `GET /articles` list item + `GET /articles/{slug}` detail (detail adds the opaque Markdown `body`). */
export type ArticleListItem = Schemas['PublicArticleListItemEntity']
export type Article = Schemas['PublicArticleDetailEntity']

/**
 * `GET /projects/{slug}` detail — also the shape returned by the draft-preview route
 * `GET /preview/projects/{id}` (D10-11). Its long-form sections are opaque Markdown rendered
 * through the single `ContentProse` surface, like an article `body`.
 */
export type ProjectDetail = Schemas['PublicProjectDetailEntity']
export type ProjectGalleryItem = Schemas['PublicProjectGalleryItemEntity']

/** `GET /projects` list item (featured-first, published-only) — home featured section + projects index card. */
export type ProjectListItem = Schemas['PublicProjectListItemEntity']
export type ProjectTechnology = Schemas['ProjectTechnologyEntity']

/**
 * `GET /redirects/resolve` — the destination for a renamed slug (D04-6). `toPath` is
 * **section-relative** (e.g. `/projects/new-slug`), so the caller localizes it before navigating.
 */
export type RedirectResolve = Schemas['RedirectResolveEntity']

/** `GET /skills` — resolved single-locale skill (home tech-stack section, D09-9). */
export type Skill = Schemas['PublicSkillEntity']

/** `GET /experiences` — resolved single-locale experience (home timeline summary; `employmentType` code, D09-9). */
export type Experience = Schemas['PublicExperienceEntity']

/**
 * One technology on an experience (FR-PUB-021, D02-9) — a Skill-registry reference, not free text,
 * so the label matches the Projects filter and translates with the registry. The API orders these by
 * `Skill.order` and drops a skill with no translation in the requested locale rather than falling
 * back to another one (D10-6); the client renders the array verbatim.
 */
export type ExperienceTechnology = Schemas['ExperienceTechnologyEntity']

/** `GET /testimonials` — visible testimonials (home social-proof section). */
export type Testimonial = Schemas['PublicTestimonialEntity']

/** Resolved media descriptors (D10-10): image renditions / résumé PDF, served from the media origin. */
export type MediaImage = Schemas['PublicMediaImageDescriptor']
export type MediaPdf = Schemas['PublicMediaPdfDescriptor']

/** Category/tag ref carried on article list items. */
export type ArticleTaxonomyRef = Schemas['ArticleTaxonomyRefEntity']

/** Auth (D11-1): login returns the access token + user; refresh rotates only the access token. */
export type AuthUser = Schemas['AuthUserEntity']
export type AuthSession = Schemas['LoginResponse']
export type RefreshSession = Schemas['RefreshResponse']
export type LoginCredentials = Schemas['LoginDto']

/** Admin inbox message descriptor (FR-DSH-060, D10-16 (d) — `email`/`phone` nullable, never both). */
export type ContactMessage = Schemas['ContactMessageEntity']
