<script setup lang="ts">
// Shown when a preview cannot be loaded — an absent, expired, tampered, or wrong-type token all
// yield the same API 404, and transport/5xx failures land here too. The copy is deliberately
// generic ("unavailable or expired"): it neither confirms a draft exists nor explains why the token
// failed (FR-PUB-046, draft concealment).
const { t } = useI18n()
</script>

<template>
  <UContainer class="py-16">
    <section
      data-testid="preview-unavailable"
      class="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center text-center"
    >
      <UIcon name="i-lucide-link-2-off" class="size-10 text-muted" aria-hidden="true" />
      <h1 class="mt-4 text-h1 text-highlighted">{{ t('preview.unavailableTitle') }}</h1>
      <p class="mt-3 text-muted">{{ t('preview.unavailableBody') }}</p>
    </section>
  </UContainer>
</template>
