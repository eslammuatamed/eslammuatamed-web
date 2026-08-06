// Entity-level social image resolution, split out of `utils/metadata.ts` on purpose.
//
// WHY IT IS ITS OWN MODULE: only the two DETAIL routes (`blog/[slug]`, `projects/[slug]`) can carry
// an entity image. `app.vue` and `layouts/default.vue` use `pickMeta`/`absoluteSocialUrl` from
// `utils/metadata.ts`, which therefore lands in the shared entry closure every public route
// downloads — and the format gate below rode along with it into LISTING routes that never call it.
// `/projects` sits within a fraction of a KB of the frozen 250 KB budget (doc 20 §1, D20-11), so
// code the route cannot execute must not ship with it. Keeping this in a separate file lets the
// listing routes drop it while the detail routes still get it through the same Nuxt auto-import,
// with no change at either call site.

// Formats that social platforms render reliably. WebP and AVIF are deliberately absent: WhatsApp
// in particular handles them inconsistently, and a preview that silently fails is worse than a
// generic-but-working one.
const SHAREABLE_IMAGE_FORMATS = /^(png|jpe?g)$/i

/**
 * Is this entity image positively known to be a format social platforms render reliably?
 *
 * "Positively known" is the bar, not "not known to be bad": WebP, AVIF, an unknown format, and a
 * URL with no extension all return false, so the caller falls back to the committed PNG. A
 * declared MIME/format field wins over the URL when one is present; the URL extension is
 * consulted only because the current `PublicMediaImageDescriptor` has no such field — it carries
 * `kind: IMAGE | PDF`, which does not distinguish PNG from WebP.
 *
 * NOTE ON TODAY'S CONTRACT: `descriptor.url` is documented as the "widest PUBLIC WebP rendition",
 * so in practice this returns false for every entity image the API currently serves and the
 * committed PNG is always used. The gate exists so that a real PNG/JPEG social rendition — the
 * recorded media-pipeline follow-up — starts being honoured with no further change here.
 */
function isShareableImageFormat(
  descriptor: { url?: string | null, mimeType?: string | null, format?: string | null } | null | undefined,
): boolean {
  const declared = pickMeta(descriptor?.mimeType, descriptor?.format)
  if (declared) {
    return SHAREABLE_IMAGE_FORMATS.test(declared.replace(/^image\//i, ''))
  }

  const url = pickMeta(descriptor?.url)
  if (!url) return false

  // Compare the extension only, never the query string — `?w=1` must not read as a format.
  const extension = url.split(/[?#]/)[0]?.match(/\.([a-z0-9]+)$/i)?.[1]
  return Boolean(extension && SHAREABLE_IMAGE_FORMATS.test(extension))
}

/**
 * Social-image tags for an entity (article / project) that may carry its own `ogImage`.
 *
 * Returns ALL of the image tags together, or `undefined` when the entity has no usable image.
 * Returning them as a set is the point: `og:image:width`/`height`/`alt` describe a specific
 * file, so overriding the image while inheriting the committed 1200×630 dimensions from the
 * site-wide owner would emit tags that contradict each other. A caller that gets `undefined`
 * simply emits nothing and inherits the complete committed set.
 */
export function entitySocialImage(
  descriptor: { url?: string | null, width?: number | null, height?: number | null, alt?: string | null, mimeType?: string | null, format?: string | null } | null | undefined,
  siteUrl: unknown,
): { url: string, width: number | undefined, height: number | undefined, alt: string | undefined } | undefined {
  if (!isShareableImageFormat(descriptor)) return undefined

  const url = absoluteSocialUrl(descriptor?.url, siteUrl)
  if (!url) return undefined

  return {
    url,
    width: descriptor?.width ?? undefined,
    height: descriptor?.height ?? undefined,
    alt: pickMeta(descriptor?.alt),
  }
}
