import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { SLUG } from './backend.ts'

/**
 * SCENARIO 6 — THE PROJECT GALLERY CAROUSEL.
 *
 * WHY THIS LANE AND NOT THE UNIT SPEC. Every claim below is GEOMETRY: side by side rather than
 * stacked, a tall screenshot narrower than a wide one, a slide that actually moves. jsdom has no
 * layout engine — every box there is 0×0 and Embla's snap list is empty — so the component spec can
 * only assert the classes and `sizes` that the shape classification derives. Whether those classes
 * produce the intended layout is a question only a real browser can answer, and this is where it is
 * asked.
 *
 * The fixture is `SLUG.multiShapeGallery`: three images, three intrinsic shapes (2400×1350 wide,
 * 1086×1448 tall, 1200×1200 square), in an order that is sorted by nothing.
 *
 * NOT IN SCOPE HERE. Gallery persistence, API delivery and the `no-store` detail-route rule are
 * released behaviour verified elsewhere (`e2e/cache/project-detail.spec.ts`); this feature changed
 * how the gallery is PRESENTED and nothing about how it is fetched.
 */

const EN_PATH = `/projects/${SLUG.multiShapeGallery.en}`
const AR_PATH = `/ar/projects/${SLUG.multiShapeGallery.ar}`

/** `max-w-sm` — the portrait cap, in CSS pixels. A few px of tolerance for the border box. */
const PORTRAIT_CAP = 384
/** `max-w-md` — the near-square cap. */
const SQUARE_CAP = 448

const galleryImages = (page: Page) => page.locator('#project-gallery-heading ~ * img')
const dots = (page: Page) => page.locator('[role="tablist"] [role="tab"]')
/**
 * The carousel's own `role="region"` root. Selected by `aria-roledescription` rather than by role
 * alone, because the gallery `<section>` is ALSO a region and also contains the viewport — a
 * role-plus-descendant filter would match both and trip strict mode.
 */
const carouselRoot = (page: Page) => page.locator('[aria-roledescription="carousel"]')

async function boxesOf(images: Locator) {
  const count = await images.count()
  const boxes = []
  for (let index = 0; index < count; index++) {
    const box = await images.nth(index).boundingBox()
    expect(box, `image ${index} has no layout box`).not.toBeNull()
    boxes.push(box!)
  }
  return boxes
}

/** Which dot is selected == which slide Embla considers active. */
async function activeSlide(page: Page) {
  const states = await dots(page).evaluateAll(tabs =>
    tabs.map(tab => tab.getAttribute('aria-selected') === 'true')
  )
  return states.indexOf(true)
}

