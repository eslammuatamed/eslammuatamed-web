// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ArticlesList from './index.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminArticle, AdminArticleTranslation } from '~/composables/admin-article-types'

/**
 * The Articles list, asserted through the REAL rendered page.
 *
 * `admin-articles-query.spec.ts` proves the query rules and `useAdminArticles.spec.ts` proves the
 * keep-or-clear rule behind §14.9 criterion 2. This file proves the PAGE renders the four states
 * distinctly — that a first load is a skeleton and not an empty list, that a failure with nothing
 * underneath is an error with a retry, that a 403 is neither, and that an empty filter says
 * something different from an empty library.
 *
 * The "failed refresh keeps the rows" half of criterion 2 is deliberately NOT asserted here. It is
 * reachable only by a second request for the SAME view, and this page has no in-page control that
 * issues one — inventing a Refresh button so a unit test could click it would be adding product
 * surface to serve the test. It is proven directly in `useAdminArticles.spec.ts`, and end to end in
 * the browser lane where a real revalidation happens.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  data: [] as unknown[],
  meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
  status: 0,
  /** When set, the request parks here until it is released — so an in-flight state is observable. */
  release: null as null | (() => void),
  makeError: null as null | ((status: number) => unknown)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  if (holder.release !== null) {
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.status !== 0) {
    throw holder.makeError?.(holder.status) ?? new Error('failed')
  }
  return { data: holder.data, meta: holder.meta }
})

holder.makeError = (status: number) =>
  new ApiError({ type: 'about:blank', title: 'Request failed', status })

function translation(over: Partial<AdminArticleTranslation> = {}): AdminArticleTranslation {
  return {
    title: 'A modular monolith in practice',
    slug: 'a-modular-monolith-in-practice',
    excerpt: 'e',
    body: '# b',
    readingTimeMin: 4,
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    ...over
  }
}

function article(over: Partial<AdminArticle> = {}): AdminArticle {
  return {
    id: 'a1',
    status: 'PUBLISHED',
    publishAt: '2026-08-01T09:00:00.000Z',
    categoryId: 'c1',
    coverImageId: null,
    tagIds: [],
    translations: { en: translation(), ar: translation({ title: 'الهندسة', slug: 'الهندسة' }) },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over
  }
}

function reset(rows: unknown[] = [article()], total = 1, totalPages = 1) {
  holder.calls = []
  holder.data = rows
  holder.meta = { page: 1, perPage: 12, total, totalPages }
  holder.status = 0
  holder.release = null
}

/**
 * MOUNTED AT `/`, NOT AT `/dashboard/articles`.
 *
 * `mountSuspended`'s `route` option performs a REAL `router.replace`, which runs the target route's
 * `definePageMeta` middleware — and `auth` redirects an unauthenticated test to `/dashboard/login`,
 * discarding the query string the test was setting. That was measured on the Projects list before
 * this module existed (`projects/index.spec.ts`), and it reproduces here: every filter arrived
 * empty. The page reads `route.query` and never `route.path`, so the query is the whole of what
 * these tests need to control.
 */
let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

/**
 * UNMOUNTED BETWEEN TESTS, which is not tidiness.
 *
 * Every test in this file shares one Nuxt app and therefore one router. A page left mounted keeps
 * watching that router, so the next test's navigation re-runs the previous test's watcher and the
 * request an assertion reads may be one nobody in this test asked for.
 */
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(options: { rows?: unknown[], total?: number, totalPages?: number, status?: number, park?: boolean } = {}) {
  reset(options.rows ?? [article()], options.total ?? 1, options.totalPages ?? 1)
  holder.status = options.status ?? 0
  if (options.park) holder.release = () => {}
  const wrapper = await mountSuspended(ArticlesList)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

/**
 * Let a navigation land.
 *
 * An interaction starts a CHAIN — `router.push`, the route update, the watcher, the request — and
 * only the last link is a promise this test holds. `flushPromises` alone leaves the assertion
 * reading the request made BEFORE the interaction.
 */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50))
  await flushPromises()
}

