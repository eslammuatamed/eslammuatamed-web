<script setup lang="ts">
import type { Experience } from '~/types/models'

// Experience (FR-PUB-013) — the career as a vertical timeline on a lifted surface (the section where a
// real sequence earns an ordered structure). A current role always leads, even if an older past role has
// a later-looking start (code-review WD-7). Empty → omitted; error → inline retry (NFR-DEGRADE).
interface Props {
  experiences: readonly Experience[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() =>
  (props.experiences ?? [])
    .slice()
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
)
const hasData = computed(() => items.value.length > 0)
// Split pending into initial-load (skeleton) vs revalidation with content on screen (overlay).
const initialPending = computed(() => props.pending && !hasData.value)
const refreshing = computed(() => props.pending && hasData.value)
const show = computed(() => props.pending || props.error || hasData.value)
</script>

<template>
  <UiSpread v-if="show" tone="lift" aria-labelledby="experience-title">
    <UiSectionHead
      :eyebrow="t('home.experience.eyebrow')"
      :title="t('home.experience.title')"
      title-id="experience-title"
    >
      <template #action>
        <AppLink to="/experience" class="group -my-1 inline-flex items-center gap-2 py-1 text-body-sm text-link">
          {{ t('common.viewAll') }}
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
        </AppLink>
      </template>
    </UiSectionHead>

    <UiRequestState
      class="mt-12 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="error"
      skeleton="timeline"
      @retry="$emit('retry')"
    >
      <ol class="max-w-3xl">
        <ContentTimelineEntry v-for="experience in items" :key="experience.id" :experience="experience" />
      </ol>
    </UiRequestState>
  </UiSpread>
</template>
