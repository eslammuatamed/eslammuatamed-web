<script setup lang="ts">
import type { Experience } from '~/types/models'

// Timeline entry (FR-PUB-013) — one role on the experience timeline: period, role @ company, employment
// type, and the impact bullets. The rail sits on the inline-start edge and the marker is offset with a
// logical `-ms` margin, so the whole flow mirrors correctly in RTL (doc 13 §8); a current role carries a
// violet marker. `impact` is a Markdown bullet string in the contract — split to lines here rather than
// pulling in the full prose renderer for a short list (the digits stay Western via Intl, D03-4).
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
const bullets = computed(() =>
  (props.experience.impact ?? '')
    .split('\n')
    .map(line => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
)
</script>

<template>
  <li class="relative border-s border-default ps-8 pb-12 last:pb-0">
    <span
      class="absolute start-0 top-1 -ms-[6px] size-3 rounded-full ring-4 ring-[var(--ui-bg-elevated)]"
      :class="experience.isCurrent ? 'bg-primary' : 'bg-[var(--ui-border-accented)]'"
      aria-hidden="true"
    />

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="font-mono text-caption text-dimmed">{{ period }}</p>
      <span
        class="rounded-full border border-default px-2 py-0.5 text-caption text-muted"
      >{{ employmentLabel }}</span>
    </div>

    <h3 class="mt-3 font-display text-h3 text-highlighted">{{ experience.role }}</h3>
    <p class="mt-1 text-body text-default">
      {{ experience.company
      }}<span v-if="experience.location" class="text-muted"> · {{ experience.location }}</span>
    </p>

    <ul v-if="bullets.length" class="mt-4 flex flex-col gap-2">
      <li
        v-for="(bullet, i) in bullets"
        :key="i"
        class="flex gap-3 text-body-sm text-muted"
      >
        <span class="mt-2 size-1 shrink-0 rounded-full bg-[var(--ui-border-accented)]" aria-hidden="true" />
        <span class="text-pretty">{{ bullet }}</span>
      </li>
    </ul>
  </li>
</template>
