<script setup lang="ts">
// Loading placeholder for a public section (doc 13 §2). The blocks approximate the final card grid so
// content resolving causes no layout shift (CLS 0). It is only visible on a client-side refetch — SSR
// first paint is content-complete (doc 13 §2) — and is purely decorative, so it is hidden from AT.
interface Props {
  count?: number
}

withDefaults(defineProps<Props>(), { count: 3 })
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
    <div
      v-for="n in count"
      :key="n"
      class="h-40 animate-pulse rounded-card border border-default bg-elevated"
    />
  </div>
</template>
