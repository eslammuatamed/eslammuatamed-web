// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LocaleSwitcher from './LocaleSwitcher.vue'

// Regression for the AR→EN switch (M1 blocker). The sibling LocaleSwitcher.spec mocks
// useSwitchLocalePath, so it passes even while the rendered link is wrong. This spec wires the
// REAL i18n module AND the REAL UDropdownMenu → ULink render path (forced open), then reads the
// actual href — the defect lived in ULink re-localizing the already-resolved switchLocalePath
// output, not in switchLocalePath itself.

// Renders LocaleSwitcher, forcing the dropdown open (defaultOpen falls through to UDropdownMenu)
// and returns the "English" item's rendered href. Unmounts so teleported anchors don't leak
// into the next case.
async function englishHref(component: unknown, route: string) {
  const wrapper = await mountSuspended(component as never, {
    route,
    attrs: { defaultOpen: true }
  })
  try {
    const anchor = [...document.querySelectorAll('a')].find(a => a.textContent?.includes('English'))
    return anchor?.getAttribute('href')
  } finally {
    wrapper.unmount()
  }
}

// Wrapper that registers per-locale slugs (the F-P5 setI18nParams contract adoption) before the
// switcher reads them — the parent setup runs first, so route.meta carries the params.
const SwitcherWithSlugs = defineComponent({
  inheritAttrs: false,
  setup(_props, { attrs }) {
    useSetI18nParams()({ en: { slug: 'building-x' }, ar: { slug: 'binaa-x' } })
    return () => h(LocaleSwitcher, attrs)
  }
})

describe('LocaleSwitcher — real i18n + real dropdown wiring', () => {
  it('AR list page: the English item links to /blog, not the current /ar/blog', async () => {
    expect(await englishHref(LocaleSwitcher, '/ar/blog')).toBe('/blog')
  })

  it('AR article with registered slugs: the English item is /blog/<en-slug>, no /ar prefix', async () => {
    expect(await englishHref(SwitcherWithSlugs, '/ar/blog/binaa-x')).toBe('/blog/building-x')
  })
})
