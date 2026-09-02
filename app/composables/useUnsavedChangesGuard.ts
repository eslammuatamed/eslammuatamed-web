import { onBeforeRouteLeave } from 'vue-router'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Guard an editor against losing unsaved work, in both directions a browser can leave a page
 * (OD-8: keep the guard in v1, defer autosave — losing a long article to a stray navigation is the
 * worst Dashboard failure available).
 *
 * ── WHY THIS IS EXTRACTED AND THE TAB COMPONENT IS NOT ──────────────────────────────────────────
 * §14.6's rule is no abstraction before a SECOND real consumer. This one already had two before it
 * was written: `ProjectEditor.vue` and `ArticleEditor.vue` each implemented the same pair of hooks
 * independently, with the same `bypass` flag for their own post-save redirects. That is observed
 * duplication, not an anticipated need.
 *
 * `ProjectEditor` still carries its own copy: retrofitting it belongs to the Projects refit, not to
 * FE-2c. The abstraction is justified by the duplication EXISTING, not by both callers adopting it
 * in the same commit.
 *
 * ── TWO EXITS, NOT ONE ──────────────────────────────────────────────────────────────────────────
 * In-app navigation is caught by the router guard and asks with a `confirm()`. A reload or a tab
 * close is caught by `beforeunload`, which cannot show our own message — the browser chooses the
 * wording — so it only needs to signal that there is something to lose.
 *
 * `bypass` exists because an editor performs its OWN navigation after a successful save or delete,
 * and challenging the operator on the redirect they just earned is the guard firing on precisely
 * the case it should not.
 */
export function useUnsavedChangesGuard(options: {
  /** Is there unsaved work right now? */
  dirty: MaybeRefOrGetter<boolean>
  /** Skip the guard — set before a navigation the component performs itself. */
  bypass: MaybeRefOrGetter<boolean>
  /** The confirmation text for in-app navigation. Localized by the caller. */
  message: () => string
}): void {
  const shouldGuard = () => !toValue(options.bypass) && toValue(options.dirty)

  onBeforeRouteLeave(() => (shouldGuard() ? window.confirm(options.message()) : true))

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    // No custom message is possible here; the browser owns the wording. `preventDefault()` is what
    // makes it ask at all.
    if (shouldGuard()) event.preventDefault()
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
