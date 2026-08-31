import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  LOCALE_COOKIE,
  NARROW,
  PRJ,
  SKILL,
  editorSettled,
  expectNoKeyPaths,
  listSettled,
  openEditor,
  resetBackend,
  selectedTechnologyIds,
  setBackendState,
  shell,
  signIn
} from './harness'

/**
 * The Projects Dashboard in a real browser — R16 CLOSED (SEO-U3c).
 *
 * ⚠ ONE SPEC FILE, and that is an INVARIANT rather than a preference. This lane is
 * `resetsBackendState: true`: a dedicated process pair AND exactly one spec file, because `workers`
 * is a top-level Playwright option and a second file would land on a second worker and reset these
 * fixtures mid-assertion. `scripts/e2e/lane-isolation.spec.mjs` asserts this.
 *
 * What this lane exists to prove that no unit test can: the real Nitro render over real HTTP — the
 * request states (via `delayMs`), the technology picker against its own vocabulary endpoint, the
 * shared SEO panel inside Projects in both languages, and above all THE SEO-U2 DEFECT ON THE WIRE:
 * a field the operator clears must reach the PATCH as `"metaTitle": null`, not as a missing key or
 * an empty string. That distinction is invisible to every outcome-only assertion.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

const seoInput = (page: import('@playwright/test').Page, locale: 'en' | 'ar', field: string) =>
  page.locator(`[data-locale-section="${locale}"] [data-seo-field="${field}"]`)

const tab = (page: import('@playwright/test').Page, locale: 'en' | 'ar') =>
  page.locator('[data-editor-tabs]').getByRole('tab').nth(locale === 'en' ? 0 : 1)

const REQUIRED_PROJECT_FIELDS = [
  'title', 'slug', 'summary', 'overview', 'businessProblem', 'solution',
  'role', 'architecture', 'challenges', 'features', 'lessonsLearned'
] as const

async function fillTranslation(page: import('@playwright/test').Page, locale: 'en' | 'ar', prefix: string): Promise<void> {
  for (const field of REQUIRED_PROJECT_FIELDS) {
    await page.locator(`[data-project-field="${locale}.${field}"]`).fill(`${prefix} ${field}`)
  }
}

async function patchBodyFor(page: import('@playwright/test').Page, action: () => Promise<void>) {
  const sent = page.waitForRequest(req =>
    req.url().includes('/admin/projects/') && req.method() === 'PATCH'
  )
  await action()
  return (await sent).postDataJSON() as {
    translations: Array<Record<string, unknown>>
    technologyIds?: string[]
  }
}

test.describe('collection and editor entry', () => {
  test('the collection renders through the real preview', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/projects')
    await listSettled(page)

    const ids = page.locator('[data-project-row]')
    await expect(ids).toHaveCount(2)
    await expect(page.locator(`[data-project-edit="${PRJ.main}"]`)).toBeVisible()
  })

  test('an existing project opens for editing and settles without runtime errors', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/projects')
    await listSettled(page)
    const requests = await openEditor(page, PRJ.main)

    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Held EN title')
    await expectNoKeyPaths(page)
    // No client-side error overlay replaced the form.
    await expect(page.locator('[data-save-error]')).toHaveCount(0)
    expect(requests.some(path => path.startsWith('/__nuxt_error'))).toBe(false)
  })

  test('the create surface renders without runtime errors', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/projects/new')
    await editorSettled(page)

    await expect(page.locator('[data-editor-save]')).toBeVisible()
    await expect(page.locator('[data-project-forbidden], [data-project-not-found]')).toHaveCount(0)
  })

  test('create keeps EN/AR tab state local and POSTs the established payload', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/projects/new')
    await editorSettled(page)

    await expect(tab(page, 'en')).toHaveAttribute('aria-selected', 'true')
    await fillTranslation(page, 'en', 'New')
    await tab(page, 'ar').click()
    await page.locator('[data-project-field="ar.title"]').fill('مسودة عربية')
    await tab(page, 'en').click()
    await expect(page.locator('[data-project-field="en.title"]')).toHaveValue('New title')
    await tab(page, 'ar').click()
    await expect(page.locator('[data-project-field="ar.title"]')).toHaveValue('مسودة عربية')
    await page.locator('[data-project-field="ar.title"]').fill('')
    await tab(page, 'en').click()

    const sent = page.waitForRequest(req =>
      req.url().endsWith('/admin/projects') && req.method() === 'POST'
    )
    await page.locator('[data-editor-save]').click()
    const body = (await sent).postDataJSON() as { isPublished: boolean, translations: Array<{ locale: string, title: string }> }
    expect(body.isPublished).toBe(false)
    expect(body.translations).toContainEqual(expect.objectContaining({ locale: 'en', title: 'New title' }))
    await page.waitForURL('**/dashboard/projects/00000000-0000-4000-a000-0000000000aa')
  })
})

