<script setup lang="ts">
import type { Experience } from '~/types/models'

// Experience timeline item (FR-PUB-013): role @ company, period, employment type. The rail sits on the
// inline-start edge and the marker is offset with a logical `-ms` margin, so the whole timeline flow
// mirrors correctly in RTL (doc 13 §8). This is a summary — the full history is the /experience page.
interface Props {
  experience: Experience
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const period = computed(() =>
  formatExperiencePeriod(
    props.experience.startDate,
    props.experience.endDate,
    locale.value,
    t('home.experience.present')
  )
)
const employmentLabel = computed(() =>
  t(`home.experience.employmentType.${props.experience.employmentType}`)
)
</script>

<template>
  <li class="relative border-s border-default ps-6 pb-8 last:pb-0">
    <span
      class="absolute start-0 top-1.5 -ms-[5px] size-2.5 rounded-full bg-[var(--ui-primary)]"
      aria-hidden="true"
    />
    <p class="text-caption text-muted">{{ period }}</p>
    <h3 class="mt-1 text-h3 text-highlighted">{{ experience.role }}</h3>
    <p class="mt-0.5 text-default">
      {{ experience.company }}<span v-if="experience.location" class="text-muted"> · {{ experience.location }}</span>
    </p>
    <p class="mt-1 text-caption text-muted">{{ employmentLabel }}</p>
  </li>
</template>
