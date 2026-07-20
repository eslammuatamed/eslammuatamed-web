<script setup lang="ts">
// Minimal chrome for the draft-preview surface: a persistent "not published" banner over the same
// content markup the live pages use. Deliberately omits the site header/footer and the locale
// switcher — a preview is a single-locale, single-purpose view (locale is fixed by the link), so
// dropping that chrome keeps the token-bearing URL off `switchLocalePath` and shrinks the surface.
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <p
      class="flex items-center justify-center gap-2 border-b border-default bg-elevated px-4 py-2 text-caption font-medium text-muted"
    >
      <UIcon name="i-lucide-eye" class="size-4" aria-hidden="true" />
      {{ t('preview.banner') }}
    </p>

    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
