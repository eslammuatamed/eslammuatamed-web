// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ChipFilter from './ChipFilter.vue'

// The shared chip row, tested DIRECTLY because it now has two layout modes and its callers only
// exercise one each: `/projects` passes grouped options, `/blog` passes flat ones. Before grouping
// existed there was one behaviour and the projects spec covered it incidentally; the moment a branch
// appeared, "the blog row still scrolls" stopped being covered anywhere at all. This file is that
// coverage, and it is why the grouped fix could not silently change the blog.

const flat = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' }
]

const grouped = [
  { value: 'nuxt', label: 'Nuxt', group: 'Frontend' },
  { value: 'vue', label: 'Vue', group: 'Frontend' },
  { value: 'nestjs', label: 'NestJS', group: 'Backend' }
]

interface Option {
  value: string
  label: string
  group?: string
}

// `options` is an explicit parameter rather than part of a spread: spread into the props literal,
// TypeScript cannot see that the required prop is supplied and the whole object fails to typecheck.
const mount = (options: readonly Option[]) =>
  mountSuspended(ChipFilter, {
    props: {
      id: 'chips',
      label: 'Filter',
      allLabel: 'All',
      modelValue: undefined,
      options
    }
  })

describe('UiChipFilter', () => {
  describe('ungrouped (the blog row)', () => {
    it('scrolls horizontally below sm and wraps above it, unchanged by grouping support', async () => {
      const wrapper = await mount(flat)
      const row = wrapper.find('#chips')

      expect(row.classes()).toContain('overflow-x-auto')
      expect(row.classes()).toContain('sm:flex-wrap')
      expect(row.classes()).toContain('sm:overflow-x-visible')
      // The padding is what stops `overflow-x-auto` clipping the offset focus ring on the edge
      // chips — deleting it is a silent a11y regression with no visual signal in the common case.
      expect(row.classes()).toContain('p-1')
    })

    it('renders no headings at all, so the DOM is what it was before grouping existed', async () => {
      const wrapper = await mount(flat)

      expect(wrapper.find('#chips').findAll('span')).toHaveLength(0)
      expect(wrapper.find('#chips').findAll('button').map(b => b.text())).toEqual([
        'All',
        'Engineering',
        'Design'
      ])
    })
  })

  describe('grouped (the projects row)', () => {
    // A full-width heading can only start a new line where wrapping is on. Inside the nowrap
    // scroller it collapsed to min-content and sat inline between chips.
    it('wraps at every width instead of scrolling', async () => {
      const wrapper = await mount(grouped)
      const row = wrapper.find('#chips')

      expect(row.classes()).toContain('flex-wrap')
      expect(row.classes()).not.toContain('overflow-x-auto')
      expect(row.classes()).toContain('p-1')
    })

    it('emits one heading per group, in first-appearance order, with "All" ungrouped', async () => {
      const wrapper = await mount(grouped)

      expect(wrapper.find('#chips').findAll('span').map(s => s.text())).toEqual([
        'Frontend',
        'Backend'
      ])
      // "All" leads and is not filed under any group — it clears the filter, it is not an option.
      expect(wrapper.find('#chips').findAll('button')[0]!.text()).toBe('All')
    })

    // Sections are derived FROM the options, so an absent group cannot produce an empty heading.
    // This is what makes "hide empty groups" structural rather than a conditional to forget.
    it('renders no heading for a group with no options', async () => {
      const wrapper = await mount(grouped.filter(option => option.group === 'Frontend'))

      expect(wrapper.find('#chips').findAll('span').map(s => s.text())).toEqual(['Frontend'])
    })

    it('keeps every chip and preserves the caller order within each group', async () => {
      const wrapper = await mount(grouped)

      expect(wrapper.find('#chips').findAll('button').map(b => b.text())).toEqual([
        'All',
        'Nuxt',
        'Vue',
        'NestJS'
      ])
    })

    it('still emits the option value, not its group or label', async () => {
      const wrapper = await mount(grouped)

      const nestjs = wrapper.find('#chips').findAll('button').find(b => b.text() === 'NestJS')!
      await nestjs.trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['nestjs'])
    })
  })
})