/** The query of the most recent `/admin/articles` request. */
function lastQuery(): Record<string, unknown> {
  const call = [...holder.calls].reverse().find(c => c.path === '/admin/articles')
  return (call?.options.query ?? {}) as Record<string, unknown>
}

/** Release a parked request and let it land. */
async function release(): Promise<void> {
  const resume = holder.release as unknown as () => void
  holder.release = null
  resume()
  await flushPromises()
}

describe('the address becomes the request', () => {
  it('sends page and perPage, and NEVER sends the default status', async () => {
    await mount()
    expect(holder.calls.at(-1)?.path).toBe('/admin/articles')
    expect(lastQuery()).toEqual({ page: 1, perPage: 12 })
    // `all` is this app's spelling, not the API's: under `forbidNonWhitelisted` an unsolicited
    // `status=all` is a 422, not a harmless extra parameter.
    expect(lastQuery()).not.toHaveProperty('status')
  })

  it('sends a real status from the address', async () => {
    const wrapper = await mount()
    await wrapper.vm.$router.push({ query: { status: 'DRAFT' } })
    await settle()
    expect(lastQuery()).toMatchObject({ status: 'DRAFT', page: 1 })
  })

  it('sends a page from the address', async () => {
    const wrapper = await mount()
    await wrapper.vm.$router.push({ query: { page: '3' } })
    await settle()
    expect(lastQuery()).toMatchObject({ page: 3 })
  })

  // The "changing the status returns to page 1" behaviour is asserted in the BROWSER lane, not
  // here. `USelect` is a Reka listbox rather than a native `<select>`, so `setValue` does not drive
  // it — and faking the interaction by pushing the URL the handler would have pushed would assert
  // the test's own arithmetic instead of the page's. `projects/index.spec.ts` never clicks its
  // selects for the same reason.

  it('passes admin calls locale-agnostically, as the admin DTOs require', async () => {
    await mount()
    expect(holder.calls.at(-1)?.options.locale).toBe(false)
  })
})

describe('§14.9 criterion 1 — a first load is a skeleton, never an empty list', () => {
  it('shows a busy placeholder and no rows while the first request is open, then the rows', async () => {
    const wrapper = await mount({ park: true })

    expect(wrapper.find('[data-article-row]').exists(), 'no rows before data resolves').toBe(false)
    expect(
      wrapper.find('[data-articles-empty]').exists(),
      'an empty state must not flash before the first response'
    ).toBe(false)
    expect(wrapper.find('[aria-busy="true"]').exists(), 'a busy placeholder must be on screen').toBe(true)

    await release()

    expect(wrapper.find('[data-article-row]').exists()).toBe(true)
    expect(wrapper.find('[aria-busy="true"]').exists(), 'the placeholder goes when the data lands').toBe(false)
  })
})

describe('§14.9 criterion 2 — a failed refresh must not destroy usable content', () => {
  /**
   * The gating this proves is one character wide and completely silent.
   *
   * `UiRequestState` tests `error` BEFORE content, so `:error="failed"` would blank the list the
   * moment any background refresh failed. The page passes `failed && !hasData` instead. A test that
   * only asserted "an error appeared" would pass against the broken version, because an error DOES
   * appear — it just takes the rows with it.
   *
   * Re-pushing `page=1` is a real refresh of the SAME view: the query object changes identity, the
   * parse recomputes, and the watcher re-issues the request for the view already on screen.
   */
  it('keeps the rows and reports staleness, instead of replacing them with an error', async () => {
    const wrapper = await mount()
    expect(wrapper.findAll('[data-article-row]')).toHaveLength(1)

    holder.status = 500
    await wrapper.vm.$router.push({ query: { page: '1' } })
    await settle()

    expect(
      wrapper.findAll('[data-article-row]'),
      'usable content must survive a failed background refresh'
    ).toHaveLength(1)
    expect(wrapper.find('[data-articles-stale]').exists(), 'staleness must be stated').toBe(true)
    expect(
      wrapper.find('[data-articles-failed]').exists(),
      'the full error surface must NOT replace rows that are still usable'
    ).toBe(false)
  })

  it('offers a retry from the stale notice that re-requests and recovers', async () => {
    const wrapper = await mount()
    holder.status = 500
    await wrapper.vm.$router.push({ query: { page: '1' } })
    await settle()
    expect(wrapper.find('[data-articles-stale]').exists()).toBe(true)

    holder.status = 0
    await wrapper.find('[data-articles-stale-retry]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-articles-stale]').exists(), 'a successful retry clears the notice').toBe(false)
    expect(wrapper.findAll('[data-article-row]')).toHaveLength(1)
  })
})

