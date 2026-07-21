// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import DatumLabel from './DatumLabel.vue'

// The section datum label (brand §5): eyebrow + caller-levelled heading over a hairline rule led by a
// violet tick. Latin eyebrows are tracked small-caps; Arabic keeps normal casing (letter-spacing breaks
// connected script — doc 03 §3), which is the locale branch exercised here.
// `t` is included (though the component only reads `locale`) because the global mock also feeds SEO
// plugins that call `i18n.t` during the nuxt test environment.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

describe('UiDatumLabel', () => {
  it('renders an eyebrow, a caller-levelled heading, the action slot, and the datum rule', async () => {
    const wrapper = await mountSuspended(DatumLabel, {
      props: { eyebrow: 'Selected work', title: 'Featured projects', as: 'h2' },
      slots: { action: '<a href="/projects">All</a>' }
    })
    expect(wrapper.find('h2').text()).toBe('Featured projects')
    const eyebrow = wrapper.find('p')
    expect(eyebrow.text()).toBe('Selected work')
    // Latin eyebrow is tracked small-caps.
    expect(eyebrow.classes().join(' ')).toContain('uppercase')
    expect(wrapper.find('a[href="/projects"]').exists()).toBe(true)
    // The datum rule carries the single accent occurrence (a violet tick).
    expect(wrapper.html()).toContain('--ui-primary')
  })

  it('omits the eyebrow when none is provided', async () => {
    const wrapper = await mountSuspended(DatumLabel, { props: { title: 'Contact' } })
    expect(wrapper.find('h2').text()).toBe('Contact')
    expect(wrapper.find('p').exists()).toBe(false)
  })
})
