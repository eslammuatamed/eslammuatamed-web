<script setup lang="ts">
import type { ProjectListItem } from '~/types/models'

// Project card (doc 13 §9): year meta, title, summary, technologies. The whole card is one accessible
// link — the title link stretches over the card via a pseudo-element, so AT announces a single link,
// not a nest (doc 21 §1). It links to the case study `/projects/{slug}`; that page ships in the
// follow-on public-pages feature, so the target may 404 until then (walking skeleton, PROJECT_GUIDE §12).
interface Props {
  project: ProjectListItem
}

defineProps<Props>()
</script>

<template>
  <article
    class="group relative flex h-full flex-col rounded-card border border-default p-6 transition-colors hover:bg-elevated"
  >
    <div class="flex items-center justify-between gap-3">
      <p v-if="project.year" class="font-mono text-caption text-muted">{{ project.year }}</p>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="size-4 text-muted transition-colors group-hover:text-link rtl:-scale-x-100"
        aria-hidden="true"
      />
    </div>

    <h3 class="mt-4 text-h3 text-highlighted">
      <AppLink
        :to="`/projects/${project.slug}`"
        class="after:absolute after:inset-0 group-hover:text-link"
      >
        {{ project.title }}
      </AppLink>
    </h3>

    <p class="mt-2 line-clamp-3 flex-1 text-muted">{{ project.summary }}</p>

    <ul
      v-if="project.technologies.length"
      class="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-t border-default pt-4 font-mono text-caption text-muted"
    >
      <li v-for="tech in project.technologies" :key="tech.id">
        <bdi>{{ tech.label }}</bdi>
      </li>
    </ul>
  </article>
</template>
