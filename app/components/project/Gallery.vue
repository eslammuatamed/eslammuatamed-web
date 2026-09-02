<script setup lang="ts">
import type { ProjectGalleryItem } from '~/types/models'

// Case-study gallery (FR-PUB-032): "optimized images and captions".
//
// The API pre-generates every rendition and R2 serves the static objects — there is no image CDN and
// no runtime transformation (D23-15). So the browser consumes the contract's own `variants` as its
// srcset; `mediaAsset.url` (the widest WebP) stays the `src` fallback for browsers that ignore it.
//
// PRESENTATION ONLY: the items arrive already ordered, already localized and already carrying their
// own renditions. Nothing here fetches, sorts, caches or re-derives any of that — the gallery was
// stacked vertically and is now one slide at a time, and that is the whole of the change.
interface Props {
  items: readonly ProjectGalleryItem[]
  heading: string
}

const props = defineProps<Props>()

/**
 * Ordered by the API (`order` asc); never re-sorted here, for the same reason the index is not.
 * Copied out of the readonly prop because `UCarousel` types `items` as a mutable array — the copy is
 * the array shell only, so slide N is still the very same item object the contract delivered.
 */
const ordered = computed(() => [...props.items])

/** Arrows and dots are navigation. With one slide there is nowhere to navigate, so they would render
 *  as two permanently-disabled buttons and a single dot that does nothing. */
const isNavigable = computed(() => props.items.length > 1)

function srcsetFor(item: ProjectGalleryItem): string | undefined {
  const variants = item.mediaAsset.variants
  if (!variants.length) return undefined
  return variants.map(variant => `${variant.url} ${variant.width}w`).join(', ')
}

/**
 * INTRINSIC SHAPE DRIVES PRESENTATION.
 *
 * A carousel slide is as wide as the gallery, but an IMAGE is not its slide. A phone screenshot
 * (~3:4) blown up to a 1024px content column is a wall of upscaled pixels; the requirement is that
 * it stay small and centred instead. The contract already carries the exact dimensions of the file
 * `url` serves (D10-14), so the shape is measured, never guessed and never inferred from a filename.
 *
 * Cropping is not on the table — every shape keeps its own aspect ratio and is width-constrained
 * only, so `object-fit` never has anything to discard.
 *
 * The thresholds sit either side of 1:1 with a deliberate dead zone: 4:3 (1.33) is landscape, 3:4
 * (0.75) is portrait, and anything between 0.8 and 1.2 is treated as square — near-square images
 * read as neither, so they take the same restrained width as a portrait rather than stretching.
 */
type GalleryShape = 'landscape' | 'square' | 'portrait'

function shapeOf(item: ProjectGalleryItem): GalleryShape {
  const { width, height } = item.mediaAsset
  // A zero/absent height would make the ratio Infinity or NaN. Landscape is the safe default: it is
  // what the gallery rendered for every image before shapes existed.
  if (!width || !height) return 'landscape'

  const ratio = width / height
  if (ratio > 1.2) return 'landscape'
  if (ratio >= 0.8) return 'square'
  return 'portrait'
}

/**
 * The rendered width cap per shape, and — critically — the `sizes` that MUST agree with it.
 *
 * These two are declared together on purpose. If the class said `max-w-sm` while `sizes` still said
 * `100vw`, the browser would dutifully download the 2400w rendition to paint a 384px-wide portrait:
 * a bandwidth regression that no size gate can see, because the bytes are images and they are fetched
 * at runtime. Coupling them here makes the two impossible to drift apart.
 *
 * `sizes` is a native responsive-image media-query list. It matches the output Nuxt Image previously
 * generated from this component's breakpoint shorthand.
 */
const SHAPE_PRESENTATION = {
  // Wide screenshots earn the full gallery width — this is the case the column was designed around.
  landscape: { class: 'w-full', sizes: '(max-width: 767px) 100vw, (max-width: 1023px) 768px, 1024px' },
  // 28rem. Wide enough to read a square screenshot, narrow enough that it never reads as a hero.
  square: { class: 'w-full max-w-md', sizes: '(max-width: 639px) 100vw, 448px' },
  // 24rem — a phone screenshot at roughly its own scale.
  portrait: { class: 'w-full max-w-sm', sizes: '(max-width: 639px) 100vw, 384px' }
} as const satisfies Record<GalleryShape, { class: string, sizes: string }>

