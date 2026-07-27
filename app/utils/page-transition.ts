/**
 * The public route transition, and the point at which a deferred locale switch is released.
 *
 * Extracted from `app.vue` so the ORDERING CONTRACT is unit-testable. The contract is not "a page
 * fades"; it is that a locale change reaches the DOM exactly once, and only after the outgoing page
 * has left. `nuxt.config`'s `i18n.skipSettingLocaleOnNavigate` suspends the switch, and
 * `onBeforeEnter` — which Vue calls after the leave completes under `mode: 'out-in'`, before the
 * incoming page is revealed — is where it is released.
 *
 * Getting that backwards is invisible in a screenshot and obvious to a user: `<html dir>` flips
 * while the previous page is still on screen, mirroring it mid-exit, and the switch reads as two
 * separate visual events instead of one.
 */

/** Vue transition hooks are fire-and-forget: the return value is discarded, never awaited. */
export type FinalizeLocale = () => Promise<void> | void

export interface PageTransition {
  name: string
  mode: 'out-in'
  onBeforeEnter: () => void
}

/**
 * Build the page-transition definition bound to a locale-finalizer.
 *
 * `mode: 'out-in'` is load-bearing twice over: only one page is ever in flow (no overlap jump, no
 * cumulative layout shift), and it is what guarantees `onBeforeEnter` fires with the outgoing page
 * already gone. Switching to the default simultaneous mode would silently reintroduce the defect.
 *
 * @param finalizeLocale `finalizePendingLocaleChange` from `useI18n()`. It is a no-op when no
 *   switch is pending, so same-locale navigations are unaffected.
 */
export function createPageTransition(finalizeLocale: FinalizeLocale): PageTransition {
  return {
    name: 'page-spread',
    mode: 'out-in',
    onBeforeEnter: () => {
      // Vue discards this hook's return value, so there is nothing to await into. The rejection is
      // swallowed deliberately rather than left floating: if loading the incoming locale's messages
      // fails, i18n keeps the current locale and the page still enters — a partially-translated page
      // is a better outcome than an unhandled rejection and a navigation that never completes.
      try {
        Promise.resolve(finalizeLocale()).catch(() => {})
      } catch {
        // A finalizer that throws synchronously must not escape into Vue's transition machinery.
      }
    }
  }
}
