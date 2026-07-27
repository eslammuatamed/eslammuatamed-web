import { describe, expect, it, vi } from 'vitest'
import { createPageTransition } from './page-transition'

/**
 * These tests pin the ORDERING CONTRACT behind the locale-switch fix, not the animation.
 *
 * The defect they guard against: `<html dir>` (and every other locale-reactive binding) committing
 * while the outgoing page is still painted, which mirrors the previous page mid-exit and makes one
 * locale switch read as two visual events. The guarantee is structural — the locale switch is
 * suspended by `i18n.skipSettingLocaleOnNavigate` and can only be released from `onBeforeEnter`,
 * which `mode: 'out-in'` schedules after the leave completes.
 */
describe('createPageTransition — the locale commit is gated on the page having left', () => {
  it('releases the pending locale switch from onBeforeEnter', () => {
    const finalize = vi.fn()
    const transition = createPageTransition(finalize)

    expect(finalize).not.toHaveBeenCalled()
    transition.onBeforeEnter()
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  // `out-in` is what makes onBeforeEnter mean "the old page is gone". Under the default
  // simultaneous mode the incoming page enters while the outgoing one is still leaving, so the
  // commit would land on a frame that still shows the previous page — the original defect.
  it('uses out-in, which is what makes onBeforeEnter safe', () => {
    expect(createPageTransition(vi.fn()).mode).toBe('out-in')
  })

  it('keeps the branded transition name so the CSS still applies', () => {
    expect(createPageTransition(vi.fn()).name).toBe('page-spread')
  })

  // Vue discards transition-hook return values, so a rejected finalizer has nowhere to surface
  // except as an unhandled rejection. It must be absorbed: the page still enters.
  it('absorbs a rejecting finalizer instead of leaving an unhandled rejection', async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error('locale messages failed to load')))
    const transition = createPageTransition(rejecting)

    expect(() => transition.onBeforeEnter()).not.toThrow()
    // Let the rejection settle; an unabsorbed one would trip vitest's unhandled-rejection guard.
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(rejecting).toHaveBeenCalledTimes(1)
  })

  it('absorbs a finalizer that throws synchronously', () => {
    const throwing = vi.fn(() => { throw new Error('boom') })
    expect(() => createPageTransition(throwing).onBeforeEnter()).not.toThrow()
  })

  it('tolerates a synchronous finalizer', () => {
    const sync = vi.fn(() => undefined)
    expect(() => createPageTransition(sync).onBeforeEnter()).not.toThrow()
    expect(sync).toHaveBeenCalledTimes(1)
  })

  // Same-locale navigation: `finalizePendingLocaleChange` is a no-op when nothing is pending, so
  // calling it on every enter is correct and must stay unconditional — a guard here would be a
  // second place for the ordering to go wrong.
  it('calls the finalizer on every enter, not only on locale changes', () => {
    const finalize = vi.fn()
    const transition = createPageTransition(finalize)
    transition.onBeforeEnter()
    transition.onBeforeEnter()
    transition.onBeforeEnter()
    expect(finalize).toHaveBeenCalledTimes(3)
  })
})
