// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRequestState } from './useRequestState'

/**
 * The skeleton-vs-overlay split, which is the one thing this composable exists to state once.
 *
 * ⚠ The nine call sites it replaced were covered only for `initialPending` (a skeleton appears while
 * loading with nothing on screen) and `show`. NOTHING asserted `refreshing` — the branch that keeps
 * content readable under an overlay during a revalidation. That gap is why a wrong `refreshing`
 * could have survived the extraction green: when there is no data the `initialPending` branch wins
 * and `refreshing` is never read, so every existing test passes either way. The `pending WITH data`
 * cases below are the discriminating ones.
 */

describe('useRequestState', () => {
  it('shows a skeleton on the initial load, when nothing is on screen yet', () => {
    const { initialPending, refreshing, show } = useRequestState(true, false)
    expect(initialPending.value).toBe(true)
    expect(refreshing.value).toBe(false)
    expect(show.value).toBe(true)
  })

  it('shows an overlay instead of a skeleton when content is already on screen', () => {
    const { initialPending, refreshing, show } = useRequestState(true, true)
    expect(initialPending.value).toBe(false)
    expect(refreshing.value).toBe(true)
    expect(show.value).toBe(true)
  })

  it('never reports both states at once, in any combination', () => {
    for (const pending of [true, false]) {
      for (const hasData of [true, false]) {
        const { initialPending, refreshing } = useRequestState(pending, hasData)
        expect(initialPending.value && refreshing.value).toBe(false)
      }
    }
  })

  it('is idle once loaded, with neither loading presentation', () => {
    const { initialPending, refreshing, show } = useRequestState(false, true)
    expect(initialPending.value).toBe(false)
    expect(refreshing.value).toBe(false)
    expect(show.value).toBe(true)
  })

  it('hides the section when it is idle, empty and not erroring', () => {
    const { show } = useRequestState(false, false, false)
    expect(show.value).toBe(false)
  })

  it('still shows the section when a failed read left it empty, so the retry is reachable', () => {
    const { initialPending, refreshing, show } = useRequestState(false, false, true)
    expect(show.value).toBe(true)
    expect(initialPending.value).toBe(false)
    expect(refreshing.value).toBe(false)
  })

  it('treats an omitted error as no error', () => {
    expect(useRequestState(false, false).show.value).toBe(false)
  })

  it('moves from skeleton to overlay reactively when the first page of data lands', () => {
    const pending = ref(true)
    const hasData = ref(false)
    const { initialPending, refreshing } = useRequestState(pending, hasData)

    expect(initialPending.value).toBe(true)
    expect(refreshing.value).toBe(false)

    // Data arrives while a revalidation is still in flight: the skeleton must give way to the
    // overlay rather than staying up over content the visitor can already read.
    hasData.value = true
    expect(initialPending.value).toBe(false)
    expect(refreshing.value).toBe(true)

    pending.value = false
    expect(initialPending.value).toBe(false)
    expect(refreshing.value).toBe(false)
  })

  it('accepts getters, which is how both call-site shapes reach it', () => {
    // A `home/` section passes `() => props.pending`; a page passes
    // `() => status.value === 'pending'`. Neither shape may leak into the composable.
    const status = ref<'idle' | 'pending'>('pending')
    const data = ref<string | null>(null)
    const { initialPending, refreshing } = useRequestState(
      () => status.value === 'pending',
      () => !!data.value
    )

    expect(initialPending.value).toBe(true)
    data.value = 'loaded'
    expect(refreshing.value).toBe(true)
    status.value = 'idle'
    expect(refreshing.value).toBe(false)
  })
})
