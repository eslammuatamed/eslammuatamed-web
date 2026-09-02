// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/pages/dashboard/categories/index.vue', 'utf8')

describe('Categories collection route', () => {
  it('owns one table/list state and reuses the existing lightweight category overlay', () => {
    expect(source).toContain("useAdminCategories()")
    expect(source).toContain('<UTable')
    expect(source).toContain('DashboardTaxonomyCategoryOverlay')
    expect(source).toContain('parseAdminCategoriesQuery')
    expect(source).toContain('ADMIN_CATEGORIES_PER_PAGE')
    expect(source).toContain('data-categories-pagination')
    expect(source).toContain('@saved="loadCurrentPage()"')
    expect(source).not.toContain('useAdminTags')
  })
})
