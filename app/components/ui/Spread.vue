<script setup lang="ts">
// Spread — the reusable page-frame primitive for the public site (007). The page is composed as a
// sequence of full-bleed "spreads" whose surface alternates, so hierarchy comes from ground changes
// and varied composition rather than one flat background stacked seven times (the 006 failure).
//   tone="paper" — the page ground.
//   tone="lift"  — one surface step up, hairline-fenced (depth from surface steps, not shadow — D03-3).
//   tone="ink"   — a full-bleed dark feature spread; `.on-ink` re-points the semantic tokens so the
//                  slot content stays theme-agnostic and mirrors correctly in both themes (see main.css).
//   tone="glass"     — a translucent, violet-tinted spread on the page's own theme (024, D03-15).
//   tone="ink-glass" — the ink spread made translucent: KEEPS `.on-ink`, so its subtree keeps the ink
//                      token context and the technology brand dots keep the dark ground they were
//                      designed against.
// Wraps <section> + <UContainer> (the doc 04 content measure). Vertical rhythm is one token so the
// beat is consistent; the *composition* inside each spread is what varies. Logical padding only (RTL).
//
// The glass tones are composed from THREE existing pieces rather than a new bespoke class: `.glass`
// (blur + edge lighting, already `@supports`- and reduced-transparency-gated), the
// `bg-[var(--glass-surface-elevated)]` utility that D14-8 requires the surface be applied with — a
// background set in `@layer components` loses to Nuxt UI's `bg-default`, which is a bug this project
// has already paid for once — and `.spread-glass`, which adds only the violet wash and the accent
// hairline. `glass-strong` layers one more class that re-points two tokens.
//
// Unlike `ink`, the glass tones do NOT re-point the semantic `--ui-*` tokens: the surface is
// translucent over the page, so the page's own theme is still the right one for the content on it.
interface Props {
  tone?: 'paper' | 'lift' | 'ink' | 'glass' | 'ink-glass'
  /** Rendered landmark/element — defaults to a plain content `section`. */
  as?: string
  /** Draw a top hairline — used to separate adjacent paper spreads without a surface change. */
  ruled?: boolean
}

const props = withDefaults(defineProps<Props>(), { tone: 'paper', as: 'section', ruled: false })

// Every class in both glass tones already exists in the shipped stylesheet — `.glass` from the
// D03-14 chrome treatment, `border-y`/`border-default` from the `lift` tone, `.on-ink` from the ink
// spread, and the two surface utilities from the mobile drawer and the scrolled header. Only
// `.spread-tint` is new, and it is one declaration. Composing the tones from what already ships is
// what makes them affordable against a CSS budget with ~105 bytes of headroom.
//
// `ink-glass` carries NO `backdrop-filter`, and that is a correction of a measured defect rather than
// a shortcut. The first attempt wrote it as `.on-ink` + `.glass` + `bg-[var(--glass-surface)]` on the
// theory that `--glass-surface` would re-resolve against the ink `--ui-bg`. It does not: a custom
// property's `var()` references are substituted where the property is DECLARED, so the token keeps
// the page-tone value it computed at `:root`. Worse, `.on-ink` is unlayered, so its own opaque
// `background-color` beat the utility outright — the section rendered fully opaque while still
// running a live `backdrop-filter`. That is exactly the "no visible glass, full compositing cost"
// failure D14-8 was written to prevent, verified in the browser before this was changed.
//
// The blur was not worth rescuing. A full-bleed spread has nothing moving behind it — only the flat
// page ground and the low-frequency ambient field — and blurring a smooth gradient is visually
// near-identical to not blurring it, at the cost of a compositor re-sample of the whole band every
// frame. D03-14 made this same argument to keep glass off static surfaces. So an ink spread stays
// opaque ink and takes the violet as a tint, which is also what protects the technology brand dots:
// they never leave the dark ground they were designed against.
const toneClass = computed(() => {
  if (props.tone === 'ink') return 'on-ink'
  if (props.tone === 'lift') return 'border-y border-default bg-elevated'
  if (props.tone === 'glass') return 'glass spread-tint border-y border-default bg-[var(--glass-surface-elevated)]'
  if (props.tone === 'ink-glass') return 'on-ink spread-tint'
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
