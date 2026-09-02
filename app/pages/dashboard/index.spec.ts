// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import OverviewPage from './index.vue'
import { ApiError } from '~/utils/api-error'

type Outcome = number | Error

const holder = vi.hoisted(() => ({
  apiCalls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  totals: { '/admin/articles': 7, '/admin/projects': 3 } as Record<string, Outcome>,
  pendingPaths: new Set<string>(),
  unread: 2 as number | null,
  unreadRef: null as null | { value: number | null },
  ensurePending: false,
  ensureError: false,
  fetchError: false,
  ensureCalls: 0,
  fetchCalls: 0,
  locale: 'en' as 'en' | 'ar'
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.apiCalls.push({ path, options })
  if (holder.pendingPaths.has(path)) return await new Promise<never>(() => {})
  const outcome = holder.totals[path]
  if (outcome instanceof Error) throw outcome
  return { meta: { total: outcome } }
})

mockNuxtImport('useUnreadCount', () => () => ({
  count: (holder.unreadRef = ref(holder.unread)),
  ensureFresh: async () => {
    holder.ensureCalls += 1
    if (holder.ensurePending) return await new Promise<never>(() => {})
    if (holder.ensureError) throw new Error('Unread messages unavailable')
  },
  fetchCount: async () => {
    holder.fetchCalls += 1
    if (holder.fetchError) throw new Error('Unread messages unavailable')
  }
}))

mockNuxtImport('useDashboardI18n', () => () => ({
  t: (key: string, values?: { count?: number }) => `${holder.locale === 'ar' ? 'عربي' : 'English'} ${key}${values?.count === undefined ? '' : ` ${values.count}`}`
}))

const UButton = {
  props: ['to'],
  template: '<a v-if="to" :href="to"><slot /></a><button v-else type="button"><slot /></button>'
}

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UPageHeader: { props: ['title', 'description'], template: '<header><h1>{{ title }}</h1><p>{{ description }}</p></header>' },
  UCard: { template: '<div><slot /></div>' },
  UAlert: { props: ['title', 'description'], template: '<div><strong>{{ title }}</strong><p>{{ description }}</p><slot name="actions" /></div>' },
  USkeleton: { template: '<div />' },
  UButton
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

function reset(options: Partial<{
  articles: Outcome
  projects: Outcome
  unread: number | null
  ensurePending: boolean
  ensureError: boolean
  fetchError: boolean
  locale: 'en' | 'ar'
  pendingPaths: string[]
}> = {}) {
  holder.apiCalls = []
  holder.totals = {
    '/admin/articles': options.articles ?? 7,
    '/admin/projects': options.projects ?? 3
  }
  holder.pendingPaths = new Set(options.pendingPaths ?? [])
  holder.unread = options.unread === undefined ? 2 : options.unread
  if (holder.unreadRef) holder.unreadRef.value = holder.unread
  holder.ensurePending = options.ensurePending ?? false
  holder.ensureError = options.ensureError ?? false
  holder.fetchError = options.fetchError ?? false
  holder.ensureCalls = 0
  holder.fetchCalls = 0
  holder.locale = options.locale ?? 'en'
}

async function mount(options: Parameters<typeof reset>[0] = {}) {
  reset(options)
  const wrapper = await mountSuspended(OverviewPage, { global: { stubs } })
  mounted = wrapper
  await flushPromises()
  return wrapper
}

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('Dashboard Overview operational hierarchy', () => {
  it('keeps real counts and navigation-only modules together without inventing totals', async () => {
    const wrapper = await mount()

    expect(wrapper.find('[data-overview-header]').exists()).toBe(true)
    expect(wrapper.find('[data-overview-content-surface]').exists()).toBe(true)
    expect(wrapper.get('[data-overview-total="articles"]').text()).toContain('7')
    expect(wrapper.get('[data-overview-total="projects"]').text()).toContain('3')
    for (const [module, route] of [['skills', '/dashboard/skills'], ['testimonials', '/dashboard/testimonials']] as const) {
      const item = wrapper.get(`[data-overview-card="${module}"]`)
      expect(item.get('a').attributes('href')).toBe(route)
      expect(item.find('[data-overview-total]').exists()).toBe(false)
    }
    expect(holder.apiCalls).toEqual([
      { path: '/admin/articles', options: { locale: false, query: { page: 1, perPage: 1 } } },
      { path: '/admin/projects', options: { locale: false, query: { page: 1, perPage: 1 } } }
    ])
  })

  it('keeps unread messages as compact attention and leaves zero unread non-urgent', async () => {
    const attention = await mount({ unread: 2 })
    expect(attention.get('[data-overview-attention-active]').text()).toContain('2')
    expect(attention.get('[data-overview-attention-active] a').attributes('href')).toBe('/dashboard/messages')
    attention.unmount()
    mounted = null

    const clear = await mount({ unread: 0 })
    expect(clear.find('[data-overview-attention-active]').exists()).toBe(false)
    expect(clear.get('[data-overview-total="messages"]').text()).toContain('0')
  })

  it('keeps Articles and Projects failures isolated and retryable while preserving 403 treatment', async () => {
    const articleError = await mount({ articles: new Error('Articles unavailable'), projects: 3 })
    expect(articleError.find('[data-overview-unavailable="articles"]').exists()).toBe(true)
    expect(articleError.get('[data-overview-total="projects"]').text()).toContain('3')
    holder.totals['/admin/articles'] = 7
    await articleError.get('[data-overview-retry="articles"]').trigger('click')
    await flushPromises()
    expect(articleError.get('[data-overview-total="articles"]').text()).toContain('7')

    articleError.unmount()
    mounted = null
    const forbidden = await mount({ articles: new ApiError({ type: 'about:blank', title: 'Forbidden', status: 403 }) })
    expect(forbidden.get('[data-overview-unavailable="articles"]').text()).toContain('dashboard.overview.forbidden')
    expect(forbidden.find('[data-overview-retry="articles"]').exists()).toBe(false)
  })

  it('keeps unread-message failure and retry semantics independent of content snapshots', async () => {
    const wrapper = await mount({ unread: null, ensureError: true })
    expect(wrapper.find('[data-overview-unavailable="messages"]').exists()).toBe(true)
    expect(wrapper.get('[data-overview-total="articles"]').text()).toContain('7')
    holder.unread = 2
    if (holder.unreadRef) holder.unreadRef.value = 2
    await wrapper.get('[data-overview-retry="messages"]').trigger('click')
    await flushPromises()
    expect(holder.fetchCalls).toBe(1)
    expect(wrapper.get('[data-overview-attention-active]').text()).toContain('2')
  })

  it('keeps loading attributable to its pending source and preserves primary quick-action destinations', async () => {
    const wrapper = await mount({ pendingPaths: ['/admin/articles'], unread: null, ensurePending: true })
    expect(wrapper.find('[data-overview-loading="articles"]').exists()).toBe(true)
    expect(wrapper.get('[data-overview-total="projects"]').text()).toContain('3')
    expect(wrapper.find('[data-overview-loading="messages"]').exists()).toBe(true)
    expect(wrapper.get('[data-overview-action="new-article"]').attributes('href')).toBe('/dashboard/articles/new')
    expect(wrapper.get('[data-overview-action="new-project"]').attributes('href')).toBe('/dashboard/projects/new')
    expect(wrapper.get('[data-overview-action="media"]').attributes('href')).toBe('/dashboard/media')
    expect(wrapper.get('[data-overview-action="seo"]').attributes('href')).toBe('/dashboard/seo')
  })

  it('renders the localized hierarchy without localized Dashboard routes', async () => {
    const wrapper = await mount({ locale: 'ar' })
    expect(wrapper.text()).toContain('عربي dashboard.overview.title')
    for (const link of wrapper.findAll('a')) expect(link.attributes('href')).not.toMatch(/^\/ar\/dashboard/)
  })
})
