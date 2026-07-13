<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="grid min-h-screen place-items-center px-4">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>
    <main id="main-content" tabindex="-1" class="w-full max-w-sm outline-none">
      <slot />
    </main>
  </div>
</template>
