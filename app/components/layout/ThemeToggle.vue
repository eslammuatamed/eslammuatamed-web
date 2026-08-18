<script setup lang="ts">
// Explicit light/dark override on top of the system default (FR-PUB-002). Wrapped in
// ClientOnly because the resolved mode is only known after hydration — rendering the icon on
// the server would flash the wrong glyph.
const { t } = useI18n()
const colorMode = useColorMode()

/**
 * `label` exists for the DASHBOARD, which has its own application locale (D11-8).
 *
 * This component is shared between both worlds, and `useI18n()` resolves against the ROUTE-derived
 * public locale — always English on an unprefixed `/dashboard/**` route (D04-7). Left to itself it
 * would announce an English "Toggle theme" inside an Arabic dashboard: invisible on screen, wrong in
 * a screen reader, and caught by nothing. The dashboard passes its own translated label instead of
 * this component growing a second locale source. Public callers pass nothing and are unchanged.
 */
const props = defineProps<{ label?: string }>()
const ariaLabel = computed(() => props.label ?? t('a11y.toggleTheme'))

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
      :aria-label="ariaLabel"
      @click="toggleTheme"
    />
    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
