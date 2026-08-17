import { expect, test } from '@playwright/test'

/**
 * The governed reading measure on the NON-article prose surfaces — `/about` and `/projects/{slug}`.
 *
 * WHAT THIS PROTECTS. Doc 03 §3 governs prose to 65–75 characters per line in BOTH scripts, and
 * `--measure-prose` is the single mechanism that delivers it (`32em` Latin / `28em` Arabic, rebound
 * under `html[lang="ar"]`). `.content-prose` used to cap itself at `68ch` instead, which is not the
 * same thing and did not land inside the band in either locale:
 *
 *   - `ch` is the advance of "0" — 0.688em in Geist, far from the average character — so `68ch`
 *     resolved to ~748px in EN. These pages then took whichever was smaller, their `max-w-2xl`
 *     container at 672px, giving ~92 characters.
 *   - The Arabic body face is imported as an Arabic-ONLY subset with NO "0" glyph, so `ch` silently
 *     fell back to the 0.5em default: `68ch` = 544px, giving ~86 characters.
 *
 * Both outside 65–75, in opposite directions, from one declaration that looked locale-neutral. That
 * is the class of defect this file exists to catch: a width that is stable, bounded and centred —
 * and wrong.
 *
 * WHY THESE EXACT NUMBERS. `--measure-prose` is in `em`, so the column resolves against the
 * font-size of the element carrying the max-width. These two pages render prose at the 16px UI size
 * (unlike `/blog/{slug}`, whose wrapper sets `text-body-lg` = 18px and therefore expects 576/504 —
 * see `article-layout.spec.ts`). So 32 × 16 = 512 and 28 × 16 = 448. Unlike `ch`, `em` does not
 * depend on the loaded font's glyph metrics, so these are deterministic integers that do not shift
 * if a webfont is slow or substituted.
 *
 * ⚠ CONSEQUENCE FOR WHOEVER RE-TUNES THE TOKEN: re-tuning `--measure-prose` fails this file BY
 * DESIGN, even for a value well inside the governed band. The exact widths are part of the contract
 * and must be updated in the same change — as must `article-layout.spec.ts`, which pins the 18px
 * resolution of the same token.
 *
 * ⚠ WHY EVERY `.content-prose` IS ASSERTED, NOT THE FIRST. `/about` renders two prose blocks (bio,
 * philosophy) and `/projects/{slug}` renders one per authored section. Asserting only the first
 * would pass while a later block regressed, and the sections are rendered by a `v-for` — precisely
 * where a per-instance class override would go unnoticed.
 *
 * SYMMETRY IS CHECKED AGAINST THE VIEWPORT, not `left`/`right`, so the assertion reads identically
 * in LTR and RTL: RTL is verified by the Arabic routes resolving the REBOUND 448px and staying
 * inside their container, not by mirroring the geometry check.
 */

/** 32em / 28em at the 16px UI size these two surfaces render prose at. */
const COLUMN = { en: 512, ar: 448 }

/**
 * A loose upper bound asserted BEFORE the exact width, purely as a first-failure diagnostic: it is
 * tight enough that the pre-fix behaviour (672px in EN, 544px in AR) cannot pass, and it names the
 * defect far more legibly than the exact-width message would. It adds no coverage the exact width
 * lacks — keep it for the message, not for the guarantee.
 */
const MAX_COLUMN_PX = 520

const ROUTES = [
  { surface: 'about', locale: 'en', path: '/about' },
  { surface: 'about', locale: 'ar', path: '/ar/about' },
  { surface: 'project', locale: 'en', path: '/projects/content-platform-api' },
  { surface: 'project', locale: 'ar', path: '/ar/projects/content-platform-api' }
] as const

/** Geometry of every prose block on the page, plus the viewport, in one browser round-trip. */
async function readProse(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.content-prose'))
    if (nodes.length === 0) throw new Error('no .content-prose block rendered')
    const vw = document.documentElement.clientWidth
    return {
      vw,
      dir: document.documentElement.getAttribute('dir'),
      blocks: nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return {
          width: Math.round(r.width),
          // Direction-agnostic: distance from each viewport edge reads the same in LTR and RTL.
          gapStart: Math.round(r.x),
          gapEnd: Math.round(vw - r.x - r.width)
        }
      })
    }
  })
}

for (const { surface, locale, path } of ROUTES) {
  const expected = COLUMN[locale]

  test.describe(`Prose measure — ${surface} (${locale})`, () => {
    test('resolves the governed measure and does not grow with the viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(path)
      const atDesktop = await readProse(page)

      await page.setViewportSize({ width: 1920, height: 900 })
      const atWide = await readProse(page)

      expect(atWide.dir).toBe(locale === 'ar' ? 'rtl' : 'ltr')
      expect(atWide.blocks.length).toBeGreaterThan(0)

      for (const block of atWide.blocks) {
        // Bounded — the pre-fix 672px (EN) / 544px (AR) columns fail here with a legible message.
        expect(block.width).toBeLessThanOrEqual(MAX_COLUMN_PX)
        // The real gate: a MISRESOLVED column is the failure mode that would otherwise ship
        // silently, because it stays bounded and stable while leaving the governed band.
        expect(block.width).toBe(expected)
      }

      // 640px more viewport buys the reader NO extra line length.
      expect(atWide.blocks.map(b => b.width)).toEqual(atDesktop.blocks.map(b => b.width))
    })

    test('fills the small viewport without overflowing it', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto(path)
      const atMobile = await readProse(page)

      for (const block of atMobile.blocks) {
        // On a phone the measure is not the constraint — the viewport is. The column must use what
        // is there (minus the container gutter) and must not push past either edge. `gapStart`/
        // `gapEnd` being non-negative is the RTL-safe way to state "does not overflow".
        expect(block.width).toBeLessThanOrEqual(atMobile.vw)
        expect(block.gapStart).toBeGreaterThanOrEqual(0)
        expect(block.gapEnd).toBeGreaterThanOrEqual(0)
        expect(block.width).toBeGreaterThan(atMobile.vw * 0.8)
      }
    })
  })
}

/**
 * The cross-locale assertion is NOT cosmetic. The measure is rebound per script because a single
 * value cannot land both inside 65–75 characters. If that rebinding is ever dropped, Arabic resolves
 * at the Latin `32em` — still bounded, still centred, still stable, so every other assertion above
 * keeps passing. Only comparing the two notices that the Arabic reading measure stopped being real.
 */
test('the Arabic measure is narrower than the Latin one on both surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  const widthOf = async (path: string) => {
    await page.goto(path)
    return (await readProse(page)).blocks[0]!.width
  }

  expect(await widthOf('/ar/about')).toBeLessThan(await widthOf('/about'))
  expect(await widthOf('/ar/projects/content-platform-api'))
    .toBeLessThan(await widthOf('/projects/content-platform-api'))
})
