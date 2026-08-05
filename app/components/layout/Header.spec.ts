// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Header from './Header.vue'

// The header's identity moved into `UiWordmark` (019). What must survive that move is the ACCESSIBLE
// NAME of the home link — it was the text alone before, with the Monolith hidden, and a lockup that
// starts contributing the mark (or replaces the text with an image or an aria-label) is the regression
// this file exists to catch. The drawer is checked alongside it because it renders the same identity from
// the same component and used to render it from a second, hand-matched class string.
//
// `UiWordmark`/`UiBrandMark` are deliberately NOT stubbed: they carry the text and the `aria-hidden`, so
// stubbing them would leave this file asserting nothing about the accessible name.
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => (key === 'brand.name' ? 'Eslam Muatamed' : key),
  locale: ref('en'),
  locales: ref([
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ar', name: 'العربية', dir: 'rtl' }
  ])
}))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UIcon: { template: '<i />', props: ['name'] },
  UButton: { template: '<a :href="to"><slot /></a>', props: ['to', 'icon'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  // Renders both named slots inline so the drawer's identity is assertable without opening a real dialog.
  USlideover: { template: '<div><slot name="title" /><slot name="body" /></div>', props: ['title', 'side', 'ui', 'open'] },
  LayoutLangToggle: { template: '<div />' },
  LayoutLangSwitchButton: { template: '<div />' },
  LayoutThemeToggle: { template: '<div />' }
}

describe('LayoutHeader', () => {
  it('keeps the home link\'s accessible name as the brand name text alone', async () => {
    const wrapper = await mountSuspended(Header, { global: { stubs } })
    const home = wrapper.findAll('a').find(a => a.attributes('href') === '/')

    expect(home).toBeDefined()
    // The name comes from the text content, so this is exactly what a screen reader announces.
    expect(home!.text()).toBe('Eslam Muatamed')

    // Nothing may override that text with a different string, and the mark must stay out of the name.
    expect(home!.attributes('aria-label')).toBeUndefined()
    expect(home!.find('svg').attributes('aria-hidden')).toBe('true')
    expect(home!.find('img').exists()).toBe(false)
  })

  it('renders the same lockup component in the bar and in the mobile drawer', async () => {
    const wrapper = await mountSuspended(Header, { global: { stubs } })

    // Two identities, one source. Before 019 these were two hand-matched class strings that disagreed on
    // the mark-to-word ratio (20px mark at 15px text in the bar, 18px at ~16px in the drawer).
    const words = wrapper.findAll('span.nameplate')
    expect(words).toHaveLength(2)
    expect(words.map(w => w.text())).toEqual(['Eslam Muatamed', 'Eslam Muatamed'])

    // Registers differ by design — the bar is the compact one and steps up at `md`.
    expect(words[0]!.element.parentElement?.className).toContain('text-[15px]')
    expect(words[1]!.element.parentElement?.className).toContain('text-lg')
  })

  it('still exposes the primary navigation and the persistent résumé/contact targets', async () => {
    const wrapper = await mountSuspended(Header, { global: { stubs } })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))

    for (const to of ['/projects', '/blog', '/experience', '/about', '/resume', '/contact']) {
      expect(hrefs).toContain(to)
    }
    expect(wrapper.find('nav').attributes('aria-label')).toBe('a11y.primaryNav')
  })
})
