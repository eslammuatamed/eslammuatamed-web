<script setup lang="ts">
import type { MediaAsset } from '~/types/models'
import type { MediaKind } from '~/utils/media-query'
import { thumbnailFor } from '~/utils/media-asset'

/**
 * The reusable media picker — THE ONE PLACE selection and inline upload live.
 *
 * It is built for every consumer that stores a media reference: the About portrait today, and
 * project media, article covers, testimonial avatars, the résumé PDF and social images next. What
 * makes that possible is the interface, not a promise:
 *
 *   - it takes and returns a STABLE `mediaAssetId` and nothing else, so a consumer stores one column
 *     and never a denormalised copy of the descriptor;
 *   - it RESOLVES the descriptor itself from that id, so consumers whose own entity exposes a
 *     different media shape (the portrait arrives as a `PublicMediaImageDescriptor` with no
 *     filename) do not have to hand one down or convert one;
 *   - `allowedKind` is a prop, so the résumé slot restricts to PDF with no new component;
 *   - all browsing state is LOCAL, so it can open inside any page without touching that page's URL.
 *
 * IT DOES NOT TOUCH ALT TEXT, and that is a deliberate boundary rather than a missing feature. The
 * alt a usage publishes belongs to the USAGE, not to the asset (D09-22), so it belongs to the form
 * that owns the usage — the picker returning an id and the Profile form owning the About alt is what
 * keeps a library default from being copied into a published context.
 */
const props = withDefaults(defineProps<{
  /** The selected asset id, or `null`. The only value this component reads or writes. */
  modelValue: string | null
  /** Restricts browsing and the file dialog to one kind. `IMAGE` for the portrait. */
  allowedKind?: MediaKind
  /** Names the field this picker fills, for the dialog title and the controls' accessible names. */
  fieldLabel: string
  disabled?: boolean
}>(), { allowedKind: undefined, disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t, locale } = useDashboardI18n()
const library = useMediaLibrary()

const open = ref(false)

/**
 * Browsing state — LOCAL, never the route query. See `media-query.ts` for why that split matters:
 * a picker writing `?q=` would rewrite its HOST page's address and leave parameters behind on close.
 *
 * One ref holding the whole triple, matching what the browser emits. Nothing here needs the
 * one-navigation-per-interaction discipline the URL-backed page does — a local assignment is
 * immediate — but keeping one shape means the two consumers cannot drift apart.
 */
const browse = ref<MediaBrowseState>({ page: 1 })

/** The resolved descriptor for the current `modelValue`, for the preview. */
const selected = ref<MediaAsset | null>(null)
const resolving = ref(false)
const resolveFailed = ref(false)

/**
 * Resolve the selected id into a descriptor.
 *
 * Token-guarded: clearing and re-selecting quickly can leave an older lookup in flight, and without
 * the guard it would resolve afterwards and repopulate the preview with an asset the operator has
 * already replaced.
 */
let resolveSeq = 0
watch(() => props.modelValue, async (id) => {
  const seq = ++resolveSeq
  resolveFailed.value = false
  if (id === null) {
    selected.value = null
    return
  }
  // Already holding it — the operator just picked it from the grid, so a request would re-fetch
  // what is already on screen.
  if (selected.value?.id === id) return
  resolving.value = true
  try {
    const asset = await library.get(id)
    if (seq !== resolveSeq) return
    selected.value = asset
  } catch {
    if (seq !== resolveSeq) return
    // The reference is dangling or unreadable. The id is NOT cleared: silently discarding a stored
    // reference because one request failed would turn a transient error into data loss.
    selected.value = null
    resolveFailed.value = true
  } finally {
    if (seq === resolveSeq) resolving.value = false
  }
}, { immediate: true })

const thumbnail = computed(() => (selected.value ? thumbnailFor(selected.value) : null))

function choose(asset: MediaAsset): void {
  selected.value = asset
  emit('update:modelValue', asset.id)
  open.value = false
}

/**
 * An inline upload SELECTS what it produced — including a deduplicated one, which resolves to the
 * asset that already existed. Uploading a file and then having to find it in the grid would be the
 * "leaving the editor" this component exists to avoid.
 */
function onUploaded(asset: MediaAsset): void {
  choose(asset)
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', null)
}

// Named rather than an inline `open = true`: an assignment expression EVALUATES to the assigned
// value, so the handler would return `true` where Nuxt UI's click prop is typed `void`. Caught by
// `nuxt typecheck`, and a named handler reads better anyway.
function openPicker(): void {
  open.value = true
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- ── current selection ──────────────────────────────────────────────────────────────────── -->
    <div v-if="resolving" class="flex items-center gap-3">
      <USkeleton class="size-20 shrink-0 rounded-control" />
      <USkeleton class="h-4 w-40" />
    </div>

    <UAlert
      v-else-if="resolveFailed"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('dashboard.picker.resolveFailedTitle')"
      :description="t('dashboard.picker.resolveFailedBody')"
    />

    <div v-else-if="selected" class="flex items-start gap-3">
      <span class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-control border border-default bg-elevated">
        <img
          v-if="thumbnail"
          :src="thumbnail.url"
          :width="thumbnail.width"
          :height="thumbnail.height"
          alt=""
          decoding="async"
          class="size-full object-cover"
        >
        <UIcon v-else name="i-lucide-file-text" class="size-8 text-muted" aria-hidden="true" />
      </span>
      <div class="flex min-w-0 flex-col gap-1">
        <p dir="auto" data-picker-filename class="break-all text-sm font-medium text-highlighted">
          {{ selected.originalFilename }}
        </p>
        <p class="text-xs text-muted">
          {{ formatFileSize(selected.sizeBytes, locale, {
            kb: t('dashboard.media.unit.kb'),
            mb: t('dashboard.media.unit.mb')
          }) ?? '—' }}
          <template v-if="dimensionsOf(selected)">
            <span aria-hidden="true"> · </span>{{ dimensionsOf(selected) }}
          </template>
        </p>
      </div>
    </div>

    <p v-else class="text-sm text-muted" data-picker-empty>
      {{ t('dashboard.picker.none') }}
    </p>

    <!-- ── controls ───────────────────────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-image"
        :disabled="disabled"
        data-picker-open
        :aria-label="t(selected ? 'dashboard.picker.replaceFor' : 'dashboard.picker.selectFor', { field: fieldLabel })"
        @click="openPicker()"
      >
        {{ selected ? t('dashboard.picker.replace') : t('dashboard.picker.select') }}
      </UButton>
      <UButton
        v-if="selected"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :disabled="disabled"
        data-picker-clear
        :aria-label="t('dashboard.picker.clearFor', { field: fieldLabel })"
        @click="clear()"
      >
        {{ t('dashboard.picker.clear') }}
      </UButton>
    </div>

    <!-- The browser is mounted only while the dialog is OPEN. `UModal` teleports and destroys its
         body content on close, so the grid does not keep fetching behind a closed dialog — and each
         opening starts from a fresh request rather than a result set the library may have moved on
         from. -->
    <UModal
      v-model:open="open"
      :title="t('dashboard.picker.dialogTitle', { field: fieldLabel })"
      :description="t('dashboard.picker.dialogDescription')"
      :ui="{ content: 'max-w-3xl' }"
    >
      <template #body>
        <DashboardMediaBrowser
          v-model:state="browse"
          :allowed-kind="allowedKind"
          :selected-id="modelValue"
          @select="choose"
          @uploaded="onUploaded"
        />
      </template>
    </UModal>
  </div>
</template>
