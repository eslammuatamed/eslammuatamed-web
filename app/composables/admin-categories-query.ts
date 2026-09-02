import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value

export const ADMIN_CATEGORIES_PER_PAGE = 12

export const adminCategoriesQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1))
})

export type AdminCategoriesQuery = z.output<typeof adminCategoriesQuerySchema>

export function parseAdminCategoriesQuery(query: LocationQuery): AdminCategoriesQuery {
  return adminCategoriesQuerySchema.parse(query)
}

export function adminCategoriesRequestQuery(query: AdminCategoriesQuery): Record<string, number> {
  return { page: query.page, perPage: ADMIN_CATEGORIES_PER_PAGE }
}

export function adminCategoriesQueryKey(query: AdminCategoriesQuery): string {
  return String(query.page)
}
