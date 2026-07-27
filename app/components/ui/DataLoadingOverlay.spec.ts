// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import DataLoadingOverlay from './DataLoadingOverlay.vue'

// DataLoadingOverlay (007 loading system) is the revalidation state layered over content already on
// screen while it refetches. It renders nothing when `show` is false, and otherwise exposes an
// accessible, localized "Updating" status (never a bare spinner or fake progress).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiBrandMark: { template: '<i />', props: ['size'] }
}

describe('UiDataLoadingOverlay', () => {
  it('renders nothing when show is false', async () => {
    const wrapper = await mountSuspended(DataLoadingOverlay, { props: { show: false }, global: { stubs } })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('shows an accessible status region with the localized "Updating" label when show is true', async () => {
    const wrapper = await mountSuspended(DataLoadingOverlay, { props: { show: true }, global: { stubs } })
    const status = wrapper.find('[role="status"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.text()).toContain('state.updating')
  })

  it('uses a custom label when provided', async () => {
    const wrapper = await mountSuspended(DataLoadingOverlay, {
      props: { show: true, label: 'Refreshing projects' },
      global: { stubs }
    })
    expect(wrapper.find('[role="status"]').text()).toContain('Refreshing projects')
  })
})
