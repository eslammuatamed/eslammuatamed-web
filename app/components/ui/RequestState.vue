<script setup lang="ts">
// RequestState (007 loading system) — the one place a data-backed region maps its request state to a
// branded presentation, so pages consume the same contract instead of inventing loaders (see the
// public-page data-state contract in app/components/README + docs 13). States:
//   initial load (pending, no content) → content-matching skeleton;
//   error (no content)                 → inline error + accessible retry;
//   empty (loaded, nothing to show)    → the #empty slot (caller decides copy);
//   loaded                             → the content, with a restrained revalidation overlay layered on
//                                        top while `refreshing` (content stays readable beneath).
// Only ONE state renders at a time — never a stacked skeleton + overlay + spinner.
interface Props {
  /** Initial load with no content yet → skeleton. */
  pending?: boolean
  /** Content already on screen and refetching → overlay (not skeleton). */
  refreshing?: boolean
  error?: boolean
  empty?: boolean
  /** Skeleton geometry matching this region's real composition. */
  skeleton?: 'capabilities' | 'work' | 'timeline' | 'articles' | 'quotes' | 'rows'
  count?: number
  /** Localized overlay status; defaults to "Updating". */
  updatingLabel?: string
}

withDefaults(defineProps<Props>(), {
  pending: false,
  refreshing: false,
  error: false,
  empty: false,
  skeleton: 'rows',
  count: 3,
  updatingLabel: undefined
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <UiContentSkeleton v-if="pending" :variant="skeleton" :count="count" />
  <slot v-else-if="error" name="error">
    <UiStateError @retry="$emit('retry')" />
  </slot>
  <slot v-else-if="empty" name="empty" />
  <div v-else class="relative">
    <slot />
    <UiDataLoadingOverlay :show="refreshing" :label="updatingLabel" />
  </div>
</template>
