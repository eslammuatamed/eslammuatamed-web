<script setup lang="ts">
// One section-header pattern across the public site (doc 13 §9): eyebrow label + heading, with
// an optional trailing action ("view all"). Heading level is caller-controlled so document
// outline stays correct (doc 21 §1 — levels never skip).
interface Props {
  title: string
  eyebrow?: string
  as?: 'h1' | 'h2' | 'h3'
}

withDefaults(defineProps<Props>(), { as: 'h2', eyebrow: undefined })
</script>

<template>
  <div class="flex items-end justify-between gap-4">
    <div>
      <p v-if="eyebrow" class="text-caption font-medium uppercase tracking-wide text-muted">
        {{ eyebrow }}
      </p>
      <component :is="as" class="mt-1 text-h2 text-highlighted">{{ title }}</component>
    </div>
    <div v-if="$slots.action" class="shrink-0">
      <slot name="action" />
    </div>
  </div>
</template>
