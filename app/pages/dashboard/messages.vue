<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ContactMessage } from '~/types/models'
import { callTel, replyMailto, useMessages, MESSAGES_PER_PAGE } from '~/composables/useMessages'
import { parseMessagesQuery } from '~/utils/messages-query'

/**
 * Dashboard Inbox (FR-DSH-060, flow F-D5).
 *
 * URL IS THE SINGLE SOURCE OF TRUTH for view, page and selection — `?view=&page=&message=`. The
 * slideover's open state is DERIVED from `?message=`, never stored alongside it: that is what makes
 * Back/Forward, deep links and reload correct without any manual synchronisation, because history
 * navigation changes the query and the UI simply follows.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { items, total, totalPages, pending, forbidden, failed, load, patch } = useMessages()
const { refresh: refreshUnread, ensureFresh } = useUnreadCount()

useHead({ title: () => `${t('dashboard.messages.title')} · ${t('dashboard.title')}` })

/**
 * ONE canonical parse of the route query (Zod-first Dashboard validation policy). Every read below
 * derives from it, so `view`, `page` and `message` cannot be normalised one way here and another way
 * in a handler. The schema is total — it defaults rather than throwing — and never rewrites the URL,
 * which is what keeps normalisation from re-triggering the watcher that reads it.
 */
const parsedQuery = computed(() => parseMessagesQuery(route.query))
const view = computed(() => parsedQuery.value.view)
const page = computed(() => parsedQuery.value.page)
const selectedId = computed(() => parsedQuery.value.message ?? null)

/** Offline is a first-class state: mutations are disabled and no queue is kept (owner decision 11). */
const online = ref(true)
const updateError = ref(false)
/**
 * Two monotonic tokens, because two different things go stale at different rates. Clearing state on
 * navigation is not sufficient on its own: an async action already in flight resolves AFTER the
 * clear and would resurrect what was just cleared, so every async write captures a token first and
 * commits only if it still matches.
 *
 * `contextSeq` guards PER-INTERACTION state — the error banner, the copy confirmation and
 * `closeDetail` — all of which belong to one message and are meaningless once the reader has moved.
 *
 * The LIST is deliberately NOT guarded by it. List freshness is a data question, not an interaction
 * one: a mutation changes what belongs in both the source and the destination view, so the refresh
 * has to follow the reader rather than be cancelled by them. Ordering safety for that refresh comes
 * from `load()`'s own token, which lets the newest request win, not from cancelling here.
 */
let contextSeq = 0
const busyId = ref<string | null>(null)
const copyState = ref<'idle' | 'ok' | 'fail'>('idle')

/**
 * The message the reader currently has OPEN, retained across list refreshes.
 *
 * WHY A SNAPSHOT IS REQUIRED. Opening an unread message auto-marks it read, and a confirmed
 * mutation refreshes the list. The list is ordered unread-first, so the message the reader just
 * opened is re-sorted behind every remaining unread one — and on any inbox with more than one page
 * of unread mail that pushes it clean off the current page. Resolving `selected` from `items` alone
 * then yielded `null`, `detailOpen` flipped false, and the detail CLOSED ITSELF a few hundred
 * milliseconds after opening while `?message=` still named it: the URL and the page disagreeing,
 * which is exactly what the canonical query schema exists to prevent.
 *
 * The snapshot is keyed to the selected id and cleared when the selection clears, so it can never
 * resurrect a detail the reader has closed, and it is always overwritten by the fresher list copy
 * whenever the message IS on the page.
 */
const selectedSnapshot = ref<ContactMessage | null>(null)

/**
 * The selected message is looked up in the loaded page rather than fetched — list rows already
 * carry the full body (owner decision 3), so a detail request would re-download what is on screen.
 * The snapshot above covers the one case the page cannot answer: a message that left this page as a
 * consequence of its own mutation.
 */
const selectedInPage = computed(() => items.value.find(m => m.id === selectedId.value) ?? null)
const selected = computed(() => {
  if (selectedInPage.value) return selectedInPage.value
  const held = selectedSnapshot.value
  return held && held.id === selectedId.value ? held : null
})

