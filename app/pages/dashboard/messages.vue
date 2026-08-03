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
  if (!message.isRead) void markRead(message)
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
  busyId.value = message.id
  updateError.value = false
  try {
    await patch(message.id, body)
    await Promise.all([load(view.value, page.value), refreshUnread()])
    // An archived/unarchived message leaves the current view; keeping it selected would show a row
    // that is no longer in the list it came from.
    if (body.isArchived !== undefined && selectedId.value === message.id) closeDetail()
  } catch {
    updateError.value = true
  } finally {
    busyId.value = null
  }
}

const markRead = (m: ContactMessage) => mutate(m, { isRead: true })
const markUnread = (m: ContactMessage) => mutate(m, { isRead: false })
const archive = (m: ContactMessage) => mutate(m, { isArchived: true })
const unarchive = (m: ContactMessage) => mutate(m, { isArchived: false })

async function copyNumber(phone: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(phone)
    copyState.value = 'ok'
  } catch {
    copyState.value = 'fail'
  }
  setTimeout(() => (copyState.value = 'idle'), 2000)
}

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
      <UButton
        v-for="tab in (['inbox', 'archived'] as const)"
        :key="tab"
        role="tab"
        :aria-selected="view === tab"
        :color="view === tab ? 'primary' : 'neutral'"
        :variant="view === tab ? 'solid' : 'ghost'"
        size="sm"
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
        :title="t('dashboard.messages.updateErrorTitle')"
        :description="t('dashboard.messages.updateErrorBody')"
      />
    </div>

    <div v-if="pending" class="flex flex-col gap-2" :aria-label="t('dashboard.messages.loading')" aria-busy="true">
      <USkeleton v-for="i in 6" :key="i" class="h-12 w-full" />
    </div>

    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
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
          <span dir="auto" class="block max-w-48 truncate">{{ row.original.name }}</span>
        </template>

        <template #subject-cell="{ row }">
          <!-- The row's ONE interactive control. Per-row actions live in the trailing menu, so no
               interactive element is nested inside another. -->
          <UButton
            variant="link"
            color="neutral"
            class="max-w-80 truncate p-0 text-start"
            :class="row.original.isRead ? '' : 'font-semibold'"
            @click="openMessage(row.original)"
          >
            <span dir="auto">{{ row.original.subject }}</span>
          </UButton>
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
