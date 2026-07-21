// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LangToggle from './LangToggle.vue'

// The two-locale toggle shows both choices as links; the active one is marked by aria-current AND a
// filled surface (a cue beyond colour), and targets resolve through switchLocalePath (fed to a plain
// link so it is not re-prefixed).
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: ref('en'),
  locales: ref([
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ar', name: 'العربية', dir: 'rtl' }
  ])
}))
mockNuxtImport('useSwitchLocalePath', () => () => (code: string) => (code === 'en' ? '/' : '/ar'))

describe('LayoutLangToggle', () => {
  it('renders both locales as links with resolved targets and accessible names', async () => {
    const wrapper = await mountSuspended(LangToggle)
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links.map(a => a.text())).toEqual(['EN', 'AR'])
    expect(links.map(a => a.attributes('href'))).toEqual(['/', '/ar'])
    // Accessible name = the visible EN/AR text (so it contains the label, WCAG 2.5.3); the full language
    // name is a supplementary title, and the group carries the "switch language" context.
    expect(links.map(a => a.attributes('title'))).toEqual(['English', 'العربية'])
  })

  it('marks the current locale with aria-current and a filled surface (not colour alone)', async () => {
    const wrapper = await mountSuspended(LangToggle)
    const [en, ar] = wrapper.findAll('a')
    expect(en!.attributes('aria-current')).toBe('true')
    expect(en!.classes()).toContain('bg-primary')
    expect(ar!.attributes('aria-current')).toBeUndefined()
    expect(ar!.classes()).not.toContain('bg-primary')
  })
})
