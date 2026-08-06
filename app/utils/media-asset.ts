import type { MediaAsset, MediaVariant } from '~/types/models'

/**
 * Pure helpers over the admin media descriptor. Vue-free so they unit-test against contract shapes.
 */

/**
 * The smallest WebP rendition — what a ~200px grid card should actually download.
 *
 * `asset.url` is the WIDEST rendition by contract ("IMAGE: widest WebP rendition"), so using it as a
 * thumbnail would pull a 1920px file into a card a tenth that size, once per card, on a page that
 * shows twelve of them. The API already generated the small renditions; this picks one.
 *
 * WebP only, and that is not an oversight. `<img src>` carries no type information, so an AVIF URL
 * would be handed to browsers that cannot decode it and render as a broken image — the public
 * surfaces solve that with `<picture>` + `<source type>`, which is the right tool for a hero and
 * needless weight for a thumbnail. WebP is universally supported among the browsers this dashboard
 * targets, so one format keeps the card a plain `<img>`.
 *
 * Returns `null` for a PDF (no variants by contract) and for an image whose variants are missing,
 * so the caller renders its icon fallback rather than an empty frame.
 */
export function thumbnailFor(asset: MediaAsset): MediaVariant | null {
  let smallest: MediaVariant | null = null
  for (const variant of asset.variants) {
    if (variant.format !== 'WEBP') continue
    if (!smallest || variant.width < smallest.width) smallest = variant
  }
  return smallest
}

/**
 * The asset's LIBRARY-DEFAULT alt for one locale, or `null` when it has none.
 *
 * ASSET-LEVEL METADATA (D09-22). This is never the value a usage publishes and must never seed a
 * per-usage alt input — the Profile form reads `translations[locale].portraitAlt` for that. It is
 * exposed only so an authoring surface can DISPLAY the default as a labelled reference.
 */
export function libraryAltFor(asset: MediaAsset, locale: string): string | null {
  return asset.alts.find(alt => alt.locale === locale)?.alt ?? null
}

/** Image dimensions as `2400 × 1350`, or `null` for a PDF (no dimensions by contract). */
export function dimensionsOf(asset: MediaAsset): string | null {
  if (asset.width === null || asset.height === null) return null
  return `${asset.width} × ${asset.height}`
}
