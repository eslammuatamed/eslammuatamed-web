<script setup lang="ts">
import type { MediaAsset } from '~/types/models'
import { MEDIA_PER_PAGE, type MediaKind } from '~/utils/media-query'

/**
 * The Media Library's browse surface: search, kind filter, upload, grid, pagination, and the
 * loading / empty / forbidden / error states.
 *
 * ONE COMPONENT, TWO STATE HOMES — this is the point of the design. Search, kind and page arrive as
 * PROPS and leave as events; where they actually live is the parent's decision:
 *
 *   - `/dashboard/media` keeps them in the ROUTE QUERY, because on a page the URL genuinely is the
 *     state: Back/Forward, reload and a shared link all have to reproduce the same grid.
 *   - the PICKER keeps them in component-local refs, because it opens inside someone else's page.
 *     Writing `?q=` from a modal would rewrite the host page's address, leave parameters behind when
 *     it closed, and make a `?page=` meant for the picker indistinguishable from the host's own.
 *
 * Owning the state internally would have forced one of those two to be wrong, and hoisting the
 * FETCHING into the parents would have duplicated the request logic this exists to share.
 */
const props = defineProps<{
  /**
   * Search, kind and page as ONE value, and emitted back as one. See `MediaBrowseState` — a
   * URL-backed parent must perform exactly one navigation per interaction, and separate events for
   * "the filter changed" and "so the page resets" produce two pushes that overwrite each other.
   */
  state: MediaBrowseState
  /**
   * Restricts the browser to one kind and HIDES the kind filter. The picker passes `IMAGE` for the
   * portrait; the library page passes nothing and lets the operator filter freely.
   */
  allowedKind?: MediaKind
  /** The currently-selected asset, in a selecting context. Renders the pressed state. */
  selectedId?: string | null
}>()

const emit = defineEmits<{
  'update:state': [value: MediaBrowseState]
  'select': [asset: MediaAsset]
  /** An upload landed. The parent may adopt it (picker) or simply note the library changed (page). */
  'uploaded': [asset: MediaAsset, deduplicated: boolean]
}>()

const { t } = useDashboardI18n()
const library = useMediaLibrary()
const { items, total, totalPages, pending, forbidden, failed } = library

/** `allowedKind` always wins: a locked browser must not be widened by a stale prop. */
const effectiveKind = computed(() => props.allowedKind ?? props.state.kind)

async function reload(): Promise<void> {
  await library.load({ q: props.state.q, kind: effectiveKind.value, page: props.state.page })
}

/**
 * Emit the next browse state as ONE value.
 *
 * Every caller resets the page unless it is explicitly setting one, because a new search or filter
 * invalidates the page number: staying on page 3 of the previous result set usually lands past the
 * end of the new one and renders an empty grid for a query that has matches.
 */
function browse(patch: Partial<MediaBrowseState>): void {
  emit('update:state', { q: props.state.q, kind: props.state.kind, page: 1, ...patch })
}

/**
 * The search box's own text, so typing is not fighting a round-trip through the parent's state.
 *
 * Bound directly to the prop, the input would re-render from whatever the parent had committed on
 * the previous debounce tick and the caret would jump mid-word. This holds the keystrokes; the
 * debounce below is what promotes them to the parent.
 */
const search = ref(props.state.q ?? '')
// Kept in sync when the query changes from OUTSIDE the box — Back/Forward, or a cleared filter.
watch(() => props.state.q, (value) => {
  if ((value ?? '') !== search.value.trim()) search.value = value ?? ''
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const next = value.trim()
    // `undefined` rather than `''` so "no search" has exactly ONE representation; `?q=` and no `q`
    // must not be two states that fetch two different URLs.
    browse({ q: next.length > 0 ? next : undefined })
  }, 300)
})
onUnmounted(() => clearTimeout(searchTimer))

function selectKind(next: MediaKind | undefined): void {
  browse({ kind: next })
}

// One watcher over everything the request depends on, rather than a reload call in each handler:
// a handler that forgot one would silently show results for the previous filter.
watch(
  () => [props.state.q, effectiveKind.value, props.state.page] as const,
  () => void reload(),
  { immediate: true }
)

// ── upload ──────────────────────────────────────────────────────────────────────────────────────
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadNotice = ref<string | null>(null)

/**
 * `accept` narrows the OS file dialog; it is a convenience, never the enforcement. The API validates
 * the real bytes and rejects a spoofed content type with a 422 — a renamed `.exe` is caught there,
 * not here, and this attribute could be bypassed by choosing "all files" in any browser.
 */
const accept = computed(() => {
  if (props.allowedKind === 'IMAGE') return 'image/*'
  if (props.allowedKind === 'PDF') return 'application/pdf'
  return 'image/*,application/pdf'
})

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Always clear the input, and clear it EARLY: a file input holds its value, so re-choosing the
  // same file after a failed upload would fire no `change` event at all and the retry would appear
  // to do nothing.
  input.value = ''
  if (!file) return

  uploading.value = true
  uploadError.value = null
  uploadNotice.value = null
  try {
    const { asset, deduplicated } = await library.upload(file)
    // Deduplication is a SUCCESS with a different story: the operator uploaded bytes that already
    // exist, so no new asset appears in the grid and saying nothing would look like a failed upload.
    uploadNotice.value = deduplicated
      ? t('dashboard.media.upload.deduplicated', { filename: asset.originalFilename })
      : t('dashboard.media.upload.done', { filename: asset.originalFilename })
    emit('uploaded', asset, deduplicated)
    // Back to page 1: uploads land newest-first, so the new asset is on the first page and nowhere
    // else. Reloading in place would leave the operator looking at a page it cannot be on.
    if (props.state.page !== 1) browse({ page: 1 })
    else await reload()
  } catch (error) {
    uploadError.value = error instanceof ApiError && error.status === 422
      ? (error.detail ?? error.message)
      : t('dashboard.media.upload.failed')
  } finally {
    uploading.value = false
  }
}

