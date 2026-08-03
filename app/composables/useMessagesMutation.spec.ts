// @vitest-environment nuxt
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { ref } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * Concurrency contract for the Messages page's mutation flow.
 *
 * Mounting the page itself would drag in UTable, USlideover and the router for what is really a
 * question about ordering, so the flow is reproduced here exactly as `messages.vue` implements it
 * and driven with deferred promises. That makes the ordering deterministic instead of timing
 * dependent, and it pins the rules that three separate review rounds landed on:
 *
 *   - the BADGE is global state the mutation genuinely changed -> always refreshed
 *   - the LIST belongs to a view -> refreshed only if the reader is still on that view/page
 *   - per-interaction FEEDBACK belongs to one message -> only if the selection is unchanged either
 *
 * The two tokens exist because one combined token has to be wrong for one of these: guarding the
 * list on selection would leave a mutated row showing its old read state after the reader opened a
 * different message.
 */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** The mutation flow of `messages.vue`, structurally identical to the component. */
function createFlow(deps: {
  patch: () => Promise<unknown>
  load: (view: string, page: number) => Promise<void>
  refreshUnread: () => Promise<void>
  closeDetail: () => void
}) {
  let contextSeq = 0
  const view = ref('inbox')
  const page = ref(1)
  const selectedId = ref<string | null>('a')
  const updateError = ref(false)
  const busyId = ref<string | null>(null)

  /** Reader changes view or page — both tokens move; the watcher also reloads. */
  function navigateView(next: string) {
    view.value = next
    contextSeq += 1
    updateError.value = false
  }

  /** Reader opens a different message — only the interaction context moves. */
  function selectMessage(id: string | null) {
    selectedId.value = id
    contextSeq += 1
    updateError.value = false
  }

  async function mutate(id: string, body: { isArchived?: boolean }) {
    const ctx = contextSeq
    busyId.value = id
    updateError.value = false
    try {
      await deps.patch()
      await Promise.all([deps.load(view.value, page.value), deps.refreshUnread()])
      if (ctx !== contextSeq) return
      if (body.isArchived !== undefined && selectedId.value === id) deps.closeDetail()
    } catch {
      if (ctx !== contextSeq) return
      updateError.value = true
    } finally {
      if (busyId.value === id) busyId.value = null
    }
  }

  return { mutate, navigateView, selectMessage, updateError, busyId }
}

let patchGate: ReturnType<typeof deferred<unknown>>
let load: Mock<(view: string, page: number) => Promise<void>>
let refreshUnread: Mock<() => Promise<void>>
let closeDetail: Mock<() => void>

beforeEach(() => {
  patchGate = deferred<unknown>()
  load = vi.fn<(view: string, page: number) => Promise<void>>().mockResolvedValue(undefined)
  refreshUnread = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  closeDetail = vi.fn<() => void>()
})

const flow = () => createFlow({ patch: () => patchGate.promise, load, refreshUnread, closeDetail })

