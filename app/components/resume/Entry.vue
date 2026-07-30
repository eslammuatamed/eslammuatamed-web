<script setup lang="ts">
import type { Experience } from '~/types/models'

// One role on the HTML résumé (FR-PUB-023). Same contract data as `ContentTimelineEntry`,
// rendered COMPACTLY: no rail, no marker, no 3rem gutter — a résumé is scanned, and doc 04 §5
// asks this page to be denser than `/experience` rather than a reskin of it.
//
// The CONTENT is verbatim from the API (FR-PUB-024). Only the presentation differs: nothing is
// re-authored, summarized, truncated or reordered here, and the factual historical `role` is
// printed exactly as stored — the governed public positioning ("JavaScript Product Engineer")
// is a Site Settings concern and must never rewrite an employment title.
interface Props {
  experience: Experience
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

// Two `<time datetime>` elements, not one formatted string: a range is not expressible in a
// single `<time>`, and the machine-readable value is what makes the period parseable by a
// résumé parser. `datetime` carries the contract's ISO instant untouched by locale formatting.
const startLabel = computed(() => formatMonthYear(props.experience.startDate, locale.value))
const endLabel = computed(() =>
  props.experience.endDate
    ? formatMonthYear(props.experience.endDate, locale.value)
    : t('home.experience.present')
)
const startIso = computed(() => String(props.experience.startDate))
const endIso = computed(() => (props.experience.endDate ? String(props.experience.endDate) : null))

const employmentLabel = computed(() =>
  t(`home.experience.employmentType.${props.experience.employmentType}`)
)

// Shared with the timeline via `impactBullets` so the two pages can never disagree about what
// a bullet is.
const bullets = computed(() => impactBullets(props.experience.impact))

// API order (`Skill.order`, D02-9), rendered verbatim — no client sort.
const technologies = computed(() => props.experience.technologies ?? [])
const technologiesLabelId = computed(() => `resume-tech-${props.experience.id}`)
</script>

<template>
  <li class="resume-entry break-inside-avoid pb-6 last:pb-0">
    <!-- Role and period on one row on desktop, stacked on mobile. `items-baseline` keeps the
         period optically aligned to the role rather than to the row box. -->
    <div class="flex flex-col gap-x-4 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
      <h3 class="font-display text-h4 text-highlighted">
        {{ experience.role }}
      </h3>
      <p class="font-mono text-caption text-dimmed sm:shrink-0">
        <time :datetime="startIso">{{ startLabel }}</time> – <time
          v-if="endIso"
          :datetime="endIso"
        >{{ endLabel }}</time><span v-else>{{ endLabel }}</span>
      </p>
    </div>

    <p class="mt-0.5 text-body-sm text-default">
      {{ experience.company
      }}<span v-if="experience.location" class="text-muted"> · {{ experience.location }}</span>
      <span class="text-muted"> · {{ employmentLabel }}</span>
    </p>

    <ul v-if="bullets.length" class="mt-2.5 flex flex-col gap-1.5">
      <li
        v-for="(bullet, i) in bullets"
        :key="i"
        class="flex gap-2.5 text-body-sm text-muted"
      >
        <span class="mt-[0.5em] size-1 shrink-0 rounded-full bg-[var(--ui-border-accented)]" aria-hidden="true" />
        <span class="text-pretty">{{ bullet }}</span>
      </li>
    </ul>

    <!-- A real <ul> so the stack is announced as a list with a count, not a run of adjacent
         text; labelled with the role it belongs to so it is not an anonymous list. -->
    <template v-if="technologies.length">
      <p :id="technologiesLabelId" class="sr-only">
        {{ t('experience.technologiesLabel', { role: experience.role }) }}
      </p>
      <ul :aria-labelledby="technologiesLabelId" class="mt-2.5 flex flex-wrap gap-1.5">
        <li
          v-for="technology in technologies"
          :key="technology.id"
          class="rounded-full border border-default px-2 py-0.5 font-mono text-caption text-muted"
        >
          {{ technology.label }}
        </li>
      </ul>
    </template>
  </li>
</template>
