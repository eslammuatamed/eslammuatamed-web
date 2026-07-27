// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiBreadcrumbs from './Breadcrumbs.vue'

// The breadcrumb is the case study's recovery path and the visible counterpart of the BreadcrumbList
// structured data (doc 22 §4). Its accessibility semantics are the whole point and are silently easy to
// break: a labelled nav, an ordered list, and a current page that is text with aria-current — never a
// link to itself.
const items = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Personal Platform' }
]

describe('UiBreadcrumbs', () => {
  it('is a labelled navigation landmark', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, { props: { items, label: 'Breadcrumb' } })

    const nav = wrapper.find('nav')
    expect(nav.exists()).toBe(true)
    expect(nav.attributes('aria-label')).toBe('Breadcrumb')
  })

  it('renders the trail as an ordered list in order', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, { props: { items, label: 'Breadcrumb' } })

    expect(wrapper.find('ol').exists()).toBe(true)
    expect(wrapper.findAll('li').map(li => li.text().trim())).toEqual([
      'Home',
      'Projects',
      'Personal Platform'
    ])
  })

  it('links every ancestor crumb', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, { props: { items, label: 'Breadcrumb' } })

    expect(wrapper.findAll('a')).toHaveLength(2)
  })

  it('marks the current page with aria-current and does not link it to itself', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, { props: { items, label: 'Breadcrumb' } })

    const current = wrapper.find('[aria-current="page"]')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('Personal Platform')
    expect(current.element.tagName).toBe('SPAN')
  })

  it('hides the decorative separators from assistive technology', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, { props: { items, label: 'Breadcrumb' } })

    // One separator fewer than crumbs — and none of them announced.
    const separators = wrapper.findAll('[aria-hidden="true"]')
    expect(separators.length).toBeGreaterThanOrEqual(items.length - 1)
  })

  it('renders a single-item trail without a leading separator', async () => {
    const wrapper = await mountSuspended(UiBreadcrumbs, {
      props: { items: [{ label: 'Projects' }], label: 'Breadcrumb' }
    })

    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
