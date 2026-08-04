// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { MediaImage } from '~/types/models'
import Portrait from './Portrait.vue'

/**
 * The About portrait's rendering contract. Two owner decisions are enforced here:
 *
 *   1. The transparent cutout sits on an intentional design token, never on a BlurHash-derived
 *      colour. For an opaque photo a BlurHash average is a placeholder the image covers; for a cutout
 *      it is a PERMANENT backdrop, and because BlurHash ignores alpha the transparent 42% of this
 *      frame encodes as black and drags the average to a muddy brown.
 *   2. Responsive candidates are built per format from the contract's own `variants`, with truthful
 *      widths — never a width the API cannot produce, never a derived storage URL.
 */

const ORIGIN = 'https://media.test/media/p1'

/** The real post-D20-20 shape for the approved 1086×1448 portrait: 640 + a 1086 terminal, ×2 formats. */
const portrait = (overrides: Partial<MediaImage> = {}): MediaImage => ({
  id: 'p1',
  kind: 'IMAGE',
  url: `${ORIGIN}/1086-webp.webp`,
  width: 1086,
  height: 1448,
  blurhash: 'LA8:bcoL0LR+^NoL9uWC0zaz}@oL',
  alt: 'Portrait of Eslam Muatamed wearing a navy shirt',
  variants: [
    { format: 'AVIF', width: 640, height: 853, url: `${ORIGIN}/640-avif.avif` },
    { format: 'WEBP', width: 640, height: 853, url: `${ORIGIN}/640-webp.webp` },
    { format: 'AVIF', width: 1086, height: 1448, url: `${ORIGIN}/1086-avif.avif` },
    { format: 'WEBP', width: 1086, height: 1448, url: `${ORIGIN}/1086-webp.webp` }
  ],
  ...overrides
})

const SLOT_SIZES = '(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw'

async function render(image: MediaImage = portrait()) {
  const wrapper = await mountSuspended(Portrait, { props: { portrait: image } })
  return wrapper
}

describe('AboutPortrait — candidate construction', () => {
  it('builds one typed source per format, ascending, from the contract variants', async () => {
    const w = await render()
    const sources = w.findAll('source')
    expect(sources).toHaveLength(2)

    expect(sources[0]?.attributes('type')).toBe('image/avif')
    expect(sources[0]?.attributes('srcset')).toBe(
      `${ORIGIN}/640-avif.avif 640w, ${ORIGIN}/1086-avif.avif 1086w`
    )
    expect(sources[1]?.attributes('type')).toBe('image/webp')
    expect(sources[1]?.attributes('srcset')).toBe(
      `${ORIGIN}/640-webp.webp 640w, ${ORIGIN}/1086-webp.webp 1086w`
    )
  })

  it('keeps every candidate list describing the same slot', async () => {
    const w = await render()
    for (const el of [...w.findAll('source'), w.get('img')]) {
      expect(el.attributes('sizes')).toBe(SLOT_SIZES)
    }
  })

  it('retains a valid img src fallback at the widest public WebP', async () => {
    const w = await render()
    const img = w.get('img')
    expect(img.attributes('src')).toBe(`${ORIGIN}/1086-webp.webp`)
    expect(img.attributes('srcset')).toBe(
      `${ORIGIN}/640-webp.webp 640w, ${ORIGIN}/1086-webp.webp 1086w`
    )
  })

  it('never advertises a width the API cannot produce for this source', async () => {
    const w = await render()
    const html = w.html()
    expect(html).not.toContain('1280')
    expect(html).not.toContain('1920')
  })

  it('never references or derives the private master', async () => {
    const w = await render()
    expect(w.html()).not.toContain('master')
  })

  it('sorts widths ascending even when the contract returns them out of order', async () => {
    const w = await render(
      portrait({
        variants: [
          { format: 'WEBP', width: 1086, height: 1448, url: `${ORIGIN}/1086-webp.webp` },
          { format: 'WEBP', width: 640, height: 853, url: `${ORIGIN}/640-webp.webp` }
        ]
      })
    )
    expect(w.get('img').attributes('srcset')).toBe(
      `${ORIGIN}/640-webp.webp 640w, ${ORIGIN}/1086-webp.webp 1086w`
    )
  })

  it('deduplicates a repeated width so no srcset carries an ambiguous descriptor', async () => {
    const w = await render(
      portrait({
        variants: [
          { format: 'WEBP', width: 640, height: 853, url: `${ORIGIN}/640-webp.webp` },
          { format: 'WEBP', width: 640, height: 853, url: `${ORIGIN}/640-webp-dup.webp` }
        ]
      })
    )
    const srcset = w.get('img').attributes('srcset')
    expect(srcset).toBe(`${ORIGIN}/640-webp.webp 640w`)
    expect(srcset).not.toContain('dup')
  })

  it('omits a format entirely when the contract has no rendition for it', async () => {
    const w = await render(
      portrait({
        variants: [
          { format: 'WEBP', width: 640, height: 853, url: `${ORIGIN}/640-webp.webp` }
        ]
      })
    )
    const sources = w.findAll('source')
    expect(sources).toHaveLength(1)
    expect(sources[0]?.attributes('type')).toBe('image/webp')
  })

  it('still renders a usable img when the contract carries no variants at all', async () => {
    const w = await render(portrait({ variants: [] }))
    expect(w.findAll('source')).toHaveLength(0)
    const img = w.get('img')
    expect(img.attributes('src')).toBe(`${ORIGIN}/1086-webp.webp`)
    expect(img.attributes('srcset')).toBeUndefined()
  })
})

