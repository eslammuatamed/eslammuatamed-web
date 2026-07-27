// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SectionHead from './SectionHead.vue'

// SectionHead is the one recurring heading device for public spreads (007): a kicker eyebrow over a
// display title, with an optional trailing action slot. `accent` swaps the eyebrow to the violet tone.
describe('UiSectionHead', () => {
  it('renders the eyebrow and title', async () => {
    const wrapper = await mountSuspended(SectionHead, { props: { eyebrow: 'Selected work', title: 'Featured projects' } })
    expect(wrapper.find('p').text()).toBe('Selected work')
    expect(wrapper.find('h2').text()).toBe('Featured projects')
  })

  it('accent switches the eyebrow to text-primary; default is text-dimmed', async () => {
    const plain = await mountSuspended(SectionHead, { props: { eyebrow: 'Eyebrow', title: 'Title' } })
    expect(plain.find('p').classes()).toContain('text-dimmed')
    expect(plain.find('p').classes()).not.toContain('text-primary')

    const accented = await mountSuspended(SectionHead, { props: { eyebrow: 'Eyebrow', title: 'Title', accent: true } })
    expect(accented.find('p').classes()).toContain('text-primary')
    expect(accented.find('p').classes()).not.toContain('text-dimmed')
  })

  it('renders the #action slot only when provided', async () => {
    const without = await mountSuspended(SectionHead, { props: { eyebrow: 'Eyebrow', title: 'Title' } })
    expect(without.text()).not.toContain('View all')

    const withAction = await mountSuspended(SectionHead, {
      props: { eyebrow: 'Eyebrow', title: 'Title' },
      slots: { action: '<a href="/projects">View all</a>' }
    })
    expect(withAction.find('a').text()).toBe('View all')
  })
})
