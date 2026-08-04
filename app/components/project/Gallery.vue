<script setup lang="ts">
import type { ProjectGalleryItem } from '~/types/models'

// Case-study gallery (FR-PUB-032): "optimized images and captions".
//
// The API pre-generates every rendition and R2 serves the static objects — there is no image CDN and
// no runtime transformation (D23-15). So the srcset is built from the contract's own `variants`
// rather than asking @nuxt/image to re-derive one; `mediaAsset.url` (the widest WebP) stays the `src`
// fallback for browsers that ignore srcset.
interface Props {
  items: readonly ProjectGalleryItem[]
  heading: string
}

const props = defineProps<Props>()

/** Ordered by the API (`order` asc); never re-sorted here, for the same reason the index is not. */
const ordered = computed(() => props.items)

function srcsetFor(item: ProjectGalleryItem): string | undefined {
  const variants = item.mediaAsset.variants
  if (!variants.length) return undefined
  return variants.map(variant => `${variant.url} ${variant.width}w`).join(', ')
}

/**
 * `alt === null` and `alt === ""` are DIFFERENT states in the contract and must not be collapsed:
 *   null → no alt translation exists for this locale. The image carries no accessible name, so it is
 *          removed from the accessibility tree and the caption (if any) carries the meaning. Inventing
 *          alt text from the caption would be fabricating content.
 *   ""   → the owner marked it decorative on purpose. Also `alt=""`, but deliberately so.
 * Both render `alt=""`; only the untranslated case is additionally hidden, because a decorative image
 * inside a <figure> with a caption is still part of the figure's meaning.
 */
function isUntranslated(item: ProjectGalleryItem): boolean {
  return item.mediaAsset.alt === null
}
</script>

<template>
  <section aria-labelledby="project-gallery-heading">
    <h2 id="project-gallery-heading" class="font-display text-h2 text-highlighted">{{ heading }}</h2>

    <ul class="mt-8 flex flex-col gap-12">
      <li v-for="item in ordered" :key="item.mediaAssetId">
        <figure>
          <!-- width/height are always set: reserving the box is what actually keeps CLS at zero, and
               the blurhash average colour fills it until the image paints. Lazy by default — nothing
               in a gallery below the fold competes with the page's LCP element. -->
          <NuxtImg
            :src="item.mediaAsset.url"
            :srcset="srcsetFor(item)"
            sizes="100vw md:768px lg:1024px"
            :width="item.mediaAsset.width"
            :height="item.mediaAsset.height"
            :alt="item.mediaAsset.alt ?? ''"
            :aria-hidden="isUntranslated(item) ? 'true' : undefined"
            loading="lazy"
            decoding="async"
            class="h-auto w-full rounded-card border border-default"
            :style="{ backgroundColor: blurhashAverageColor(item.mediaAsset.blurhash) ?? undefined }"
          />
          <figcaption v-if="item.caption" class="mt-3 text-body-sm text-muted">
            {{ item.caption }}
          </figcaption>
        </figure>
      </li>
    </ul>
  </section>
</template>
