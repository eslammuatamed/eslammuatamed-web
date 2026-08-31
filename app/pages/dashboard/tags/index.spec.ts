// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/pages/dashboard/tags/index.vue', 'utf8')

describe('Tags collection route', () => {
  it('owns one table/list state and reuses the existing lightweight tag overlay', () => {
    expect(source).toContain("useAdminTags()")
    expect(source).toContain('<UTable')
    expect(source).toContain('DashboardTaxonomyTagOverlay')
    expect(source).toContain('@saved="load()"')
    expect(source).not.toContain('useAdminCategories')
  })
})