watch(selectedInPage, (message) => {
  if (message) selectedSnapshot.value = message
})
watch(selectedId, (id) => {
  if (id === null) selectedSnapshot.value = null
})

/**
 * A selection that is not on this page AND was never opened here is STALE, not an error: the message
 * may have been archived, purged by retention, or linked from a different page. Non-destructive
 * notice, list stays usable.
 */
const staleSelection = computed(() => selectedId.value !== null && selected.value === null && !pending.value)

const detailOpen = computed({
  get: () => selected.value !== null,
  set: (open: boolean) => {
    if (!open) closeDetail()
  }
})

function setQuery(patchQuery: Record<string, string | undefined>): void {
  // Build the next query by filtering rather than deleting: an `undefined` value means "drop this
  // parameter", and a rebuilt object states that without mutating the route's own query object.
  const merged = { ...route.query, ...patchQuery }
  const next = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined))
  void router.push({ query: next })
}

/** Closing removes ONLY `message`, preserving view and page (owner decision 3). */
function closeDetail(): void {
  setQuery({ message: undefined })
}

/**
 * The exact element that opened the detail, so focus can return to IT.
 *
 * Stored as an element rather than a message id on purpose: the table and the card list both exist
 * in the DOM with one hidden by CSS, so a lookup by id could resolve to the hidden counterpart and
 * focus would vanish. Non-reactive — it is an imperative handle, not render state.
 */
let lastOpener: HTMLElement | null = null
/**
 * Which PRESENTATION the reader opened from, so the opener can be re-acquired if its node dies.
 *
 * Opening an unread message marks it read, which reloads the list and can replace the very node
 * that was clicked — measured: focus then lands on `<body>`. Re-acquiring by message id ALONE is
 * forbidden, because the table and the card list both exist in the DOM and the id would match the
 * hidden counterpart. Scoping the lookup by presentation makes that impossible by construction.
 *
 * `data-*` attributes rather than `id`, so the two presentations cannot collide.
 */
let lastOpenerKey: { presentation: 'card' | 'row', id: string, view: 'inbox' | 'archived', page: number } | null = null

/**
 * The always-present fallback: the labelled list region (see the template).
 */
const listRegion = useTemplateRef<HTMLElement>('listRegion')

/** Names the CURRENT view, so restored focus announces which list the reader is back in. */
const listRegionLabel = computed(() => t('dashboard.messages.listRegionLabel', {
  view: t(`dashboard.messages.view.${view.value}`)
}))

/**
 * Visible AND focusable, not merely attached.
 *
 * `isConnected` alone is not enough: the table and the card list are BOTH in the DOM at every
 * breakpoint with one `display:none`, so a node can be connected and still be the hidden
 * counterpart — focusing it silently drops focus to `<body>`, which is the exact failure this
 * whole path exists to prevent. `checkVisibility` resolves `display:none` on any ancestor;
 * `offsetParent` is the fallback for engines without it.
 */
function isFocusable(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el?.isConnected) return false
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false
  return typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ checkVisibilityCSS: true })
    : el.offsetParent !== null
}

function openMessage(message: ContactMessage, event?: Event): void {
  const el = (event?.currentTarget as HTMLElement | null) ?? null
  lastOpener = el
  const presentation = el?.dataset.opener
  // The view and page are captured WITH the opener: restoring focus to a control that belongs to a
  // list the reader has since navigated away from would be worse than the fallback, not better.
  lastOpenerKey = presentation === 'card' || presentation === 'row'
    ? { presentation, id: message.id, view: view.value, page: page.value }
    : null
  setQuery({ message: message.id })
}

/**
 * Return focus to the opener when the detail closes.
 *
 * The wait is load-bearing. This watcher fires as soon as the query changes, but the overlay is
 * still closing and performs its OWN focus restoration when it unmounts — which lands after ours and
 * overwrites it, leaving focus on `<body>`. So we wait for the dialog to actually leave the DOM
 * before claiming focus. Measured: without the wait, focus returned to neither the card nor the row.
 *
 * Guarded on `isConnected` because a mutation re-renders the list and can replace that node;
 * focusing a detached element silently drops focus instead of restoring it.
 */
