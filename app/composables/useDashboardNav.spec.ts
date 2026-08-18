// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { isNavItemActive, useDashboardNav } from './useDashboardNav'
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

describe('the navigation model', () => {
  const items = () => useDashboardNav().groups.value.flatMap(group => group.items)

  it('offers Articles, Experience and Projects, in the Content group', () => {
    const groups = useDashboardNav().groups.value
    const content = groups.find(group => group.key === 'content')
    expect(content?.items.map(item => item.key)).toEqual(['articles', 'experiences', 'projects'])
  })

  it('points Experience at a route that EXISTS — no placeholder destinations', () => {
    expect(items().find(item => item.key === 'experiences')?.to).toBe('/dashboard/experiences')
  })

  it('points Projects at a route that EXISTS — no placeholder destinations', () => {
    expect(items().find(item => item.key === 'projects')?.to).toBe('/dashboard/projects')
  })

  /**
   * The model carries NO `roles` predicate, and that is the decision rather than an omission: the
   * session exposes a role name and no permission grants, so a predicate here would be guessing.
   * Authorization is answered by the API through each page's `forbidden` state (D11-2).
   */
  it('carries no authorization predicate on any item', () => {
    for (const item of items()) {
      expect(item, item.key).not.toHaveProperty('roles')
    }
  })

  it('keeps exactly one item active on every Projects route, editors included', () => {
    const all = items()
    for (const path of [
      '/dashboard',
      '/dashboard/projects',
      '/dashboard/projects/new',
      '/dashboard/projects/0194f9a2-ef2a-7a31-8cb7-369c87f7933a'
    ]) {
      expect(all.filter(item => isNavItemActive(item, path)), path).toHaveLength(1)
    }
    // The editor routes are children of the section, so Projects stays current inside them rather
    // than the sidebar going blank while an operator is editing.
    expect(active(all, '/dashboard/projects/new')).toBe('projects')
    expect(active(all, '/dashboard')).toBe('overview')
  })
})

function active(items: readonly DashboardNavItem[], path: string): string | undefined {
  return items.find(item => isNavItemActive(item, path))?.key
}
