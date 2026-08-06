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
    // A glass spread must NOT re-point the semantic tokens the way an ink spread does: the surface is
    // translucent over the page, so the page's own theme is still the correct one for its content.
    expect(wrapper.classes()).not.toContain('on-ink')
    expect(wrapper.classes()).not.toContain('spread-glass-strong')
  })

  it('tone="glass-strong" is the glass tone PLUS the stronger wash, never a replacement for it', async () => {
    const wrapper = await mountSuspended(Spread, { props: { tone: 'glass-strong' }, global: { stubs } })
    expect(wrapper.classes()).toContain('spread-glass-strong')
    // The strong tone only adds a second tint layer; if it ever stopped carrying the base classes it
    // would lose the blur and the gated surface and would render as a bare violet block.
    expect(wrapper.classes()).toContain('glass')
    expect(wrapper.classes()).toContain('bg-[var(--glass-surface-elevated)]')
  })

  it('renders the requested `as` element', async () => {
    const wrapper = await mountSuspended(Spread, { props: { as: 'header' }, global: { stubs } })
    expect(wrapper.element.tagName.toLowerCase()).toBe('header')
  })
})
