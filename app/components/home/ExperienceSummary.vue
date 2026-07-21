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

// Reverse-chronological, but a current role always leads (its start date may predate a newer past
// role, so sorting on startDate alone could bury it — code-review WD-7).
const items = computed(() =>
  (props.experiences ?? [])
    .slice()
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
)
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <UiSection v-if="show" variant="elevated">
    <UiDatumLabel :eyebrow="t('home.experience.eyebrow')" :title="t('home.experience.title')">
      <template #action>
        <AppLink to="/experience" class="text-body-sm text-link">{{ t('common.viewAll') }}</AppLink>
      </template>
    </UiDatumLabel>

    <UiStateError v-if="error" class="mt-10" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-10" :count="3" />

    <ol v-else class="mt-10 max-w-2xl">
      <ContentExperienceItem v-for="experience in items" :key="experience.id" :experience="experience" />
    </ol>
  </UiSection>
</template>