watch(selectedId, async (id, previous) => {
  if (id !== null || previous === null) return
  const el = lastOpener
  const key = lastOpenerKey
  lastOpener = null
  lastOpenerKey = null
  // NOT an early return when there is no opener: a deep-linked `?message=` open has none, and
  // closing it must still land somewhere real.

  for (let frame = 0; frame < 40 && document.querySelector('[role=dialog]'); frame += 1) {
    await new Promise(resolve => requestAnimationFrame(resolve))
  }

  // An opener that belongs to a list the reader has since left is NOT a valid target, however alive
  // its node still is. Paging or switching view while the detail is open lands here.
  const sameList = key !== null && key.view === view.value && key.page === page.value

  if (sameList && isFocusable(el)) {
    el.focus()
    return
  }
  // The node was replaced by the re-render. Re-acquire it WITHIN the same presentation only — never
  // by message id alone, which would match the hidden counterpart.
  if (sameList && key) {
    const replacement = document.querySelector<HTMLElement>(
      `[data-opener="${key.presentation}"][data-message="${key.id}"]`
    )
    if (isFocusable(replacement)) {
      replacement.focus()
      return
    }
  }

  // Nothing valid left: the message was re-sorted off the page by auto-read, archived away, or the
  // reader changed view/page. Focus the labelled list region rather than an arbitrary first message
  // — an arbitrary row is a silent, wrong claim about where the reader was.
  listRegion.value?.focus()
})

function selectView(next: 'inbox' | 'archived'): void {
  setQuery({ view: next, page: undefined, message: undefined })
}

function goToPage(next: number): void {
  setQuery({ page: next === 1 ? undefined : String(next), message: undefined })
}

/**
 * Confirmed mutation (owner decision 6). The row is updated only after the API succeeds; on failure
 * the previous state is retained, the badge is NOT touched, and a recoverable error is announced.
 */
async function mutate(message: ContactMessage, body: { isRead?: boolean, isArchived?: boolean }): Promise<void> {
  if (!online.value) return
  const ctx = contextSeq
  busyId.value = message.id
  updateError.value = false
  try {
    await patch(message.id, body)

    // Refresh the CURRENT list — whichever one it now is — plus the global badge.
    //
    // Archive and unarchive change membership of BOTH lists, so if the reader has moved to the
    // destination view it is precisely the list that needs refetching. Skipping it there is a real
    // bug, not a safe no-op: archive in Inbox, switch to Archived, and the watcher's load races the
    // patch. It can resolve while the message is still unarchived on the server, so the destination
    // renders WITHOUT the message that was just archived and nothing refetches it.
    //
    // Reading `view`/`page` here rather than from the captured token is deliberate: the refresh
    // targets where the reader is now, which is the list the mutation just changed. `load()` carries
    // its own monotonic token, so this and the watcher's request cannot land out of order — the
    // newest always wins.
    //
    // This does reset the destination's `pending`/`failed` state, which is the honest consequence of
    // the list having genuinely changed; a briefly-cleared error banner is a far smaller cost than a
    // silently missing message.
    await Promise.all([load(view.value, page.value), refreshUnread()])

    // An archived/unarchived message leaves the current view; keeping it selected would show a row
    // that is no longer in the list it came from. Skipped if the reader already navigated — closing
    // a detail they have since replaced would yank the message they are now reading.
    if (ctx !== contextSeq) return
    if (body.isArchived !== undefined && selectedId.value === message.id) closeDetail()
  } catch {
    // A failure that lands after the reader moved on belongs to a context they have left; raising
    // it now would attach the banner to a message or list it never concerned.
    if (ctx !== contextSeq) return
    updateError.value = true
  } finally {
    // `busyId` is always released — it gates a control, so leaving it set would strand a row
    // disabled — but only if a newer mutation has not already taken ownership of it.
    if (busyId.value === message.id) busyId.value = null
  }
}

