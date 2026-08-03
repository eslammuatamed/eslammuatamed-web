// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { isNavItemActive } from './useDashboardNav'
import type { DashboardNavItem } from './useDashboardNav'

const item = (over: Partial<DashboardNavItem> = {}): DashboardNavItem =>
  ({ key: 'messages', to: '/dashboard/messages', icon: 'i', ...over })

describe('isNavItemActive', () => {
  it('marks a section root active on its own path', () => {
    expect(isNavItemActive(item(), '/dashboard/messages')).toBe(true)
  })

  it('keeps a section active on a child route', () => {
    expect(isNavItemActive(item(), '/dashboard/messages/anything')).toBe(true)
  })

  /**
   * The reason `exact` exists: without it Overview would prefix-match every dashboard route and two
   * items would render `aria-current="page"` at once, which is both wrong and ambiguous to a screen
   * reader.
   */
  it('does not mark exact items active on child routes', () => {
    const overview = item({ key: 'overview', to: '/dashboard', exact: true })
    expect(isNavItemActive(overview, '/dashboard')).toBe(true)
    expect(isNavItemActive(overview, '/dashboard/messages')).toBe(false)
  })

  it('does not match a sibling whose path merely shares a prefix string', () => {
    // `/dashboard/messages-archive` must not activate `/dashboard/messages`.
    expect(isNavItemActive(item(), '/dashboard/messages-archive')).toBe(false)
  })

  it('exactly one item is active on any dashboard path', () => {
    const items = [
      item({ key: 'overview', to: '/dashboard', exact: true }),
      item()
    ]
    for (const path of ['/dashboard', '/dashboard/messages']) {
      expect(items.filter(i => isNavItemActive(i, path))).toHaveLength(1)
    }
  })
})