test.describe('Project gallery carousel — English', () => {
  test('shows the images side by side, not as a vertical stack', async ({ page }) => {
    await page.goto(EN_PATH)

    const images = galleryImages(page)
    await expect(images).toHaveCount(3)

    const boxes = await boxesOf(images)

    // THE DISCRIMINATING ASSERTION. A vertical stack puts every image at the SAME x and a DIFFERENT
    // y; a carousel track does exactly the inverse. Asserting both halves means neither a stack nor
    // a collapsed/zero-size render can satisfy it.
    const [first, second, third] = boxes as [typeof boxes[0], typeof boxes[0], typeof boxes[0]]
    expect(Math.abs(second.y - first.y), 'slides share a baseline').toBeLessThanOrEqual(2)
    expect(Math.abs(third.y - first.y), 'slides share a baseline').toBeLessThanOrEqual(2)

    const xs = boxes.map(box => Math.round(box.x))
    expect(new Set(xs).size, 'each slide occupies its own horizontal offset').toBe(3)

    // One slide per view: only the first is actually within the viewport's horizontal extent.
    const viewportWidth = page.viewportSize()!.width
    const onScreen = boxes.filter(box => box.x < viewportWidth && box.x + box.width > 0)
    expect(onScreen).toHaveLength(1)
  })

  test('sizes each image by its intrinsic shape, and never crops', async ({ page }) => {
    await page.goto(EN_PATH)

    const [wide, tall, square] = await boxesOf(galleryImages(page))

    // The requirement in one line: a portrait screenshot is NOT stretched to the content width.
    expect(tall!.width).toBeLessThan(wide!.width)
    expect(tall!.width).toBeLessThanOrEqual(PORTRAIT_CAP)
    expect(square!.width).toBeLessThanOrEqual(SQUARE_CAP)
    // …while a wide screenshot still gets the room it was designed for.
    expect(wide!.width).toBeGreaterThan(PORTRAIT_CAP * 1.5)

    // No cropping: each rendered box keeps its own intrinsic ratio, so nothing was clipped to fill a
    // fixed frame. Checked against the descriptors the fixture publishes.
    const ratios = await galleryImages(page).evaluateAll(imgs =>
      imgs.map(img => ({
        rendered: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
        intrinsic: Number(img.getAttribute('width')) / Number(img.getAttribute('height'))
      }))
    )
    for (const { rendered, intrinsic } of ratios) {
      expect(Math.abs(rendered - intrinsic)).toBeLessThan(0.05)
    }
  })

  test('a constrained portrait is centred in its slide rather than pinned to one edge', async ({ page }) => {
    await page.goto(EN_PATH)

    const gaps = await galleryImages(page).nth(1).evaluate((img) => {
      const slide = img.closest('[data-slot="item"]')!
      const image = img.getBoundingClientRect()
      const track = slide.getBoundingClientRect()
      return { start: image.left - track.left, end: track.right - image.right }
    })

    expect(gaps.start).toBeGreaterThan(0)
    // Equal margins either side is what "centred" means; the slide carries a `ps-4` gutter, so the
    // tolerance absorbs that single-sided padding rather than pretending it is not there.
    expect(Math.abs(gaps.start - gaps.end)).toBeLessThanOrEqual(20)
  })

  test('a caption is exactly as wide as the screenshot it describes', async ({ page }) => {
    await page.goto(EN_PATH)

    // The defect this catches is pure geometry, so jsdom cannot see it: cap the IMAGE and the
    // <figure> keeps the full slide width, leaving a 384px portrait with its caption starting at the
    // far edge of a ~1216px box — a label that appears to describe the whitespace beside the image.
    const measured = await galleryImages(page).evaluateAll(imgs => imgs.map((img) => {
      const figure = img.closest('figure')!
      const caption = figure.querySelector('figcaption')
      return {
        shape: (img as HTMLElement).dataset.galleryShape,
        imageLeft: img.getBoundingClientRect().left,
        imageWidth: img.getBoundingClientRect().width,
        captionLeft: caption ? caption.getBoundingClientRect().left : null,
        captionWidth: caption ? caption.getBoundingClientRect().width : null
      }
    }))

    expect(measured).toHaveLength(3)
    for (const row of measured) {
      expect(row.captionWidth, `${row.shape} has a caption`).not.toBeNull()
      // Same box: same left edge and same width, at every shape.
      expect(Math.abs(row.captionLeft! - row.imageLeft), `${row.shape} caption starts at the image`)
        .toBeLessThanOrEqual(2)
      expect(Math.abs(row.captionWidth! - row.imageWidth), `${row.shape} caption matches image width`)
        .toBeLessThanOrEqual(2)
    }

    // …and the constrained shapes really are constrained, so this is not passing because everything
    // happens to be full width.
    expect(measured.find(row => row.shape === 'portrait')!.imageWidth).toBeLessThanOrEqual(PORTRAIT_CAP)
  })

  test('the next/previous controls actually move the active slide', async ({ page }) => {
    await page.goto(EN_PATH)

    await expect(dots(page)).toHaveCount(3)
    expect(await activeSlide(page)).toBe(0)

    const startX = (await galleryImages(page).first().boundingBox())!.x

    await page.getByRole('button', { name: 'Next' }).click()
    await expect.poll(() => activeSlide(page)).toBe(1)

    // The dot is a claim about state; the moved box is the proof the track really scrolled.
    const movedX = (await galleryImages(page).first().boundingBox())!.x
    expect(movedX).toBeLessThan(startX)

    await page.getByRole('button', { name: 'Prev' }).click()
    await expect.poll(() => activeSlide(page)).toBe(0)
  })

  test('is reachable and operable from the keyboard alone', async ({ page }) => {
    await page.goto(EN_PATH)

    // Wait for hydration BEFORE touching the keyboard. The arrow-key handler is bound when Vue
    // hydrates, and the dots are rendered from Embla's snap list — which only exists once it has
    // measured the real slides on the client. So "three dots are present" is the observable proof
    // that the listener this test drives is actually attached; focusing a server-rendered tabindex
    // and pressing a key before that point tests nothing and fails intermittently.
    await expect(dots(page)).toHaveCount(3)

    const carousel = carouselRoot(page)
    await carousel.focus()
    await expect(carousel).toBeFocused()

    // LTR: ArrowRight advances.
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => activeSlide(page)).toBe(1)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => activeSlide(page)).toBe(0)
  })

  test('shows a visible focus indicator on the tab stop it adds', async ({ page }) => {
    // WCAG 2.2 AA 2.4.7, release-blocking. This is a REGRESSION TEST for a real defect: the carousel
    // root is a new tab stop, and the component theme resets it with `focus:outline-none` — which is
    // in `@layer utilities` and therefore beats this site's `@layer base` global focus ring outright.
    // Focused-but-invisible is the exact state axe does not reliably catch, so it is pinned here by
    // reading the computed style rather than by trusting the class list.
    await page.goto(EN_PATH)
    await expect(dots(page)).toHaveCount(3)

    const carousel = carouselRoot(page)
    await carousel.focus()
    await expect(carousel).toBeFocused()

    const indicator = await carousel.evaluate((element) => {
      const style = getComputedStyle(element)
      return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow }
    })

    // The outline is expected to be suppressed — that is the theme's doing and is not the bug. The
    // requirement is that SOMETHING renders, so the assertion is on the indicator that survives.
    expect(indicator.boxShadow, 'focused carousel paints no visible ring').not.toBe('none')
    expect(indicator.boxShadow).toMatch(/rgb/)
  })

  test('keeps the API order and the localized captions', async ({ page }) => {
    await page.goto(EN_PATH)

    expect(await page.locator('figcaption').allInnerTexts()).toEqual([
      'Wide caption',
      'Tall caption',
      'Square caption'
    ])
    expect(await galleryImages(page).evaluateAll(imgs => imgs.map(img => img.getAttribute('alt')))).toEqual([
      'Wide dashboard screenshot',
      'Tall mobile screenshot',
      'Square logo screenshot'
    ])
  })

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(EN_PATH)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})

