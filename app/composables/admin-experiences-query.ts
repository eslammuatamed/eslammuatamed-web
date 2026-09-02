import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value

/** The production list default, kept explicit so the route and request stay in lockstep. */
export const ADMIN_EXPERIENCES_PER_PAGE = 12

export const adminExperiencesQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1))
})

export type AdminExperiencesQuery = z.output<typeof adminExperiencesQuerySchema>

export function parseAdminExperiencesQuery(query: LocationQuery): AdminExperiencesQuery {
  return adminExperiencesQuerySchema.parse(query)
}

export function adminExperiencesRequestQuery(query: AdminExperiencesQuery): Record<string, number> {
  return { page: query.page, perPage: ADMIN_EXPERIENCES_PER_PAGE }
}

export function adminExperiencesQueryKey(query: AdminExperiencesQuery): string {
  return String(query.page)
}
