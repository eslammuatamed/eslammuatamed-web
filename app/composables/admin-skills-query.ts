import * as z from 'zod'
import type { LocationQuery } from 'vue-router'

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The released admin list default, kept explicit so pagination and the request cannot drift. */
export const ADMIN_SKILLS_PER_PAGE = 12
export const ADMIN_SKILLS_FILTER_GROUPS = ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'] as const
export type AdminSkillsFilterGroup = (typeof ADMIN_SKILLS_FILTER_GROUPS)[number]

/** `group` is optional on the wire: omitted means every group, never a fake "all" enum value. */
export const adminSkillsQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().positive().catch(1)),
  group: z.preprocess(firstValue, z.enum(ADMIN_SKILLS_FILTER_GROUPS).optional().catch(undefined))
})

export type AdminSkillsQuery = z.output<typeof adminSkillsQuerySchema>

export function parseAdminSkillsQuery(query: LocationQuery): AdminSkillsQuery {
  return adminSkillsQuerySchema.parse(query)
}

export function adminSkillsRequestQuery(query: AdminSkillsQuery): Record<string, string | number> {
  return {
    page: query.page,
    perPage: ADMIN_SKILLS_PER_PAGE,
    ...(query.group ? { group: query.group } : {})
  }
}

/** Both dimensions identify what can safely remain rendered after a failed refresh. */
export function adminSkillsQueryKey(query: AdminSkillsQuery): string {
  return JSON.stringify([query.group ?? null, query.page])
}
