import type { ContactMessage, Paginated } from '~/types/models'

/**
 * The unread badge count — one owner, shared by the dashboard shell and the Messages page.
 *
 * NO NEW ENDPOINT (owner decision 7). The API has no unread-count route, and adding one for a
 * single-operator inbox would be new public surface for a number the list envelope already carries:
 * `perPage=1` transfers one row while `meta.total` reports the full count.
 *
 * NO POLLING, NO SOCKETS. The count changes only as a consequence of actions this UI performs, so
 * it is refreshed on those actions rather than watched. A timer would spend requests to learn what
 * the mutation already told us.
 *
 * SINGLE OWNER. `useState` keys the value into the Nuxt payload once, so the sidebar badge and the
 * Messages page read the same ref rather than each holding a copy that can disagree.
 */
const STATE_KEY = 'dashboard:unread'
const FETCHED_AT_KEY = 'dashboard:unread:fetchedAt'

/** How long a count is considered fresh when returning to Messages (owner decision 7: "when stale"). */
const STALE_AFTER_MS = 30_000

/**
 * The in-flight promise lives at module scope, NOT in `useState`.
 *
 * Both the shell (on initialization) and the page (on a stale return) can ask for the count in the
 * same tick. A promise is not serialisable and must not enter the payload; keeping it here makes
 * "one request per burst" a property of the module rather than a convention each caller has to
 * remember. Cleared in `finally` so a failed request never wedges the badge permanently.
 */
let inFlight: Promise<number> | null = null

export function useUnreadCount() {
  const api = useApi()
  const count = useState<number | null>(STATE_KEY, () => null)
  const fetchedAt = useState<number | null>(FETCHED_AT_KEY, () => null)

  async function fetchCount(): Promise<number> {
    // A second caller during an outstanding request receives the SAME promise — the deduplication
    // the owner asked for, expressed as sharing rather than as cancelling.
    if (inFlight) return inFlight

    inFlight = api<Paginated<ContactMessage>>('/admin/messages', {
      locale: false,
      query: { isRead: false, isArchived: false, perPage: 1 }
    })
      .then((res) => {
        const total = res.meta.total
        count.value = total
        fetchedAt.value = Date.now()
        return total
      })
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  /**
   * Fetch only when there is no value yet or the value is stale. Used by shell initialization and
   * by returning to the Messages route; a mutation calls `refresh()` instead, because a mutation
   * KNOWS the count moved and must not be talked out of it by a freshness window.
   */
  async function ensureFresh(): Promise<void> {
    const stale = fetchedAt.value === null || Date.now() - fetchedAt.value > STALE_AFTER_MS
    if (count.value !== null && !stale) return
    // A failed badge fetch must never break the page that triggered it: the badge is ambient
    // information, and the list has its own error surface.
    await fetchCount().catch(() => undefined)
  }

  /** Unconditional refetch after a successful read/unread/archive/unarchive. */
  async function refresh(): Promise<void> {
    fetchedAt.value = null
    await fetchCount().catch(() => undefined)
  }

  /**
   * Bounded display (owner decision 7). `null` renders nothing — "not loaded yet" is not "zero",
   * and showing a confident 0 before the first response would be a small lie the user would act on.
   */
  const badge = computed<string | null>(() => {
    if (count.value === null || count.value <= 0) return null
    return count.value > 99 ? '99+' : String(count.value)
  })

  return { count, badge, ensureFresh, refresh, fetchCount }
}

/** Test seam only — resets the module-scoped in-flight promise between cases. */
export function __resetUnreadInFlight(): void {
  inFlight = null
}
