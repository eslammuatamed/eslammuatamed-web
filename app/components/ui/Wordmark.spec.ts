// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Wordmark from './Wordmark.vue'

// The nameplate lockup (019). Two properties are worth a test and they are different in kind:
//   1. ACCESSIBILITY — the identity is real text and the mark contributes nothing to it (AP-9). This is
//      the assertion that catches "pretty but unreadable to a screen reader".
//   2. ONE LOCKUP — the mark and gap are sized in `em` against the register the root carries, which is
//      what makes both call sites render the same identity. A px mark size passed per surface is exactly
//      the defect this component replaced, so the `em` sizing is asserted, not assumed.
// `UiBrandMark` is deliberately NOT stubbed: `aria-hidden` lives in the real component and stubbing it
// would make the accessibility assertion test the stub.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => (key === 'brand.name' ? 'Eslam Muatamed' : key), locale: ref('en') }))

describe('UiWordmark', () => {
  it('renders the name as real text, with the mark hidden from assistive tech', async () => {
    const wrapper = await mountSuspended(Wordmark)

    // Real text, not an image of the name and not an `aria-label` standing in for missing content.
    expect(wrapper.text()).toBe('Eslam Muatamed')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[aria-label]').exists()).toBe(false)

    // The accessible name of the lockup is the text ALONE: the mark is decorative, so nothing else may
    // contribute. `svg` with `aria-hidden` is the only non-text node.
    const mark = wrapper.find('svg')
    expect(mark.exists()).toBe(true)
    expect(mark.attributes('aria-hidden')).toBe('true')
    expect(mark.attributes('focusable')).toBe('false')
    expect(mark.text()).toBe('')
  })

  it('applies the Latin nameplate treatment to the word, and the display face rather than the nameplate face', async () => {
    const wrapper = await mountSuspended(Wordmark)
    const word = wrapper.find('span.nameplate')

    expect(word.exists()).toBe(true)
    expect(word.text()).toBe('Eslam Muatamed')

    // `font-nameplate` selects Reem Kufi under the Arabic root and Reem Kufi is the Arabic HERO face only
    // (D03-12). If it ever appears here, the Arabic chrome silently changes face and pulls an extra woff2
    // on every /ar route — a regression no CSS diff would show, because nothing in main.css would change.
    expect(word.classes()).not.toContain('font-nameplate')
    expect(word.classes()).toContain('font-display')

    // Load-bearing at 320px: the name wraps and breaks the header's fixed height without it.
    expect(word.classes()).toContain('whitespace-nowrap')

    // Still 600 under the Arabic root, where `.nameplate` does not apply — this utility is what keeps the
    // Arabic chrome at the weight it has always had.
    expect(word.classes()).toContain('font-semibold')
  })

  it('sizes the mark and the gap in `em`, so one ratio covers every register', async () => {
    const wrapper = await mountSuspended(Wordmark)

    // The defect this replaces: a px mark size cannot follow the header's responsive 15px → 18px step, so
    // the bar and the drawer rendered the mark at two different ratios of the word.
    expect(wrapper.find('svg').classes()).toContain('size-[1.1em]')
    expect(wrapper.find('span').classes()).toContain('gap-[0.55em]')
  })

  it('covers both registers in use, with the responsive step on the header bar', async () => {
    const bar = await mountSuspended(Wordmark, { props: { size: 'sm' } })
    expect(bar.find('span').classes()).toEqual(expect.arrayContaining(['text-[15px]', 'md:text-lg']))

    const panel = await mountSuspended(Wordmark, { props: { size: 'md' } })
    expect(panel.find('span').classes()).toContain('text-lg')
    expect(panel.find('span').classes()).not.toContain('text-[15px]')

    // Default is the bar: the header renders it without a prop.
    const fallback = await mountSuspended(Wordmark)
    expect(fallback.find('span').classes()).toContain('text-[15px]')
  })
})
