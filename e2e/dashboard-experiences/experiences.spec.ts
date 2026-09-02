import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hydrated } from '../hydration'
import {
  API_ORDER,
  EXP,
  NARROW,
  editorSettled,
  expectNoKeyPaths,
  listSettled,
  resetBackend,
  rows,
  selectedSkillIds,
  setBackendState,
  shell,
  signIn,
  tableRowFor
} from './harness'

const LATER_SKILL = '00000000-0000-4000-f000-000000000051'
const skillsForPicker = () => Array.from({ length: 51 }, (_, index) => ({
  id: index === 50 ? LATER_SKILL : `00000000-0000-4000-f000-${String(index + 1).padStart(12, '0')}`,
  slug: index === 50 ? 'later-experience-skill' : `experience-skill-${index + 1}`,
  group: 'FRAMEWORK', brandColor: null, isPublic: true, order: index,
  translations: { en: { label: index === 50 ? 'Later Experience Skill' : `Experience Skill ${index + 1}` } }
}))

/**
 * The Experiences collection in a real browser (FE-3 module 1, `M1·U2`).
 *
 * ⚠ ONE SPEC FILE, and that is an INVARIANT rather than a preference. This lane is
 * `resetsBackendState: true`, which means a dedicated process pair AND exactly one spec file:
 * `workers` is a top-level Playwright option and `fullyParallel: false` only serialises tests
 * WITHIN a file, so a second file would land on a second worker and the two would reset each
 * other's fixtures mid-assertion. `scripts/e2e/lane-isolation.spec.mjs` asserts this.
 *
 * What this lane can prove that no unit test can: that the ORDER the operator actually sees is the
 * API's, through a real Nitro render and a real HTTP response.
 */

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test.describe('the collection', () => {
  test('renders the first server page in API order, current-role-first', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-table]')).toBeVisible()
    await expect(page.locator(`[data-experience-role="${EXP.current}"]`)).toHaveText('Senior Frontend Engineer')

    /**
     * ⚠ THE FULL SEQUENCE, not just the head.
     *
     * A `startDate desc` sort — the natural way to write a CV list, and the one that shipped an
     * ended role above the current one to the live site — produces `endedLater` first here. A test
     * that only asserted "the current role is first" would still pass against a sort that is wrong
     * further down, so the whole order is pinned.
     */
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-experience-row')))
    expect(ids.slice(0, API_ORDER.length)).toEqual([...API_ORDER])
    expect(ids).toHaveLength(12)
    await expect(page.locator('[data-experiences-pagination]')).toBeVisible()
  })

  test('owns page in the URL, requests the deep-linked server page, and preserves history', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)
    const pageTwo = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/experiences') && url.searchParams.get('page') === '2' && url.searchParams.get('perPage') === '12'
    })
    await page.goto('/dashboard/experiences?page=2')
    await pageTwo
    await listSettled(page)
    await expect(rows(page)).toHaveCount(1)
    await page.goBack()
    await listSettled(page)
    await expect(page).toHaveURL(/\/dashboard\/experiences$/)
    await expect(rows(page)).toHaveCount(12)
  })

  test('discards a late page-one response after page two becomes current', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 1000 })
    const pageOne = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '1')
    await page.goto('/dashboard/experiences')
    await pageOne
    await setBackendState(page, { delayMs: 0 })
    await page.goto('/dashboard/experiences?page=2')
    await listSettled(page)
    await expect(rows(page)).toHaveCount(1)
  })

  test('marks the current role, and only that one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator(`[data-experience-current="${EXP.current}"]`)).toBeVisible()
    await expect(page.locator(`[data-experience-current="${EXP.endedLater}"]`)).toHaveCount(0)
  })

  test('reports an English-only role as missing its Arabic, without substituting it', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    const row = tableRowFor(page, EXP.enOnly)
    await expect(row.locator('[data-experience-translation="en:present"]')).toBeVisible()
    await expect(row.locator('[data-experience-translation="ar:missing"]')).toBeVisible()
  })

  test('states each role\'s linked skill count, including zero', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    // `current` holds three skills; `noSkills` holds none — so "cleared" stays distinguishable
    // from "never had any" on the surface the operator reads.
    await expect(tableRowFor(page, EXP.current).locator('[data-experience-skills="3"]')).toBeVisible()
    await expect(tableRowFor(page, EXP.noSkills).locator('[data-experience-skills="0"]')).toBeVisible()
  })
})

