// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Spread from './Spread.vue'

// Spread is the page-frame primitive for the public site (007): tone drives the surface. "ink" swaps
// to the dark full-bleed class; "lift" steps the surface up with a hairline fence; the default "paper"
// tone adds neither (optionally ruled with a top hairline). It renders whichever element `as` requests.
const stubs = {
  UContainer: { template: '<div><slot /></div>' }
}

describe('UiSpread', () => {
  it('tone="ink" applies the on-ink surface class', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'ink' }, global: { stubs } })
    expect(wrapper.classes()).toContain('on-ink')
    expect(wrapper.classes()).not.toContain('bg-elevated')
  })

  it('tone="lift" applies bg-elevated and border-y', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'lift' }, global: { stubs } })
    expect(wrapper.classes()).toContain('bg-elevated')
    expect(wrapper.classes()).toContain('border-y')
  })

  it('default tone="paper" adds neither the ink nor the lift classes', async () => {
    const wrapper = await mountSuspended(Spread, { global: { stubs } })
    expect(wrapper.classes()).not.toContain('on-ink')
    expect(wrapper.classes()).not.toContain('bg-elevated')
    expect(wrapper.classes()).not.toContain('border-y')
    expect(wrapper.classes()).not.toContain('border-t')
  })

  it('ruled adds a top hairline on the paper tone', async () => {
    const wrapper = await mountSuspended(Spread, { props: { ruled: true }, global: { stubs } })
    expect(wrapper.classes()).toContain('border-t')
  })

  // The glass tones are asserted class-by-class rather than against a whole string, because each
  // class is load-bearing for a DIFFERENT reason and they fail independently:
  //   `glass`                              — the blur + edge lighting, and the `@supports` /
  //                                          reduced-transparency gating that rides on it
  //   `bg-[var(--glass-surface-elevated)]` — D14-8 requires the surface be an arbitrary UTILITY; a
  //                                          background declared in `@layer components` loses to
  //                                          Nuxt UI's `bg-default` and silently yields an opaque
  //                                          panel that still pays for a live backdrop-filter
  //   `border-y border-default`            — D03-3's border-led depth, which glass supplements
  // A single `toBe('glass border-y …')` assertion would pass or fail as one lump and would not say
  // which guarantee broke.
  it('tone="glass" composes the blur, the gated surface utility and the semantic border', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'glass' }, global: { stubs } })
    expect(wrapper.classes()).toContain('glass')
    expect(wrapper.classes()).toContain('bg-[var(--glass-surface-elevated)]')
    expect(wrapper.classes()).toContain('border-y')
    expect(wrapper.classes()).toContain('border-default')
    expect(wrapper.classes()).toContain('spread-tint')
    // A plain glass spread must NOT re-point the semantic tokens the way an ink spread does: the
    // surface is translucent over the page, so the page's own theme is right for its content.
    expect(wrapper.classes()).not.toContain('on-ink')
  })

  // The single most important assertion in this file. `on-ink` is what keeps the technology brand
  // dots (JS #f7df1e and friends) on a dark ground; without it they composite onto a near-white
  // surface in light theme and effectively disappear — a WCAG regression that is release-blocking
  // here, and one that no snapshot of the component alone would reveal.
  it('tone="ink-glass" KEEPS the ink token context and adds only the tint', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'ink-glass' }, global: { stubs } })
    expect(wrapper.classes()).toContain('on-ink')
    expect(wrapper.classes()).toContain('spread-tint')
    // NO `backdrop-filter` on an ink spread. `.on-ink` is unlayered, so its opaque background beats
    // any surface utility — pairing it with `.glass` produced a fully opaque panel that still ran a
    // live backdrop-filter (verified in the browser): the exact "no visible glass, full compositing
    // cost" defect D14-8 exists to prevent. This assertion is what stops it coming back.
    expect(wrapper.classes()).not.toContain('glass')
    expect(wrapper.classes()).not.toContain('bg-[var(--glass-surface)]')
  })

  // The ink tone is retained and unchanged — it is still the plain opaque feature spread, and
  // `ink-glass` must not have quietly become an alias for it (nor the reverse).
  it('tone="ink" stays the untinted opaque spread', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'ink' }, global: { stubs } })
    expect(wrapper.classes()).toContain('on-ink')
    expect(wrapper.classes()).not.toContain('glass')
    expect(wrapper.classes()).not.toContain('spread-tint')
  })

  it('renders the requested `as` element', async () => {
    const wrapper = await mountSuspended(Spread, { props: { as: 'header' }, global: { stubs } })
    expect(wrapper.element.tagName.toLowerCase()).toBe('header')
  })
})
