import type { ContactMessage, Paginated } from '~/types/models'
import { ApiError } from '~/utils/api-error'

/** The two top-level views (owner decision 4). There is no All/Unread/Read filter. */
export type MessagesView = 'inbox' | 'archived'

/** The API default; max 50. Explicit rather than implicit so the URL and the request agree. */
export const MESSAGES_PER_PAGE = 12

export function isMessagesView(value: unknown): value is MessagesView {
  return value === 'inbox' || value === 'archived'
}

/**
 * Messages list + triage mutations.
 *
 * ORDERING IS THE API'S. `GET /admin/messages` returns unread-first then newest-first, backed by
 * `@@index([isArchived, isRead, createdAt])`. The client never re-sorts — doing so would silently
 * diverge from the pagination it is displaying, since page 2 is computed server-side under the
 * server's order.
 *
 * `isRead` IS NEVER SENT AS A FILTER. Owner decision 4 ships exactly two views; read state is
 * DISPLAYED, not filtered on.
 *
 * MUTATIONS ARE CONFIRMED, NEVER OPTIMISTIC (owner decision 6). Each returns only after the API
 * succeeds, and the caller refetches. No optimistic cache surgery: for a single-operator inbox the
 * latency win is imperceptible and the rollback branch is real complexity that would have to be
 * correct on the failure path — the exact path that must keep the unread badge honest.
 */
export function useMessages() {
  const api = useApi()

  const items = ref<ContactMessage[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const pending = ref(false)
  /** `403` is not "no messages" — it is a different answer and gets a different surface. */
  const forbidden = ref(false)
  const failed = ref(false)

  /**
   * Monotonic request token. Responses are not guaranteed to arrive in the order they were asked
   * for: switch Inbox -> Archived quickly and a slow Inbox response can land AFTER the Archived one,
   * leaving Inbox rows on screen under the Archived view — stale DATA, not merely stale feedback.
   * Only the newest request may write, so a superseded response is discarded rather than displayed.
   */
  let loadSeq = 0

  async function load(view: MessagesView, page: number): Promise<void> {
    const seq = ++loadSeq
    pending.value = true
    forbidden.value = false
    failed.value = false
    try {
      const res = await api<Paginated<ContactMessage>>('/admin/messages', {
        locale: false,
        query: { isArchived: view === 'archived', page, perPage: MESSAGES_PER_PAGE }
      })
      if (seq !== loadSeq) return
      items.value = [...res.data]
      total.value = res.meta.total
      totalPages.value = res.meta.totalPages
    } catch (error) {
      // A superseded request's failure is not this view's failure — it must not clear the newer
      // request's rows or raise an error state the reader would attach to the wrong list.
      if (seq !== loadSeq) return
      // A failed load must not leave the previous page's rows on screen pretending to be current.
      items.value = []
      total.value = 0
      totalPages.value = 1
      if (error instanceof ApiError && error.status === 403) forbidden.value = true
      else failed.value = true
    } finally {
      // Only the newest request owns `pending`; a superseded one clearing it would say "loaded"
      // while the current request is still in flight.
      if (seq === loadSeq) pending.value = false
    }
  }

  /**
   * PATCH one message. Returns the updated entity so the caller can reconcile the row it already
   * holds; throws on failure so the caller can retain the previous state and surface the error —
   * the behaviour owner decision 6 requires on the unread path.
   */
  async function patch(id: string, body: { isRead?: boolean, isArchived?: boolean }): Promise<ContactMessage> {
    const res = await api<{ data: ContactMessage }>(`/admin/messages/${id}`, {
      method: 'PATCH',
      body
    })
    return res.data
  }

  return { items, total, totalPages, pending, forbidden, failed, load, patch }
}

/**
 * A safe `mailto:` for the reply handoff (owner decision 8).
 *
 * Returns `null` when there is no address — the guard that makes `mailto:null` impossible. A
 * phone-only message is a fully supported intake shape (D10-16), not an edge case, so the absence of
 * an address is expected input rather than an error.
 *
 * The body is left EMPTY by decision; only the subject is prefilled, and it is prefixed once —
 * a subject already starting with `Re:` is not re-prefixed into `Re: Re: …`.
 */
export function replyMailto(message: Pick<ContactMessage, 'email' | 'subject'>): string | null {
  if (!message.email) return null
  const subject = /^re:\s/i.test(message.subject) ? message.subject : `Re: ${message.subject}`
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}`
}

/**
 * A `tel:` URL for the call affordance. The stored value is already E.164 (D10-16), so this only
 * strips the spacing a human might have introduced — it never reformats or "repairs" the number.
 */
export function callTel(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`
}
