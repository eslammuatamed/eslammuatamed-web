import type { components } from '~/types/api'

/**
 * View-model alias over the generated contract for the ADMIN Testimonials surface (FE-3 module 3),
 * following `admin-experience-types.ts` and `admin-project-types.ts` exactly: the shape points at
 * the schema in `app/types/api.d.ts`, which `npm run api:types` generates from the committed
 * `openapi/openapi.json`. Nothing is hand-maintained, and no shape is widened or narrowed.
 *
 * It lives beside the module rather than in `app/types/models.ts` for the reason recorded there:
 * that file is the shared barrel imported by public pages (which already hold a PUBLIC
 * `Testimonial` alias), and this one is dashboard-only. The two names must never meet — a public
 * projection carries only visible, ordered rows, while this is the whole admin collection.
 *
 * COLLECTION-ONLY FOR NOW (`T·U2`): the read alias ships; the write payload aliases join with the
 * editor unit, exactly as every earlier module introduced them when its editor arrived.
 */
type Schemas = components['schemas']

/**
 * The full admin projection: the whole translation MAP at once — an editor with no cross-locale
 * fallback needs every locale in a single response, or "this testimonial has no Arabic yet" becomes
 * indistinguishable from "its Arabic is the English text".
 */
export type AdminTestimonial = Schemas['AdminTestimonialEntity']
