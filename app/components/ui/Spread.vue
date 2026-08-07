<script setup lang="ts">
// Spread — the reusable page-frame primitive for the public site (007). The page is composed as a
// sequence of full-bleed "spreads" whose surface alternates, so hierarchy comes from ground changes
// and varied composition rather than one flat background stacked seven times (the 006 failure).
//   tone="paper" — the page ground.
//   tone="lift"  — one surface step up, hairline-fenced (depth from surface steps, not shadow — D03-3).
//   tone="ink"   — a full-bleed dark feature spread; `.on-ink` re-points the semantic tokens so the
//                  slot content stays theme-agnostic and mirrors correctly in both themes (see main.css).
//   tone="ink-glass" — the ink spread with the violet section wash (025). It KEEPS `.on-ink` and adds
//                  only `.spread-tint`, so the section stays DARK-NEUTRAL FIRST and the violet is a
//                  5–7 % layer on top rather than a fill. Carries NO `backdrop-filter`, deliberately:
//                  `.on-ink` is unlayered, so its opaque background beats any surface utility and the
//                  section would render fully opaque while still paying for a live blur — the exact
//                  "no visible glass, full compositing cost" defect D14-8 was written to prevent.
//                  Keeping it ink is also what protects the technology brand dots, which stay on the
//                  dark ground they were designed against.
// Wraps <section> + <UContainer> (the doc 04 content measure). Vertical rhythm is one token so the
// beat is consistent; the *composition* inside each spread is what varies. Logical padding only (RTL).
interface Props {
  tone?: 'paper' | 'lift' | 'ink' | 'ink-glass'
  /** Rendered landmark/element — defaults to a plain content `section`. */
  as?: string
  /** Draw a top hairline — used to separate adjacent paper spreads without a surface change. */
  ruled?: boolean
}

const props = withDefaults(defineProps<Props>(), { tone: 'paper', as: 'section', ruled: false })

const toneClass = computed(() => {
  if (props.tone === 'ink-glass') return 'on-ink spread-tint'
  if (props.tone === 'ink') return 'on-ink'
  if (props.tone === 'lift') return 'border-y border-default bg-elevated'
  return props.ruled ? 'border-t border-default' : ''
})
</script>

<template>
  <component :is="as" class="py-[var(--space-section)]" :class="toneClass">
    <UContainer>
      <slot />
    </UContainer>
  </component>
</template>
