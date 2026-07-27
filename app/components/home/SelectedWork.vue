<script setup lang="ts">
import type { ProjectListItem } from '~/types/models'

// Selected work (FR-PUB-012) — the top featured projects as an editorial index of work on paper. The API
// returns published projects featured-first (D09-8); this filters to `featured` and caps at 3. Empty →
// section omitted; error → inline retry (NFR-DEGRADE). Presentational — the page owns the fetch.
interface Props {
  projects: readonly ProjectListItem[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() => (props.projects ?? []).filter(project => project.featured).slice(0, 3))
const hasData = computed(() => items.value.length > 0)
// Split pending into initial-load (skeleton) vs revalidation with content on screen (overlay).
const initialPending = computed(() => props.pending && !hasData.value)
const refreshing = computed(() => props.pending && hasData.value)
const show = computed(() => props.pending || props.error || hasData.value)
</script>

<template>
  <UiSpread v-if="show" aria-labelledby="work-title">
    <UiSectionHead :eyebrow="t('home.featured.eyebrow')" :title="t('home.featured.title')" title-id="work-title">
      <template #action>
        <AppLink to="/projects" class="group -my-1 inline-flex items-center gap-2 py-1 text-body-sm text-link">
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
      skeleton="work"
      @retry="$emit('retry')"
    >
      <ContentWorkEntry v-for="project in items" :key="project.id" :project="project" />
    </UiRequestState>
  </UiSpread>
</template>
