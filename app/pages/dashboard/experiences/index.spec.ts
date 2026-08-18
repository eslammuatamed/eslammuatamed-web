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
 * the request rules. This file proves the PAGE renders the four states distinctly, and that the two
 * shape differences from Articles are real in the markup: no pagination control, and rows in the
 * order received.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  data: [] as unknown[],
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
  // No `meta`, exactly as the contract answers.
  return { data: holder.data }
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

async function mount(options: { rows?: unknown[], status?: number, park?: boolean } = {}) {
  holder.calls = []
  holder.data = options.rows ?? [experience()]
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

  /**
   * The contract sends no `meta`, so there is nothing to paginate WITH. Asserting the control's
   * absence keeps a copied `UPagination` from arriving with fields that would read `undefined`.
   */
  it('renders no pagination control, because the endpoint is not paginated', async () => {
    const page = await mount({ rows: [experience(), ENDED_LATER] })
    expect(page.find('[data-experiences-pagination]').exists()).toBe(false)
    expect(page.text()).not.toContain('undefined')
  })
})
