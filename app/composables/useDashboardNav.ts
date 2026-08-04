import type { ComputedRef } from 'vue'

/**
 * The dashboard navigation model (doc 11 §2, owner decision 1).
 *
 * Declarative on purpose: adding one of doc 04's remaining IA groups (Content, Library, System) is
 * an entry in this array, not a change to the shell. That is what "durable" means here — the shell
 * renders whatever the model describes and knows nothing about which modules exist.
 *
 * NO `roles` PREDICATE. The session exposes `role: { id, name }` and no permission grants, and owner
 * decision 2 forbids inferring `messages.read` from a role name. A role field here would be the
 * first half of exactly the permission matrix the decision rules out, so the model carries none:
 * navigation is filtered by ROUTE EXISTENCE only, and authorization is answered by the API through
 * the forbidden state (D11-2).
 */
export interface DashboardNavItem {
  /** i18n key under `dashboard.nav.*`. */
  readonly key: string
  /** Must be a route that EXISTS — no disabled or placeholder destinations (owner decision 1). */
  readonly to: string
  readonly icon: string
  /** Optional badge slot; rendered only when the value is non-null. */
  readonly badge?: ComputedRef<string | null>
  /**
   * `true` when this item should only light up on an exact path match. `/dashboard` needs it, or
   * Overview would stay active on every child route and two items would look current at once.
   */
  readonly exact?: boolean
}

export interface DashboardNavGroup {
  /** i18n key under `dashboard.nav.*`, or `null` for an ungrouped leading item. */
  readonly key: string | null
  readonly items: readonly DashboardNavItem[]
}

export function useDashboardNav() {
  const { badge } = useUnreadCount()

  const groups = computed<DashboardNavGroup[]>(() => [
    {
      key: null,
      items: [{ key: 'overview', to: '/dashboard', icon: 'i-lucide-layout-dashboard', exact: true }]
    },
    {
      key: 'communication',
      items: [{ key: 'messages', to: '/dashboard/messages', icon: 'i-lucide-inbox', badge }]
    }
  ])

  return { groups }
}

/**
 * Active-route test, shared by both nav surfaces so desktop and mobile cannot drift.
 *
 * Exact for `/dashboard` (see `exact` above); prefix for section roots, so `/dashboard/messages`
 * stays current while a message is open at `?message=…` and while on any future child route.
 */
export function isNavItemActive(item: DashboardNavItem, currentPath: string): boolean {
  if (item.exact) return currentPath === item.to
  return currentPath === item.to || currentPath.startsWith(`${item.to}/`)
}
