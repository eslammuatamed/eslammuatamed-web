// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LangSwitchButton from './LangSwitchButton.vue'

const locale = ref<'en' | 'ar'>('en')
const messages: Record<string, string> = {
  en: 'Switch to Arabic',
  ar: 'التبديل إلى الإنجليزية'
}

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => (key === 'a11y.switchToOtherLocale' ? messages[locale.value]! : key),
  locale,
  locales: ref([
    { code: 'en', name: 'English' },
    { code: 'ar', name: 'العربية' }
  ])
}))

describe('LayoutLangSwitchButton', () => {
  it('shows the CURRENT locale code on an English route', async () => {
    locale.value = 'en'
    const wrapper = await mountSuspended(LangSwitchButton)
    expect(wrapper.text().trim()).toBe('EN')
  })

  it('shows the CURRENT locale code on an Arabic route', async () => {
    locale.value = 'ar'
    const wrapper = await mountSuspended(LangSwitchButton)
    expect(wrapper.text().trim()).toBe('AR')
  })

  // The visible label is the current locale; the accessible name has to state the ACTION, because
  // "EN" on its own tells a screen-reader user nothing about what activating it does.
  it('names the action, not the code, for assistive technology', async () => {
    locale.value = 'en'
    const en = await mountSuspended(LangSwitchButton)
    expect(en.find('[aria-label]').attributes('aria-label')).toBe('Switch to Arabic')

    locale.value = 'ar'
    const ar = await mountSuspended(LangSwitchButton)
    expect(ar.find('[aria-label]').attributes('aria-label')).toBe('التبديل إلى الإنجليزية')
  })

  it('targets the OTHER locale', async () => {
    locale.value = 'en'
    const wrapper = await mountSuspended(LangSwitchButton)
    expect(wrapper.attributes('locale') ?? wrapper.html()).toContain('ar')
  })

  // 36x36 minimum touch target (size-9 = 2.25rem = 36px).
  it('keeps a 36px touch target', async () => {
    locale.value = 'en'
    const wrapper = await mountSuspended(LangSwitchButton)
    expect(wrapper.find('[aria-label]').classes()).toContain('size-9')
  })
})