const markRead = (m: ContactMessage) => mutate(m, { isRead: true })
const markUnread = (m: ContactMessage) => mutate(m, { isRead: false })
const archive = (m: ContactMessage) => mutate(m, { isArchived: true })
const unarchive = (m: ContactMessage) => mutate(m, { isArchived: false })

// A single tracked timer. Two copies in quick succession previously left the FIRST timer running,
// so it cleared the second copy's feedback early; and an unmount mid-window wrote to a ref that no
// longer had a component. Replacing the pending timer and clearing it on unmount fixes both.
let copyResetTimer: ReturnType<typeof setTimeout> | undefined
async function copyNumber(phone: string): Promise<void> {
  const ctx = contextSeq
  let outcome: 'ok' | 'fail'
  try {
    await navigator.clipboard.writeText(phone)
    outcome = 'ok'
  } catch {
    outcome = 'fail'
  }
  // The clipboard write is async, so the reader can open another message before it settles. Without
  // this the confirmation would appear under a message whose number was never copied.
  if (ctx !== contextSeq) return
  copyState.value = outcome
  clearTimeout(copyResetTimer)
  copyResetTimer = setTimeout(() => (copyState.value = 'idle'), 2000)
}
onUnmounted(() => clearTimeout(copyResetTimer))

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', {
  dateStyle: 'medium', timeStyle: 'short'
}))
const formatDate = (iso: string) => dateFormatter.value.format(new Date(iso))

const columns: TableColumn<ContactMessage>[] = [
  { accessorKey: 'status', header: () => t('dashboard.messages.column.status') },
  { accessorKey: 'name', header: () => t('dashboard.messages.column.from') },
  { accessorKey: 'subject', header: () => t('dashboard.messages.column.subject') },
  { accessorKey: 'createdAt', header: () => t('dashboard.messages.column.received') },
  { id: 'actions', header: () => t('dashboard.messages.column.actions') }
]

function rowActions(message: ContactMessage) {
  return [[
    message.isRead
      ? { label: t('dashboard.messages.actions.markUnread'), icon: 'i-lucide-mail', onSelect: () => markUnread(message) }
      : { label: t('dashboard.messages.actions.markRead'), icon: 'i-lucide-mail-open', onSelect: () => markRead(message) },
    message.isArchived
      ? { label: t('dashboard.messages.actions.unarchive'), icon: 'i-lucide-archive-restore', onSelect: () => unarchive(message) }
      : { label: t('dashboard.messages.actions.archive'), icon: 'i-lucide-archive', onSelect: () => archive(message) }
  ]]
}

// Re-read whenever view or page changes — including via Back/Forward, which changes the query.
watch([view, page], () => void load(view.value, page.value), { immediate: true })

/**
 * Transient per-interaction feedback is cleared by ANY navigation, which here means a change to the
 * view, the page, OR the selected message — `?message=` is a real navigation with its own history
 * entry, not a lesser kind of state change.
 *
 * Both of these outlive their context otherwise. A failed archive on message A would keep its banner
 * on screen while the reader opened message B and C, attaching a stale failure to rows it never
 * touched; and "Number copied" would still be showing under B's actions within the two-second
 * window, for a number that was copied from A.
 *
 * Only the FAILURE path can reach here with state set: `mutate` clears the error before each attempt
 * and changes the route only after a success, so this never wipes a message the reader has not had
 * the chance to see.
 */
watch([view, page, selectedId], () => {
  contextSeq += 1
  updateError.value = false
  clearTimeout(copyResetTimer)
  copyState.value = 'idle'
})

/**
 * "Opening an unread message requests mark read" (owner decision 6) is keyed on the message becoming
 * VISIBLE, not on the click that usually causes it. A deep link, a reload and a Back/Forward all
 * open the detail without a click, and marking read only on click would give the same visible state
 * two different meanings depending on how the reader arrived.
 *
 * Guarded on the id so re-running the effect for an already-handled message cannot re-issue the
 * mutation, and confirmed like every other write — a failure leaves the message unread.
 */
