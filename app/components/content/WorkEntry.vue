<script setup lang="ts">
import type { ProjectListItem } from '~/types/models'

// Work entry (FR-PUB-012) — a project as a full-width index row rather than a boxed card: year in the
// margin, the title set large in the display face, a one-line summary, and the stack as a quiet mono
// line. The whole row is one accessible link (the title's stretched pseudo-element covers the row, so AT
// announces a single link — doc 21 §1) to the case study `/projects/{slug}`, which ships in web-005 and
// may 404 until then (carried limitation). Reusable on the future /projects index. No cover image in the
// list contract, so the entry is purely typographic — and degrades cleanly if one is added later.
interface Props {
  project: ProjectListItem
}

defineProps<Props>()
</script>

<template>
  <article
    class="group relative grid gap-x-10 gap-y-3 border-t border-default py-8 first:border-t-0 sm:grid-cols-[4rem_1fr]"
  >
    <p v-if="project.year" class="font-mono text-body-sm text-dimmed sm:pt-2.5">{{ project.year }}</p>

    <div class="sm:col-start-2">
      <div class="flex items-start justify-between gap-6">
        <h3 class="font-display text-h2 text-highlighted transition-colors group-hover:text-link">
          <AppLink :to="`/projects/${project.slug}`" class="after:absolute after:inset-0">
            {{ project.title }}
          </AppLink>
        </h3>
        <UIcon
          name="i-lucide-arrow-up-right"
          class="mt-1.5 size-5 shrink-0 text-dimmed transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-link rtl:-scale-x-100"
          aria-hidden="true"
        />
      </div>

      <p class="mt-3 max-w-2xl text-body text-muted text-pretty">{{ project.summary }}</p>

      <ul
        v-if="project.technologies.length"
        class="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-caption text-dimmed"
      >
        <li v-for="tech in project.technologies" :key="tech.id"><bdi>{{ tech.label }}</bdi></li>
      </ul>
    </div>
  </article>
</template>
