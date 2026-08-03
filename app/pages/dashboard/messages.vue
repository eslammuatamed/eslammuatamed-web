<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ContactMessage } from '~/types/models'
import { callTel, isMessagesView, replyMailto, useMessages, MESSAGES_PER_PAGE } from '~/composables/useMessages'

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

const view = computed(() => (isMessagesView(route.query.view) ? route.query.view : 'inbox'))
const page = computed(() => {
  const raw = Number(route.query.page)
  return Number.isInteger(raw) && raw >= 1 ? raw : 1
})
const selectedId = computed(() => (typeof route.query.message === 'string' ? route.query.message : null))

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
 * The selected message is looked up in the loaded page rather than fetched — list rows already
 * carry the full body (owner decision 3), so a detail request would re-download what is on screen.
 */
const selected = computed(() => items.value.find(m => m.id === selectedId.value) ?? null)

/**
 * A selection that is not on this page is STALE, not an error: the message may have been archived,
 * purged by retention, or linked from a different page. Non-destructive notice, list stays usable.
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

function openMessage(message: ContactMessage): void {
  setQuery({ message: message.id })
}

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
           unread badge and the violet the Contact slice standardised on. Caught by axe on the
           Archived view during the visual review. -->
      <UButton
        v-for="tab in (['inbox', 'archived'] as const)"
        :key="tab"
        role="tab"
        :aria-selected="view === tab"
        :color="view === tab ? 'primary' : 'neutral'"
        :variant="view === tab ? 'solid' : 'ghost'"
        size="sm"
        :ui="view === tab ? { base: 'bg-primary-600 text-white hover:bg-primary-700' } : undefined"
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
        :ui="{ title: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.messages.updateErrorTitle')"
        :description="t('dashboard.messages.updateErrorBody')"
      />
    </div>

    <div v-if="pending" class="flex flex-col gap-2" :aria-label="t('dashboard.messages.loading')" aria-busy="true">
      <USkeleton v-for="i in 6" :key="i" class="h-12 w-full" />
    </div>

    <!-- The subtle error title defaults to the 500 red, which measures 3.15:1 on its own tinted
         background — under the 4.5:1 AA minimum. The 700 shade is 5.32:1; the dark-mode counterpart
         keeps the same relationship against the dark surface. Caught by axe during the visual
         review, and applied to BOTH error alerts so they cannot drift apart. -->
    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      :ui="{ title: 'text-error-700 dark:text-error-300' }"
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
            class="block w-44 max-w-full truncate text-start text-sm sm:w-64 lg:w-80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="row.original.isRead ? 'text-default' : 'font-semibold text-highlighted'"
            @click="openMessage(row.original)"
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

      <div v-if="totalPages > 1" class="mt-4 flex justify-center">
        <UPagination
          :page="page"
          :total="total"
          :items-per-page="MESSAGES_PER_PAGE"
          @update:page="goToPage"
        />
      </div>
    </template>

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