test.describe('the request states, made observable by delayMs', () => {
  /**
   * The skeleton is only on screen while a request is genuinely in flight. Without `delayMs` the
   * response returns before the first paint and this assertion passes without the state ever
   * having rendered — which is the whole reason a mutable, latency-controllable backend exists.
   */
  test('shows a skeleton on a first load, not an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 2000 })
    await page.goto('/dashboard/experiences')

    await expect(page.locator('[aria-busy=true]')).toBeVisible()
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)

    await listSettled(page)
    await expect(rows(page)).not.toHaveCount(0)
  })

  test('shows the deliberate empty state, with its own create action', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'empty' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-empty]')).toBeVisible()
    await expect(page.locator('[data-experiences-failed]')).toHaveCount(0)
  })

  test('shows an error with a retry when the first load fails', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'error' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-failed]')).toBeVisible()
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)
  })

  test('answers a 403 as forbidden — neither an error nor an empty list', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { mode: 'forbidden' })
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(page.locator('[data-experiences-forbidden]')).toBeVisible()
    await expect(page.locator('[data-experiences-failed]')).toHaveCount(0)
    await expect(page.locator('[data-experiences-empty]')).toHaveCount(0)
  })

  /**
   * ⚠ §10.3 rule 2's KEEP branch is NOT REACHABLE IN A BROWSER FOR THIS MODULE, and that is a
   * consequence of the contract rather than a gap in this lane.
   *
   * "A failed REFRESH keeps the rows" requires a SECOND request for the same view. The Articles
   * lane can produce one, because Articles has a status filter and pagination — real in-page
   * controls that re-request. `GET /admin/experiences` takes ZERO query parameters, so this page
   * has no control that issues a second load, and the only other route to one is a full navigation,
   * which is a FIRST load with nothing underneath it (already covered above as the error case).
   *
   * A test that reloaded the page and then asserted the error state would LOOK like it proved the
   * keep branch while actually re-proving the clear branch under a misleading name. The property is
   * proven where it is genuinely observable — `useAdminExperiences.spec.ts`, "KEEPS the rows when a
   * refresh fails after a successful load".
   */
})

