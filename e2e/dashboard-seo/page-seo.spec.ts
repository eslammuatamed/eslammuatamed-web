import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  NARROW,
  OG,
  openLocaleTab,
  resetBackend,
  selectPage,
  seoInput,
  seoSettled,
  setBackendState,
  shell,
  signIn,
  trackRequests
} from './harness'

/**
 * The Static Page SEO editor in a real browser — FE4-U1e.
 *
 * ⚠ ONE SPEC FILE (mutable-lane invariant, asserted by lane-isolation). What this lane proves that
 * no unit test can: real Nitro over real HTTP — the one-list/zero-detail read architecture, the
 * D10-23 pair ON THE WIRE (cleared field reaches the PATCH as `"metaTitle": null`), sent-order 422
 * mapping onto the Arabic tab, dirty-switch and dirty-refresh protection, the shared IMAGE picker
 * against its media vocabulary, public-endpoint isolation, unfiltered axe, and 380px in both
 * chrome languages with canonical URLs pinned LTR.
 *
 * Fixtures (from the U1a server): `about` fully authored EN+AR (ogImage = hero asset), `blog`
 * AR-only, `resume` AR-only title, everything else untouched. `home` is the product's initial page.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

const patchBodyFor = async (page: Page, action: () => Promise<void>) => {
  const sent = page.waitForRequest(req =>
    req.url().includes('/admin/seo/pages/') && req.method() === 'PATCH'
  )
  await action()
  return (await sent).postDataJSON() as {
    translations: Array<Record<string, unknown>>
  }
}

test.describe('initial read — one list is the whole surface', () => {
  test('renders through the production preview; Home selected; seven pages in PRODUCT order', async ({ page, baseURL }) => {
    const calls = trackRequests(page)
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)

    // Exactly ONE admin collection read so far, and NO detail-shaped GET at all.
    const listCalls = calls.filter(c => c.path === '/api/v1/admin/seo/pages' && c.method === 'GET')
    expect(listCalls).toHaveLength(1)
    for (const call of calls) {
      expect(call.path.startsWith('/api/v1/admin/seo/pages/'), call.path).toBe(false)
      expect(call.path.startsWith('/api/v1/seo/pages/'), call.path).toBe(false)
    }
    const keys = await page.locator('[data-seo-page-select]').evaluateAll(els =>
      els.map(el => el.getAttribute('data-seo-page-select'))
    )
    expect(keys).toEqual(['home', 'about', 'experience', 'projects', 'blog', 'resume', 'contact'])
    await expect(page.locator('[data-seo-page-select="home"][aria-selected="true"]')).toBeVisible()
    // Server seed: home is UNAUTHORED — empty inputs + the localized no-overrides badges.
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('')
    await expect(page.locator('[data-editor-tab-fill="en:empty"]')).toBeVisible()
    await selectPage(page, 'about')
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')
  })

  test('selecting another page renders its values and issues ZERO additional requests', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)

    const calls = trackRequests(page)
    await selectPage(page, 'about')
    expect(calls.filter(call => call.path.startsWith('/api/v1/admin/seo/pages'))).toHaveLength(0)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')
    await expect(seoInput(page, 'ar', 'metaTitle')).toHaveValue('نبذة — إسلام معتمد')
  })
})

test.describe('request states', () => {
  test('a held collection read shows the skeleton, then the settled editor replaces it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/seo')

    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-seo-editor]')).toHaveCount(0)
    await seoSettled(page)
    await expect(page.locator('[data-seo-editor]')).toBeVisible()
  })

  test('a failed read shows error + retry; retry reissues ONLY the collection request', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/seo')
    await seoSettled(page)

    await expect(page.locator('[data-seo-failed]')).toBeVisible()
    await setBackendState(page, { mode: 'ok' })
    const calls = trackRequests(page)
    await page.locator('[data-seo-failed] button').click()
    await seoSettled(page)
    expect(calls.filter(call => call.path === '/api/v1/admin/seo/pages')).toHaveLength(1)
  })

  test('forbidden mode renders its own state', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await expect(page.locator('[data-seo-forbidden]')).toBeVisible()
    await expect(page.locator('[data-seo-editor]')).toHaveCount(0)
  })

  test('background refresh keeps the editor visible with restrained updating treatment', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')

    await setBackendState(page, { delayMs: 1500 })
    await page.locator('[data-seo-refresh]').click()
    // Usable data stays on screen — never a full-surface skeleton.
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    await expect(page.locator('[data-seo-editor]')).toBeVisible()
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')
    await seoSettled(page)
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
  })

  test('the selected page remains stable through a refresh', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')

    await page.locator('[data-seo-refresh]').click()
    await seoSettled(page)
    await expect(page.locator('[data-seo-page-select="about"][aria-selected="true"]')).toBeVisible()
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')
  })
})

test.describe('EN / AR editing', () => {
  test('EN tab edits English only; AR tab edits Arabic only; switching preserves values', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('EN draft title')
    await expect(seoInput(page, 'ar', 'metaTitle')).toHaveValue('نبذة — إسلام معتمد')
    await openLocaleTab(page, 'ar')
    await seoInput(page, 'ar', 'canonicalUrl').fill('https://eslammuatamed.com/ar/about-draft')
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('EN draft title')
    await expect(seoInput(page, 'en', 'canonicalUrl')).toHaveValue('https://eslammuatamed.com/about')
  })

  test('Arabic-first editing works on an untouched locale of an authored page', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'experience') // all-null page
      await openLocaleTab(page, 'ar')
      await seoInput(page, 'ar', 'metaDescription').fill('وصف عربي فقط')
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations).toHaveLength(1)
    expect(body.translations[0]).toMatchObject({ locale: 'ar', metaDescription: 'وصف عربي فقط' })
  })
})

test.describe('PATCH wire semantics — captured browser request bodies', () => {
  test('an unchanged save produces ZERO PATCH requests', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    const calls = trackRequests(page)
    await page.locator('[data-editor-save]').click()
    await page.waitForTimeout(500)
    expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(0)
  })

  test('an EN-only edit PATCHes exactly one EN entry', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'about')
      await seoInput(page, 'en', 'metaTitle').fill('Revised about')
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations).toEqual([{ locale: 'en', metaTitle: 'Revised about' }])
  })

  test('an AR-only edit PATCHes AR at SENT index 0', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'about')
      await openLocaleTab(page, 'ar')
      await seoInput(page, 'ar', 'metaTitle').fill('عنوان معدل')
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations).toHaveLength(1)
    expect(body.translations[0]).toMatchObject({ locale: 'ar', metaTitle: 'عنوان معدل' })
  })

  test('a HELD text field cleared reaches the wire as explicit null', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'about')
      await seoInput(page, 'en', 'metaDescription').fill('')
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations[0]).toMatchObject({ locale: 'en', metaDescription: null })
  })

  test('INITIALLY-NULL untouched fields are ABSENT from the emitted entry', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'about')
      await openLocaleTab(page, 'ar')
      await seoInput(page, 'ar', 'metaTitle').fill('عنوان جديد')
      await page.locator('[data-editor-save]').click()
    })
    const entry = body.translations[0]!
    expect('metaDescription' in entry).toBe(false)
    expect('ogImageId' in entry).toBe(false)
  })

  test('no request EVER carries translations: [], and pageKey never enters a body', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'about')
      await seoInput(page, 'en', 'metaTitle').fill('Keyless')
      await page.locator('[data-editor-save]').click()
    })
    expect(JSON.stringify(body)).not.toContain('"translations":[]')
    expect(body.translations.length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(body)).not.toContain('pageKey')
  })
})

test.describe('save success', () => {
  test('server-confirmed values render; clean state; same page; no refetch after the PATCH', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('Confirmed about')

    const patchDone = page.waitForResponse(res =>
      res.url().includes('/admin/seo/pages/') && res.request().method() === 'PATCH'
    )
    await page.locator('[data-editor-save]').click()
    const response = await patchDone
    const confirmed = (await response.json()).data as {
      translations: Record<string, { metaTitle: string | null }>
    }
    expect(confirmed.translations.en?.metaTitle).toBe('Confirmed about')
    await seoSettled(page)

    await expect(page.locator('[data-seo-page-select="about"][aria-selected="true"]')).toBeVisible()
    // Clean: saving again writes nothing further.
    const calls = trackRequests(page)
    await page.locator('[data-editor-save]').click()
    await page.waitForTimeout(400)
    expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(0)
    expect(calls.filter(call => call.method === 'GET' && call.path === '/api/v1/admin/seo/pages')).toHaveLength(0)
  })
})

test.describe('canonical URL direction + validation', () => {
  test('canonical input stays LTR under English chrome', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    for (const locale of ['en', 'ar'] as const) {
      await expect(page.locator(`[data-editor-panel="${locale}"] input[data-seo-field="canonicalUrl"]`))
        .toHaveAttribute('dir', 'ltr')
    }
  })

  test('canonical input stays LTR under an ARABIC RTL chrome (cold boot)', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    for (const locale of ['en', 'ar'] as const) {
      await expect(page.locator(`[data-editor-panel="${locale}"] input[data-seo-field="canonicalUrl"]`))
        .toHaveAttribute('dir', 'ltr')
    }
  })

  test('a valid FTP canonical passes client validation and reaches the PATCH', async ({ page, baseURL }) => {
    const body = await patchBodyFor(page, async () => {
      await signIn(page, 'en', baseURL!)
      await page.goto('/dashboard/seo')
      await seoSettled(page)
      await selectPage(page, 'experience')
      await seoInput(page, 'en', 'canonicalUrl').fill('ftp://eslammuatamed.com/resource')
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations[0]).toMatchObject({ locale: 'en', canonicalUrl: 'ftp://eslammuatamed.com/resource' })
  })

  test('a RELATIVE canonical is blocked CLIENT-side with zero PATCHes', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    const calls = trackRequests(page)
    await seoInput(page, 'en', 'canonicalUrl').fill('/relative/path')
    await page.locator('[data-editor-save]').click()
    await page.waitForTimeout(500)
    expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(0)
    await expect(page.locator('[data-editor-panel="en"]').locator('text=absolute URL').first()).toBeVisible()
  })
})

test.describe('422 mapping and mutation failure', () => {
  test('an Arabic-only 422 at translations[0] lands on the ARABIC field/tab with edits intact', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await openLocaleTab(page, 'ar')
    await seoInput(page, 'ar', 'metaTitle').fill('تعديل عربي غير محفوظ')
    await setBackendState(page, {
      nextPatch422: [{ field: 'translations[0].canonicalUrl', message: 'must be an absolute URI.' }]
    })
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-tab-invalid="en"]')).toHaveCount(0)
    await expect(
      page.locator('[data-editor-panel="ar"]').locator('text=must be an absolute URI.')
    ).toBeVisible()
    await expect(seoInput(page, 'ar', 'metaTitle')).toHaveValue('تعديل عربي غير محفوظ')
  })

  test('a general mutation failure keeps the editor and shows an action-level error', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('Fails on the wire')
    await setBackendState(page, { failNextWrite: true })
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-seo-save-error]')).toBeVisible()
    await expect(page.locator('[data-seo-failed]')).toHaveCount(0)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Fails on the wire')
  })
})

test.describe('dirty page switching', () => {
  test('DIRTY + cancel keeps the current page and every edit', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('Unsaved about draft')

    page.once('dialog', dialog => dialog.dismiss())
    await page.locator('[data-seo-page-select="home"]').click()
    await expect(page.locator('[data-seo-page-select="about"][aria-selected="true"]')).toBeVisible()
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Unsaved about draft')
  })

  test('DIRTY + confirm discard opens the destination from its own row', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('Discarded draft')

    page.once('dialog', dialog => dialog.accept())
    await page.locator('[data-seo-page-select="home"]').click()
    await expect(page.locator('[data-seo-page-select="home"][aria-selected="true"]')).toBeVisible()
    // Server seed: home is UNAUTHORED — empty inputs + the localized no-overrides badges.
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('')
    await expect(page.locator('[data-editor-tab-fill="en:empty"]')).toBeVisible()
    await selectPage(page, 'about')
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('About — Eslam Muatamed')
  })

  test('CLEAN switches immediately with zero API requests and no confirmation', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    const calls = trackRequests(page)
    await selectPage(page, 'projects')
    await expect(page.locator('[data-seo-page-select="projects"][aria-selected="true"]')).toBeVisible()
    // Lazy chunks may stream in; the API must not. The destination LIST ROW was the edit source.
    expect(calls.filter(call => call.method === 'GET' && call.path.startsWith('/api/v1/'))).toHaveLength(0)
  })
})

test.describe('dirty refresh protection', () => {
  test('a background refresh does NOT overwrite a dirty form; a clean one rehydrates', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)

    // DIRTY first: the refreshed server value must NOT win.
    await seoInput(page, 'en', 'metaTitle').fill('My uncommitted work')
    await page.locator('[data-seo-refresh]').click()
    await seoSettled(page)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('My uncommitted work')

    // A CLEAN editor DOES rehydrate: reload fresh (server home row is UNAUTHORED → empty), then
    // change the SERVER'S home row behind the surface and prove clean rehydration picks it up.
    await page.reload()
    await seoSettled(page)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('')

    const nulled = { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null }
    await setBackendState(page, {
      pages: {
        home: { en: { ...nulled, metaTitle: 'Server-side new title' } },
        about: {}, experience: {}, projects: {}, blog: {}, resume: {}, contact: {}
      } as never
    })
    await page.locator('[data-seo-refresh]').click()
    await seoSettled(page)
    await expect(seoInput(page, 'en', 'metaTitle')).toHaveValue('Server-side new title')
  })

  test('the selected KEY remains stable through a refresh (never array position)', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'blog')
    await page.locator('[data-seo-refresh]').click()
    await seoSettled(page)
    await expect(page.locator('[data-seo-page-select="blog"][aria-selected="true"]')).toBeVisible()
  })
})

test.describe('OG image picker', () => {
  test('open → pick an IMAGE → id reaches PATCH; clear emits null', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'experience') // starts with ogImageId null

    await page.locator('[data-editor-panel="en"] [data-picker-open]').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Only IMAGE-kind assets are offered (the panel restricts the kind); the PDF fixture is absent.
    await expect(page.locator(`[data-media-id="${OG.pdf}"]`)).toHaveCount(0)
    await page.locator(`[data-media-id="${OG.spare}"]`).click()

    const body = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-save]').click()
    })
    expect(body.translations[0]).toMatchObject({ locale: 'en', ogImageId: OG.spare })

    // Clear control emits null through the panel untouched.
    const cleared = await patchBodyFor(page, async () => {
      await page.locator('[data-editor-panel="en"] [data-picker-clear]').click()
      await page.locator('[data-editor-save]').click()
    })
    expect(cleared.translations[0]?.ogImageId).toBeNull()
  })

  test('a STORED og reference resolves through /admin/media/:id and displays', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await expect(page.locator('[data-editor-panel="en"] [data-picker-filename]')).toContainText('about-social-card')
  })
})

test.describe('public endpoint isolation', () => {
  test('the editing flow NEVER touches /api/v1/seo/pages/{pageKey}', async ({ page, baseURL }) => {
    const calls = trackRequests(page)
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')
    await seoInput(page, 'en', 'metaTitle').fill('Isolated')
    await page.locator('[data-editor-save]').click()
    await seoSettled(page)
    for (const call of calls) {
      expect(call.path.startsWith('/api/v1/seo/pages/'), call.path).toBe(false)
    }
  })
})

test.describe('accessibility — unfiltered axe on the real surface', () => {
  test('settled editor, English', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })

  test('settled editor, Arabic cold boot', async ({ page, baseURL }) => {
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })

  test('held loading state', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/seo')
    await expect(page.locator('[aria-busy=true]').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
    await seoSettled(page)
  })

  test('error state offers a retry affordance with no violations', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })

  test('open OG-image picker dialog', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'experience')
    await page.locator('[data-editor-panel="en"] [data-picker-open]').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([])
  })
})

test.describe('narrowest supported width (380px)', () => {
  test('English: no horizontal overflow, selector/tabs/save usable', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'experience')

    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'horizontal overflow at 380px').toBeLessThanOrEqual(1)
    await expect(page.locator('[data-editor-save]')).toBeVisible()
    await expect(page.locator('[data-picker-open]').first()).toBeVisible()
  })

  test('Arabic: RTL chrome cold boot, no overflow, canonical LTR', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await selectPage(page, 'about')

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'horizontal overflow at 380px').toBeLessThanOrEqual(1)
    await expect(page.locator('[data-editor-panel="ar"] input[data-seo-field="canonicalUrl"]'))
      .toHaveAttribute('dir', 'ltr')
    await expect(page.locator('[data-editor-save]')).toBeVisible()
  })
})

test.describe('cold-boot direction', () => {
  test('EN boots dir=ltr; AR boots dir=rtl on the unprefixed dashboard route', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await expect(shell(page)).toHaveAttribute('dir', 'ltr')

    await page.context().clearCookies()
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/seo')
    await seoSettled(page)
    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expect(page).toHaveURL(/\/dashboard\/seo$/)
  })
})
