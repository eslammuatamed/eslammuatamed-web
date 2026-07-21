// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BrandMark from './BrandMark.vue'

// The Monolith mark (brand-identity.md §3) — inline SVG from the normative path, sized, decorative
// (the accessible identity is the adjacent HTML text, AP-9), so it is hidden from assistive tech.
describe('UiBrandMark', () => {
  it('renders the normative Monolith path as a decorative, sized svg', async () => {
    const wrapper = await mountSuspended(BrandMark, { props: { size: 32 } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('width')).toBe('32')
    expect(svg.attributes('height')).toBe('32')
    expect(svg.attributes('viewBox')).toBe('0 0 16 16')
    expect(wrapper.find('path').attributes('d')).toBe('M2,6 H6 V2 H14 V10 H10 V14 H2 Z')
  })

  it('defaults to a 24px mark', async () => {
    const wrapper = await mountSuspended(BrandMark)
    expect(wrapper.find('svg').attributes('width')).toBe('24')
  })
})
