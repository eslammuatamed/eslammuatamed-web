// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ProjectsList from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminProject, AdminProjectTranslation } from '~/composables/admin-project-types'

/**
 * The Projects list, asserted through the REAL rendered page.
 *
 * `admin-projects-query.spec.ts` proves the query rules. This proves the PAGE obeys them — that the
 * address it is opened at becomes the request it makes, that a control changes the address and the
 * address changes the request, and that a project with one translation says so on screen. A correct
 * parser wired to the wrong parameter is exactly the defect a pure test cannot see.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  data: [] as unknown[],
  meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
  status: 0,
  next: null as Promise<unknown> | null,
  /**
   * Assigned below, not inside the hoisted factory: `mockNuxtImport` is hoisted above the imports,
   * so the factory body cannot reference `ApiError` yet. It is only READ when a request is made,
   * by which time the module has finished evaluating.
   *
   * The failure has to be a real `ApiError`, because the composable branches on `instanceof` — and
   * mocking `useApi` bypasses the one place (`toApiError`) that normally guarantees that shape.
   */
  makeError: null as null | ((status: number) => unknown)
}))

mockNuxtImport('useApi', () => () => (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (holder.next) {
    return holder.next
  }
  if (holder.status !== 0) {
    return Promise.reject(holder.makeError?.(holder.status) ?? new Error('failed'))
  }
  return Promise.resolve({ data: holder.data, meta: holder.meta })
})

holder.makeError = (status: number) =>
  new ApiError({ type: 'about:blank', title: 'Request failed', status })

function translation(over: Partial<AdminProjectTranslation> = {}): AdminProjectTranslation {
  return {
    title: 'Content platform API',
    slug: 'content-platform-api',
    summary: 's', overview: 'o', businessProblem: 'b', solution: 'so', role: 'r',
    architecture: 'a', challenges: 'c', features: 'f', lessonsLearned: 'l',
    metaTitle: null, metaDescription: null, ogImageId: null, canonicalUrl: null,
    ...over
  }
}

function project(over: Partial<AdminProject> = {}): AdminProject {
  return {
    id: 'p1',
    featured: true,
    isPublished: true,
    order: 3,
    liveUrl: null,
    repoUrl: null,
    year: 2026,
    technologyIds: [],
    gallery: [],
    translations: { en: translation(), ar: translation({ title: 'منصة', slug: 'mnsah' }) },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...over
  }
}

/**
 * MOUNTED AT `/`, NOT AT `/dashboard/projects`.
 *
 * `mountSuspended`'s `route` option performs a REAL `router.replace`, which runs the target route's
 * `definePageMeta` middleware — and `auth` redirects an unauthenticated test to `/dashboard/login`,
 * discarding the query string the test was setting. Measured: every filter arrived empty. The page
 * reads `route.query` and never `route.path`, and `setQuery` pushes `{ query }` which preserves
 * whatever path it is on, so the query is the whole of what these tests need to control.
 */
let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

/**
 * UNMOUNTED BETWEEN TESTS, which is not tidiness.
 *
 * Every test in this file shares one Nuxt app and therefore one router. A page left mounted keeps
 * watching that router, so the next test's navigation re-runs the previous test's watcher and its
 * debounced search timer, and the request the assertion reads may be one nobody in this test asked
 * for. Measured: the "clear all" case read the request made by the instance before it.
 */
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(route = '/', options: {
  data?: unknown[]
  meta?: typeof holder.meta
  status?: number
} = {}) {
  holder.calls = []
  holder.data = options.data ?? [project()]
  holder.meta = options.meta ?? { page: 1, perPage: 12, total: 1, totalPages: 1 }
  holder.status = options.status ?? 0
  holder.next = null
  const wrapper = await mountSuspended(ProjectsList, { route })
  mounted = wrapper
  await flushPromises()
  return wrapper
}

/**
 * Let a navigation land.
 *
 * An interaction here starts a CHAIN — `router.push`, the route update, the watcher, the request —
 * and only the last link is a promise this test holds. `flushPromises` alone leaves the assertion
 * reading the request made BEFORE the interaction, which passes or fails for the wrong reason. The
 * short real wait is what lets the whole chain drain; it is not a guess at a race.
 */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50))
  await flushPromises()
}

/** The query of the most recent `/admin/projects` request. */
function lastQuery(): Record<string, unknown> {
  const call = [...holder.calls].reverse().find(c => c.path === '/admin/projects')
  return (call?.options.query ?? {}) as Record<string, unknown>
}

