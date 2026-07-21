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
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <UiSpread v-if="show" aria-labelledby="work-title">
    <UiSectionHead :eyebrow="t('home.featured.eyebrow')" :title="t('home.featured.title')" title-id="work-title">
      <template #action>
        <AppLink to="/projects" class="group inline-flex items-center gap-2 text-body-sm text-link">
          {{ t('common.viewAll') }}
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
        </AppLink>
      </template>
    </UiSectionHead>

    <UiStateError v-if="error" class="mt-10" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-10" :count="3" />

    <div v-else class="mt-12">
      <ContentWorkEntry v-for="project in items" :key="project.id" :project="project" />
    </div>
  </UiSpread>
</template>
