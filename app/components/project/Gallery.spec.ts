// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectGalleryItem } from '~/types/models'
import ProjectGallery from './Gallery.vue'

// FR-PUB-032. Real owner images are deferred, so this is verified entirely against contract-shaped
// descriptors — which is exactly what the gallery will receive once media is uploaded through the
// Dashboard → Media Library → API → R2 pipeline.
function item(overrides: Partial<ProjectGalleryItem['mediaAsset']> = {}, rest: Partial<ProjectGalleryItem> = {}): ProjectGalleryItem {
  return {
    mediaAssetId: rest.mediaAssetId ?? 'asset-1',
    order: rest.order ?? 0,
    caption: rest.caption ?? null,
    mediaAsset: {
      id: 'media-1',
      kind: 'IMAGE',
      url: 'https://media.example.com/1920.webp',
      width: 2400,
      height: 1350,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      alt: 'A dashboard overview',
      variants: [
        { format: 'WEBP', width: 640, height: 360, url: 'https://media.example.com/640.webp' },
        { format: 'WEBP', width: 1280, height: 720, url: 'https://media.example.com/1280.webp' }
      ],
      ...overrides
    }
  } as ProjectGalleryItem
}

const mount = (items: ProjectGalleryItem[]) =>
  mountSuspended(ProjectGallery, { props: { items, heading: 'Gallery' } })

describe('ProjectGallery', () => {
  it('renders one figure per item as a labelled section', async () => {
    const wrapper = await mount([item(), item({}, { mediaAssetId: 'asset-2', order: 1 })])

    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('project-gallery-heading')
    expect(wrapper.findAll('figure')).toHaveLength(2)
  })

  it('preserves the API order rather than re-sorting', async () => {
    const wrapper = await mount([
      item({ url: 'https://media.example.com/first.webp' }, { mediaAssetId: 'a', order: 0 }),
      item({ url: 'https://media.example.com/second.webp' }, { mediaAssetId: 'b', order: 1 })
    ])

    const sources = wrapper.findAll('img').map(img => img.attributes('src'))
    expect(sources[0]).toContain('first')
    expect(sources[1]).toContain('second')
  })

  it('sets explicit dimensions so the box is reserved and CLS stays at zero', async () => {
    const wrapper = await mount([item()])
    const img = wrapper.find('img')

    expect(img.attributes('width')).toBe('2400')
    expect(img.attributes('height')).toBe('1350')
  })

  it('builds the srcset from the contract variants, widest url as src', async () => {
    const wrapper = await mount([item()])
    const img = wrapper.find('img')

    expect(img.attributes('srcset')).toBe(
      'https://media.example.com/640.webp 640w, https://media.example.com/1280.webp 1280w'
    )
    expect(img.attributes('src')).toBe('https://media.example.com/1920.webp')
  })

  it('omits the srcset entirely when no variants exist', async () => {
    const wrapper = await mount([item({ variants: [] })])
    expect(wrapper.find('img').attributes('srcset')).toBeUndefined()
  })

  it('lazy-loads gallery images — none competes with the page LCP element', async () => {
    const wrapper = await mount([item()])
    expect(wrapper.find('img').attributes('loading')).toBe('lazy')
  })

  it('paints the blurhash average colour behind the image while it loads', async () => {
    const wrapper = await mount([item()])
    expect(wrapper.find('img').attributes('style')).toMatch(/background-color: rgb\(/)
  })

  it('degrades to no background when the blurhash is malformed', async () => {
    const wrapper = await mount([item({ blurhash: '!!' })])
    expect(wrapper.find('img').attributes('style') ?? '').not.toMatch(/background-color/)
  })

  it('renders meaningful alt text when a translation exists', async () => {
    const wrapper = await mount([item({ alt: 'A dashboard overview' })])
    const img = wrapper.find('img')

    expect(img.attributes('alt')).toBe('A dashboard overview')
    expect(img.attributes('aria-hidden')).toBeUndefined()
  })

  it('treats an intentionally decorative image as decorative, and keeps it in the figure', async () => {
    const wrapper = await mount([item({ alt: '' })])
    const img = wrapper.find('img')

    // alt="" is the owner's explicit choice — the image stays part of the figure's meaning.
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('aria-hidden')).toBeUndefined()
  })

  it('hides an image whose alt has no translation, rather than inventing one', async () => {
    const wrapper = await mount([item({ alt: null }, {})])
    const img = wrapper.find('img')

    // null means "no translation for this locale" — a different state from a deliberate alt="".
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('aria-hidden')).toBe('true')
  })

  it('renders a caption when one exists and none when it does not', async () => {
    const withCaption = await mount([item({}, { caption: 'Dashboard overview' })])
    expect(withCaption.find('figcaption').text()).toBe('Dashboard overview')

    const without = await mount([item({}, { caption: null })])
    expect(without.find('figcaption').exists()).toBe(false)
  })

  it('carries the localized caption through verbatim, in either script', async () => {
    // The gallery does not translate — the API resolves the caption for the requested locale and this
    // renders that string. Arabic here is the assertion that nothing re-encodes or reorders it; the
    // RTL direction of the carousel itself is a layout concern, proven in the Playwright lane.
    const arabic = await mount([item({}, { caption: 'تعليق المعرض بالعربية' })])
    expect(arabic.find('figcaption').text()).toBe('تعليق المعرض بالعربية')
  })
})