test.describe('Project gallery carousel — Arabic', () => {
  test('scrolls right-to-left, with the arrow keys mirrored to match', async ({ page }) => {
    await page.goto(AR_PATH)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const boxes = await boxesOf(galleryImages(page))
    // RTL: slide 2 sits to the LEFT of slide 1. Asserting the direction — rather than merely that
    // the offsets differ — is what catches a carousel that stayed LTR while the page turned RTL,
    // which is the failure mode where swiping "forward" moves backwards.
    expect(boxes[1]!.x).toBeLessThan(boxes[0]!.x)

    // Same hydration precondition as the English keyboard test.
    await expect(dots(page)).toHaveCount(3)

    const carousel = carouselRoot(page)
    await carousel.focus()
    // Mirrored: in RTL it is ArrowLeft that advances.
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => activeSlide(page)).toBe(1)
  })

  test('labels its controls in Arabic and keeps the Arabic captions in order', async ({ page }) => {
    await page.goto(AR_PATH)

    // From the Nuxt UI Arabic locale pack, switched by `<UApp :locale>` — not hand-rolled here.
    await expect(page.getByRole('button', { name: 'التالي' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'السابق' })).toBeVisible()

    expect(await page.locator('figcaption').allInnerTexts()).toEqual([
      'تعليق عريض',
      'تعليق طويل',
      'تعليق مربع'
    ])

    await page.getByRole('button', { name: 'التالي' }).click()
    await expect.poll(() => activeSlide(page)).toBe(1)
  })

  test('constrains the portrait in RTL exactly as it does in LTR', async ({ page }) => {
    await page.goto(AR_PATH)
    const [wide, tall] = await boxesOf(galleryImages(page))

    expect(tall!.width).toBeLessThanOrEqual(PORTRAIT_CAP)
    expect(tall!.width).toBeLessThan(wide!.width)
  })

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(AR_PATH)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})

test.describe('Project gallery carousel — degenerate galleries', () => {
  test('a single image renders with no navigation furniture', async ({ page }) => {
    // The canonical fixture carries exactly one gallery image. Arrows and dots would be inert here,
    // so the component withholds them — while the image itself must still be fully present.
    await page.goto(`/projects/${SLUG.canonical.en}`)

    await expect(page.locator('#project-gallery-heading')).toBeVisible()
    await expect(galleryImages(page)).toHaveCount(1)
    await expect(page.locator('[role="tablist"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Prev' })).toHaveCount(0)
  })

  test('an empty gallery renders no carousel at all', async ({ page }) => {
    // The complement of the case above, and the reason the component is `v-if`-ed on the page rather
    // than rendering an empty track: scenario 5 owns the full assertion set, this pins the carousel
    // specifically, so an "empty carousel shell" regression is caught in THIS lane too.
    await page.goto(`/projects/${SLUG.emptyGallery.en}`)

    await expect(page.locator('#project-gallery-heading')).toHaveCount(0)
    await expect(page.locator('[aria-roledescription="carousel"]')).toHaveCount(0)
    await expect(page.locator('article img')).toHaveCount(0)
  })
})
