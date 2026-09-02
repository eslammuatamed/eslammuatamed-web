// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ExperiencesList from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminExperience, AdminExperienceTranslation } from '~/composables/admin-experience-types'

/**
 * The Experience list, asserted through the REAL rendered page.
 *
 * `admin-experience-fields.spec.ts` proves the field rules and `useAdminExperiences.spec.ts` proves
 * the request rules. This file proves the PAGE renders the four states distinctly, server page
 * metadata drives the pager, and received rows retain the API's order.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  data: [] as unknown[],
  total: 0,
  totalPages: 1,
  status: 0,
  release: null as null | (() => void),
  makeError: null as null | ((status: number) => unknown)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (holder.release !== null) {
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.status !== 0) throw holder.makeError?.(holder.status) ?? new Error('failed')
  return { data: holder.data, meta: { page: 1, perPage: 12, total: holder.total, totalPages: holder.totalPages } }
})

holder.makeError = (status: number) => new ApiError({ type: 'about:blank', title: 'Request failed', status })

function translation(over: Partial<AdminExperienceTranslation> = {}): AdminExperienceTranslation {
  return { role: 'Senior Frontend Engineer', company: 'Findropica', location: 'Cairo', impact: '- x', ...over }
}

function experience(over: Partial<AdminExperience> = {}): AdminExperience {
  return {
    id: 'e-current',
    startDate: '2025-01-15T00:00:00.000Z',
    endDate: null,
    isCurrent: true,
    employmentType: 'FULL_TIME',
    order: 0,
    technologyIds: ['s1', 's2', 's3'],
    translations: { en: translation(), ar: translation({ role: 'مهندس واجهات أول', company: 'فايندروبيكا' }) },
    ...over
  }
}

/** The pair whose API order and `startDate desc` order disagree. */
const ENDED_LATER = experience({
  id: 'e-ended-later',
  isCurrent: false,
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-07-31T00:00:00.000Z',
  employmentType: 'FREELANCE',
  order: 3,
  technologyIds: ['s5'],
  translations: { en: translation({ role: 'Consulting Engineer', company: 'WaveX' }) }
})

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(options: { rows?: unknown[], total?: number, totalPages?: number, status?: number, park?: boolean } = {}) {
  holder.calls = []
  holder.data = options.rows ?? [experience()]
  holder.total = options.total ?? holder.data.length
  holder.totalPages = options.totalPages ?? 1
  holder.status = options.status ?? 0
  holder.release = options.park ? () => {} : null
  const wrapper = await mountSuspended(ExperiencesList)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

describe('the four request states render distinctly', () => {
  it('shows a skeleton on a first load, and NOT an empty state', async () => {
    const page = await mount({ park: true })
    expect(page.find('[data-experiences-empty]').exists()).toBe(false)
    expect(page.find('[data-experiences-failed]').exists()).toBe(false)
    expect(page.find('[aria-busy=true]').exists()).toBe(true)
  })

  it('shows the deliberate empty state when the collection is genuinely empty', async () => {
    const page = await mount({ rows: [] })
    expect(page.find('[data-experiences-empty]').exists()).toBe(true)
    expect(page.find('[data-experiences-failed]').exists()).toBe(false)
  })

  it('shows an error with a retry when a first load fails with nothing underneath', async () => {
    const page = await mount({ status: 500 })
    expect(page.find('[data-experiences-failed]').exists()).toBe(true)
    expect(page.find('[data-experiences-empty]').exists()).toBe(false)
  })

  it('answers a 403 on its own terms — neither an error nor an empty list', async () => {
    const page = await mount({ status: 403 })
    expect(page.find('[data-experiences-forbidden]').exists()).toBe(true)
    expect(page.find('[data-experiences-failed]').exists()).toBe(false)
    expect(page.find('[data-experiences-empty]').exists()).toBe(false)
  })
})

describe('the rows', () => {
  it('renders stable Experience rows through the UTable with their operational fields and exact actions', async () => {
    const page = await mount({ rows: [experience()] })
    expect(page.find('[data-experiences-table]').exists()).toBe(true)
    expect(page.find('[data-experience-row="e-current"]').exists()).toBe(true)
    expect(page.find('[data-experience-role="e-current"]').text()).toBe('Senior Frontend Engineer')
    expect(page.find('[data-experience-company="e-current"]').text()).toBe('Findropica')
    expect(page.find('[data-experience-period="e-current"]').text()).toContain('Present')
    expect(page.find('[data-experience-edit="e-current"]').attributes('href')).toBe('/dashboard/experiences/e-current')
    expect(page.find('[data-experiences-create]').attributes('href')).toBe('/dashboard/experiences/new')
  })

  /**
   * ⚠ THE DISCRIMINATING ORDER ASSERTION, at the page level.
   *
   * The FULL sequence is asserted rather than "the current role is first": a sort that is wrong
   * further down the list would still put the current role at the top and pass a weaker check.
   */
  it('renders rows in the order received and never re-sorts them by startDate', async () => {
    const page = await mount({ rows: [experience(), ENDED_LATER] })
    const ids = page.findAll('[data-experience-row]').map(row => row.attributes('data-experience-row'))
    expect(ids).toEqual(['e-current', 'e-ended-later'])
  })

  it('marks the current role from the stored flag', async () => {
    const page = await mount({ rows: [experience(), ENDED_LATER] })
    expect(page.find('[data-experience-current="e-current"]').exists()).toBe(true)
    expect(page.find('[data-experience-current="e-ended-later"]').exists()).toBe(false)
  })

  it('reports a missing translation as missing rather than substituting the other locale', async () => {
    const page = await mount({ rows: [ENDED_LATER] })
    expect(page.find('[data-experience-translation="en:present"]').exists()).toBe(true)
    expect(page.find('[data-experience-translation="ar:missing"]').exists()).toBe(true)
  })

  it('states the linked skill count from the relation itself', async () => {
    const page = await mount({ rows: [experience()] })
    expect(page.find('[data-experience-skills="3"]').exists()).toBe(true)
  })

  it('renders the server pagination control only when more than one page exists', async () => {
    const page = await mount({ rows: [experience()], total: 13, totalPages: 2 })
    expect(page.find('[data-experiences-pagination]').exists()).toBe(true)
    expect(holder.calls[0]).toEqual({ path: '/admin/experiences', options: { locale: false, query: { page: 1, perPage: 12 } } })
  })
})