describe('§14.9 criterion 7 — error, empty and forbidden are three different answers', () => {
  it('a first load that fails shows error + retry, with no rows underneath', async () => {
    const wrapper = await mount({ rows: [], total: 0, status: 500 })

    expect(wrapper.find('[data-articles-failed]').exists()).toBe(true)
    expect(
      wrapper.find('[data-articles-failed] button').exists(),
      'the shared error component brings its own retry control'
    ).toBe(true)
    expect(wrapper.find('[data-articles-empty]').exists(), 'a failure is not an empty library').toBe(false)
  })

  it('the retry control re-issues the request', async () => {
    const wrapper = await mount({ rows: [], total: 0, status: 500 })
    const before = holder.calls.length

    await wrapper.find('[data-articles-failed] button').trigger('click')
    await flushPromises()
    expect(holder.calls.length, 'retry must actually re-request').toBeGreaterThan(before)
  })

  it('a 403 is answered on its own terms — not as an error and not as an empty list', async () => {
    const wrapper = await mount({ rows: [], total: 0, status: 403 })

    expect(wrapper.find('[data-articles-forbidden]').exists()).toBe(true)
    expect(
      wrapper.find('[data-articles-failed]').exists(),
      'a 403 gets no retry button — retrying it cannot work'
    ).toBe(false)
    expect(wrapper.find('[data-articles-empty]').exists()).toBe(false)
  })

  it('an empty library invites the first article; an empty FILTER does not', async () => {
    const wrapper = await mount({ rows: [], total: 0 })
    expect(wrapper.find('[data-articles-empty]').exists()).toBe(true)
    expect(
      wrapper.find('[data-articles-empty-create]').exists(),
      'an empty library offers the create action'
    ).toBe(true)

    await wrapper.vm.$router.push({ query: { status: 'ARCHIVED' } })
    await settle()
    expect(wrapper.find('[data-articles-empty]').exists()).toBe(true)
    expect(
      wrapper.find('[data-articles-empty-create]').exists(),
      'an empty filter must say "change the filter", not "write your first"'
    ).toBe(false)
  })
})

describe('row presentation', () => {
  it('marks a missing translation as missing, from the translation map itself', async () => {
    const wrapper = await mount({ rows: [article({ id: 'en-only', translations: { en: translation() } })] })

    expect(wrapper.find('[data-article-translation="en:present"]').exists()).toBe(true)
    expect(wrapper.find('[data-article-translation="ar:missing"]').exists()).toBe(true)
    // Nothing may substitute the English title for the absent Arabic one.
    expect(wrapper.find('[data-article-translation="ar:present"]').exists()).toBe(false)
  })

  it('renders the status as a WORD, not colour alone', async () => {
    const wrapper = await mount({ rows: [article({ status: 'SCHEDULED' })] })
    const badge = wrapper.find('[data-article-status="SCHEDULED"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text().trim().length, 'the chip must carry its own text').toBeGreaterThan(0)
  })

  it('links each row to its own editor', async () => {
    const wrapper = await mount({ rows: [article({ id: 'abc-123' })] })
    expect(wrapper.find('[data-article-edit="abc-123"]').attributes('href'))
      .toBe('/dashboard/articles/abc-123')
  })

  it('renders no raw i18n key path anywhere on the surface', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).not.toMatch(/dashboard\.articles\.[a-zA-Z]/)
  })
})
