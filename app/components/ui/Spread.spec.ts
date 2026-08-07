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

  // The single most important assertion here. `on-ink` is what keeps the technology brand dots
  // (JS #f7df1e and friends) on a dark ground; without it they composite onto a near-white surface in
  // light theme and effectively disappear. And NO `glass`: `.on-ink` is unlayered, so its opaque
  // background beats any surface utility — pairing the two renders a fully opaque panel that still
  // runs a live `backdrop-filter`, the "no visible glass, full compositing cost" defect D14-8 exists
  // to prevent. Verified in the browser (`backdrop-filter: none` on both ink-glass spreads).
  it('tone="ink-glass" KEEPS the ink token context and adds only the tint', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'ink-glass' }, global: { stubs } })
    expect(wrapper.classes()).toContain('on-ink')
    expect(wrapper.classes()).toContain('spread-tint')
    expect(wrapper.classes()).not.toContain('glass')
  })

  // The plain ink tone is retained and unchanged — `ink-glass` must not have quietly become an alias
  // for it, nor the reverse.
  it('tone="ink" stays the untinted opaque spread', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'ink' }, global: { stubs } })
    expect(wrapper.classes()).toContain('on-ink')
    expect(wrapper.classes()).not.toContain('spread-tint')
  })

  it('renders the requested `as` element', async () => {
    const wrapper = await mountSuspended(Spread, { props: { as: 'header' }, global: { stubs } })
    expect(wrapper.element.tagName.toLowerCase()).toBe('header')
  })
})
