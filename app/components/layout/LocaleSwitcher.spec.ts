// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LocaleSwitcher from './LocaleSwitcher.vue'

// The locale switch must preserve the current route (flow F-P5): each menu item's target is built
// from `useSwitchLocalePath(code)`, which resolves the counterpart path for THIS route rather than
// dropping the visitor on the homepage. We assert the switcher asks switchLocalePath for every
// locale — that is route preservation by construction.
const { switchSpy } = vi.hoisted(() => ({
  switchSpy: vi.fn((code: string) => `/switched/${code}`)
}))

mockNuxtImport('useSwitchLocalePath', () => () => switchSpy)

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: ref('en'),
  locales: ref([
    { code: 'en', name: 'English' },
    { code: 'ar', name: 'العربية' }
  ])
}))

describe('LocaleSwitcher', () => {
  it('builds every locale target from switchLocalePath so the route is preserved', async () => {
    await mountSuspended(LocaleSwitcher, {
      global: { stubs: { UDropdownMenu: true, UButton: true } }
    })

    expect(switchSpy).toHaveBeenCalledWith('en')
    expect(switchSpy).toHaveBeenCalledWith('ar')
  })
})
