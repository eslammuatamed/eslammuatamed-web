<script setup lang="ts">
// Explicit light/dark override on top of the system default (FR-PUB-002). Wrapped in
// ClientOnly because the resolved mode is only known after hydration — rendering the icon on
// the server would flash the wrong glyph.
const { t } = useI18n()
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value) => {
    colorMode.preference = value ? 'dark' : 'light'
  }
})

// A statement, not an inline `isDark = !isDark` expression — click handlers must return void
// (enforced by vue-tsc 3's template typing; an assignment expression returns the boolean).
function toggleTheme(): void {
  isDark.value = !isDark.value
}
</script>

<template>
  <ClientOnly>
    <UButton
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      color="neutral"
      variant="ghost"
      :aria-label="t('a11y.toggleTheme')"
      @click="toggleTheme"
    />
    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