/**
 * THE CAROUSEL PRESENTATION (this feature).
 *
 * Scope note: jsdom has no layout engine. Embla measures real boxes to build its snap list, so in
 * this environment `scrollSnaps` is empty and the dots render zero buttons — "which slide is active"
 * and "the slides sit side by side" are GEOMETRY, and are asserted in `e2e/scenarios/project-gallery`
 * where a real browser can answer them. What belongs here is the structure and the derived
 * attributes: that the vertical stack is gone, and that each image's width cap and its `sizes` are
 * both driven by the same intrinsic ratio.
 */
describe('ProjectGallery — carousel presentation', () => {
  const landscape = () => item({ width: 2400, height: 1350 }, { mediaAssetId: 'landscape' })
  const portrait = () => item({ width: 1086, height: 1448 }, { mediaAssetId: 'portrait' })
  const square = () => item({ width: 1000, height: 1000 }, { mediaAssetId: 'square' })

  it('does not stack the images vertically', async () => {
    const wrapper = await mount([landscape(), portrait()])

    // The old markup was a `<ul>` of `<li>` in a `flex-col`. Its absence is the negative half of the
    // assertion; the positive half is that both figures now live in ONE horizontal carousel track,
    // so this cannot pass vacuously by rendering nothing at all.
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.find('li').exists()).toBe(false)

    const container = wrapper.get('[data-slot="container"]')
    expect(container.classes()).toContain('flex-row')
    expect(container.classes()).not.toContain('flex-col')

    const slides = wrapper.findAll('[data-slot="item"]')
    expect(slides).toHaveLength(2)
    // `basis-full` is what makes it ONE image per slide rather than a filmstrip of several.
    expect(slides[0]!.classes()).toContain('basis-full')
    expect(slides.every(slide => slide.findAll('figure').length === 1)).toBe(true)
  })

  it('exposes the carousel to assistive technology and to the keyboard', async () => {
    const wrapper = await mount([landscape(), portrait()])
    const root = wrapper.get('[role="region"][aria-roledescription="carousel"]')

    // Focusable, because the component's own ArrowLeft/ArrowRight handler lives on this element —
    // without a tab stop the carousel would be mouse- and touch-only.
    expect(root.attributes('tabindex')).toBe('0')
  })

  it('offers previous/next and dot navigation only when there is somewhere to go', async () => {
    // Selected via the `arrows` wrapper rather than `[data-slot="prev"]`: the arrows ARE UButtons,
    // and UButton stamps its own `data-slot="base"` on the root, which wins over the slot name the
    // carousel passes down. The wrapper is the stable handle.
    const many = await mount([landscape(), portrait()])
    expect(many.findAll('[data-slot="arrows"] button')).toHaveLength(2)
    expect(many.find('[role="tablist"]').exists()).toBe(true)

    // One slide: two permanently-disabled arrows and a lone dot would be furniture, not navigation.
    const single = await mount([landscape()])
    expect(single.findAll('[data-slot="arrows"] button')).toHaveLength(0)
    expect(single.find('[role="tablist"]').exists()).toBe(false)
    // …but the image itself is still fully present.
    expect(single.findAll('figure')).toHaveLength(1)
  })

  // The cap lives on the FIGURE, not on the image: a caption has to be as wide as the figure it
  // describes, or a 384px portrait ends up with its caption starting at the far edge of a full-width
  // box. The image is `w-full` inside that capped box, so its RENDERED width is unchanged — which is
  // what the e2e geometry assertions and the `sizes` attribute are both written against.
  it('lets a wide screenshot use the full gallery width', async () => {
    const wrapper = await mount([landscape()])

    expect(wrapper.find('img').attributes('data-gallery-shape')).toBe('landscape')
    expect(wrapper.find('figure').classes()).toContain('w-full')
    expect(wrapper.find('figure').classes().some(c => c.startsWith('max-w-'))).toBe(false)
  })

  it('constrains and centres a portrait screenshot instead of stretching it', async () => {
    const wrapper = await mount([portrait()])

    expect(wrapper.find('img').attributes('data-gallery-shape')).toBe('portrait')
    expect(wrapper.find('figure').classes()).toContain('max-w-sm')
    expect(wrapper.find('figure').classes()).toContain('mx-auto')
  })

  it('gives a near-square image a constrained width too', async () => {
    const wrapper = await mount([square()])

    expect(wrapper.find('img').attributes('data-gallery-shape')).toBe('square')
    expect(wrapper.find('figure').classes()).toContain('max-w-md')
    expect(wrapper.find('figure').classes()).toContain('mx-auto')
  })

  it('keeps every caption exactly as wide as the figure it describes', async () => {
    // The defect: cap the IMAGE and the figure stays full-width, so the caption of a constrained
    // screenshot is stranded away from it. Falsifiable by construction — move the cap back onto the
    // image and the figure loses `max-w-sm`/`max-w-md` here.
    const captioned = [
      { dims: { width: 1086, height: 1448 }, cap: 'max-w-sm' },
      { dims: { width: 1000, height: 1000 }, cap: 'max-w-md' }
    ]

    for (const { dims, cap } of captioned) {
      const wrapper = await mount([item(dims, { caption: 'A caption that must track its image' })])
      const figure = wrapper.find('figure')

      expect(figure.classes()).toContain(cap)
      expect(figure.find('figcaption').exists()).toBe(true)
      // The image fills that box rather than carrying a second, competing cap.
      expect(figure.find('img').classes()).toContain('w-full')
      expect(figure.find('img').classes().some(c => c.startsWith('max-w-'))).toBe(false)
    }
  })

  it('keeps `sizes` honest about the width each shape actually renders at', async () => {
    // The defect this catches: a portrait capped at 24rem while `sizes` still claims `100vw` makes
    // the browser fetch the 2400w rendition to paint 384 CSS pixels. Nothing else in the suite —
    // and no size budget — would notice, because the waste is in image bytes fetched at runtime.
    const wide = (await mount([landscape()])).find('img')
    expect(wide.attributes('sizes')).toContain('1024px')

    const tall = (await mount([portrait()])).find('img')
    expect(tall.attributes('sizes')).toContain('384px')
    expect(tall.attributes('sizes')).not.toContain('1024px')

    const boxy = (await mount([square()])).find('img')
    expect(boxy.attributes('sizes')).toContain('448px')
  })

  it('never crops: every shape is width-constrained only, and keeps its own height', async () => {
    const wrapper = await mount([landscape(), portrait(), square()])

    for (const img of wrapper.findAll('img')) {
      expect(img.classes()).toContain('h-auto')
      // `object-cover` is the class that would silently crop a screenshot to fill a fixed box.
      expect(img.classes()).not.toContain('object-cover')
      // Reserved boxes survive the rewrite, so the carousel does not reintroduce CLS.
      expect(img.attributes('width')).toBeTruthy()
      expect(img.attributes('height')).toBeTruthy()
    }
  })

  it('preserves API order across the slides', async () => {
    const wrapper = await mount([
      item({ url: 'https://media.example.com/first.webp' }, { mediaAssetId: 'a', order: 0 }),
      item({ url: 'https://media.example.com/second.webp' }, { mediaAssetId: 'b', order: 1 }),
      item({ url: 'https://media.example.com/third.webp' }, { mediaAssetId: 'c', order: 2 })
    ])

    // Embla does not virtualize — every slide is in the DOM, in track order — so DOM order IS the
    // gallery order the API sent.
    const sources = wrapper.findAll('[data-slot="item"] img').map(img => img.attributes('src'))
    expect(sources).toEqual([
      'https://media.example.com/first.webp',
      'https://media.example.com/second.webp',
      'https://media.example.com/third.webp'
    ])
  })

  it('renders an empty gallery as an empty track, with no controls and no image shell', async () => {
    // The page omits the component entirely when the gallery is empty, so this is the defensive
    // case: mounted with nothing, it must not invent a slide, an arrow, or a broken <img>.
    const wrapper = await mount([])

    expect(wrapper.findAll('[data-slot="item"]')).toHaveLength(0)
    expect(wrapper.findAll('figure')).toHaveLength(0)
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.findAll('[data-slot="arrows"] button')).toHaveLength(0)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
  })
})
