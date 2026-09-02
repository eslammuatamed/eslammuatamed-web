<script setup lang="ts">
import type { Testimonial } from '~/types/models'

// Quote block (FR-PUB-016) — a testimonial as an editorial pull quote led by a violet quotation mark.
// The avatar is null in the current contract, so attribution falls to a monogram; when an avatar is
// seeded later it renders from the API's pre-generated absolute URL with no layout change (null-safe).
interface Props {
  testimonial: Testimonial
}

const props = defineProps<Props>()

const monogram = computed(() => Array.from(props.testimonial.authorName ?? '?')[0] ?? '?')
</script>

<template>
  <figure class="flex flex-col border-t border-default pt-6">
    <span class="font-display text-[2.5rem] leading-none text-primary" aria-hidden="true">&ldquo;</span>
    <blockquote class="mt-2 flex-1 text-body-lg text-default text-pretty">
      {{ testimonial.quote }}
    </blockquote>
    <figcaption class="mt-6 flex items-center gap-3">
      <img
        v-if="testimonial.avatar?.url"
        :src="testimonial.avatar.url"
        :alt="testimonial.authorName"
        width="40"
        height="40"
        loading="lazy"
        class="size-10 shrink-0 rounded-full object-cover"
      >
      <span
        v-else
        class="grid size-10 shrink-0 place-items-center rounded-full border border-default bg-accented font-display text-body-sm text-muted"
        aria-hidden="true"
      >{{ monogram }}</span>
      <div>
        <p class="text-body-sm font-medium text-highlighted">{{ testimonial.authorName }}</p>
        <p v-if="testimonial.authorRole" class="text-caption text-muted">{{ testimonial.authorRole }}</p>
      </div>
    </figcaption>
  </figure>
</template>
