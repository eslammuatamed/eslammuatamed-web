// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectTechnologyFacet } from '~/types/models'
import ProjectFilter from './Filter.vue'

// The filter's contract with the API is narrow and easy to break silently: it must send the skill's
// canonical `slug` (a label would change with the language, and the only symptom is a wrong result
// set) and must express "All" as `undefined` rather than an empty string, which is a 422 and not
// "unfiltered".
//
// The control is a row of plain `<button aria-pressed>` chips rather than a Nuxt UI overlay, so these
// assert real DOM — the element, its type and its ARIA state — instead of a component's props. That is
// the point of the swap: there is no component boundary left to hide a broken control behind.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

// Typed as ProjectTechnologyFacet[] rather than inferred: `group` is a literal union in the contract,
// so an inferred `string` would not satisfy the prop and the spec would drift from the real shape.
//
// These are FACETS, not Skills (D10-19): the API already guarantees each one is used by at least one
// published project, so the component never has to decide what to hide.
const facets: ProjectTechnologyFacet[] = [
  { slug: 'nuxt', label: 'Nuxt', group: 'frontend', count: 3 },
  { slug: 'nestjs', label: 'NestJS', group: 'backend', count: 2 }
]

const chips = (wrapper: { findAll: (s: string) => { text: () => string, attributes: (a: string) => string | undefined }[] }) =>
  wrapper.findAll('#projects-filter button')

describe('ProjectFilter', () => {
  it('offers an "all" chip followed by exactly one chip per technology', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    expect(wrapper.text()).toContain('projects.filter.label')
    // "All" is a real chip here, not a placeholder: the overlay constraint that forced it to be one
    // (reka-ui rejects an item whose value is `''`) no longer applies to plain buttons.
    expect(chips(wrapper).map(chip => chip.text())).toEqual([
      'projects.filter.all',
      'Nuxt',
      'NestJS'
    ])
  })

  it('renders real buttons, not links or divs, so the platform owns the semantics', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    // `type="button"` matters: inside a form, a typeless button submits it.
    for (const chip of chips(wrapper)) expect(chip.attributes('type')).toBe('button')
    expect(wrapper.findAll('#projects-filter a')).toHaveLength(0)
  })

  it('is labelled as a group by a visible label', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    const label = wrapper.find('#projects-filter-label')
    expect(label.exists()).toBe(true)
    const group = wrapper.find('#projects-filter')
    expect(group.attributes('role')).toBe('group')
    // `aria-labelledby`, not `for`: `for` addresses exactly one control, and there are now several.
    expect(group.attributes('aria-labelledby')).toBe('projects-filter-label')
  })

  it('reflects the active filter as the pressed chip', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: 'nestjs' }
    })

    expect(chips(wrapper).map(chip => chip.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'true'
    ])
  })

  it('presses the "all" chip — and only it — when no filter is active', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    expect(chips(wrapper).map(chip => chip.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
      'false'
    ])
  })

  it('marks every chip with aria-pressed, so an unpressed chip states its state rather than omitting it', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: 'nuxt' }
    })

    for (const chip of chips(wrapper)) expect(chip.attributes('aria-pressed')).toBeDefined()
  })

  it('emits the canonical slug — never the uuid or the label — when a technology is chosen', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    await wrapper.findAll('#projects-filter button')[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['nuxt'])
  })

  it('emits undefined — never an empty string — when "all" is chosen', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: 'nuxt' }
    })

    await wrapper.findAll('#projects-filter button')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined])
  })

  it('does not emit when the already-active chip is pressed again', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: 'nuxt' }
    })

    await wrapper.findAll('#projects-filter button')[1]!.trigger('click')

    // Re-pressing must not toggle off and must not push an identical URL.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('still offers the "all" chip when the technologies list is empty', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets: [], modelValue: undefined }
    })

    // The group must not vanish: an empty registry is not the same as "no filter control exists".
    expect(chips(wrapper).map(chip => chip.text())).toEqual(['projects.filter.all'])
  })

  it('disables every chip when the list could not be loaded', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined, disabled: true }
    })

    for (const chip of chips(wrapper)) expect(chip.attributes('disabled')).toBeDefined()
  })

  it('keeps the row scrollable rather than wrapping on narrow viewports, without clipping the focus ring', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    const group = wrapper.find('#projects-filter')
    expect(group.classes()).toContain('overflow-x-auto')
    // The padding is what stops `overflow-x-auto` clipping the offset focus ring on the edge chips;
    // deleting it is a silent a11y regression with no visual signal in the common case.
    expect(group.classes()).toContain('p-1')
  })

  // ── Facets (D10-19) ────────────────────────────────────────────────────────────────────────────
  // The old filter was built from the global Skills registry and offered chips that match nothing.
  // These pin the two properties that replaced it: the component renders exactly what the API sent,
  // and it groups without inventing a group.

  it('renders a localized heading per group, in first-appearance order', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    const text = wrapper.text()
    expect(text).toContain('projects.filter.group.frontend')
    expect(text).toContain('projects.filter.group.backend')
    // Group labels are translated from the contract's stable keys, so they follow the UI locale
    // rather than whatever language the list request happened to resolve.
    expect(text).not.toContain('FRONTEND')
  })

  it('hides a group that has no facets instead of rendering an empty heading', async () => {
    // Live Production currently has exactly one backend technology, so the asymmetric case is the
    // normal case, not an edge case.
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets: facets.filter(facet => facet.group === 'frontend'), modelValue: undefined }
    })

    expect(wrapper.text()).toContain('projects.filter.group.frontend')
    expect(wrapper.text()).not.toContain('projects.filter.group.backend')
  })

  it('sends the slug, never the label, when a grouped chip is pressed', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    // The backend chip sits after a heading; the heading must not shift which element is clicked.
    // Found by TEXT, not by index, so the assertion still means "the NestJS chip" if grouping ever
    // reorders the row.
    const nestjs = wrapper
      .findAll('#projects-filter button')
      .find(chip => chip.text() === 'NestJS')
    await nestjs!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['nestjs'])
  })

  it('renders one chip per facet and never a count', async () => {
    const wrapper = await mountSuspended(ProjectFilter, {
      props: { facets, modelValue: undefined }
    })

    // `count` exists on the contract for ordering/telemetry decisions, but the chip is a label. A
    // number rendered here would need a plural rule per locale, which this app deliberately has not.
    expect(chips(wrapper).map(chip => chip.text())).toEqual([
      'projects.filter.all',
      'Nuxt',
      'NestJS'
    ])
  })
})
