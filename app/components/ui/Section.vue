<script setup lang="ts">
// Section rhythm wrapper — the single place the home's vertical rhythm and surface pacing live, so the
// page reads as one composed sequence instead of seven identical stacked blocks. `variant='elevated'`
// steps the surface up one level and fences it with hairline rules (depth from borders/surface-steps,
// not shadows — D03-3), used sparingly to pace the page. Wraps `<section>` + `<UContainer>` (the doc 04
// content measure). This wraps Nuxt UI only to encode the page's section contract (a semantic decision,
// not a restyle — D12-2).
interface Props {
  variant?: 'base' | 'elevated'
  /** Rendered landmark/element — defaults to a plain content `section`. */
  as?: string
}

const props = withDefaults(defineProps<Props>(), { variant: 'base', as: 'section' })

const surfaceClass = computed(() =>
  props.variant === 'elevated' ? 'border-y border-default bg-elevated' : ''
)
</script>

<template>
  <component :is="as" class="py-[var(--space-section)]" :class="surfaceClass">
    <UContainer>
      <slot />
    </UContainer>
  </component>
</template>
