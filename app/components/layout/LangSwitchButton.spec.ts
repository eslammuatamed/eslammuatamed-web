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

  // The accessible name must do BOTH jobs, and it previously did only one.
  //
  // It has to state the ACTION, because "EN" alone tells a screen-reader user nothing about what
  // activating it does — that was this test's original point and it still holds. But it must ALSO
  // CONTAIN THE VISIBLE TEXT: WCAG 2.5.3 (Label in Name) exists so a voice-control user who says
  // "click EN" actually activates the control they can see. Naming only the action failed that, and
  // Lighthouse flagged it as `label-content-name-mismatch` on `/projects`.
  //
  // Asserted as two properties rather than one literal, so the copy can be reworded in either
  // locale without silently dropping either guarantee.
  it('names the action AND contains the visible label (WCAG 2.5.3)', async () => {
    for (const [code, visible, action] of [
      ['en', 'EN', 'Switch to Arabic'],
      ['ar', 'AR', 'التبديل إلى الإنجليزية'],
    ] as const) {
      locale.value = code
      const wrapper = await mountSuspended(LangSwitchButton)
      const name = wrapper.find('[aria-label]').attributes('aria-label')!

      expect(name).toContain(visible)
      expect(name).toContain(action)
    }
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
