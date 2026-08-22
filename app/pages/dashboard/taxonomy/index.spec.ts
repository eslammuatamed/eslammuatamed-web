// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import TaxonomyPage from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminCategory } from '~/composables/admin-article-types'

/**
 * Unit coverage for the Taxonomy page (FE-3, `U2`): the two sections own INDEPENDENT request
 * state; rows render in the order received; no create/edit control exists to promise a route that
 * is not built; and completeness badges derive from the returned map alone.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string }>,
  byPath: {} as Record<string, unknown[] | { status: number }>
}))

mockNuxtImport('useApi', () => () => async (path: string) => {
  holder.calls.push({ path })
  const configured = holder.byPath[path]
  if (!configured) return { data: [] }
  if (typeof configured === 'object' && 'status' in configured) {
    throw new ApiError({ type: 'about:blank', title: 'failed', status: configured.status })
  }
  return { data: configured }
})

function category(id: string, name: string, withAr = true): AdminCategory {
  return {
    id,
    translations: {
      en: { name, slug: `${name.toLowerCase()}-en`, description: name === 'Systems' ? 'Architecture notes.' : null },
      ...(withAr
        ? { ar: { name: `عربي-${name}`, slug: `${name.toLowerCase()}-ar`, description: null } }
        : {})
    }
  }
}

function tag(id: string, name: string, withAr = true) {
  return {
    id,
    translations: {
      en: { name, slug: `${name.toLowerCase()}-en` },
      ...(withAr
        ? { ar: { name: `عربي-${name}`, slug: `${name.toLowerCase()}-ar`, description: null } }
        : {})
    }
  }
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(config: Record<string, unknown[] | { status: number }> = {}) {
  holder.calls = []
  holder.byPath = config
  const wrapper = await mountSuspended(TaxonomyPage)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

const ids = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, attr: string) =>
  wrapper.findAll(`[${attr}]`).map((node: { attributes: (name: string) => string | undefined }) => node.attributes(attr))

describe('the Taxonomy page — one destination, two independent collections', () => {
  it('issues exactly the two list reads and NEVER a detail read', async () => {
    await mount({
      '/admin/categories': [category('c1', 'Systems')],
      '/admin/tags': [tag('t1', 'NestJS')]
    })
    expect(holder.calls.map(call => call.path).sort()).toEqual(['/admin/categories', '/admin/tags'])
    for (const call of holder.calls) {
      expect(call.path, 'no {id} segment may be requested').not.toMatch(/\/admin\/(categories|tags)\/[^/]+$/)
    }
  })

  it('renders each section in the order received, independently', async () => {
    const wrapper = await mount({
      // Deliberately unsorted names: what arrives is what renders.
      '/admin/categories': [category('c2', 'Zeta'), category('c1', 'Alpha')],
      '/admin/tags': [tag('t2', 'Vue'), tag('t1', 'Angular')]
    })
    expect(ids(wrapper, 'data-category-row')).toEqual(['c2', 'c1'])
    expect(ids(wrapper, 'data-tag-row')).toEqual(['t2', 't1'])
  })

  it('one section failing leaves the other fully usable', async () => {
    const wrapper = await mount({
      '/admin/categories': { status: 500 },
      '/admin/tags': [tag('t1', 'NestJS')]
    })
    await flushPromises()

    expect(wrapper.find('[data-categories-failed]').exists()).toBe(true)
    expect(wrapper.find('[data-tags-failed]').exists()).toBe(false)
    expect(ids(wrapper, 'data-tag-row')).toEqual(['t1'])

    // And the reverse.
    const reversed = await mount({
      '/admin/categories': [category('c1', 'Systems')],
      '/admin/tags': { status: 500 }
    })
    expect(reversed.find('[data-tags-failed]').exists()).toBe(true)
    expect(reversed.find('[data-categories-failed]').exists()).toBe(false)
    expect(ids(reversed, 'data-category-row')).toEqual(['c1'])
  })

  it('shows section-local empty states only when that list is empty', async () => {
    const wrapper = await mount({
      '/admin/categories': [],
      '/admin/tags': [tag('t1', 'NestJS')]
    })
    expect(wrapper.find('[data-categories-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-tags-empty]').exists()).toBe(false)
  })

  it('derives completeness from the returned map, never by substitution', async () => {
    const wrapper = await mount({
      '/admin/categories': [
        category('c-full', 'Systems'),          // both locales
        category('c-en', 'Field notes', false)  // English only
      ],
      '/admin/tags': [tag('t-ar', 'NestJS', false)]
    })
    const html = wrapper.html()
    // Full row: two present badges. English-only rows: en present + ar missing.
    expect(html).toContain('data-taxonomy-translation="en:present"')
    expect(html).toContain('data-taxonomy-translation="ar:missing"')
    const presentCount = (html.match(/data-taxonomy-translation="en:present"/g) ?? []).length
    const missingCount = (html.match(/data-taxonomy-translation="ar:missing"/g) ?? []).length
    expect(presentCount).toBe(3)
    expect(missingCount).toBe(2)
  })

  it('ships NO create or edit controls while no destination exists for them', async () => {
    const wrapper = await mount({
      '/admin/categories': [category('c1', 'Systems')],
      '/admin/tags': [tag('t1', 'NestJS')]
    })
    const html = wrapper.html()
    for (const forbidden of ['data-taxonomy-create', 'data-category-edit', 'data-tag-edit', '/dashboard/taxonomy/new']) {
      expect(html, `${forbidden} would be a dead control`).not.toContain(forbidden)
    }
    // No link of any kind may point at a taxonomy sub-route that does not exist.
    for (const link of wrapper.findAll('a')) {
      expect(link.attributes('href'), link.attributes('href')).not.toMatch(/^\/dashboard\/taxonomy\//)
    }
  })

  it('presents slugs as stored data and never synthesizes one', async () => {
    const wrapper = await mount({
      '/admin/categories': [category('c1', 'Systems')],
      '/admin/tags': []
    })
    expect(wrapper.find('[data-taxonomy-slug="c1"]').text()).toContain('/systems-en')
  })
})
