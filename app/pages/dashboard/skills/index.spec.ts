// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import SkillsList from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminSkill } from '~/composables/admin-project-types'

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

function skill(over: Partial<AdminSkill> = {}): AdminSkill {
  return {
    id: 's1',
    slug: 'typescript',
    group: 'LANGUAGE',
    order: -1.25,
    brandColor: 'brand-token',
    isPublic: true,
    translations: { en: { label: 'TypeScript' }, ar: { label: 'تايب سكربت' } },
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
  holder.rows = options.rows ?? [skill()]
  holder.status = options.status ?? 0
  holder.release = options.park ? () => {} : null
  const wrapper = await mountSuspended(SkillsList)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

describe('the collection request-state contract', () => {
  it('renders loading without claiming the collection is empty', async () => {
    const page = await mount({ park: true })
    expect(page.find('[aria-busy=true]').exists()).toBe(true)
    expect(page.find('[data-skills-empty]').exists()).toBe(false)
    expect(page.find('[data-skills-failed]').exists()).toBe(false)
  })

  it('renders the deliberate empty state', async () => {
    const page = await mount({ rows: [] })
    expect(page.find('[data-skills-empty]').exists()).toBe(true)
    expect(page.find('[data-skills-failed]').exists()).toBe(false)
  })

  it('renders a failed first load as error, not empty', async () => {
    const page = await mount({ status: 500 })
    expect(page.find('[data-skills-failed]').exists()).toBe(true)
    expect(page.find('[data-skills-empty]').exists()).toBe(false)
  })

  it('renders loaded rows in the Skills UTable', async () => {
    const page = await mount({ rows: [skill()] })
    expect(page.find('[data-skills-loaded]').exists()).toBe(true)
    expect(page.find('[data-skills-table]').exists()).toBe(true)
    expect(page.findAll('[data-skill-row]')).toHaveLength(1)
    expect(page.find('[data-skills-empty]').exists()).toBe(false)
    expect(page.find('[data-skills-failed]').exists()).toBe(false)
  })

  it('renders 403 as forbidden rather than error or empty', async () => {
    const page = await mount({ status: 403 })
    expect(page.find('[data-skills-forbidden]').exists()).toBe(true)
    expect(page.find('[data-skills-failed]').exists()).toBe(false)
    expect(page.find('[data-skills-empty]').exists()).toBe(false)
  })
})

describe('the contract-driven collection shape', () => {
  it('requests the whole list with no query and locale suppressed', async () => {
    await mount()
    expect(holder.calls).toEqual([{ path: '/admin/skills', options: { locale: false } }])
  })

  it('renders rows in the API order and has no pagination or filter controls', async () => {
    const page = await mount({ rows: [skill({ id: 'second' }), skill({ id: 'first' })] })
    expect(page.findAll('[data-skill-row]').map(row => row.attributes('data-skill-row'))).toEqual(['second', 'first'])
    expect(page.find('[data-skills-pagination]').exists()).toBe(false)
    expect(page.find('[data-skills-filter]').exists()).toBe(false)
  })

  it('reports one-locale Skills as incomplete instead of substituting the other locale', async () => {
    const page = await mount({ rows: [skill({ translations: { ar: { label: 'العربية' } } })] })
    expect(page.find('[data-skill-translation="en:missing"]').exists()).toBe(true)
    expect(page.find('[data-skill-translation="ar:present"]').exists()).toBe(true)
  })

  it('renders contract-legal fractional order and non-hex brandColor verbatim', async () => {
    const page = await mount()
    expect(page.find('[data-skill-order="s1"]').text()).toBe('-1.25')
    expect(page.find('[data-skill-brand-color="s1"]').text()).toBe('brand-token')
  })
})
