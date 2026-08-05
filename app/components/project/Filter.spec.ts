// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Skill } from '~/types/models'
import ProjectFilter from './Filter.vue'

// The filter's contract with the API is narrow and easy to break silently: it must send the skill's
// canonical `slug` (a label would change with the language, and a 422 or a wrong result set is the
// only symptom) and must translate "All" back to `undefined` rather than an empty string (which is a
// 422, not "unfiltered").
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

// Typed as Skill[] rather than inferred: `group` is a literal union in the contract, so an inferred
// `string` would not satisfy the prop and the spec would drift from the real shape.
const technologies: Skill[] = [
  { id: 'uuid-nuxt', slug: 'nuxt', label: 'Nuxt', group: 'FRONTEND', order: 0, brandColor: null, availableLocales: ['en'] },
  { id: 'uuid-nest', slug: 'nestjs', label: 'NestJS', group: 'FRONTEND', order: 1, brandColor: null, availableLocales: ['en'] }
]

describe('ProjectFilter', () => {
  it('offers exactly one option per technology — "all" is the placeholder, not an item', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: undefined }
    })

    expect(wrapper.text()).toContain('projects.filter.label')
    // reka-ui rejects an item whose value is an empty string, so "all" must be the placeholder.
    const select = wrapper.findComponent({ name: 'USelect' })
    expect(select.props('items')).toEqual([
      { label: 'Nuxt', value: 'nuxt' },
      { label: 'NestJS', value: 'nestjs' }
    ])
    expect(select.props('placeholder')).toBe('projects.filter.all')
  })

  it('is labelled by a visible label bound to the control', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: undefined }
    })

    const label = wrapper.find('label#projects-filter-label')
    expect(label.exists()).toBe(true)
    expect(label.attributes('for')).toBe('projects-filter')
  })

  it('reflects the active filter as the selected value', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: 'nestjs' }
    })

    expect(wrapper.findComponent({ name: 'USelect' }).props('modelValue')).toBe('nestjs')
  })

  it('shows the "all" sentinel when no filter is active', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: undefined }
    })

    expect(wrapper.findComponent({ name: 'USelect' }).props('modelValue')).toBe('')
  })

  it('emits the canonical slug — never the uuid or the label — when a technology is chosen', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: undefined }
    })

    wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'nuxt')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['nuxt'])
  })

  it('emits undefined — never an empty string — when "all" is chosen', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: 'nuxt' }
    })

    wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', '')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined])
  })

  it('renders without options when the technologies list is empty', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies: [], modelValue: undefined }
    })

    expect(wrapper.findComponent({ name: 'USelect' }).props('items')).toEqual([])
  })

  it('offers a clear control only while a filter is active', async () => {
    const unfiltered = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: undefined }
    })
    expect(unfiltered.text()).not.toContain('projects.filter.clear')

    const filtered = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: 'nuxt' }
    })
    expect(filtered.text()).toContain('projects.filter.clear')
  })

  it('clears the filter to undefined when the clear control is used', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { technologies, modelValue: 'nuxt' }
    })

    await wrapper.findComponent({ name: 'UButton' }).trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined])
  })
})
