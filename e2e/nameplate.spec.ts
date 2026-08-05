import { expect, test } from '@playwright/test'

/**
 * The nameplate treatment (019) against the COMMITTED contract served by Prism.
 *
 * WHY THIS IS AN E2E FILE AND NOT A UNIT TEST. The treatment is CSS: a script-scoped rule in
 * `main.css` that has to beat two utilities from Tailwind's utilities layer (`.text-mega`'s own
 * `font-weight: 600` in the hero, `font-semibold` on the chrome) without `!important`. A component test
 * can only assert that a class name is present — it would keep passing with the rule deleted, so it
 * would prove nothing about the thing being built. Only computed style in a real engine can tell
 * "the class is on the element" apart from "the declaration actually won the cascade".
 *
 * THE ARABIC ASSERTIONS ARE THE POINT, NOT A COURTESY. Reem Kufi is the Arabic HERO face only
 * (D03-12, `main.css`): the hero name is Reem Kufi 700, and the chrome stays Cairo 600. That
 * separation is invisible to a diff — a wordmark that adopted `font-nameplate` would change the Arabic
 * chrome's face and pull `reem-kufi-arabic-*.woff2` onto every /ar route against the D20-15 font
 * budget, while `git diff -- app/assets/css/main.css` showed the Arabic block byte-identical. So the
 * Arabic side is asserted positively here, per surface, and the font fetch is asserted too.
 *
 * FAMILY IS READ AS THE DECLARED STACK, not as the face the engine picked, so these assertions do not
 * depend on a webfont having loaded and cannot flake on a slow font.
 */

const LATIN = 'Space Grotesk Variable'
const ARABIC_NAMEPLATE = 'Reem Kufi Variable'
const ARABIC_DISPLAY = 'Cairo Variable'

/**
 * The English home page, requested on a key the readiness probe did not poison.
 *
 * `nuxt.config.ts` puts `swr: 60` on `/`, and `playwright.config.ts` gates this lane's readiness by
 * GETting `/` — which SERVER-RENDERS AND CACHES the home page at the moment the Nitro port opens,
 * which is BEFORE Prism is answering. Every subsequent request for `/` is then served that cached
 * render for 60 s, and it is the "Content unavailable" state, not the page: `pages/index.vue` gates the
 * hero behind `v-if="settings"`. Measured here — `/` renders the error state for the whole run while
 * `/ar` (same `swr: 60`, but not the probe path) renders the real page. That config file already
 * documents this exact side effect for the `settings-dedupe` lane and gives that lane a non-SWR
 * `readyPath`; the contract lane still probes `/`.
 *
 * Nitro keys the SWR entry by `event.path`, which includes the query string, so a distinct query is a
 * genuinely fresh server render against a live backend. It is NOT a retry and NOT a relaxed assertion:
 * every expectation below is asserted exactly once, on a real render.
 *
 * The proper fix belongs to `playwright.config.ts`, which this workstream may not edit (shared file).
 */
const HOME_EN = '/?e2e=nameplate'

/**
 * Computed setting of one element.
 *
 * Read through a LOCATOR, not `page.evaluate(querySelector)`: the hero sits behind `v-if="settings"`
 * in `pages/index.vue`, so a bare query can land in the window before Site Settings resolve and read a
 * document that has a header and nothing else. The locator waits for the element itself; the assertion
 * it feeds is unchanged and still fails outright when the treatment is removed.
 */
async function setting(page: import('@playwright/test').Page, selector: string) {
  const target = page.locator(selector)
  await expect(target).toBeVisible()
  return target.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: parseFloat(cs.fontSize) }
  })
}