describe('the list is filtered by the SERVER, and the URL says how', () => {
  it('sends the page and an explicit perPage, and never a locale', async () => {
    await mount()
    const call = holder.calls.find(c => c.path === '/admin/projects')
    // `locale: false` is mandatory on every admin call: the DTOs are `forbidNonWhitelisted`, so an
    // unsolicited `?locale=` is a 422 rather than a harmless extra parameter.
    expect(call?.options.locale).toBe(false)
    expect(lastQuery()).toMatchObject({ page: 1, perPage: 12 })
  })

  it('turns every filter in the address into a request parameter', async () => {
    await mount('/?page=2&q=api&published=yes&featured=no&sortBy=year&sortOrder=desc')
    expect(lastQuery()).toEqual({
      page: 2,
      perPage: 12,
      q: 'api',
      isPublished: true,
      featured: false,
      sortBy: 'year',
      sortOrder: 'desc'
    })
  })

  it('sends NO isPublished or featured by default, which is what returns both states', async () => {
    await mount()
    expect(lastQuery()).not.toHaveProperty('isPublished')
    expect(lastQuery()).not.toHaveProperty('featured')
  })

  it('sends `false` for a "no" filter — an omission and a false are different requests', async () => {
    await mount('/?published=no')
    expect(lastQuery().isPublished).toBe(false)
  })

  it('re-requests when the address changes, rather than narrowing what it already has', async () => {
    const wrapper = await mount()
    const before = holder.calls.length
    await wrapper.vm.$router.push({ query: { published: 'no', page: '3' } })
    await settle()
    expect(holder.calls.length).toBeGreaterThan(before)
    expect(lastQuery()).toMatchObject({ page: 3, isPublished: false })
  })
})

describe('the search box drives the URL, which drives the request', () => {
  it('issues a request carrying `q` after the operator stops typing', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-projects-search]').setValue('platform')
    // The box is debounced on purpose: a navigation per keystroke would put one history entry per
    // character between the operator and where they came from.
    expect(lastQuery()).not.toHaveProperty('q')

    await new Promise(resolve => setTimeout(resolve, 350))
    await settle()
    expect(lastQuery().q).toBe('platform')
  })

  it('returns to page 1 when the search changes, in ONE navigation', async () => {
    const wrapper = await mount('/?page=4')
    await wrapper.find('[data-projects-search]').setValue('api')
    await new Promise(resolve => setTimeout(resolve, 350))
    await settle()
    // A stale page number with a new filter asks the API for an offset the result set may not have.
    expect(lastQuery()).toMatchObject({ page: 1, q: 'api' })
  })

  it('drops `q` entirely when the box is emptied', async () => {
    const wrapper = await mount('/?q=api')
    expect(lastQuery().q).toBe('api')
    await wrapper.find('[data-projects-search]').setValue('   ')
    await new Promise(resolve => setTimeout(resolve, 350))
    await settle()
    expect(lastQuery()).not.toHaveProperty('q')
  })
})

describe('paging', () => {
  it('requests the chosen page', async () => {
    const wrapper = await mount('/', {
      data: [project()],
      meta: { page: 1, perPage: 12, total: 40, totalPages: 4 }
    })
    // The real control, clicked: the page buttons are what an operator uses, and going through
    // them proves the wiring rather than the handler in isolation.
    await wrapper.find('[data-projects-pagination] [aria-label="Page 3"]').trigger('click')
    await settle()
    expect(lastQuery().page).toBe(3)
  })

  it('renders no pagination when there is a single page', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-projects-pagination]').exists()).toBe(false)
  })
})

describe('clearing the filters', () => {
  it('removes every filter parameter at once and returns to page 1', async () => {
    const wrapper = await mount('/?page=2&q=api&published=yes&sortBy=year&sortOrder=desc')
    await wrapper.find('[data-projects-clear]').trigger('click')
    await settle()
    expect(lastQuery()).toEqual({ page: 1, perPage: 12 })
  })

  it('offers no Clear control when nothing is filtered', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-projects-clear]').exists()).toBe(false)
  })
})

