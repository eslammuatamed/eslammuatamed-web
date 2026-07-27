<script setup lang="ts">
// The Monolith — the canonical brand mark (brand-identity.md §3, normative geometry). One connected form
// in 180°-rotational symmetry: it reads identically in LTR and RTL, which is the whole point (it encodes
// the platform's bilingual/RTL engineering, Pillar 3). Reintroduced in 007 (D03-11) as the compact
// identity mark that accompanies the wordmark in the header and footer — NOT the rejected 006 section
// language (the datum rules / hero identity plate). Inline SVG from the canonical grid (never a raster),
// single-fill `currentColor` so callers set the colour via a text token. Decorative — the accessible
// identity is the adjacent wordmark text (AP-9) — so it is hidden from assistive tech.
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
