import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value

/** The production list default, kept explicit so the route and request stay in lockstep. */
export const ADMIN_TESTIMONIALS_PER_PAGE = 12

export const adminTestimonialsQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1))
})

export type AdminTestimonialsQuery = z.output<typeof adminTestimonialsQuerySchema>

export function parseAdminTestimonialsQuery(query: LocationQuery): AdminTestimonialsQuery {
  return adminTestimonialsQuerySchema.parse(query)
}

export function adminTestimonialsRequestQuery(query: AdminTestimonialsQuery): Record<string, number> {
  return { page: query.page, perPage: ADMIN_TESTIMONIALS_PER_PAGE }
}

export function adminTestimonialsQueryKey(query: AdminTestimonialsQuery): string {
  return String(query.page)
}
