// @vitest-environment nuxt
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import BackToTop from './BackToTop.vue'

// The floating control returns to the top: a real button with a localized accessible name; it scrolls
// smoothly when motion is allowed and jumps immediately under prefers-reduced-motion.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = { UIcon: { template: '<i />', props: ['name'] } }

describe('UiBackToTop', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  })

  it('renders a button with a localized accessible name', async () => {
    const wrapper = await mountSuspended(BackToTop, { global: { stubs } })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('a11y.backToTop')
    expect(btn.attributes('type')).toBe('button')
  })

  it('smooth-scrolls to the top on click when motion is allowed', async () => {
    const wrapper = await mountSuspended(BackToTop, { global: { stubs } })
    await wrapper.find('button').trigger('click')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('jumps immediately under prefers-reduced-motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    const wrapper = await mountSuspended(BackToTop, { global: { stubs } })
    await wrapper.find('button').trigger('click')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})
