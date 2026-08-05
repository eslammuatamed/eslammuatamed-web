<script setup lang="ts">
import type { Experience } from '~/types/models'

// One role on the HTML résumé (FR-PUB-023). Same contract data as `ContentTimelineEntry`,
// rendered COMPACTLY: no rail, no marker, no 3rem gutter — a résumé is scanned, and doc 04 §5
// asks this page to be denser than `/experience` rather than a reskin of it.
//
// The period sits in the page's ONE document rail from `sm` up — the same 10rem column the Skills
// group labels already occupied — so every date in the document aligns to one edge and the roles
// share a single content measure. Below `sm` the rail collapses and the natural DOM order (role,
// then period, then the detail) is what reads, which is why the period follows the heading in the
// markup and is placed into column 1 explicitly rather than by source order.
//
// The CONTENT is verbatim from the API (FR-PUB-024). Only the presentation differs: nothing is
// re-authored, summarized, truncated or reordered here, and the factual historical `role` is
// printed exactly as stored — the governed public positioning ("Full-Stack JavaScript Product
// Engineer", positioning-strategy v2.0.0 §2) is a Site Settings concern and must never rewrite an
// employment title (§4, "Does not change").
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
  <li class="resume-entry break-inside-avoid sm:grid sm:grid-cols-[10rem_1fr] sm:gap-x-4">
    <!-- The role is the loudest thing in the entry — it is the content of a résumé, where the
         section label is only a signpost. The size is a real token from the scale; see the spec's
         type-scale guard for the size that used to sit here and resolved to nothing. -->
    <h3 class="font-display text-h3 text-highlighted sm:col-start-2 sm:row-start-1">
      {{ experience.role }}
    </h3>

    <p
      class="mt-1 font-mono text-caption text-dimmed sm:col-start-1 sm:row-start-1 sm:mt-0 sm:pt-1.5"
    >
      <time :datetime="startIso">{{ startLabel }}</time> – <time
        v-if="endIso"
        :datetime="endIso"
      >{{ endLabel }}</time><span v-else>{{ endLabel }}</span>
    </p>

    <div class="sm:col-start-2 sm:row-start-2">
      <p class="mt-1 text-body-sm text-default">
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
    </div>
  </li>
</template>