defineExpose({ reload })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ── controls ───────────────────────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        class="min-w-48 flex-1"
        :placeholder="t('dashboard.media.searchPlaceholder')"
        :aria-label="t('dashboard.media.searchLabel')"
      />

      <!-- Hidden entirely when the browser is locked to one kind: a filter with a single legal value
           is a control that cannot do anything. -->
      <div
        v-if="!allowedKind"
        class="flex items-center gap-1"
        role="group"
        :aria-label="t('dashboard.media.kindLabel')"
      >
        <UButton
          v-for="option in ([undefined, 'IMAGE', 'PDF'] as const)"
          :key="option ?? 'all'"
          size="sm"
          :color="state.kind === option ? 'primary' : 'neutral'"
          :variant="state.kind === option ? 'solid' : 'ghost'"
          :aria-pressed="state.kind === option"
          :ui="state.kind === option ? { base: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-700' } : undefined"
          @click="selectKind(option)"
        >
          {{ option ? t(`dashboard.media.kind.${option}`) : t('dashboard.media.kind.all') }}
        </UButton>
      </div>

      <!-- ONE control, ONE tab stop: the BUTTON is the control, and the file input is an
           implementation detail it opens.
           Two earlier versions were worse. The first made the styled span a second fake button
           (`role="button" tabindex="0"`) beside the focusable input — two tab stops and two
           announcements for one action. The second kept the input as the control and painted its
           focus ring onto the visible box with `has-[:focus-visible]:*`, which was correct but cost
           three bespoke `:has()` rules in a stylesheet with 40 B of budget headroom.
           A real `UButton` needs no custom focus CSS at all — it brings its own ring — and the input
           is removed from the tab order and the accessibility tree entirely. It stays `sr-only`
           rather than `display:none`, because a detached input cannot be targeted by
           `setInputFiles` and could not be clicked programmatically. -->
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        :disabled="uploading"
        tabindex="-1"
        aria-hidden="true"
        data-media-upload
        class="sr-only"
        @change="onFileChange"
      >
      <UButton
        icon="i-lucide-upload"
        :loading="uploading"
        :disabled="uploading"
        data-media-upload-button
        @click="fileInput?.click()"
      >
        {{ uploading ? t('dashboard.media.upload.busy') : t('dashboard.media.upload.label') }}
      </UButton>
    </div>

    <!-- Upload outcomes are ANNOUNCED, not only coloured. Both live in one polite region so a
         success replacing a failure is a single announcement rather than two competing ones. -->
    <div aria-live="polite" class="empty:hidden">
      <UAlert
        v-if="uploadError"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.media.upload.failedTitle')"
        :description="uploadError"
        close
        @update:open="uploadError = null"
      />
      <UAlert
        v-else-if="uploadNotice"
        color="neutral"
        variant="subtle"
        icon="i-lucide-check"
        :description="uploadNotice"
        close
        @update:open="uploadNotice = null"
      />
    </div>

    <!-- ── results ────────────────────────────────────────────────────────────────────────────── -->
    <div v-if="pending" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" :aria-label="t('dashboard.media.loading')" aria-busy="true">
      <USkeleton v-for="i in 8" :key="i" class="aspect-square w-full" />
    </div>

    <!-- The subtle error title defaults to the 500 red, which measures 3.15:1 on its own tinted
         background — under the 4.5:1 AA minimum. The 700 shade is 5.32:1, matching the treatment
         the Inbox standardised on for exactly this reason. -->
    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.media.forbiddenTitle')"
      :description="t('dashboard.media.forbiddenBody')"
    />

    <div v-else-if="failed" class="rounded-control border border-default p-6 text-center">
      <p class="font-medium text-highlighted">{{ t('dashboard.media.errorTitle') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('dashboard.media.errorBody') }}</p>
      <UButton class="mt-4" color="neutral" variant="subtle" @click="reload()">
        {{ t('dashboard.media.retry') }}
      </UButton>
    </div>

    <!-- An empty LIBRARY and an empty SEARCH are different situations with different next actions:
         one says "upload something", the other says "try a different search". -->
    <div v-else-if="items.length === 0" class="rounded-control border border-default p-10 text-center">
      <p class="font-medium text-highlighted">
        {{ state.q || state.kind || allowedKind ? t('dashboard.media.noMatchTitle') : t('dashboard.media.emptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ state.q || state.kind || allowedKind ? t('dashboard.media.noMatchBody') : t('dashboard.media.emptyBody') }}
      </p>
    </div>

    <template v-else>
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <li v-for="asset in items" :key="asset.id">
          <DashboardMediaCard
            :asset="asset"
            :selected="selectedId === undefined ? undefined : selectedId === asset.id"
            @select="$emit('select', $event)"
          />
        </li>
      </ul>

      <div v-if="totalPages > 1" class="flex justify-center">
        <UPagination
          :page="state.page"
          :total="total"
          :items-per-page="MEDIA_PER_PAGE"
          @update:page="browse({ page: $event })"
        />
      </div>
    </template>
  </div>
</template>
