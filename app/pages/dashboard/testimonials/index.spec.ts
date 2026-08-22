// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import TestimonialsList from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  rows: [] as unknown[],
  status: 0,
  release: null as null | (() => void),
  makeError: null as null | ((status: number) => unknown)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (holder.release !== null) await new Promise<void>(resolve => { holder.release = resolve })
  if (holder.status) throw holder.makeError?.(holder.status) ?? new Error('failed')
  return { data: holder.rows }
})

holder.makeError = status => new ApiError({ type: 'about:blank', title: 'failed', status })

function testimonial(over: Partial<AdminTestimonial> = {}): AdminTestimonial {
  return {
    id: 't1',
    avatarId: '00000000-0000-4000-b300-000000000001',
    order: 7,
    isVisible: true,
    translations: {
      en: { quote: 'Dependable work.', authorName: 'Alex Morgan', authorRole: 'CTO, Northstar' },
      ar: { quote: 'عمل يمكن الاعتماد عليه.', authorName: 'أليكس مورغان', authorRole: 'المدير التقني' }
    },
    ...over
  }
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(options: { rows?: unknown[], status?: number, park?: boolean } = {}) {
  holder.calls = []
  holder.rows = options.rows ?? [testimonial()]
  holder.status = options.status ?? 0
  holder.release = options.park ? () => {} : null
  const wrapper = await mountSuspended(TestimonialsList)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

describe('the collection request-state contract', () => {
  it('renders loading without claiming the collection is empty', async () => {
    const page = await mount({ park: true })
    expect(page.find('[aria-busy=true]').exists()).toBe(true)
    expect(page.find('[data-testimonials-empty]').exists()).toBe(false)
    expect(page.find('[data-testimonials-failed]').exists()).toBe(false)
  })

  it('renders the deliberate empty state', async () => {
    const page = await mount({ rows: [] })
    expect(page.find('[data-testimonials-empty]').exists()).toBe(true)
    expect(page.find('[data-testimonials-failed]').exists()).toBe(false)
  })

  it('renders a failed first load as error, not empty', async () => {
    const page = await mount({ status: 500 })
    expect(page.find('[data-testimonials-failed]').exists()).toBe(true)
    expect(page.find('[data-testimonials-empty]').exists()).toBe(false)
  })

  it('renders loaded rows as content', async () => {
    const page = await mount({ rows: [testimonial()] })
    expect(page.find('[data-testimonials-loaded]').exists()).toBe(true)
    expect(page.findAll('[data-testimonial-row]')).toHaveLength(1)
    expect(page.find('[data-testimonials-empty]').exists()).toBe(false)
    expect(page.find('[data-testimonials-failed]').exists()).toBe(false)
  })

  it('renders 403 as forbidden rather than error or empty', async () => {
    const page = await mount({ status: 403 })
    expect(page.find('[data-testimonials-forbidden]').exists()).toBe(true)
    expect(page.find('[data-testimonials-failed]').exists()).toBe(false)
    expect(page.find('[data-testimonials-empty]').exists()).toBe(false)
  })
})

describe('the contract-driven collection shape', () => {
  it('requests the whole list with no query and locale suppressed', async () => {
    await mount()
    expect(holder.calls).toEqual([{ path: '/admin/testimonials', options: { locale: false } }])
  })

  it('renders rows in the received order even when order values run backwards', async () => {
    const rows = [
      testimonial({ id: 'third-sent', order: 40 }),
      testimonial({ id: 'first-sent', order: 10 }),
      testimonial({ id: 'second-sent', order: 20 })
    ]
    const page = await mount({ rows })
    const rendered = page.findAll('[data-testimonial-row]').map(row => row.attributes('data-testimonial-row'))
    expect(rendered).toEqual(['third-sent', 'first-sent', 'second-sent'])
    // `order` is displayed as data; it never becomes a client-side sorting policy.
    expect(page.find('[data-testimonial-order="first-sent"]').text()).toBe('10')
    expect(page.find('[data-testimonials-pagination]').exists()).toBe(false)
    expect(page.find('[data-testimonials-filter]').exists()).toBe(false)
  })

  it('reports one-locale testimonials as incomplete instead of substituting the other locale', async () => {
    const page = await mount({
      rows: [testimonial({ translations: { en: { quote: 'Q', authorName: 'Alex', authorRole: 'CTO' } } })]
    })
    expect(page.find('[data-testimonial-translation="en:present"]').exists()).toBe(true)
    expect(page.find('[data-testimonial-translation="ar:missing"]').exists()).toBe(true)
  })

  it('presents visibility and the nullable avatar from the stored record alone', async () => {
    const page = await mount({
      rows: [
        testimonial(),
        testimonial({ id: 't2', isVisible: false, avatarId: null })
      ]
    })
    expect(page.find('[data-testimonial-visible="true"]').exists()).toBe(true)
    expect(page.find('[data-testimonial-visible="false"]').exists()).toBe(true)
    expect(page.find('[data-testimonial-avatar="00000000-0000-4000-b300-000000000001"]').exists()).toBe(true)
    expect(page.find('[data-testimonial-avatar="none"]').exists()).toBe(true)
  })
})