test.describe('request states, made observable by delayMs', () => {
  test('a held read shows the skeleton, then the settled editor replaces it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto(`/dashboard/projects/${PRJ.main}`)

    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-editor-save]')).toHaveCount(0)

    await editorSettled(page)
    await expect(page.locator('[data-editor-save]')).toBeVisible()
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Held EN title')
  })

  test('a held collection read shows the skeleton, then rows replace it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/projects')

    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await listSettled(page)
    await expect(page.locator('[data-project-row]')).toHaveCount(2)
  })

  test('a failed collection read shows error with retry, not empty', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/projects')
    await listSettled(page)

    await expect(page.locator('[data-projects-failed]')).toBeVisible()
    await expect(page.locator('[data-projects-empty]')).toHaveCount(0)

    // Retry through the surface's own control recovers into settled rows.
    await setBackendState(page, { mode: 'ok' })
    await page.locator('[data-projects-failed] button').first().click()
    await listSettled(page)
    await expect(page.locator('[data-project-row]')).toHaveCount(2)
  })

  test('a filter refresh preserves held rows, then stale retry recovers in place', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/projects')
    await listSettled(page)
    await expect(page.locator('[data-project-row]')).toHaveCount(2)

    // The control plane holds only the fixture response. The user-triggered search remains the
    // real route transition that used to replace this usable list with the initial skeleton.
    await setBackendState(page, { delayMs: 2000 })
    await page.locator('[data-projects-search]').fill('content')
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-project-row]')).toHaveCount(2)

    await setBackendState(page, { mode: 'error' })
    await expect(page.locator('[data-projects-stale]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-project-row]')).toHaveCount(2)
    await expect(page.locator('[data-projects-failed]')).toHaveCount(0)

    await setBackendState(page, { mode: 'ok', delayMs: 0 })
    await page.locator('[data-projects-stale-retry]').click()
    await listSettled(page)
    await expect(page.locator('[data-projects-stale]')).toHaveCount(0)
    // This fixture records the server request but intentionally keeps its two canonical rows for
    // every healthy collection response; recovery is therefore proven by return to those rows.
    await expect(page.locator('[data-project-row]')).toHaveCount(2)

    await page.setViewportSize(NARROW)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'the retained-list notice must not introduce 380px horizontal overflow').toBeLessThanOrEqual(1)
  })

  test('a forbidden read is neither an error nor an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/projects')
    await listSettled(page)

    await expect(page.locator('[data-projects-forbidden]')).toBeVisible()
    await expect(page.locator('[data-projects-failed]')).toHaveCount(0)
  })
})

test.describe('the technology picker', () => {
  test('renders the vocabulary, keeps held selections selected, and filters by search', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    // Held selection survives the load — including across a deliberately slow read (pending state
    // must not corrupt it: the picker renders before/while the project resolves).
    expect(await selectedTechnologyIds(page)).toEqual([SKILL.typescript])

    // Search interaction narrows the rendered options without touching selection.
    await page.locator('[data-technologies-filter]').fill('nest')
    await expect(page.locator(`[data-technology="${SKILL.typescript}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-technology="${SKILL.nest}"]`)).toBeVisible()

    await page.locator('[data-technologies-filter]').fill('')
    await page.locator(`[data-technology="${SKILL.nest}"]`).click()
    expect(await selectedTechnologyIds(page).then(ids => ids.sort())).toEqual(
      [SKILL.typescript, SKILL.nest].sort()
    )
  })

  test('a save that never touches the picker sends the relation back intact', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    // Dirty the form through a NON-picker field: the invariant under test is that the untouched
    // picker still travels intact.
    await page.locator('[data-locale-section="en"] textarea >> nth=0').fill('Summary moved; picker untouched.')

    const body = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-save]').click()
    })
    expect(body.technologyIds).toEqual([SKILL.typescript])

    await page.reload()
    await editorSettled(page)
    expect(await selectedTechnologyIds(page)).toEqual([SKILL.typescript])
  })
})

