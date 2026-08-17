import type { MaybeRefOrGetter } from 'vue'

/**
 * The caller-side half of the `UiRequestState` contract (007 loading system).
 *
 * `UiRequestState` deliberately takes RESOLVED states — `pending` meaning "initial load, nothing on
 * screen yet" and `refreshing` meaning "content already visible, revalidating" — so that exactly one
 * state renders at a time. Deriving those two from a raw request is therefore the caller's job, and
 * it was written out by hand at NINE sites: the five `home/` sections (whose `pending` is a boolean
 * prop passed down by the page) and the four listing/detail pages `about`, `experience`,
 * `projects/index`, `blog/index` (whose `pending` is `status.value === 'pending'` from
 * `useAsyncData`). The nine copies were identical.
 *
 * ## Why this is shared rather than nine call sites
 *
 * The same reason `useSettingsRead` and `utils/list-query.ts` are shared in this codebase: the
 * skeleton-vs-overlay split is ONE rule, and a rule spelled out nine times is a rule that can drift
 * eight ways. Changing when a revalidation shows an overlay instead of a skeleton is a single
 * decision about how the site behaves while loading; it should be a single edit, and any site that
 * was missed would degrade silently — the wrong branch still renders something plausible, so neither
 * typecheck nor a smoke test would catch it.
 *
 * What is deliberately NOT shared is how each caller decides `hasData`. That genuinely differs —
 * `SelectedWork` filters to `featured` and caps at 3, `Writing` slices to 3, `Capabilities` reads
 * `props.skills` directly, and the pages test `!!data.value`. Folding those into one helper would
 * hide real per-surface differences behind a shared name, which is the failure mode
 * `utils/list-query.ts` documents for the filter rules it refused to share.
 *
 * ## `show` is for the sections only
 *
 * A home section removes itself from the page when it has nothing to say (`NFR-DEGRADE`: empty →
 * section omitted), so it needs `show` to drive its own outer wrapper — which sits OUTSIDE
 * `UiRequestState`, and is why this derivation cannot simply move into that component. A page always
 * renders, so its callers ignore `show`.
 *
 * Accepts refs, getters or plain values via `toValue`, so a component can pass `() => props.pending`
 * and a page can pass `() => status.value === 'pending'` without either shape leaking in here.
 */
export function useRequestState(
  pending: MaybeRefOrGetter<boolean>,
  hasData: MaybeRefOrGetter<boolean>,
  error?: MaybeRefOrGetter<boolean>
) {
  /** Initial load with nothing on screen → skeleton. */
  const initialPending = computed(() => toValue(pending) && !toValue(hasData))
  /** Content already on screen and refetching → overlay, never a second skeleton. */
  const refreshing = computed(() => toValue(pending) && toValue(hasData))
  /** Render the section at all: it is doing something, it failed, or it has content. */
  const show = computed(() => toValue(pending) || Boolean(toValue(error)) || toValue(hasData))

  return { initialPending, refreshing, show }
}
