<script setup lang="ts">
import type { MediaImage } from '~/types/models'

// The About portrait (FR-PUB-020). MEANINGFUL CONTENT, not decoration: the readiness gate in
// `utils/about-readiness.ts` refuses to publish the page without a localized alt, so by the time this
// component renders, `alt` is guaranteed non-empty. It is still rendered from the descriptor rather
// than asserted here — the gate owns the decision, this owns the presentation.
//
// Same media contract as the case-study gallery: the API pre-generates every rendition and R2 serves
// the static objects (D23-15), so the srcset comes from the contract's own `variants` instead of
// asking @nuxt/image to re-derive one. `portrait.url` (the widest WebP) stays the `src` fallback.
interface Props {
  portrait: MediaImage
  /** Rendered eagerly when it is the page's LCP element, which it is on the published About page. */
  priority?: boolean
}

const props = withDefaults(defineProps<Props>(), { priority: false })

const srcset = computed(() => {
  const variants = props.portrait.variants
  if (!variants.length) return undefined
  return variants.map(variant => `${variant.url} ${variant.width}w`).join(', ')
})
</script>

<template>
  <!-- width/height always set from the descriptor: reserving the intrinsic box is what actually holds
       CLS at zero, and the blurhash average colour fills it until the image paints. `object-cover`
       with a portrait-oriented aspect ratio crops the frame, never the face: the crop takes from the
       sides at narrow widths, which is why the ratio stays tall rather than becoming a letterbox. -->
  <NuxtImg
    :src="portrait.url"
    :srcset="srcset"
    sizes="100vw sm:420px lg:480px"
    :width="portrait.width"
    :height="portrait.height"
    :alt="portrait.alt ?? ''"
    :loading="priority ? 'eager' : 'lazy'"
    :fetchpriority="priority ? 'high' : undefined"
    decoding="async"
    class="aspect-[4/5] w-full rounded-card border border-default object-cover"
    :style="{ backgroundColor: blurhashAverageColor(portrait.blurhash) ?? undefined }"
  />
</template>