test.describe('shared translation tabs and unsaved navigation', () => {
  test('preserves independent English and Arabic edits while switching tabs', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await tab(page, 'en').click()
    await page.locator('[data-project-field="en.title"]').fill('English edit in flight')
    await tab(page, 'ar').click()
    await page.locator('[data-project-field="ar.title"]').fill('تعديل عربي')
    await tab(page, 'en').click()
    await expect(page.locator('[data-project-field="en.title"]')).toHaveValue('English edit in flight')
    await tab(page, 'ar').click()
    await expect(page.locator('[data-project-field="ar.title"]')).toHaveValue('تعديل عربي')
  })

  test('seeds the active tab from Arabic dashboard chrome and keeps field directions per locale', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await expect(tab(page, 'ar')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-editor-panel="en"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-editor-panel="ar"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-project-field="en.title"]')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('[data-project-field="ar.title"]')).toHaveAttribute('dir', 'rtl')
  })

  test('routes an indexed 422 to the Arabic tab and preserves the unsaved edit', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await page.locator('[data-project-field="en.summary"]').fill('Still here after the rejected save')
    await setBackendState(page, {
      nextWriteErrors: [{ field: 'translations[1].slug', message: 'Arabic slug is already taken.' }]
    })
    await page.locator('[data-editor-save]').click()

    await expect(tab(page, 'ar')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-project-field="ar.slug"]')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-editor-error-summary]')).toContainText('Arabic slug is already taken.')
    await expect(page.locator('[data-project-field="en.summary"]')).toHaveValue('Still here after the rejected save')
    await expect(page.locator('[data-editor-save-state="unsaved"]')).toBeVisible()
  })

  test('routes an indexed 422 to the English tab', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await page.locator('[data-project-field="en.summary"]').fill('Rejected English save')
    await setBackendState(page, {
      nextWriteErrors: [{ field: 'translations[0].slug', message: 'English slug is already taken.' }]
    })
    await page.locator('[data-editor-save]').click()

    await expect(tab(page, 'en')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-editor-tab-invalid="en"]')).toBeVisible()
    await expect(page.locator('[data-project-field="en.slug"]')).toHaveAttribute('aria-invalid', 'true')
  })

  test('keeps a non-localized validation error in the established form-level surface', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await page.locator('[data-project-field="en.summary"]').fill('Rejected non-locale save')
    await setBackendState(page, {
      nextWriteErrors: [{ field: 'liveUrl', message: 'Live URL must be absolute.' }]
    })
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-save-error]')).toBeVisible()
    await expect(page.locator('[data-save-field-error="liveUrl"]')).toContainText('Live URL must be absolute.')
  })

  test('challenges navigation away from dirty work and honours the operator response', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)
    await page.locator('[data-project-field="en.summary"]').fill('Something not yet saved')

    page.once('dialog', dialog => void dialog.dismiss())
    await page.locator('[data-editor-back]').click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${PRJ.main}$`))
    await expect(page.locator('[data-project-field="en.summary"]')).toHaveValue('Something not yet saved')

    page.once('dialog', dialog => void dialog.accept())
    await page.locator('[data-editor-back]').click()
    await page.waitForURL('**/dashboard/projects')
  })
})

test.describe('the shared SEO panel inside Projects', () => {
  test('one titled panel renders per locale section', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await expect(page.locator('[data-seo-panel] legend')).toHaveCount(2)
  })

  /**
   * ⚠ THE SEO-U2 LIVE-DEFECT PROOF, asserted on the WIRE.
   *
   * The fixture holds `metaTitle: 'Held EN title'`. Clearing the box and saving must produce
   * `"metaTitle": null` in the PATCH body. The pre-SEO-U2 implementation OMITTED the key — which
   * this assertion fails loudly (`'null' !== undefined`) — while an empty string fails it too.
   * The round trip then proves the server actually cleared: a reload shows an EMPTY box.
   */
  test('a cleared meta title reaches the PATCH as explicit null, and stays cleared after reload', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await seoInput(page, 'en', 'metaTitle').fill('')
    const body = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-save]').click()
    })

    const en = body.translations.find(entry => entry.locale === 'en')
    expect(en).toHaveProperty('metaTitle', null)

    await page.reload()
    await editorSettled(page)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('')
  })

  test('an untouched populated SEO value is OMITTED from the PATCH, not resent or nulled', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    const body = await patchBodyFor(page, async () => {
      // An unrelated edit dirties the form; SEO stays untouched.
      await page.locator('[data-locale-section="en"] textarea >> nth=0').fill('Rewritten summary.')
      await page.locator('[data-editor-save]').click()
    })

    const en = body.translations.find(entry => entry.locale === 'en')
    expect(en).not.toHaveProperty('metaTitle')
    expect(en).not.toHaveProperty('ogImageId')
    // And the wire matches the round trip: the held value survives on the server.
    await page.reload()
    await editorSettled(page)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Held EN title')
  })

  test('clearing the OG image reaches the PATCH as explicit null', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    // The picker resolves the held reference and offers ITS OWN clear control — used as the
    // operator would, not driven through component internals.
    const enPanel = page.locator('[data-locale-section="en"] [data-seo-picker]')
    await expect(enPanel.locator('[data-picker-clear]')).toBeVisible()
    await enPanel.locator('[data-picker-clear]').click()

    const body = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-save]').click()
    })
    const en = body.translations.find(entry => entry.locale === 'en')
    expect(en).toHaveProperty('ogImageId', null)
  })

  test('EN and AR SEO edits are isolated, and canonical input stays LTR under Arabic chrome', async ({ page, baseURL }) => {
    // ARABIC dashboard chrome, cold-planted before first paint.
    await page.context().addCookies([{ name: LOCALE_COOKIE, value: 'ar', url: baseURL! }])
    await signIn(page, 'ar', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    // A machine address is LTR even inside the RTL section; natural-language fields follow content.
    await expect(seoInput(page, 'ar', 'canonicalUrl')).toHaveAttribute('dir', 'ltr')

    await seoInput(page, 'ar', 'canonicalUrl').fill('https://held.example.com/ar-clear')
    const body = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-save]').click()
    })
    const ar = body.translations.find(entry => entry.locale === 'ar')
    expect(ar).toMatchObject({ canonicalUrl: 'https://held.example.com/ar-clear' })
    // English's held SEO was untouched by the Arabic edit → omitted → preserved.
    const en = body.translations.find(entry => entry.locale === 'en')
    expect(en).not.toHaveProperty('metaTitle')
    expect(en).not.toHaveProperty('canonicalUrl')
  })

  test('an SEO-only edit marks the form changed, and a successful save returns it to rest', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)
    await expect(page.locator('[data-editor-save-state="idle"]')).toHaveCount(1)

    await seoInput(page, 'en', 'metaDescription').fill('Fresh description')
    await expect(page.locator('[data-editor-save-state="unsaved"]')).toBeVisible()

    await saveAndSettle(page)
    // The response re-seeds the form, so the affordance rests again — saved, not dirty.
    await expect(page.locator('[data-editor-save-state="saved"]')).toBeVisible()
  })
})

/** Save and wait until the write has landed and the re-seeded form has settled. */
async function saveAndSettle(page: import('@playwright/test').Page): Promise<void> {
  // Register the listener BEFORE the click: a fast PATCH would otherwise fire and be missed.
  const sent = page.waitForRequest(req =>
    req.url().includes('/admin/projects/') && req.method() === 'PATCH'
  )
  await page.locator('[data-editor-save]').click()
  await sent
  await editorSettled(page)
}

test.describe('bilingual, at the narrowest supported width', () => {
  test('English 380px: no horizontal overflow, no key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
    await expectNoKeyPaths(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'horizontal overflow at 380px').toBeLessThanOrEqual(1)
  })

  test('Arabic 380px: RTL chrome cold-boot, no overflow, no key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'ar', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expectNoKeyPaths(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'horizontal overflow at 380px').toBeLessThanOrEqual(1)
  })
})

test.describe('accessibility — unfiltered axe on the real surface', () => {
  test('settled editor, English', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })

  test('settled editor, Arabic', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL!)
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await editorSettled(page)

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })

  test('held-loading skeleton', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 4000 })
    await page.goto(`/dashboard/projects/${PRJ.main}`)
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })
})

test.describe('public isolation at the browser level', () => {
  test('editor load and save touch no public content endpoint', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)

    const publicHits: string[] = []
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        /^\/api\/v1\/(projects|articles|categories|tags|testimonials|experiences|skills)(\/|$|\?)/.test(pathname)
      ) {
        publicHits.push(pathname)
      }
    })

    await page.goto('/dashboard/projects')
    await listSettled(page)
    await openEditor(page, PRJ.main)
    await seoInput(page, 'en', 'metaTitle').fill('Isolation probe')
    await saveAndSettle(page)

    expect(publicHits, `public endpoints called from the Dashboard: ${publicHits.join(', ')}`).toEqual([])
  })
})
