<script setup lang="ts">
// SectionHead — the one recurring heading device for public spreads (007): a kicker eyebrow over a
// display-face title, with an optional trailing action (e.g. a "view all" link) that sits opposite the
// title on wider screens. Consistent headers over varied section bodies are what make the page read as
// one edition rather than seven identical blocks; the distinctiveness lives in each section's body.
interface Props {
  eyebrow: string
  title: string
  /** Ties an aria-labelledby on the owning landmark to this title. */
  titleId?: string
  /** Violet kicker instead of muted — used to accent a lead section. */
  accent?: boolean
}

withDefaults(defineProps<Props>(), { titleId: undefined, accent: false })
</script>

<template>
  <div class="flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="kicker" :class="accent ? 'text-primary' : 'text-dimmed'">{{ eyebrow }}</p>
      <h2 :id="titleId" class="mt-3 font-display text-h1 text-highlighted text-balance">
        {{ title }}
      </h2>
    </div>
    <div v-if="$slots.action" class="shrink-0">
      <slot name="action" />
    </div>
  </div>
</template>
