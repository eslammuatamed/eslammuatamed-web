// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RequestState from './RequestState.vue'

// RequestState (007 loading system) is the one place a data-backed region maps its request state to a
// branded presentation: a content-matching skeleton while pending, an inline error+retry, the #empty
// slot, or the content with a restrained revalidation overlay layered on top. Only one state renders at
// a time — never a stacked skeleton + overlay.
const stubs = {
  UiContentSkeleton: {
    props: ['variant', 'count'],
    template: '<div class="content-skeleton" :data-variant="variant" :data-count="count" />'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  UiDataLoadingOverlay: {
    props: ['show', 'label'],
    template: '<div class="overlay" :data-show="show" />'
  }
}

describe('UiRequestState', () => {
  it('shows the content-matching skeleton while pending, not the content', async () => {
    const wrapper = await mountSuspended(RequestState, {
      props: { pending: true, skeleton: 'work', count: 5 },
      slots: { default: '<div class="content">Content</div>' },
      global: { stubs }
    })
    const skeleton = wrapper.find('.content-skeleton')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.attributes('data-variant')).toBe('work')
    expect(skeleton.attributes('data-count')).toBe('5')
    expect(wrapper.find('.content').exists()).toBe(false)
  })

  it('renders an inline error and emits retry when error is true', async () => {
    const wrapper = await mountSuspended(RequestState, {
      props: { error: true },
      slots: { default: '<div class="content">Content</div>' },
      global: { stubs }
    })
    expect(wrapper.find('.state-error').exists()).toBe(true)
    expect(wrapper.find('.content').exists()).toBe(false)
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders the #empty slot when empty', async () => {
    const wrapper = await mountSuspended(RequestState, {
      props: { empty: true },
      slots: {
        default: '<div class="content">Content</div>',
        empty: '<p class="empty-state">Nothing here</p>'
      },
      global: { stubs }
    })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.content').exists()).toBe(false)
  })

  it('renders the content with the overlay reflecting `refreshing` when loaded', async () => {
    const wrapper = await mountSuspended(RequestState, {
      props: { refreshing: true },
      slots: { default: '<div class="content">Content</div>' },
      global: { stubs }
    })
    expect(wrapper.find('.content').exists()).toBe(true)
    expect(wrapper.find('.overlay').attributes('data-show')).toBe('true')
  })

  it('keeps the overlay hidden (show=false) when loaded and not refreshing', async () => {
    const wrapper = await mountSuspended(RequestState, {
      slots: { default: '<div class="content">Content</div>' },
      global: { stubs }
    })
    expect(wrapper.find('.content').exists()).toBe(true)
    expect(wrapper.find('.overlay').attributes('data-show')).toBe('false')
  })
})