function presentationFor(item: ProjectGalleryItem) {
  return SHAPE_PRESENTATION[shapeOf(item)]
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

    <!--
      One slide at a time. `basis-full` is already the theme's default item width, so nothing here
      configures "one per view" — it is what UCarousel does when left alone.

      DIRECTION IS NOT HANDLED HERE, ON PURPOSE. UCarousel reads `dir` from the `<UApp :locale>` pack
      that app.vue switches with the active i18n locale, so on /ar Embla scrolls RTL, the arrow icons
      swap, ArrowLeft/ArrowRight swap with them and the control labels come out of the Arabic pack.
      Re-implementing any of that here would be a second source of truth that could disagree.

      No autoplay: the default is off and it stays off — a case study is read at the reader's pace,
      and moving content is a WCAG 2.2 hazard we would then have to add a pause control for.
      Dragging is Embla's default, so touch/swipe needs no prop either.

      The bottom margin is layout for the dots: the theme parks them at `-bottom-7`, i.e. OUTSIDE
      the root box, so without reserved space they would overlap whatever follows the gallery.

      EVERY SPACING VALUE BELOW IS ONE THE BUNDLE ALREADY SHIPPED. The public CSS budget (doc 20
      section 1, 30 KB gz) had 40 bytes of headroom before this feature, so a value that is merely
      reasonable rather than already-present costs a whole rule the budget cannot pay for. Tighter
      offsets were tried first and each emitted a new rule; these render the same layout for no new
      bytes. Do not name a rejected utility in a comment either: Tailwind scans this file as plain
      text, so writing one is enough to emit its rule even when nothing uses it (measured).
    -->
    <UCarousel
      v-slot="{ item }"
      :items="ordered"
      :arrows="isNavigable"
      :dots="isNavigable"
      class="mt-8"
      :class="isNavigable ? 'mb-10' : undefined"
      :ui="{
        // The theme's top alignment (`container: flex items-start`) is LEFT ALONE, deliberately.
        // Centring the slides was tried and reverted: it gives images of different heights different
        // top edges, and a shared top edge is the invariant the no-vertical-stack regression rests
        // on (a stack is same-x and different-y; a carousel is different-x and same-y). It is also
        // the calmer result, since the image never jumps vertically as you navigate between shapes.
        // KEYBOARD FOCUS MUST STAY VISIBLE (WCAG 2.2 AA 2.4.7, release-blocking per doc 21).
        // The carousel root is `tabindex=0` — it is the element that handles the arrow keys — and the
        // component's own theme resets it with `focus:outline-none`. That utility lands in
        // `@layer utilities`, while this site's global ring (`:where(a,button,[tabindex])
        // :focus-visible`) is declared in `@layer base`, so the reset wins on layer order no matter
        // how low its specificity is: the region would tab-focus with no indicator at all.
        //
        // The ring is a BOX-SHADOW, not an outline, and that is the point — `outline-style: none`
        // cannot suppress a property it does not control, so this cannot lose the same race a
        // competing `outline-*` utility would (same specificity, order decided by Tailwind's sort).
        root: 'rounded-card focus-visible:ring-2 focus-visible:ring-primary',
        // The theme pushes the arrows to `sm:-start-12` / `sm:-end-12` — three rem OUTSIDE the
        // carousel. The gallery already spans the full container, whose gutter is smaller than that,
        // so the default would hang the buttons past the page edge and produce a horizontal
        // scrollbar. Pinned just inside the viewport instead, in both directions, at every breakpoint.
        prev: 'start-4 sm:start-4',
        next: 'end-4 sm:end-4'
      }"
    >
      <!--
        THE SHAPE CAP BELONGS TO THE FIGURE, NOT THE IMAGE.

        A `figcaption` describes its figure, so it has to be as wide as the thing it describes. When
        the cap sat on the image alone, the figure stayed the full width of the slide: a 384px
        portrait sat centred while its caption started at the far edge of a 1216px box, reading as a
        label for the whitespace rather than for the screenshot. Capping the figure keeps the two the
        same width, so the caption tracks the image at every shape and in both directions — in RTL it
        follows the image to the other side for free, because `text-align: start` is resolved against
        the figure's own box.

        The image is then simply `w-full` inside that box: its RENDERED width is unchanged, which is
        what the shape budget and the `sizes` attribute are both written against.
      -->
      <figure class="mx-auto" :class="presentationFor(item).class">
        <!-- width/height are always set: reserving the box is what actually keeps CLS at zero, and
             the blurhash average colour fills it until the image paints. Lazy by default — nothing
             in a gallery below the fold competes with the page's LCP element. -->
        <img
          :src="item.mediaAsset.url"
          :srcset="srcsetFor(item)"
          :sizes="presentationFor(item).sizes"
          :width="item.mediaAsset.width"
          :height="item.mediaAsset.height"
          :alt="item.mediaAsset.alt ?? ''"
          :aria-hidden="isUntranslated(item) ? 'true' : undefined"
          loading="lazy"
          decoding="async"
          class="w-full h-auto rounded-card border border-default"
          :data-gallery-shape="shapeOf(item)"
          :style="{ backgroundColor: blurhashAverageColor(item.mediaAsset.blurhash) ?? undefined }"
        >
        <figcaption v-if="item.caption" class="mt-3 text-body-sm text-muted">
          {{ item.caption }}
        </figcaption>
      </figure>
    </UCarousel>
  </section>
</template>
