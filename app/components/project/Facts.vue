<script setup lang="ts">
import type { ProjectTechnology } from '~/types/models'

/**
 * The at-a-glance engineering summary for a case study — the facts a hiring manager scans before
 * deciding whether to read the eight FR-CNT-020 narrative fields at all.
 *
 * WHAT IS AND IS NOT HERE IS DECIDED BY THE CONTRACT, NOT BY THE DESIGN. `GET /projects/{slug}`
 * carries exactly four short facts: `year`, `technologies`, `liveUrl`, `repoUrl`. There is no
 * engagement status, no start/end period (only a single nullable `year`), and `role` is one of the
 * eight opaque-Markdown narrative fields — a section, not a one-line fact. Those three are API
 * follow-ups; inventing a Web-side stand-in would put unsourced claims on a portfolio page.
 * `featured` is a curation flag for the index and `availableLocales` is the language switcher's
 * concern, so neither is a fact about the work.
 *
 * Each row is omitted when its field is absent, and the whole card is omitted when NO fact exists —
 * the same rule `Links.vue` follows: an absent fact is not a broken one, and a titled box over
 * blank space is worse than no box. Every seeded project currently has a year and technologies, so
 * the empty card is a guard rather than the live state.
 */
interface Props {
  year: number | null
  technologies: readonly ProjectTechnology[]
  liveUrl: string | null
  repoUrl: string | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const hasLinks = computed(() => Boolean(props.liveUrl || props.repoUrl))
const hasAnyFact = computed(
  () => props.year !== null || props.technologies.length > 0 || hasLinks.value
)
</script>

<template>
  <!-- A named `region`, not a `complementary`: the page already has one aside (the closing CTA), and a
       second unnamed-by-default landmark would be noise for a screen-reader user cycling landmarks.
       The heading is a real h2 — it sits directly under the page h1 and precedes the narrative h2s in
       DOM order, so the hierarchy stays flat and correct — but it is styled as a kicker so it reads as
       a card label rather than competing with the section headings it introduces. -->
  <section
    v-if="hasAnyFact"
    aria-labelledby="project-facts-heading"
    class="rounded-card border border-default bg-elevated p-6"
  >
    <h2 id="project-facts-heading" class="kicker text-dimmed">
      {{ t('projects.facts.heading') }}
    </h2>

    <!-- `<div>`-grouped `<dl>`: each fact is one name/value pair, which is what a definition list is
         for, and the wrapper keeps the pair together when the value wraps to several lines. -->
    <dl class="mt-5 flex flex-col gap-5">
      <div v-if="year !== null">
        <dt class="text-caption text-dimmed">{{ t('projects.facts.year') }}</dt>
        <dd class="mt-1 font-mono text-body-sm text-highlighted">{{ year }}</dd>
      </div>

      <!-- <bdi> isolates Latin technology names inside Arabic prose so the bidi algorithm cannot
           reorder them against neighbouring RTL text (doc 21). -->
      <div v-if="technologies.length">
        <dt class="text-caption text-dimmed">{{ t('projects.facts.stack') }}</dt>
        <dd class="mt-2">
          <ul class="flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-caption text-muted">
            <li v-for="tech in technologies" :key="tech.id"><bdi>{{ tech.label }}</bdi></li>
          </ul>
        </dd>
      </div>

      <!-- ProjectLinks owns the four null combinations and the WD-5 scheme allowlist; the row exists
           only when it would render something, so the label never stands over an empty value. -->
      <div v-if="hasLinks">
        <dt class="text-caption text-dimmed">{{ t('projects.facts.links') }}</dt>
        <dd class="mt-2">
          <ProjectLinks :live-url="liveUrl" :repo-url="repoUrl" />
        </dd>
      </div>
    </dl>
  </section>
</template>
