<script setup lang="ts">
import type { Experience } from '~/types/models'

// Timeline entry (FR-PUB-013) — one role on the experience timeline: period, role @ company, employment
// type, and the impact bullets. The rail sits on the inline-start edge and the marker is offset with a
// logical `-ms` margin, so the whole flow mirrors correctly in RTL (doc 13 §8); a current role carries a
// violet marker. `impact` is a Markdown bullet string in the contract — split to lines here rather than
// pulling in the full prose renderer for a short list (the digits stay Western via Intl, D03-4).
interface Props {
  experience: Experience
  /**
   * Mirrors `ContentWorkEntry`: on the home page these entries sit under a section `h2`, so `h3` is
   * correct; on `/experience` they sit directly under the page `h1` with no intervening heading, so
   * that page passes `h2` — otherwise the document skips a level and fails WCAG heading order.
   */
  headingLevel?: 'h2' | 'h3'
  /**
   * Technologies belong to `/experience` (FR-PUB-021). The home experience summary is FR-PUB-013 and
   * was approved without them, so the DEFAULT IS FALSE and the already-merged home rendering is
   * unchanged — the caller opts in, and `/experience` is the only one that does.
   *
   * A prop rather than a route check inside the component: a shared presentational component that
   * inspects the current route stops being mountable in isolation (doc 12 §6) and hides a page-level
   * decision inside a leaf.
   */
  showTechnologies?: boolean
}

const props = withDefaults(defineProps<Props>(), { headingLevel: 'h3', showTechnologies: false })
const { t, locale } = useI18n()

// The two ends are rendered as separate `<time datetime>` elements rather than one formatted string:
// a date range is not expressible in a single `<time>`, and the machine-readable value is what makes
// the period parseable. `formatMonthYear` keeps the visible text identical to
// `formatExperiencePeriod` (digits stay Western via Intl, D03-4).
const startLabel = computed(() => formatMonthYear(props.experience.startDate, locale.value))
const endLabel = computed(() =>
  props.experience.endDate
    ? formatMonthYear(props.experience.endDate, locale.value)
    : t('home.experience.present')
)
// `datetime` carries the ISO instant from the contract, untouched by locale formatting.
const startIso = computed(() => String(props.experience.startDate))
const endIso = computed(() => (props.experience.endDate ? String(props.experience.endDate) : null))
const employmentLabel = computed(() =>
  t(`home.experience.employmentType.${props.experience.employmentType}`)
)
// Shared with the résumé via `impactBullets` (utils/resume.ts) so the two pages can never disagree
// about what a bullet is — `resume/Entry.vue` already stated that invariant, but this copy was still
// parsing inline, so the two were only accidentally identical.
const bullets = computed(() => impactBullets(props.experience.impact))

// Rendered in the API's order — by `Skill.order`, resolved server-side (D02-9). No client sort: the
// registry order is the owner's, and a skill untranslated in this locale is already dropped by the
// API rather than falling back to another language (D10-6), so anything present here is localized.
const technologies = computed(() => props.experience.technologies ?? [])

// The list is a bare run of product names; without a name it reads to a screen reader as an
// unlabelled list floating after the bullets, so it is labelled with the role it belongs to.
const technologiesLabelId = computed(() => `tech-${props.experience.id}`)
</script>

<template>
  <li class="relative border-s border-default ps-8 pb-12 last:pb-0">
    <span
      class="absolute start-0 top-1 -ms-[6px] size-3 rounded-full ring-4 ring-[var(--ui-bg-elevated)]"
      :class="experience.isCurrent ? 'bg-primary' : 'bg-[var(--ui-border-accented)]'"
      aria-hidden="true"
    />

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="font-mono text-caption text-dimmed">
        <time :datetime="startIso">{{ startLabel }}</time> – <time
          v-if="endIso"
          :datetime="endIso"
        >{{ endLabel }}</time><span v-else>{{ endLabel }}</span>
      </p>
      <span
        class="rounded-full border border-default px-2 py-0.5 text-caption text-muted"
      >{{ employmentLabel }}</span>
    </div>

    <!-- The FACTUAL historical title from the contract, verbatim. The marketing positioning
         ("JavaScript Product Engineer") is a Site Settings concern and must never rewrite an
         employment title. -->
    <component :is="headingLevel" class="mt-3 font-display text-h3 text-highlighted">
      {{ experience.role }}
    </component>
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

    <!-- FR-PUB-021: technologies from the Skill registry (D02-9). A real <ul> so the set is
         announced as a list with a count, not a run of adjacent text. -->
    <template v-if="showTechnologies && technologies.length">
      <p :id="technologiesLabelId" class="sr-only">
        {{ t('experience.technologiesLabel', { role: experience.role }) }}
      </p>
      <ul :aria-labelledby="technologiesLabelId" class="mt-4 flex flex-wrap gap-2">
        <li
          v-for="technology in technologies"
          :key="technology.id"
          class="rounded-full border border-default px-2.5 py-0.5 font-mono text-caption text-muted"
        >
          {{ technology.label }}
        </li>
      </ul>
    </template>
  </li>
</template>