test.describe('bilingual, at the narrowest supported width', () => {
  test('renders Arabic chrome RTL on a COLD load, with no raw key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    // The preference is planted BEFORE the first navigation: a post-load toggle would prove only
    // that the switcher works, while the property under test is that a stored preference is
    // honoured at BOOT.
    await signIn(page, 'ar', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expectNoKeyPaths(page)
    // The order is a SERVER property and must not change with the chrome language.
    const ids = await rows(page).evaluateAll(els => els.map(el => el.getAttribute('data-experience-row')))
    expect(ids.slice(0, API_ORDER.length)).toEqual([...API_ORDER])
  })

  test('renders English chrome LTR with no raw key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences')
    await listSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
    await expectNoKeyPaths(page)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE EDITOR (`M1·U3`)

   ⚠ THESE LIVE IN THIS FILE BY NECESSITY, NOT BY PREFERENCE. This lane is
   `resetsBackendState: true`, so it owns EXACTLY ONE spec file — a second file would be scheduled
   on a second worker and the two would reset each other's fixtures mid-assertion.
   `scripts/e2e/lane-isolation.spec.mjs` asserts that from the lane registry, so appending here is
   the architecture's answer rather than a judgement call. It is also why `M1·U3` adds NO new lane
   and NO new server pair: the editor rides the process pair `M1·U2` already booted.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

test.describe('the editor — the skill relation, which fails SILENTLY when it fails', () => {
  test('loads and restores a page-2 Skill without group or collection query leakage', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { skills: skillsForPicker() })
    const skillRequests: URL[] = []
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.pathname.endsWith('/admin/skills')) skillRequests.push(url)
    })
    await page.goto(`/dashboard/experiences/${EXP.noSkills}?page=7&group=FRAMEWORK`)
    await editorSettled(page)
    await expect.poll(() => skillRequests.map(url => url.searchParams.get('page')))
      .toEqual(expect.arrayContaining(['1', '2']))
    for (const url of skillRequests) {
      expect(url.searchParams.get('perPage')).toBe('50')
      expect(url.searchParams.get('group')).toBeNull()
      expect([...url.searchParams.keys()].sort()).toEqual(['page', 'perPage'])
    }
    const later = page.locator(`[data-technology="${LATER_SKILL}"]`)
    await expect(later).toBeVisible()
    await later.click()
    expect(await selectedSkillIds(page)).toContain(LATER_SKILL)
    await page.locator('[data-editor-save]').click()
    await page.reload()
    await editorSettled(page)
    expect(await selectedSkillIds(page)).toContain(LATER_SKILL)
  })

  test('does not expose a partial Skill vocabulary when page 2 fails, then retries completely', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { skills: skillsForPicker(), failVocabularyPage: 2 })
    await page.goto(`/dashboard/experiences/${EXP.noSkills}`)
    await expect(page.locator('[data-technologies-error]')).toBeVisible()
    await expect(page.locator('[data-technology]')).toHaveCount(0)
    await setBackendState(page, { failVocabularyPage: null })
    await page.reload()
    await editorSettled(page)
    await expect(page.locator(`[data-technology="${LATER_SKILL}"]`)).toBeVisible()
    await expect(page.locator('[data-technologies-error]')).toHaveCount(0)
  })

  /**
   * ⚠ THE NO-TOUCH INVARIANT, asserted on the REQUEST BODY and not only on the outcome.
   *
   * `technologyIds` REPLACES the whole set, and an OMITTED key PRESERVES it. So a payload builder
   * that omitted the key would pass an outcome-only version of this test — the three skills survive
   * precisely because nothing was sent — while making "remove every skill" inexpressible. Reading
   * what was actually on the wire is what separates the two implementations, and the unit suite
   * proved that separation by injecting the omission and watching ONLY the clear-case test fail.
   */
  test('a save that never touches the picker sends the relation back intact', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    // The fixture holds THREE skills, and the form must show them before anything is saved — a form
    // that rendered before the GET resolved would show none and then destroy them.
    expect(await selectedSkillIds(page)).toHaveLength(3)

    const sent = page.waitForRequest(req =>
      req.url().includes(`/admin/experiences/${EXP.current}`) && req.method() === 'PATCH'
    )
    await page.locator('[data-editor-save]').click()
    const body = (await sent).postDataJSON() as { technologyIds?: string[] }

    expect(body.technologyIds, 'the key must be SENT, not omitted').toBeDefined()
    expect(body.technologyIds).toHaveLength(3)

    await page.reload()
    await editorSettled(page)
    expect(await selectedSkillIds(page), 'still three after a round trip').toHaveLength(3)
  })

  /**
   * ⚠ THE DISCRIMINATING CASE. Omission preserves, so only clearing proves the key is sent.
   *
   * `EXP.noSkills` exists so "cleared to empty" stays distinguishable from "never had any": this
   * asserts the relation actually went from three to zero, against a fixture that started at zero
   * and would have looked identical.
   */
  test('deselecting every skill actually clears the relation', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    for (const id of await selectedSkillIds(page)) {
      await page.locator(`[data-technology="${id}"]`).click()
    }
    expect(await selectedSkillIds(page)).toHaveLength(0)

    const sent = page.waitForRequest(req =>
      req.url().includes(`/admin/experiences/${EXP.current}`) && req.method() === 'PATCH'
    )
    await page.locator('[data-editor-save]').click()
    const body = (await sent).postDataJSON() as { technologyIds?: string[] }

    expect(body.technologyIds, 'an empty array, NOT an absent key').toEqual([])

    await page.reload()
    await editorSettled(page)
    expect(await selectedSkillIds(page), 'the clear survived the round trip').toHaveLength(0)
  })

  test('adding a skill to a role that had none links exactly that one', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.noSkills}`)
    await editorSettled(page)
    expect(await selectedSkillIds(page)).toHaveLength(0)

    const first = page.locator('[data-technology]').first()
    const id = await first.getAttribute('data-technology')
    await first.click()
    await page.locator('[data-editor-save]').click()

    await page.reload()
    await editorSettled(page)
    expect(await selectedSkillIds(page)).toEqual([id])
  })
})

test.describe('the editor — isCurrent ⇄ endDate, a rule with NOTHING behind it on the server', () => {
  /**
   * The API accepts a current role that also has an end date — the write DTOs carry no cross-field
   * constraint and this lane's backend deliberately ACCEPTS the contradictory payload. So the
   * dashboard schema is the only thing enforcing it, and this is the only place it can be caught.
   */
  test('marks the END DATE field itself invalid, not merely the form', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.past}`)
    await editorSettled(page)

    // `past` has an end date. Ticking "current" creates the contradiction without typing a date.
    await page.locator('[data-editor-is-current]').click()
    await page.locator('[data-editor-save]').click()

    // ⚠ THE EXIT CRITERION, in a real browser. A `.refine()` at the object level would block the
    // save with an issue whose path is empty — no `UFormField` renders it, and the operator is
    // stopped by a message that appears nowhere near the control at fault. `aria-invalid` on the
    // input is the observable difference.
    await expect(page.locator('[data-editor-end-date][aria-invalid=true]'))
      .toBeVisible()
    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
  })

  test('does not silently clear the end date to make the form valid', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.past}`)
    await editorSettled(page)

    const before = await page.locator('[data-editor-end-date]').inputValue()
    expect(before).not.toBe('')
    await page.locator('[data-editor-is-current]').click()
    await page.locator('[data-editor-save]').click()

    // Blocking is the decision. Repairing the contradiction would destroy a date the operator typed,
    // invisibly — and there would be nothing left to observe.
    expect(await page.locator('[data-editor-end-date]').inputValue()).toBe(before)
  })
})

test.describe('the editor — a calendar date is not an instant', () => {
  /**
   * The stored value is a `date-time` at UTC midnight and the control is a `<input type="date">`.
   * Reading that through the browser's LOCAL wall-clock walks the date back a day for every
   * operator at a negative UTC offset, and each save writes the shifted date back.
   *
   * `playwright.config.ts` decides this browser's zone; the unit suite pins `America/New_York`
   * explicitly and asserts the pin, which is where the zone-shift is proven. This test's job is
   * narrower and still worth having: that the date the operator sees SURVIVES A SAVE unchanged, in
   * whatever zone this browser is actually running.
   */
  test('a save round trip does not move the start date', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    const start = await page.locator('[data-editor-start-date]').inputValue()
    expect(start, 'a date must actually be rendered, or this asserts nothing').toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await page.locator('[data-editor-save]').click()
    await page.reload()
    await editorSettled(page)

    expect(await page.locator('[data-editor-start-date]').inputValue()).toBe(start)
  })
})

test.describe('the editor — 422s land on the tab that caused them', () => {
  /**
   * Writes send `translations` as an ARRAY, and the 422 indexes THAT array. An Arabic-only payload
   * sends one entry, so `translations[0]` is Arabic — an implementation resolving against a
   * canonical `['en','ar']` would pin the error to the English tab, which the operator deliberately
   * left empty, while the real problem stayed invisible.
   */
  test('an over-long Arabic field activates the Arabic tab and marks the field', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    /**
     * ⚠ THE ARABIC FIELD MUST BE AUTHORED FROM ITS OWN TAB, AND THEN LEFT.
     *
     * The panels stay MOUNTED when hidden (`:unmount-on-hide="false"`), so the Arabic input exists
     * in the DOM from first paint — but it is not VISIBLE, and Playwright will not type into a
     * hidden control. The first version of this test filled it directly and timed out against an
     * element it had already resolved, which is what proves the panel is mounted rather than
     * discarded.
     *
     * Returning to the English tab before saving is what makes the assertion discriminating: the
     * operator is looking at English when the Arabic field is rejected, so an implementation that
     * did not switch tabs would leave the error invisible — the exact failure §14.1 forbids.
     */
    await page.locator('[data-editor-tab-fill^="ar:"]').click()
    // The client schema has no maximum length, so this reaches the server and comes back as a real
    // 422 with an array-indexed path — which is the whole point of provoking it this way.
    await page.locator('[data-editor-role="ar"]').fill('ط'.repeat(400))
    await page.locator('[data-editor-tab-fill^="en:"]').click()
    await expect(page.locator('[data-editor-panel="en"]')).toBeVisible()
    await expect(page.locator('[data-editor-role="ar"]'), 'authoring happens away from the Arabic tab').toBeHidden()

    await page.locator('[data-editor-save]').click()

    // The server's answer pulled the operator back to the tab that caused it.
    await expect(page.locator('[data-editor-tab-invalid="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-role="ar"]')).toBeVisible()
    await expect(page.locator('[data-editor-role="ar"]')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
  })

  /**
   * A 422 WITHOUT a field array must still reach the operator.
   *
   * The service rejects duplicate and unknown skill ids with a MESSAGE and no `errors[]`, unlike the
   * class-validator failures above. An editor that only rendered `errors[]` would swallow it and
   * show a save that silently did nothing. `failNextWrite` produces the same shape — a problem
   * document with a detail and no field array — which is the branch under test.
   *
   * ⚠ The unknown-skill 422 SPECIFICALLY cannot be provoked through this UI: the picker only offers
   * ids the vocabulary contains and de-duplicates its own selection, and no fixture is seeded with
   * an unlinkable id. The branch is covered; that particular trigger is not. Recorded rather than
   * papered over.
   */
  test('a failure with no field path is surfaced, not swallowed', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    await setBackendState(page, { failNextWrite: true })
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-editor-save-error]')).toBeVisible()
  })
})

test.describe('the editor — the request-state contract, criteria 3, 4 and 5', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend(page)
  })

  /**
   * §14.9 CRITERION 3 — no blank editable fields before the entity resolves.
   *
   * On THIS module that is not only an interaction rule: a form rendered before the GET resolves
   * holds an empty `technologyIds`, and submitting it would REPLACE a real relation with nothing,
   * with a 200 and no error. The skeleton is what makes that state unreachable.
   */
  test('shows an editor-shaped skeleton, never an empty form, while the role loads', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await setBackendState(page, { delayMs: 1500 })
    await page.goto(`/dashboard/experiences/${EXP.current}`)

    await expect(page.locator('[data-editor-loading]')).toBeVisible()
    await expect(page.locator('[data-editor-save]')).toHaveCount(0)
    await expect(page.locator('[data-technology]')).toHaveCount(0)

    await setBackendState(page, { delayMs: 0 })
    await editorSettled(page)
    await expect(page.locator('[data-editor-save]')).toBeVisible()
  })

  /** §14.9 CRITERION 4 — the save's loading state belongs to the action, and blocks a second one. */
  test('disables the save control while the save is in flight', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    await setBackendState(page, { delayMs: 1500 })
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-editor-save-state="saving"]')).toBeVisible()
    await expect(page.locator('[data-editor-save]')).toBeDisabled()
  })

  /** §14.9 CRITERION 5 — a destructive action is two-step, and separated from the primary one. */
  test('deletes a role only after an explicit confirmation', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.past}`)
    await editorSettled(page)

    // One click must NOT delete. If it did, the confirm control would never appear.
    await page.locator('[data-editor-delete]').click()
    await expect(page.locator('[data-editor-delete-confirm]')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(EXP.past))

    await page.locator('[data-editor-delete-confirm]').click()
    await page.waitForURL('**/dashboard/experiences')
    await listSettled(page)
    await expect(tableRowFor(page, EXP.past)).toHaveCount(0)
    await expect(rows(page)).toHaveCount(12)
  })

  test('answers a well-formed id that does not exist as NOT FOUND', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.absent}`)
    await editorSettled(page)

    // Distinct from forbidden and from a broken request (D11-2) — and the form must not be there.
    await expect(page.locator('[data-editor-unreadable]')).toBeVisible()
    await expect(page.locator('[data-editor-save]')).toHaveCount(0)
  })
})

test.describe('the editor — creating a role', () => {
  test('creates from an empty form and lands on the saved role', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences/new')
    await editorSettled(page)

    // A create form starts with NO relation, which is correct here precisely because there is no
    // stored relation to destroy.
    expect(await selectedSkillIds(page)).toHaveLength(0)

    await page.locator('[data-editor-start-date]').fill('2020-05-01')
    await page.locator('[data-editor-role="en"]').fill('Platform Engineer')
    await page.locator('[data-editor-company="en"]').fill('Northwind Labs')
    await page.locator('[data-editor-location="en"]').fill('Remote')
    await page.locator('[data-editor-impact="en"]').fill('- Built the deploy pipeline.')
    await page.locator('[data-editor-save]').click()

    // `replace`, not `push` — an empty create form is not a place to go Back to.
    await page.waitForURL(/\/dashboard\/experiences\/[0-9a-f-]{36}$/)
    await editorSettled(page)
    expect(await page.locator('[data-editor-start-date]').inputValue()).toBe('2020-05-01')
  })

  test('refuses to create a role written in no language, and says so per field', async ({ page, baseURL }) => {
    await signIn(page, 'en', baseURL!)
    await page.goto('/dashboard/experiences/new')
    await editorSettled(page)

    await page.locator('[data-editor-start-date]').fill('2020-05-01')
    await page.locator('[data-editor-save]').click()

    await expect(page.locator('[data-editor-error-summary]')).toBeVisible()
    // Still on the create route: nothing was written.
    await expect(page).toHaveURL(/\/dashboard\/experiences\/new$/)
  })
})

test.describe('the editor — bilingual, at the narrowest supported width', () => {
  test('renders Arabic chrome RTL on a COLD load, with the Arabic panel RTL too', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    // COLD, not a post-load toggle: the preference is set before the first paint, so a shell that
    // ignored the stored preference at boot fails here. A toggle-only test would pass anyway.
    await signIn(page, 'ar', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'rtl')
    await expectNoKeyPaths(page)

    // Field direction is independent of chrome: the panel follows Arabic chrome, while each
    // authored translation field retains its own content locale direction.
    await expect(page.locator('[data-editor-panel="ar"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-editor-panel="en"]')).not.toHaveAttribute('dir')
    await expect(page.locator('[data-editor-role="ar"]')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('[data-editor-role="en"]')).toHaveAttribute('dir', 'ltr')
  })

  test('renders English chrome LTR with no raw key paths', async ({ page, baseURL }) => {
    await page.setViewportSize(NARROW)
    await signIn(page, 'en', baseURL!)
    await page.goto(`/dashboard/experiences/${EXP.current}`)
    await editorSettled(page)

    await expect(shell(page)).toHaveAttribute('dir', 'ltr')
    await expectNoKeyPaths(page)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   `M1·U5` — ACCESSIBILITY AND THE NARROWEST SUPPORTED WIDTH, IN BOTH DASHBOARD LANGUAGES

   Run per locale rather than once, because the failures these catch are language-specific: an RTL
   shell composes differently, Arabic strings are a different length, and a control that fits at
   380px in English can overflow in Arabic. A single-language scan would report a clean bill for a
   surface that is broken for half its operators.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

for (const locale of ['en', 'ar'] as const) {
  test.describe(`a11y · ${locale}`, () => {
    test(`${locale}: the collection reports no axe violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto('/dashboard/experiences')
      await hydrated(page)
      await listSettled(page)

      // Unfiltered: no rule disabled, no selector excluded. A filtered scan is a scan that agrees
      // with whatever it was told to ignore.
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the collection's LOADING state is axe-clean too`, async ({ page, baseURL }) => {
      // A skeleton is a live region most a11y suites never scan, because it is gone by the time the
      // scan runs. Holding the response is what makes it scannable at all.
      await signIn(page, locale, baseURL as string)
      await setBackendState(page, { delayMs: 3000 })
      await page.goto('/dashboard/experiences')
      await hydrated(page)
      await expect(page.locator('[aria-busy=true]').first()).toBeVisible()

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])

      await setBackendState(page, { delayMs: 0 })
    })

    test(`${locale}: the EDITOR reports no axe violations`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await page.goto(`/dashboard/experiences/${EXP.current}`)
      await hydrated(page)
      await editorSettled(page)

      // The editor is the denser surface: tabs, a checkbox group, date inputs and a sticky action
      // bar. Scanning only the collection would leave every one of those unchecked.
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test(`${locale}: the EDITOR's LOADING state is axe-clean`, async ({ page, baseURL }) => {
      await signIn(page, locale, baseURL as string)
      await setBackendState(page, { delayMs: 3000 })
      await page.goto(`/dashboard/experiences/${EXP.current}`)
      await hydrated(page)
      await expect(page.locator('[data-editor-loading]')).toBeVisible()

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])

      await setBackendState(page, { delayMs: 0 })
    })

    test(`${locale}: the EDITOR does not overflow at 380px`, async ({ page, baseURL }) => {
      await page.setViewportSize(NARROW)
      await signIn(page, locale, baseURL as string)
      await page.goto(`/dashboard/experiences/${EXP.current}`)
      await hydrated(page)
      await editorSettled(page)

      // Assert the viewport actually applied before measuring against it — otherwise this passes at
      // whatever width the browser happened to use.
      expect(await page.evaluate(() => window.innerWidth)).toBe(NARROW.width)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      expect(
        overflow.scrollWidth,
        `the editor overflows at ${NARROW.width}px in ${locale}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  })
}
