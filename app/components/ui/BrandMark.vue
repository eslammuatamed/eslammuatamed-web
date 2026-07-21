<script setup lang="ts">
// The Monolith — the brand mark (brand-identity.md §3, normative geometry). One connected form in
// 180°-rotational symmetry: it reads identically in LTR and RTL, which is the whole point (it encodes
// the platform's real bilingual/RTL engineering, Pillar 3). Rendered as inline SVG paths from the
// canonical grid — never a raster (brand §11), single-fill `currentColor` so callers set the colour via
// a text token (brand §3 colour rules: one fill, never gradient/shadow/outline). Decorative here — the
// accessible identity is the adjacent HTML text (AP-9) — so it is hidden from assistive tech.
interface Props {
  /** Rendered size in px (square). The mark's ink fills the full 12×12 of its 16-unit field. */
  size?: number
}

withDefaults(defineProps<Props>(), { size: 24 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
  >
    <path d="M2,6 H6 V2 H14 V10 H10 V14 H2 Z" />
  </svg>
</template>
