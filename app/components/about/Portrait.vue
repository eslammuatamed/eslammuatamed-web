<script setup lang="ts">
import type { MediaImage } from '~/types/models'

// The About portrait (FR-PUB-020). MEANINGFUL CONTENT, not decoration: the readiness gate in
// `utils/about-readiness.ts` refuses to publish the page without a localized alt, so by the time this
// component renders, `alt` is guaranteed non-empty. It is still rendered from the descriptor rather
// than asserted here — the gate owns the decision, this owns the presentation.
//
// Same media contract as the case-study gallery: the API pre-generates every rendition and R2 serves
// the static objects (D23-15), so the candidates come from the contract's own `variants` instead of
// asking @nuxt/image to re-derive one.
interface Props {
  portrait: MediaImage
  /** Rendered eagerly when it is the page's LCP element, which it is on the published About page. */
  priority?: boolean
}

const props = withDefaults(defineProps<Props>(), { priority: false })

// The slot the portrait occupies, as a real `sizes` attribute rather than @nuxt/image's breakpoint
// shorthand — `<source>` elements only understand the standards form, and all three candidates lists
// must describe the SAME slot or the browser would size one of them against the wrong box.
// Widest-first, because `sizes` is evaluated in order and the first matching condition wins.
const SIZES = '(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw'

/**
 * Candidates for one format, as a `srcset` string — or `undefined` when that format has no rendition.
 *
 * Deduplicated by width and sorted ascending. Both matter: a `srcset` with two entries at the same
 * `w` descriptor is malformed (the UA's choice between them is arbitrary), and that is exactly what a
 * naive `variants.map()` produced once AVIF and WebP both existed at 640 — and again at the D20-20
 * terminal width. Splitting by format is what makes each list well-formed.
 *
 * Widths come from the descriptor and are never computed here: D20-20 guarantees each `variant.width`
 * is the encoded file's real width, so a candidate can never overstate its own bytes. Nothing derives
 * or rewrites a storage URL — the master is private and has no public URL to infer (D10-14).
 */
function candidatesFor(format: 'AVIF' | 'WEBP'): string | undefined {
  const byWidth = new Map<number, string>()
  for (const variant of props.portrait.variants) {
    if (variant.format !== format) continue
    // First wins: identical (format, width) pairs are unique per asset in the schema, so this only
    // ever guards against a duplicated row, never a real choice between two files.
    if (!byWidth.has(variant.width)) byWidth.set(variant.width, variant.url)
  }
  if (byWidth.size === 0) return undefined
  return [...byWidth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ')
}

const avifCandidates = computed(() => candidatesFor('AVIF'))
const webpCandidates = computed(() => candidatesFor('WEBP'))
</script>

<template>
  <!-- `<picture>` rather than a single srcset because the API pre-generates TWO formats: a `srcset`
       carries no type information, so mixing AVIF and WebP in one list leaves the UA choosing between
       same-width entries it cannot tell apart. One `<source>` per format is how the platform expresses
       "prefer AVIF, fall back to WebP", and the trailing `<img>` stays the fallback every browser
       understands — it is what carries the alt, the intrinsic box and the token surface.

       width/height come from the descriptor and, per D10-14, describe the same file as `src` — so the
       reserved intrinsic box matches the bytes that fill it, which is what holds CLS at zero.

       The surface is a design token (`bg-elevated`), NOT a colour derived from the BlurHash. The
       portrait is a transparent cutout, so a backdrop is permanent rather than a placeholder: a
       BlurHash average would sit behind the subject forever, and because BlurHash ignores alpha the
       transparent 42% of this frame encodes as black and drags that average to a muddy brown. A token
       keeps the backdrop an intentional, theme-aware choice in both light and dark.

       `object-cover` in a 4:5 frame crops a 3:4 source VERTICALLY — the scaled image is taller than
       the box, so the crop takes from the top and bottom (~3% each), never the sides. The source
       carries ~149px of headroom above the hair, so the face and shoulders stay framed. -->
  <picture>
    <source
      v-if="avifCandidates"
      type="image/avif"
      :srcset="avifCandidates"
      :sizes="SIZES"
    >
    <source
      v-if="webpCandidates"
      type="image/webp"
      :srcset="webpCandidates"
      :sizes="SIZES"
    >
    <img
      :src="portrait.url"
      :srcset="webpCandidates"
      :sizes="SIZES"
      :width="portrait.width"
      :height="portrait.height"
      :alt="portrait.alt ?? ''"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
      class="aspect-[4/5] w-full rounded-card border border-default bg-elevated object-cover"
    >
  </picture>
</template>
