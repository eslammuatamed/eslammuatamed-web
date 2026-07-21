<script setup lang="ts">
import type { Testimonial } from '~/types/models'

// Testimonial card (doc 13 §9, linear layout — no carousel, D13-10). Quote + author; the optional
// avatar renders via <NuxtImg> from the media origin (the descriptor may be null → initial fallback,
// never a broken image). The quote rail is a logical inline-start border so it mirrors in RTL.
interface Props {
  testimonial: Testimonial
}

const props = defineProps<Props>()
const initial = computed(() => props.testimonial.authorName.trim().charAt(0).toUpperCase())
</script>

<template>
  <figure class="flex flex-col rounded-card border border-default p-6">
    <blockquote class="border-s-2 border-default ps-4 text-body-lg text-default">
      <p>{{ testimonial.quote }}</p>
    </blockquote>

    <figcaption class="mt-5 flex items-center gap-3">
      <NuxtImg
        v-if="testimonial.avatar"
        :src="testimonial.avatar.url"
        :alt="testimonial.avatar.alt ?? ''"
        :width="40"
        :height="40"
        loading="lazy"
        class="size-10 rounded-full object-cover"
      />
      <span
        v-else
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-accented text-body-sm text-muted"
        aria-hidden="true"
      >{{ initial }}</span>

      <div>
        <p class="text-body-sm font-semibold text-highlighted">{{ testimonial.authorName }}</p>
        <p class="text-caption text-muted">{{ testimonial.authorRole }}</p>
      </div>
    </figcaption>
  </figure>
</template>
