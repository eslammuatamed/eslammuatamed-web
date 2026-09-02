import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value

export const ADMIN_TAGS_PER_PAGE = 12

export const adminTagsQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1))
})

export type AdminTagsQuery = z.output<typeof adminTagsQuerySchema>

export function parseAdminTagsQuery(query: LocationQuery): AdminTagsQuery {
  return adminTagsQuerySchema.parse(query)
}

export function adminTagsRequestQuery(query: AdminTagsQuery): Record<string, number> {
  return { page: query.page, perPage: ADMIN_TAGS_PER_PAGE }
}

export function adminTagsQueryKey(query: AdminTagsQuery): string {
  return String(query.page)
}
