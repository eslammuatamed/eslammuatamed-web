import type { Page } from '@playwright/test'

/**
 * Wait until Vue has actually hydrated before driving an interactive control.
 *
 * WHY THIS IS NEEDED AT ALL. Public routes are server-rendered, so a button is present, visible and
 * enabled in the DOM well before its handler exists. Playwright's actionability checks are satisfied
 * by the SSR markup alone, so a click can land on a control that is not yet wired. What happens next
 * depends on the control, and neither failure mode looks like a timing bug:
 *
 *   - a `<button @click>` toggle silently does nothing — no navigation, no request, no error;
 *   - a `<button type="submit">` inside a `<form>` falls through to the browser's OWN native
 *     submission, a plain POST to the current document URL, which never reaches the API at all.
 *
 * THE SIGNAL IS REAL, NOT A SLEEP. Vue sets `__vue_app__` on the mount root the instant `mount()`
 * completes, so this waits for the actual event rather than for a duration that happens to be long
 * enough on the machine that wrote it.
 *
 * WHY IT IS SHARED. This defect class is load-sensitive: the set of tests that trip on it changes
 * between runs, because it depends on how long hydration takes relative to Playwright's click. It was
 * first fixed locally in `blog-filter.spec.ts`; three further specs then failed the same way. A
 * per-file copy meant the next affected spec started from scratch, so the helper lives here instead.
 *
 * THIS IS A TEST-ONLY CONCERN, deliberately. A real visitor cannot click faster than hydration on
 * these pages, and every control that merely NAVIGATES is a real link that works with no JavaScript.
 * Only genuinely interactive controls — toggles, form submission, retry — need the wait.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return Boolean(root?.__vue_app__)
  })
}