const autoReadRequestedFor = ref<string | null>(null)

// Reset when the detail CLOSES, so the guard scopes to one opening rather than to the page's
// lifetime. Without this the ref keeps the last id forever: open an unread message (auto-read),
// `Mark as unread`, close, reopen — and the reopen would not mark it read, because the guard still
// matched. Scoping it to the open/close cycle keeps both behaviours right: no duplicate request
// while a message is open, and no permanently-disarmed auto-read afterwards.
watch(selectedId, (id) => {
  if (id === null) autoReadRequestedFor.value = null
})

watch(selected, (message) => {
  if (!message || message.isRead) return
  if (autoReadRequestedFor.value === message.id) return
  autoReadRequestedFor.value = message.id
  void markRead(message)
})

onMounted(() => {
  online.value = navigator.onLine
  const on = () => (online.value = true)
  const off = () => (online.value = false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  onUnmounted(() => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  })
  // Deduplicated against the shell's own initialization call.
  void ensureFresh()
})
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6">
      <h1 class="text-h1 text-highlighted">{{ t('dashboard.messages.title') }}</h1>
      <p class="mt-2 text-muted">{{ t('dashboard.messages.description') }}</p>
    </div>

    <!-- Exactly two views (owner decision 4). Real tablist semantics so arrow keys work. -->
    <div class="mb-4 flex items-center gap-2" role="tablist" :aria-label="t('dashboard.messages.view.label')">
      <!-- The ACTIVE tab is white on the default primary (500), which measures 3.98:1 at this
           small size — under the 4.5:1 WCAG AA minimum. The 600 shade is 5.89:1, matching the
           unread badge and the violet the Contact slice standardised on.
           `active:` MUST be overridden explicitly. tailwind-merge treats `active:bg-*` as a
           different group from `bg-*` and `hover:bg-*`, so the component's own
           `active:bg-primary/75` survives an override of the other two — and being the 500 shade at
           75% alpha it composites LIGHTER, reproducing the identical 3.99:1 failure in the pressed
           state. Verified by sampling the rendered pixel in each state, because `getComputedStyle`
           reports the uncomposited `oklab(… / 0.75)` and cannot be contrast-checked directly. -->
      <UButton
        v-for="tab in (['inbox', 'archived'] as const)"
        :key="tab"
        role="tab"
        :aria-selected="view === tab"
        :color="view === tab ? 'primary' : 'neutral'"
        :variant="view === tab ? 'solid' : 'ghost'"
        size="sm"
        :ui="view === tab ? { base: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-700' } : undefined"
        @click="selectView(tab)"
      >
        {{ t(`dashboard.messages.view.${tab}`) }}
      </UButton>
    </div>

    <UAlert
      v-if="!online"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      class="mb-4"
      :title="t('dashboard.messages.offlineTitle')"
      :description="t('dashboard.messages.offlineBody')"
    />

    <!-- Retention copy belongs to the Archived VIEW, not to every archive click (owner decision 9). -->
    <UAlert
      v-if="view === 'archived'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-clock"
      class="mb-4"
      :description="t('dashboard.messages.retentionNotice')"
    />

    <UAlert
      v-if="staleSelection"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      class="mb-4"
      :description="t('dashboard.messages.staleSelection')"
      close
      @update:open="closeDetail()"
    />

    <!-- Mutation failures are announced, not just coloured. -->
    <div aria-live="polite" class="empty:hidden">
      <UAlert
        v-if="updateError"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.messages.updateErrorTitle')"
        :description="t('dashboard.messages.updateErrorBody')"
      />
    </div>

    <!-- THE FOCUS FALLBACK TARGET, and the reason it wraps the whole v-if chain rather than the
         table or the card list. Closing the detail must never drop focus on `<body>`, but the exact
         opener can genuinely cease to exist — auto-read re-sorts the message off the page, archive
         removes it, the reader pages or switches view while the detail is open. The fallback has to
         exist in EVERY one of those end states, including the empty and error ones, so it wraps all
         of them.
         One element, not one per breakpoint: the table and the card list are both in the DOM with
         one `display:none`, so a per-presentation target could be the hidden counterpart. This one
         is always the visible one because it is the only one.
         `tabindex="-1"` is programmatic-focus only — it is NOT in the tab order, so no keyboard user
         gains a stop. The label names the CURRENT view, so a screen reader announces "Inbox
         messages"/"Archived messages" and the reader knows where focus went. -->
    <section
      ref="listRegion"
      tabindex="-1"
      :aria-label="listRegionLabel"
      class="focus:outline-none"
    >
    <div v-if="pending" class="flex flex-col gap-2" :aria-label="t('dashboard.messages.loading')" aria-busy="true">
      <USkeleton v-for="i in 6" :key="i" class="h-12 w-full" />
    </div>

    <!-- The subtle error title defaults to the 500 red, which measures 3.15:1 on its own tinted
         background — under the 4.5:1 AA minimum. The 700 shade is 5.32:1; the dark-mode counterpart
         keeps the same relationship against the dark surface. Caught by axe during the visual
         review, and applied to BOTH error alerts so they cannot drift apart.

         The DESCRIPTION slot needed the same treatment and did not get it the first time. It carries
         @nuxt/ui's default `opacity-90` over the same tinted ground, which measured 2.96:1 — failing
         AA at both the 4.5:1 normal and the 3.0:1 large-text thresholds. axe-core 4.12 did not report
         it; 4.13 does, and the ratio was confirmed by direct WCAG computation, so this is a real
         pre-existing defect rather than a checker artefact. The 700 shade clears it even under the
         retained opacity. Applied to every error alert that carries a description, for the same
         no-drift reason. -->
    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.messages.forbiddenTitle')"
      :description="t('dashboard.messages.forbiddenBody')"
    />

    <div v-else-if="failed" class="rounded-control border border-default p-6 text-center">
      <p class="font-medium text-highlighted">{{ t('dashboard.messages.errorTitle') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('dashboard.messages.errorBody') }}</p>
      <UButton class="mt-4" color="neutral" variant="subtle" @click="load(view, page)">
        {{ t('dashboard.messages.retry') }}
      </UButton>
    </div>

    <div v-else-if="items.length === 0" class="rounded-control border border-default p-10 text-center">
      <p class="font-medium text-highlighted">
        {{ view === 'archived' ? t('dashboard.messages.emptyArchivedTitle') : t('dashboard.messages.emptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ view === 'archived' ? t('dashboard.messages.emptyArchivedBody') : t('dashboard.messages.emptyBody') }}
      </p>
    </div>

    <template v-else>
      <!-- DESKTOP: the existing table, unchanged. `hidden sm:block` rather than a JS viewport branch
           — `display:none` removes the inactive presentation from the accessibility tree and the
           focus order, so the two can never both be reachable, and nothing depends on hydration. -->
      <div class="hidden sm:block">
        <UTable :data="items" :columns="columns" :aria-label="t('dashboard.messages.tableLabel')">
        <template #status-cell="{ row }">
          <!-- Unread is never colour-only: dot + text label, both present. -->
          <span class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="size-2 rounded-full"
              :class="row.original.isRead ? 'bg-transparent ring-1 ring-muted' : 'bg-primary'"
            />
            <span :class="row.original.isRead ? 'text-muted' : 'font-semibold text-highlighted'">
              {{ row.original.isRead ? t('dashboard.messages.status.read') : t('dashboard.messages.status.unread') }}
            </span>
          </span>
        </template>

        <template #name-cell="{ row }">
          <span dir="auto" class="block max-w-28 truncate sm:max-w-40 lg:max-w-48">{{ row.original.name }}</span>
        </template>

        <template #subject-cell="{ row }">
          <!-- The row's ONE interactive control. Per-row actions live in the trailing menu, so no
               interactive element is nested inside another.
               A PLAIN <button> rather than UButton: `truncate` is `overflow+text-overflow+nowrap` on
               the element that owns the text, and UButton renders an inline-flex box whose child span
               is a separate formatting context — the text then hard-clips with no ellipsis. One
               element that both owns the text and carries the width constraint is what makes the
               ellipsis appear. -->
          <button
            type="button"
            dir="auto"
            data-opener="row"
            :data-message="row.original.id"
            class="block w-44 max-w-full truncate text-start text-sm sm:w-64 lg:w-80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="row.original.isRead ? 'text-default' : 'font-semibold text-highlighted'"
            @click="openMessage(row.original, $event)"
          >
            {{ row.original.subject }}
          </button>
        </template>

        <template #createdAt-cell="{ row }">
          <time :datetime="row.original.createdAt" class="whitespace-nowrap text-sm text-muted">
            {{ formatDate(row.original.createdAt) }}
          </time>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu :items="rowActions(row.original)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis-vertical"
                size="sm"
                :disabled="!online || busyId === row.original.id"
                :aria-label="t('dashboard.messages.rowActions')"
              />
            </UDropdownMenu>
          </div>
        </template>
        </UTable>
      </div>

      <!-- MOBILE: one compact card per message. Same `items`, same `openMessage`, same slideover —
           presentation only. Each card is an <article> with exactly TWO interactive siblings: a
           full-width opener and the actions menu. The opener never contains the menu, so using the
           menu cannot open the detail. No `id` is emitted by either presentation, so the duplicated
           rows cannot collide. -->
      <ul class="flex flex-col gap-2 sm:hidden">
        <li v-for="message in items" :key="message.id">
          <!-- `UCard` supplies the surface, border, radius and dark-mode states (Nuxt UI-first
               policy); only the compact padding is overridden, so none of that is recreated with
               local styles. It stays PRESENTATIONAL — the card is not itself a link or button.
               `as="article"` keeps the semantic wrapper the a11y structure relies on. -->
          <UCard
            as="article"
            class="relative"
            :ui="{ body: 'p-0 sm:p-0' }"
          >
            <button
              type="button"
              data-opener="card"
              :data-message="message.id"
              class="block w-full rounded-control p-3 pe-11 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :aria-label="`${message.isRead ? t('dashboard.messages.status.read') : t('dashboard.messages.status.unread')}, ${message.name}: ${message.subject}`"
              @click="openMessage(message, $event)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    class="size-2 shrink-0 rounded-full"
                    :class="message.isRead ? 'bg-transparent ring-1 ring-muted' : 'bg-primary-600'"
                  />
                  <span class="text-xs" :class="message.isRead ? 'text-muted' : 'font-semibold text-highlighted'">
                    {{ message.isRead ? t('dashboard.messages.status.read') : t('dashboard.messages.status.unread') }}
                  </span>
                </span>
                <time :datetime="message.createdAt" class="shrink-0 text-xs text-muted">
                  {{ formatDate(message.createdAt) }}
                </time>
              </span>

              <span dir="auto" class="mt-1.5 block truncate text-xs text-muted">{{ message.name }}</span>

              <!-- The subject is the strongest element in the card and gets two readable lines.
                   `line-clamp-2`, NOT hand-rolled `-webkit-box` utilities: `block` and
                   `[display:-webkit-box]` set the same property, so whichever the stylesheet emits
                   last wins and the clamp silently did not apply. Measured — an Arabic preview
                   rendered eight lines and dominated the card. -->
              <span
                dir="auto"
                class="mt-0.5 line-clamp-2 text-sm/5 [overflow-wrap:anywhere]"
                :class="message.isRead ? 'text-default' : 'font-semibold text-highlighted'"
              >{{ message.subject }}</span>

              <!-- Plain-text preview, clamped to two lines. Same safe rendering as the detail body:
                   no Markdown, no HTML, long URLs and unbroken strings wrap. -->
              <span
                dir="auto"
                class="mt-1 line-clamp-2 text-xs/5 text-muted [overflow-wrap:anywhere]"
              >{{ message.body }}</span>
            </button>

            <div class="absolute end-1.5 top-1.5">
              <UDropdownMenu :items="rowActions(message)">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-ellipsis-vertical"
                  size="sm"
                  :disabled="!online || busyId === message.id"
                  :aria-label="t('dashboard.messages.rowActions')"
                />
              </UDropdownMenu>
            </div>
          </UCard>
        </li>
      </ul>

      <div v-if="totalPages > 1" class="mt-4 flex justify-center">
        <UPagination
          :page="page"
          :total="total"
          :items-per-page="MESSAGES_PER_PAGE"
          @update:page="goToPage"
        />
      </div>
    </template>
    </section>

    <USlideover
      v-model:open="detailOpen"
      :title="selected?.subject ?? t('dashboard.messages.detail.title')"
      :description="selected ? t('dashboard.messages.detail.receivedAt', { date: formatDate(selected.createdAt) }) : ''"
    >
      <template #body>
        <div v-if="selected" class="flex flex-col gap-5">
          <dl class="flex flex-col gap-3 text-sm">
            <div>
              <dt class="text-muted">{{ t('dashboard.messages.detail.from') }}</dt>
              <dd dir="auto" class="font-medium text-highlighted">{{ selected.name }}</dd>
            </div>
            <!-- Nullable by contract; either may be absent, never both (D10-16). No empty UI. -->
            <div v-if="selected.email">
              <dt class="text-muted">{{ t('dashboard.messages.detail.email') }}</dt>
              <dd dir="ltr" class="break-all font-medium text-highlighted">{{ selected.email }}</dd>
            </div>
            <div v-if="selected.phone">
              <dt class="text-muted">{{ t('dashboard.messages.detail.phone') }}</dt>
              <dd dir="ltr" class="font-medium text-highlighted">{{ selected.phone }}</dd>
            </div>
          </dl>

          <div>
            <h3 class="mb-2 text-sm text-muted">{{ t('dashboard.messages.detail.messageHeading') }}</h3>
            <!-- Plain text only (owner decision 7): preserved exactly, wraps long words and URLs. -->
            <p dir="auto" class="whitespace-pre-wrap break-words text-default [overflow-wrap:anywhere]">{{ selected.body }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton v-if="selected.email" :to="replyMailto(selected) ?? undefined" external icon="i-lucide-mail">
              {{ t('dashboard.messages.actions.reply') }}
            </UButton>
            <UButton v-if="selected.phone" :to="callTel(selected.phone)" external color="neutral" variant="subtle" icon="i-lucide-phone">
              {{ t('dashboard.messages.actions.call') }}
            </UButton>
            <UButton v-if="selected.phone" color="neutral" variant="subtle" icon="i-lucide-copy" @click="copyNumber(selected.phone)">
              {{ t('dashboard.messages.actions.copyNumber') }}
            </UButton>
          </div>
          <p v-if="selected.email" class="text-xs text-muted">{{ t('dashboard.messages.actions.replyHint') }}</p>
          <p aria-live="polite" class="text-xs empty:hidden" :class="copyState === 'fail' ? 'text-error' : 'text-muted'">
            <template v-if="copyState === 'ok'">{{ t('dashboard.messages.actions.copied') }}</template>
            <template v-else-if="copyState === 'fail'">{{ t('dashboard.messages.actions.copyFailed') }}</template>
          </p>
        </div>
      </template>

      <template #footer>
        <div v-if="selected" class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            :disabled="!online || busyId === selected.id"
            @click="selected.isRead ? markUnread(selected) : markRead(selected)"
          >
            {{ selected.isRead ? t('dashboard.messages.actions.markUnread') : t('dashboard.messages.actions.markRead') }}
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            :disabled="!online || busyId === selected.id"
            @click="selected.isArchived ? unarchive(selected) : archive(selected)"
          >
            {{ selected.isArchived ? t('dashboard.messages.actions.unarchive') : t('dashboard.messages.actions.archive') }}
          </UButton>
        </div>
      </template>
    </USlideover>
  </UContainer>
</template>