describe('what a row states about a project', () => {
  it('renders the collection through the project UTable with a localized title per stable row', async () => {
    const wrapper = await mount('/', { data: [project()] })
    expect(wrapper.find('[data-projects-table]').exists()).toBe(true)
    expect(wrapper.find('[data-project-row="p1"]').exists()).toBe(true)
    expect(wrapper.find('[data-project-title="p1"]').text()).toBe('Content platform API')
  })

  it('shows publication, featured state and the current order', async () => {
    const wrapper = await mount('/', {
      data: [project({ isPublished: true, featured: true, order: 7 })]
    })
    expect(wrapper.find('[data-project-published="true"]').exists()).toBe(true)
    expect(wrapper.find('[data-project-featured]').exists()).toBe(true)
    expect(wrapper.find('[data-project-order="p1"]').text()).toBe('7')
  })

  it('says DRAFT, in words, for an unpublished project', async () => {
    // Never colour-only: the state is a word as well as a tint.
    const wrapper = await mount('/', { data: [project({ isPublished: false, featured: false })] })
    expect(wrapper.find('[data-project-published="false"]').text()).toBe('Draft')
    expect(wrapper.find('[data-project-featured]').exists()).toBe(false)
  })

  /**
   * TRANSLATION COMPLETENESS. The fixture has English only, so a page that fell back to the other
   * locale — or that simply printed whatever title it found — would show Arabic as present.
   */
  it('marks a locale the project has no translation for as MISSING', async () => {
    const wrapper = await mount('/', {
      data: [project({ translations: { en: translation() } })]
    })
    expect(wrapper.find('[data-project-translation="en:present"]').exists()).toBe(true)
    expect(wrapper.find('[data-project-translation="ar:missing"]').exists()).toBe(true)
    expect(wrapper.find('[data-project-translation="ar:present"]').exists()).toBe(false)
  })

  it('marks both present when both are written', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-project-translation="en:present"]').exists()).toBe(true)
    expect(wrapper.find('[data-project-translation="ar:present"]').exists()).toBe(true)
  })

  it('offers an edit link per project and a create action', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-project-edit="p1"]').attributes('href')).toBe('/dashboard/projects/p1')
    expect(wrapper.find('[data-projects-create]').attributes('href')).toBe('/dashboard/projects/new')
  })
})

describe('the answers that are not rows', () => {
  it('shows a FORBIDDEN surface for 403, not an empty list', async () => {
    // `403` is a different answer from "no projects" and gets a different surface (D11-2).
    const wrapper = await mount('/', { status: 403 })
    expect(wrapper.find('[data-projects-forbidden]').exists()).toBe(true)
    expect(wrapper.find('[data-projects-empty]').exists()).toBe(false)
  })

  it('shows a retryable error for any other failure', async () => {
    const wrapper = await mount('/', { status: 500 })
    expect(wrapper.find('[data-projects-failed]').exists()).toBe(true)
  })

  it('distinguishes an empty library from an empty FILTERED result', async () => {
    const bare = await mount('/', { data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } })
    expect(bare.find('[data-projects-empty]').text()).toContain('No projects yet')

    const filtered = await mount('/?q=nothing', { data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } })
    expect(filtered.find('[data-projects-empty]').text()).toContain('Nothing matches these filters')
  })
})

describe('refreshes preserve a usable collection', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('keeps rows visible through an in-flight failure and exposes an in-place retry', async () => {
    const wrapper = await mount('/', { data: [project({ id: 'held' })] })
    const refresh = deferred<{ data: unknown[], meta: typeof holder.meta }>()
    holder.next = refresh.promise

    await wrapper.vm.$router.push({ query: { q: 'next' } })
    await flushPromises()

    // The page must overlay the held list, not regress to its initial skeleton during a filter/page
    // transition. This assertion is the negative-control target for FE5-U3.
    expect(wrapper.find('[data-project-row="held"]').exists(), 'held row remains during pending refresh').toBe(true)
    expect(wrapper.find('[aria-busy="true"]').exists(), 'refresh overlay remains observable').toBe(true)

    refresh.reject(new Error('temporary failure'))
    await settle()
    expect(wrapper.find('[data-project-row="held"]').exists(), 'held row remains after refresh failure').toBe(true)
    expect(wrapper.find('[data-projects-stale]').exists(), 'stale retry is shown after refresh failure').toBe(true)
    expect(wrapper.find('[data-projects-failed]').exists()).toBe(false)

    holder.next = null
    holder.data = [project({ id: 'recovered' })]
    holder.meta = { page: 1, perPage: 12, total: 1, totalPages: 1 }
    await wrapper.find('[data-projects-stale-retry]').trigger('click')
    await settle()
    expect(wrapper.find('[data-project-row="recovered"]').exists(), 'retry replaces held data').toBe(true)
    expect(wrapper.find('[data-projects-stale]').exists()).toBe(false)
  })
})
