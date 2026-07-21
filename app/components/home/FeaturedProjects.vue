<script setup lang="ts">
import type { ProjectListItem } from '~/types/models'

// Featured projects (FR-PUB-012): the top 3 dashboard-curated, published, featured projects with
// case-study framing. The API returns published projects featured-first (D09-8); this filters to
// `featured` and caps at 3. Empty → section omitted; error → inline retry (NFR-DEGRADE).
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
  <UiSection v-if="show">
    <UiDatumLabel :eyebrow="t('home.featured.eyebrow')" :title="t('home.featured.title')">
      <template #action>
        <AppLink to="/projects" class="text-body-sm text-link">{{ t('common.viewAll') }}</AppLink>
      </template>
    </UiDatumLabel>

    <UiStateError v-if="error" class="mt-10" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-10" :count="3" />

    <div v-else class="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ContentProjectCard v-for="project in items" :key="project.id" :project="project" />
    </div>
  </UiSection>
</template>