test.describe('Latin nameplate', () => {
  test('sets the hero name at the top of the Space Grotesk weight axis', async ({ page }) => {
    await page.goto(HOME_EN)

    const hero = await setting(page, 'h1.font-nameplate')
    expect(hero.fontFamily).toContain(LATIN)

    // 700, not 600. This is the whole treatment: `--text-mega--font-weight` is 600 and the utilities
    // layer would otherwise win, so a computed 600 here means the script-scoped rule lost the cascade
    // (or was removed) and the Latin name is back to being the display face at display weight.
    expect(hero.fontWeight).toBe('700')
  })

  test('sets the chrome wordmark from the same register, without adopting the hero face', async ({ page }) => {
    await page.goto(HOME_EN)

    const bar = await setting(page, 'header .nameplate')
    expect(bar.fontWeight).toBe('700')
    expect(bar.fontFamily).toContain(LATIN)

    // The chrome must NOT be the nameplate face: `font-nameplate` is Reem Kufi under the Arabic root,
    // and D03-12 confines Reem Kufi to the hero name.
    expect(bar.fontFamily).not.toContain(ARABIC_NAMEPLATE)
  })

  test('holds one mark-to-word ratio across the two chrome registers', async ({ page }) => {
    const ratio = async () => {
      await expect(page.locator('header .nameplate')).toBeVisible()
      return page.evaluate(() => {
        const word = document.querySelector('header .nameplate')!
        const mark = document.querySelector('header svg')!
        return mark.getBoundingClientRect().width / parseFloat(getComputedStyle(word).fontSize)
      })
    }

    // The register changes across the `md` breakpoint (15px → 18px) and the ratio must not: a px mark
    // size cannot follow a responsive type size, which is exactly how the bar and the drawer came to
    // render the same identity at two different proportions.
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(HOME_EN)
    expect(await ratio()).toBeCloseTo(1.1, 2)

    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(HOME_EN)
    expect(await ratio()).toBeCloseTo(1.1, 2)
  })

  test('keeps the whole name on one line at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto(HOME_EN)

    await expect(page.locator('header .nameplate')).toBeVisible()
    const wrapped = await page.evaluate(() => {
      const word = document.querySelector('header .nameplate') as HTMLElement
      const cs = getComputedStyle(word)
      // One line = the box is one line-height tall. A wrap makes it two, which is what broke the
      // header's fixed h-16 before `whitespace-nowrap` was added.
      return word.getBoundingClientRect().height > parseFloat(cs.lineHeight) * 1.5
    })
    expect(wrapped).toBe(false)
    await expect(page.locator('header')).toHaveText(/Eslam Muatamed/)
  })
})

test.describe('Arabic is untouched by the Latin treatment', () => {
  test('keeps the hero on Reem Kufi 700 and the chrome on Cairo 600', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const hero = await setting(page, 'h1.font-nameplate')
    expect(hero.fontFamily).toContain(ARABIC_NAMEPLATE)
    expect(hero.fontWeight).toBe('700')

    // The chrome is the assertion that matters: `.nameplate` is scoped to non-Arabic, so `font-semibold`
    // is still the declaration doing the work here. A 700 would mean the Latin register leaked into
    // Arabic; a Reem Kufi family would mean the wordmark adopted the hero face.
    const bar = await setting(page, 'header .nameplate')
    expect(bar.fontWeight).toBe('600')
    expect(bar.fontFamily).toContain(ARABIC_DISPLAY)
    expect(bar.fontFamily).not.toContain(ARABIC_NAMEPLATE)
  })

  test('does not fetch the Arabic nameplate face on an /ar route that has no hero', async ({ page }) => {
    await page.goto('/ar/about')
    // Wait for the font set to settle, so "not fetched" cannot simply mean "not fetched yet".
    await page.evaluate(() => document.fonts.ready)

    const fetched = await page.evaluate(() =>
      performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('reem-kufi'))
    )

    // D20-15 budget (Arabic script on /ar ≤ 130 KB woff2). Reem Kufi is ~14 KB of that and is only
    // earned on the one surface that uses it; a chrome wordmark on the nameplate face would put it on
    // every /ar route in the site.
    expect(fetched).toEqual([])
  })
})
