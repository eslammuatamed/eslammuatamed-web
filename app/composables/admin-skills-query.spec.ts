import { describe, expect, it } from 'vitest'
import {
  ADMIN_SKILLS_PER_PAGE,
  adminSkillsQueryKey,
  adminSkillsRequestQuery,
  parseAdminSkillsQuery
} from './admin-skills-query'

describe('the Skills collection route query contract', () => {
  it('defaults an empty or malformed URL to the first unfiltered page', () => {
    expect(parseAdminSkillsQuery({})).toEqual({ page: 1 })
    expect(parseAdminSkillsQuery({ page: '0', group: 'UNKNOWN' })).toEqual({ page: 1 })
  })

  it('restores every production group enum and the first repeated URL value', () => {
    for (const group of ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'] as const) {
      expect(parseAdminSkillsQuery({ page: '2', group })).toEqual({ page: 2, group })
    }
    expect(parseAdminSkillsQuery({ page: ['2', '9'], group: ['BACKEND', 'FRONTEND'] }))
      .toEqual({ page: 2, group: 'BACKEND' })
  })

  it('sends the fixed page size and never sends the UI-only all-groups value', () => {
    expect(adminSkillsRequestQuery({ page: 1 })).toEqual({ page: 1, perPage: ADMIN_SKILLS_PER_PAGE })
    expect(adminSkillsRequestQuery({ page: 2, group: 'FRONTEND' }))
      .toEqual({ page: 2, perPage: ADMIN_SKILLS_PER_PAGE, group: 'FRONTEND' })
  })

  it('uses both page and group as collection identity', () => {
    expect(adminSkillsQueryKey({ page: 1, group: 'FRONTEND' }))
      .not.toBe(adminSkillsQueryKey({ page: 2, group: 'FRONTEND' }))
    expect(adminSkillsQueryKey({ page: 1, group: 'FRONTEND' }))
      .not.toBe(adminSkillsQueryKey({ page: 1, group: 'BACKEND' }))
  })
})