describe('AboutPortrait — transparent background treatment', () => {
  it('backs the cutout with a token surface', async () => {
    const w = await render()
    expect(w.get('img').classes()).toContain('bg-elevated')
  })

  it('sets no inline background, so no BlurHash colour can persist behind the subject', async () => {
    const w = await render()
    const style = w.get('img').attributes('style') ?? ''
    expect(style).not.toMatch(/background/i)
  })

  it('does not render the BlurHash anywhere, even though the contract supplies one', async () => {
    const image = portrait()
    expect(image.blurhash).toBeTruthy() // the contract value exists…
    const w = await render(image)
    expect(w.html()).not.toContain(image.blurhash as string) // …and is deliberately unused here
  })
})

describe('AboutPortrait — intrinsic box and alt', () => {
  it('reserves the box from the descriptor, which describes the file src points at', async () => {
    const w = await render()
    const img = w.get('img')
    expect(img.attributes('width')).toBe('1086')
    expect(img.attributes('height')).toBe('1448')
  })

  it('renders the localized alt verbatim', async () => {
    const w = await render()
    expect(w.get('img').attributes('alt')).toBe(
      'Portrait of Eslam Muatamed wearing a navy shirt'
    )
  })

  it('renders the Arabic alt without borrowing the English one', async () => {
    const ar = 'صورة شخصية لإسلام معتمد مرتديًا قميصًا كحليًا'
    const w = await render(portrait({ alt: ar }))
    expect(w.get('img').attributes('alt')).toBe(ar)
  })

  it('renders an empty alt rather than inventing one when the locale has none', async () => {
    // The readiness gate refuses to publish in this state, so the component is never reached with it
    // in practice; asserted so a regression degrades to "decorative", never to fabricated text.
    const w = await render(portrait({ alt: null }))
    expect(w.get('img').attributes('alt')).toBe('')
  })

  it('marks the portrait eager and high-priority only when it is the LCP element', async () => {
    const eager = await mountSuspended(Portrait, {
      props: { portrait: portrait(), priority: true }
    })
    expect(eager.get('img').attributes('loading')).toBe('eager')
    expect(eager.get('img').attributes('fetchpriority')).toBe('high')

    const lazy = await render()
    expect(lazy.get('img').attributes('loading')).toBe('lazy')
    expect(lazy.get('img').attributes('fetchpriority')).toBeUndefined()
  })
})
