// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Section from './Section.vue'

// The section rhythm wrapper — one place the home's vertical rhythm and surface pacing live. The
// `elevated` variant steps the surface up and fences it with hairline rules (depth from borders, not
// shadows — D03-3).
const stubs = { UContainer: { template: '<div class="ucontainer"><slot /></div>' } }

describe('UiSection', () => {
  it('renders a plain content section on the base surface', async () => {
    const wrapper = await mountSuspended(Section, { global: { stubs }, slots: { default: '<p>body</p>' } })
    const section = wrapper.find('section')
    expect(section.exists()).toBe(true)
    expect(wrapper.text()).toContain('body')
    expect(section.classes().join(' ')).not.toContain('bg-elevated')
  })

  it('steps the surface up and fences it for the elevated variant', async () => {
    const wrapper = await mountSuspended(Section, { props: { variant: 'elevated' }, global: { stubs } })
    const cls = wrapper.find('section').classes().join(' ')
    expect(cls).toContain('bg-elevated')
    expect(cls).toContain('border-y')
  })
})