describe('mutation vs navigation — list ownership', () => {
  it('refreshes the DESTINATION list after the reader changed view', async () => {
    const f = flow()
    const running = f.mutate('a', { isArchived: true })
    f.navigateView('archived')
    patchGate.resolve({})
    await running

    // The regression this pins: the watcher's load for Archived races the patch and can resolve
    // while the message is still unarchived on the server, so the destination renders WITHOUT it.
    // Skipping the refresh here left that list permanently missing the message just archived.
    expect(load).toHaveBeenCalledTimes(1)
    // ...and it targets where the reader NOW is, not where the mutation started.
    expect(load).toHaveBeenCalledWith('archived', 1)
    // The detail still is not closed — that is per-interaction state the reader has moved past.
    expect(closeDetail).not.toHaveBeenCalled()
  })

  it('STILL refreshes the list when only the selected message changed', async () => {
    const f = flow()
    const running = f.mutate('a', {})
    f.selectMessage('b')
    patchGate.resolve({})
    await running

    // The list does not depend on which message is open, and the mutated row's read state would
    // otherwise stay stale on screen.
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('refreshes the badge regardless of navigation — it is global state', async () => {
    const f = flow()
    const running = f.mutate('a', { isArchived: true })
    f.navigateView('archived')
    patchGate.resolve({})
    await running

    expect(refreshUnread).toHaveBeenCalledTimes(1)
  })

  it('closes the detail on a normal archive with no navigation', async () => {
    const f = flow()
    const running = f.mutate('a', { isArchived: true })
    patchGate.resolve({})
    await running

    expect(load).toHaveBeenCalledTimes(1)
    expect(closeDetail).toHaveBeenCalledTimes(1)
  })

  it('does not close a detail the reader has since replaced', async () => {
    const f = flow()
    const running = f.mutate('a', { isArchived: true })
    f.selectMessage('b')
    patchGate.resolve({})
    await running

    // The list still refreshes (selection does not own it) but the open message is B now.
    expect(load).toHaveBeenCalledTimes(1)
    expect(closeDetail).not.toHaveBeenCalled()
  })
})

describe('mutation vs navigation — failure feedback', () => {
  it('raises the error banner when the reader has not moved', async () => {
    const f = flow()
    const running = f.mutate('a', {})
    patchGate.reject(new Error('boom'))
    await running

    expect(f.updateError.value).toBe(true)
  })

  it('suppresses a failure that lands after a view change', async () => {
    const f = flow()
    const running = f.mutate('a', {})
    f.navigateView('archived')
    patchGate.reject(new Error('boom'))
    await running

    expect(f.updateError.value).toBe(false)
  })

  it('suppresses a failure that lands after opening another message', async () => {
    const f = flow()
    const running = f.mutate('a', {})
    f.selectMessage('b')
    patchGate.reject(new Error('boom'))
    await running

    expect(f.updateError.value).toBe(false)
  })

  it('always releases the busy control, even when navigation intervened', async () => {
    const f = flow()
    const running = f.mutate('a', {})
    f.navigateView('archived')
    patchGate.reject(new Error('boom'))
    await running

    // A guarded release would strand the row disabled with no way back.
    expect(f.busyId.value).toBeNull()
  })
})

/**
 * The suite above pins the CONTRACT by reproducing the flow, which leaves one gap: the component
 * could drift from it and the tests would still pass. These assertions read `messages.vue` itself
 * and check the one property the reproduction cannot — that the guards appear in the right ORDER.
 *
 * Order is the whole defect. Every previous version had all the right guards; they were simply
 * placed after the work they were meant to gate.
 */
describe('messages.vue — guards are ordered, not merely present', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/messages.vue'), 'utf8')
  const mutateBody = source.slice(source.indexOf('async function mutate('), source.indexOf('const markRead ='))

  const at = (needle: string) => {
    const i = mutateBody.indexOf(needle)
    expect(i, `expected to find ${needle} in mutate()`).toBeGreaterThan(-1)
    return i
  }

  it('refreshes badge and list together, before any interaction guard', () => {
    expect(at('refreshUnread()')).toBeLessThan(at('if (ctx !== contextSeq) return'))
  })

  it('refreshes the list unconditionally — freshness follows the reader', () => {
    // No token may gate the refresh: archive/unarchive changes BOTH lists, so the destination is
    // exactly the one that needs refetching. Ordering safety comes from load()'s own token.
    expect(mutateBody).not.toContain('listSeq')
    expect(at('await Promise.all([load(view.value, page.value), refreshUnread()])'))
      .toBeLessThan(at('if (ctx !== contextSeq) return'))
  })

  it('checks the interaction token BEFORE closing the detail', () => {
    expect(at('if (ctx !== contextSeq) return')).toBeLessThan(at('closeDetail()'))
  })

  it('captures the interaction token before the first await', () => {
    // Captured after an await, it would read the value the navigation already moved.
    expect(at('const ctx = contextSeq')).toBeLessThan(at('await patch('))
  })

  it('keeps list freshness out of the interaction token entirely', () => {
    // `contextSeq` must gate only per-interaction state. If it ever gated the list, a mutated row
    // would keep its stale read state as soon as the reader opened a different message.
    const start = source.indexOf('watch([view, page, selectedId]')
    // Bound the slice to the watcher's own body; running to end-of-file would sweep in the template.
    const selectionWatcher = source.slice(start, source.indexOf('\n})', start))
    expect(selectionWatcher).not.toContain('load(')
  })
})

/**
 * Responsive list presentation (owner decision 12). Structural rules that make two presentations of
 * one list safe — asserted against `messages.vue` itself, because each is a property of the markup
 * that a behavioural test on one presentation cannot see.
 */
describe('messages.vue — responsive list structure', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/messages.vue'), 'utf8')
  const template = src.slice(src.indexOf('<template>'))

  it('switches presentation with CSS, never a JS viewport branch', () => {
    expect(template).toContain('hidden sm:block')
    expect(template).toContain('sm:hidden')
    // A hydration-sensitive branch would render the wrong presentation on first paint.
    expect(src).not.toMatch(/window\.(innerWidth|matchMedia)/)
    expect(src).not.toMatch(/useMediaQuery|useBreakpoints/)
  })

  it('emits no id attributes, so the duplicated rows cannot collide', () => {
    expect(template).not.toMatch(/\sid="/)
    expect(template).not.toMatch(/:id="/)
  })

  it('keeps the actions menu OUTSIDE the card opener', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    const opener = card.slice(card.indexOf('<button'), card.indexOf('</button>'))
    // The menu must not live inside the opener, or activating it would also open the detail.
    expect(opener).not.toContain('UDropdownMenu')
    expect(card).toContain('UDropdownMenu')
  })

  it('gives the card opener an accessible name with state, sender and subject', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    expect(card).toMatch(/:aria-label=.*message\.name.*message\.subject/s)
  })

  it('applies dir="auto" to every visitor-controlled field in the card', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    // Sender, subject and preview each render visitor text and each needs its own dir="auto";
    // the element that OWNS the text must carry it, so one shared ancestor would not do.
    for (const field of ['message.name', 'message.subject', 'message.body']) {
      const owner = card.split('<span').find(chunk => chunk.includes(`{{ ${field} }}`))
        ?? card.split('<span').find(chunk => chunk.includes(`>{{ ${field} }}`))
      expect(owner, `no span renders ${field}`).toBeDefined()
      expect(owner, `${field} is not dir="auto"`).toContain('dir="auto"')
    }
  })

  it('renders the preview as plain text — no Markdown or HTML path', () => {
    expect(template).not.toContain('v-html')
    // Assert on IMPORTS, not prose: the file's own comments legitimately mention Markdown while
    // explaining why none is used, and matching those would be checking the documentation.
    const imports = src.split('\n').filter(l => /^\s*import\s/.test(l)).join('\n')
    expect(imports).not.toMatch(/markdown|shiki|marked|dompurify/i)
    expect(template).not.toMatch(/ContentProse|content-prose/)
  })

  it('wraps unbroken strings in the card rather than overflowing', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    expect(card).toContain('[overflow-wrap:anywhere]')
  })

  it('shows unread with a text label, not colour alone', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    expect(card).toContain("t('dashboard.messages.status.unread')")
    expect(card).toContain('aria-hidden="true"')
  })

  it('reuses the one data path — no second fetch or mutation in the card', () => {
    const card = template.slice(template.indexOf('<article'), template.indexOf('</article>'))
    expect(card).toContain('openMessage(message, $event)')
    expect(card).toContain('rowActions(message)')
    // exactly one list source and one mutation helper in the whole template
    expect(template.match(/useMessages\(/g)).toBeNull()
  })
})

/**
 * Focus restoration must key on the ELEMENT, never the message id: both presentations are in the
 * DOM with one hidden by CSS, so an id lookup can resolve to the hidden counterpart and focus is
 * lost silently.
 */
describe('messages.vue — focus restoration targets the exact opener', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/messages.vue'), 'utf8')

  it('stores the opener element from the event, not a selector', () => {
    expect(src).toContain('event?.currentTarget')
    expect(src).not.toMatch(/querySelector\(.*message\.id/)
    expect(src).not.toMatch(/getElementById/)
  })

  it('both presentations pass the event to openMessage', () => {
    expect(src.match(/openMessage\((?:row\.original|message), \$event\)/g)).toHaveLength(2)
  })

  it('refocuses only a still-connected element', () => {
    // A mutation re-renders the list; focusing a detached node drops focus to <body>.
    expect(src).toContain('isConnected')
  })
})
