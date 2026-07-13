/**
 * PRE-CONTRACT PLACEHOLDER TYPES.
 *
 * These view-model shapes exist only so the M1 slice compiles and renders before the API
 * contract is exported. They are NOT the source of truth. In T10 (contract adoption, D06-2)
 * `openapi/openapi.json` lands, `npm run api:types` generates `app/types/api.d.ts`, and the
 * bodies below shrink to aliases of the generated types. Do not hand-extend them as if they
 * were the contract — that is exactly the drift D06-2 forbids.
 */

/** RFC 7807 problem detail (doc 10 §3). The `errors[]` extension appears on 422 only. */
export interface ProblemDetail {
  readonly type: string
  readonly title: string
  readonly status: number
  readonly detail?: string
  readonly instance?: string
  readonly errors?: readonly FieldError[]
}

export interface FieldError {
  readonly field: string
  readonly message: string
}

/** Every 2xx body is `{ data }`; list bodies add `meta` (envelope D10-3). */
export interface Envelope<T> {
  readonly data: T
}

export interface Paginated<T> {
  readonly data: readonly T[]
  readonly meta: PaginationMeta
}

export interface PaginationMeta {
  readonly page: number
  readonly perPage: number
  readonly total: number
  readonly totalPages: number
}

export type AvailabilityStatus = 'available' | 'open' | 'unavailable'

export interface SocialLink {
  readonly platform: string
  readonly url: string
}

/** `GET /settings/site` — resolved single-locale shape (D10-6). Feeds the hero + footer. */
export interface SiteSettings {
  readonly name: string
  readonly role: string
  readonly headline?: string
  readonly availability: AvailabilityStatus
  readonly email: string
  readonly resumeUrl?: string
  readonly socialLinks: readonly SocialLink[]
  readonly availableLocales: readonly string[]
}

export interface CategoryRef {
  readonly slug: string
  readonly name: string
}

/** `GET /articles` list item — resolved, flat, ready to render (D10-6). */
export interface ArticleListItem {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly excerpt: string
  readonly publishedAt: string
  readonly readingTimeMin: number
  readonly category: CategoryRef
  readonly availableLocales: readonly string[]
}

/** `GET /articles/{slug}` — list item plus the opaque Markdown body (D01-5). */
export interface Article extends ArticleListItem {
  readonly body: string
}

export type UserRole = 'OWNER' | 'EDITOR'

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly role: UserRole
  readonly name?: string
}

/** `POST /auth/login` / `POST /auth/refresh` payload — access token is memory-only (D11-1). */
export interface AuthSession {
  readonly accessToken: string
  readonly user: AuthUser
}

export interface LoginCredentials {
  readonly email: string
  readonly password: string
}
