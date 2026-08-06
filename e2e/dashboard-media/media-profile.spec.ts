import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { ASSET } from '../../scripts/e2e/media-server'

/**
 * The committed browser lane for the Media Library, the reusable picker and the About portrait
 * section of Profile.
 *
 * ONE FILE BY REQUIREMENT, not by preference. `workers` is a top-level Playwright option and
 * `fullyParallel: false` only serialises within a file, so a second spec file in this project would
 * be scheduled on a second worker and the two would reset this mutable backend under each other.
 *
 * SELECTION IS BY STRUCTURE OR BY FIXTURE IDENTITY, NEVER BY RENDERED COPY. Every locator resolves
 * through a role, a `data-*` hook, a URL, or a fixture id/filename defined by this repo's own
 * `scripts/e2e/media-server.ts`. A copy edit must never turn this suite red.
 */

const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_MEDIA_MOCK_PORT ?? 3701)}`

async function resetBackend(page: Page): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(res.ok(), 'backend reset must succeed').toBe(true)
}

async function setBackendState(page: Page, state: Record<string, unknown>): Promise<void> {
  const res = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(res.ok(), 'backend state change must succeed').toBe(true)
}

/** What the backend actually PERSISTED — not merely what the page re-rendered. */
async function persistedPortrait(page: Page) {
  const res = await page.request.get(`${CONTROL_BASE}/__e2e/portrait`)
  return res.json() as Promise<{ portraitAssetId: string | null, portraitAlt: Record<string, string | null> }>
}

/**
 * Sign in through the real form — deliberately not a token-injection shortcut, so every reload in
 * this lane exercises the silent-refresh path (D11-1) exactly as production does.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined)
}

const cards = (page: Page) => page.locator('[data-media-card]')
/**
 * A `UPagination` page button.
 *
 * Scoped to `nav[data-slot=root]`, which is the pagination root — the dashboard SIDEBAR is also a
 * `<nav>`, so an unscoped lookup is ambiguous. `getByRole('button', { name: '2' })` does NOT work
 * here (measured: it times out); the accessible name is not the visible digit, so the digit is
 * matched as TEXT instead. The Inbox lane resolves it the same way, for the same reason.
 */
const pageButton = (page: Page, n: number) =>
  page.locator('nav[data-slot=root] button').filter({ hasText: new RegExp(`^${n}$`) }).first()
const card = (page: Page, id: string) => page.locator(`[data-media-id="${id}"]`)
const altInput = (page: Page, locale: 'en' | 'ar') => page.locator(`[data-portrait-alt="${locale}"] input, input[data-portrait-alt="${locale}"]`).first()

/** A tiny but genuinely valid PNG, so the upload path carries real bytes rather than a text blob. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('the media library', () => {
  test('lists, paginates, searches and filters by kind through the URL', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media')
    await settled(page)

    // 17 fixtures at 12 per page ⇒ a real second page with a distinguishable tail.
    await expect(cards(page)).toHaveCount(12)

    await pageButton(page, 2).click()
    await settled(page)
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(cards(page)).toHaveCount(5)

    // Back must restore page 1 — the URL is the state, so history navigation is free.
    await page.goBack()
    await settled(page)
    await expect(cards(page)).toHaveCount(12)

    await page.locator('input[type=search]').fill('desk-setup')
    await expect(page).toHaveURL(/[?&]q=desk-setup/, { timeout: 10_000 })
    await settled(page)
    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, ASSET.desk)).toBeVisible()

    // Search also matches ALT TEXT, as the contract documents.
    await page.locator('input[type=search]').fill('ASSET-LEVEL DEFAULT')
    await expect(page).toHaveURL(/[?&]q=ASSET-LEVEL/, { timeout: 10_000 })
    await settled(page)
    await expect(card(page, ASSET.portrait)).toBeVisible()

    await page.locator('input[type=search]').fill('')
    await settled(page)
    await page.getByRole('button', { name: 'PDF', exact: true }).click()
    await settled(page)
    await expect(page).toHaveURL(/[?&]kind=PDF/)
    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, ASSET.resume)).toBeVisible()
  })

  test('a deep-linked query reproduces the same grid on a cold load', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media?q=library-image&kind=IMAGE&page=2')
    await settled(page)
    // 13 `library-image-*` fixtures ⇒ page 2 holds exactly one.
    await expect(cards(page)).toHaveCount(1)
  })

  test('shows the empty, forbidden and error states distinctly', async ({ page }) => {
    await signIn(page)

    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/media')
    await settled(page)
    await expect(cards(page)).toHaveCount(0)
    await expect(page.getByText('No media yet')).toBeVisible()

    // 403 is a DIFFERENT answer from "no media" and gets its own surface (D11-2).
    await setBackendState(page, { mode: 'forbidden' })
    await page.reload()
    await settled(page)
    await expect(page.getByText('You do not have access to media')).toBeVisible()

    await setBackendState(page, { mode: 'error' })
    await page.reload()
    await settled(page)
    await expect(page.getByText('Media could not be loaded')).toBeVisible()
  })

  test('uploads a file, then finds it again by name — and reports a duplicate as a duplicate', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media')
    await settled(page)

    await page.locator('[data-media-upload]').setInputFiles({ name: 'brand-new.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('brand-new.png uploaded.')).toBeVisible({ timeout: 15_000 })
    await settled(page)

    await page.locator('input[type=search]').fill('brand-new')
    await settled(page)
    await expect(cards(page)).toHaveCount(1)

    // Re-uploading identical content is a SUCCESS with a different story, never a failure.
    await page.locator('[data-media-upload]').setInputFiles({ name: 'brand-new.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText(/matches a file already in the library/)).toBeVisible({ timeout: 15_000 })
  })

  test('surfaces a rejected upload without losing the grid', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media')
    await settled(page)

    await setBackendState(page, { failNextUpload: true })
    await page.locator('[data-media-upload]').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('The upload did not complete')).toBeVisible({ timeout: 15_000 })
    await expect(cards(page)).toHaveCount(12)
  })

  test('deletes an UNUSED asset', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media')
    await settled(page)

    await card(page, ASSET.desk).click()
    await expect(page.locator('[data-usage-none]')).toBeVisible()

    await page.locator('[data-delete-start]').click()
    await page.locator('[data-delete-confirm]').click()
    await settled(page)

    await expect(card(page, ASSET.desk)).toHaveCount(0)
    // Page 1 still holds a FULL page: 17 fixtures minus one is 16, and `perPage` is 12. The count
    // that actually moved is the tail — page 2 drops from 5 to 4, which is what proves the asset
    // left the collection rather than merely leaving this page.
    await expect(cards(page)).toHaveCount(12)
    await pageButton(page, 2).click()
    await settled(page)
    await expect(cards(page)).toHaveCount(4)
  })

  test('REFUSES to delete an asset that is in use, and shows what is holding it', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/media')
    await settled(page)

    await card(page, ASSET.inUse).click()

    // The usages are listed, and no delete control is offered at all — a button known to fail is
    // worse than no button, because the operator's real next step is to unpick the references.
    await expect(page.locator('[data-usage-list] li')).toHaveCount(1)
    await expect(page.locator('[data-usage-list]')).toContainText('Project gallery image')
    await expect(page.locator('[data-delete-start]')).toHaveCount(0)
    await expect(page.getByText('This file is in use and cannot be deleted.')).toBeVisible()
  })
})

test.describe('the About portrait section of /dashboard/profile', () => {
  test('THE ALT INPUTS ARE NEVER PREFILLED FROM THE ASSET-LEVEL DEFAULT (D09-22)', async ({ page }) => {
    // A portrait IS associated and its asset carries a library default, while the per-usage alts are
    // null. A page that prefilled from `portrait.alt` would show that exact string in its inputs.
    await setBackendState(page, { portraitAssetId: ASSET.portrait })
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    // The default really is in the loaded data — otherwise the assertion below would pass vacuously.
    await expect(page.locator('[data-portrait-library-default]')).toHaveText('ASSET-LEVEL DEFAULT — library description')

    await expect(altInput(page, 'en')).toHaveValue('')
    await expect(altInput(page, 'ar')).toHaveValue('')
  })

  test('requires BOTH locales before it will save', async ({ page }) => {
    await setBackendState(page, { portraitAssetId: ASSET.portrait })
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    await altInput(page, 'en').fill('Eslam, seated at a desk')
    await page.locator('[data-profile-save]').click()

    await expect(page.locator('[data-portrait-alt-error="ar"]')).toBeVisible()
    // Nothing was written: the per-usage alts are still null on the server.
    expect((await persistedPortrait(page)).portraitAlt).toEqual({ en: null, ar: null })

    await altInput(page, 'ar').fill('إسلام جالسًا إلى مكتبه')
    await page.locator('[data-profile-save]').click()
    await expect(page.locator('[data-profile-saved]')).toBeVisible({ timeout: 15_000 })

    expect((await persistedPortrait(page)).portraitAlt).toEqual({
      en: 'Eslam, seated at a desk',
      ar: 'إسلام جالسًا إلى مكتبه'
    })
  })

  test('selects a portrait through the picker and survives a reload', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    await expect(page.locator('[data-picker-empty]')).toBeVisible()

    await page.locator('[data-picker-open]').click()
    // The picker is locked to IMAGE, so the PDF fixture must not be selectable in it.
    await expect(page.locator('[role=dialog]').locator(`[data-media-id="${ASSET.resume}"]`)).toHaveCount(0)
    await page.locator('[role=dialog]').locator(`[data-media-id="${ASSET.portrait}"]`).click()

    await expect(page.locator('[data-picker-filename]')).toHaveText('portrait-candidate.jpg')

    await altInput(page, 'en').fill('Eslam in front of a bookshelf')
    await altInput(page, 'ar').fill('إسلام أمام رف الكتب')
    await page.locator('[data-profile-save]').click()
    await expect(page.locator('[data-profile-saved]')).toBeVisible({ timeout: 15_000 })

    await page.reload()
    await settled(page)
    await expect(page.locator('[data-picker-filename]')).toHaveText('portrait-candidate.jpg')
    await expect(altInput(page, 'en')).toHaveValue('Eslam in front of a bookshelf')
    await expect(altInput(page, 'ar')).toHaveValue('إسلام أمام رف الكتب')
  })

  test('uploads INSIDE the picker and selects the result without leaving the page', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    await page.locator('[data-picker-open]').click()
    await page.locator('[role=dialog]').locator('[data-media-upload]')
      .setInputFiles({ name: 'inline-upload.png', mimeType: 'image/png', buffer: PNG })

    // The dialog closes with the new asset selected — the "without leaving the editor" requirement.
    await expect(page.locator('[data-picker-filename]')).toHaveText('inline-upload.png', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard\/profile$/)
  })

  test('removing a portrait clears BOTH per-usage alts in the same save', async ({ page }) => {
    await setBackendState(page, {
      portraitAssetId: ASSET.portrait,
      portraitAlt: { en: 'Previous portrait alt', ar: 'نص الصورة السابقة' }
    })
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)
    await expect(altInput(page, 'en')).toHaveValue('Previous portrait alt')

    await page.locator('[data-portrait-remove]').click()
    await page.locator('[data-portrait-remove-confirm]').click()
    await page.locator('[data-profile-save]').click()
    await expect(page.locator('[data-profile-saved]')).toBeVisible({ timeout: 15_000 })

    // Both nulled. Leaving them behind would publish the OLD portrait's words under a NEW portrait.
    const persisted = await persistedPortrait(page)
    expect(persisted.portraitAssetId).toBeNull()
    expect(persisted.portraitAlt).toEqual({ en: null, ar: null })
  })

  test('a failed save keeps the operator input on screen', async ({ page }) => {
    await setBackendState(page, { portraitAssetId: ASSET.portrait, failNextPatch: true })
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    await altInput(page, 'en').fill('Typed but not saved')
    await altInput(page, 'ar').fill('مكتوب ولم يُحفظ')
    await page.locator('[data-profile-save]').click()

    await expect(page.getByText('The change did not save')).toBeVisible({ timeout: 15_000 })
    // The work is NOT discarded — a failed save must not also lose the input.
    await expect(altInput(page, 'en')).toHaveValue('Typed but not saved')
    await expect(altInput(page, 'ar')).toHaveValue('مكتوب ولم يُحفظ')
  })

  test('a selected portrait becomes undeletable in the library, in the same session', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/profile')
    await settled(page)

    await page.locator('[data-picker-open]').click()
    await page.locator('[role=dialog]').locator(`[data-media-id="${ASSET.portrait}"]`).click()
    await altInput(page, 'en').fill('Portrait alt')
    await altInput(page, 'ar').fill('نص الصورة')
    await page.locator('[data-profile-save]').click()
    await expect(page.locator('[data-profile-saved]')).toBeVisible({ timeout: 15_000 })

    // The association is a real usage, so `onDelete: Restrict` now holds this asset.
    await page.goto('/dashboard/media')
    await settled(page)
    await card(page, ASSET.portrait).click()
    await expect(page.locator('[data-usage-list]')).toContainText('About portrait')
    await expect(page.locator('[data-delete-start]')).toHaveCount(0)
  })
})

test.describe('navigation and RTL', () => {
  test('both routes are reachable from the dashboard navigation', async ({ page }) => {
    await signIn(page)
    await page.locator('a[href="/dashboard/media"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/media$/)
    await page.locator('a[href="/dashboard/profile"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/profile$/)
  })

  test('the Arabic route renders RTL, and the Arabic alt field stays RTL in either UI language', async ({ page }) => {
    // Doc 02 §8 makes dashboard CHROME English-only a governed non-goal; what must hold in `ar` is
    // that the document direction is correct and the bilingual CONTENT fields keep their own
    // direction. An RTL string in an LTR-forced box renders its punctuation in the wrong place.
    await setBackendState(page, { portraitAssetId: ASSET.portrait })
    await signIn(page)

    await page.goto('/ar/dashboard/profile')
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(altInput(page, 'ar')).toHaveAttribute('dir', 'rtl')
    await expect(altInput(page, 'en')).toHaveAttribute('dir', 'ltr')

    await page.goto('/dashboard/profile')
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    // The Arabic field is Arabic text even while the dashboard is in English.
    await expect(altInput(page, 'ar')).toHaveAttribute('dir', 'rtl')
  })

  test('the Arabic media route renders RTL and still lists the library', async ({ page }) => {
    await signIn(page)
    await page.goto('/ar/dashboard/media')
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(cards(page)).toHaveCount(12)
  })
})
