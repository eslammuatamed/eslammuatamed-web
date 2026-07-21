<script setup lang="ts">
import type { Experience } from '~/types/models'

// Experience timeline summary (FR-PUB-013): reverse-chronological roles. The full history (with impact
// bullets) is the /experience page; here it is a glance. Empty → omitted; error → inline retry.
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
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
)
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <section v-if="show" class="py-[var(--space-section)]">
    <UContainer>
      <UiSectionHeader :eyebrow="t('home.experience.eyebrow')" :title="t('home.experience.title')">
        <template #action>
          <AppLink to="/experience" class="text-body-sm text-link">{{ t('common.viewAll') }}</AppLink>
        </template>
      </UiSectionHeader>

      <UiStateError v-if="error" class="mt-8" @retry="$emit('retry')" />
      <UiSectionSkeleton v-else-if="pending" class="mt-8" :count="3" />

      <ol v-else class="mt-8 max-w-2xl">
        <ContentExperienceItem v-for="experience in items" :key="experience.id" :experience="experience" />
      </ol>
    </UContainer>
  </section>
</template>
