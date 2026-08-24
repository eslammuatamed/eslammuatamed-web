// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import SeoPage from './index.vue'
import { PAGE_SEO_PAGE_ORDER } from '~/composables/useAdminPageSeo'
import { ApiError } from '~/utils/api-error'

/**
 * Unit coverage for the Static Page SEO read surface (FE4-U1c): ONE list read populates everything;
 * presentation order is the frontend product order regardless of server order; selection is local,
 * `home`-first and refresh-stable; both locale blocks render with pinned directions; and the
 * surface is structurally READ-ONLY — no write verb appears in its source and no non-GET request
 * can leave it.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ method: string, path: string }>,
  response: null as unknown,
  /** Hold the NEXT response in flight (request-state / stale-data proofs). */
  holdFirst: false,
  release: null as null | (() => void)
}))

mockNuxtImport('useApi', () => () => async (path: string, init?: { method?: string }) => {
  holder.calls.push({ method: init?.method ?? 'GET', path })
  if (holder.holdFirst) {
    holder.holdFirst = false
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.response && typeof holder.response === 'object' && 'status' in (holder.response as object)) {
    throw new ApiError({ type: 'about:blank', title: 'failed', status: (holder.response as { status: number }).status })
  }
  return { data: holder.response }
})

type Row = {
  pageKey: string
  translations: Record<string, {
    metaTitle: string | null
    metaDescription: string | null
    canonicalUrl: string | null
    ogImageId: string | null
  }>
}

const OG_ID = '00000000-0000-4000-b100-000000000001'

function row(pageKey: string, en: Partial<Row['translations']['en']> = {}, ar: Partial<Row['translations']['en']> = {}): Row {
  const base = { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageId: null }
  return {
    pageKey,
    translations: {
      en: { ...base, ...en },
      ar: { ...base, ...ar }
    }
  }
}

/** All seven pages; individual tests scramble the ARRAY order they arrive in. */
function seedRows(): Row[] {
  return [
    row('home', { metaTitle: 'Home title' }, { metaTitle: 'الرئيسية' }),
    row('about',
      {
        metaTitle: 'About — Eslam Muatamed',
        metaDescription: 'Engineering background.',
        canonicalUrl: 'https://eslammuatamed.com/about',
        ogImageId: OG_ID
      },
      { metaTitle: 'نبذة — إسلام معتمد' }),
    row('experience'),
    row('projects'),
    row('blog'),
    row('resume'),
    row('contact')
  ]
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

beforeEach(() => {
  document.cookie = 'dashboard_locale=; Max-Age=0; path=/'
  holder.holdFirst = false
  if (holder.release) { holder.release(); holder.release = null }
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(config: { data?: unknown, arabicChrome?: boolean } = {}): Promise<typeof mounted> {
  holder.calls = []
  holder.response = config.data ?? seedRows()
  if (config.arabicChrome) document.cookie = 'dashboard_locale=ar; path=/'
  const wrapper = await mountSuspended(SeoPage)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

/** Mount with the FIRST response held in flight, for initial-pending and stale-refresh proofs. */
async function mountHeld(data: unknown): Promise<Awaited<ReturnType<typeof mountSuspended>>> {
  holder.calls = []
  holder.response = data
  holder.holdFirst = true
  const wrapper = await mountSuspended(SeoPage)
  mounted = wrapper
  await flushPromises()
  return wrapper
}

async function releaseResponse(data?: unknown): Promise<void> {
  if (data !== undefined) holder.response = data
  holder.release?.()
  holder.release = null
  await flushPromises()
}

const selectKeys = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper.findAll('[data-seo-page-select]')
    .map((node: { attributes: (name: string) => string | undefined }) => node.attributes('data-seo-page-select'))

describe('the read — one list request is the entire surface', () => {
  it('issues exactly ONE GET /admin/seo/pages and NEVER a detail or public read', async () => {
    await mount()
    expect(holder.calls).toHaveLength(1)
    expect(holder.calls[0]).toEqual({ method: 'GET', path: '/admin/seo/pages' })
    for (const call of holder.calls) {
      expect(call.path.startsWith('/admin/seo/pages/'), call.path).toBe(false)
      // The PUBLIC override endpoint belongs to the public site, not to this admin surface.
      expect(call.path.startsWith('/seo/pages'), call.path).toBe(false)
    }
  })

  it('represents EXACTLY the seven closed page keys, none invented', async () => {
    const wrapper = await mount()
    expect(selectKeys(wrapper)).toHaveLength(7)
    expect([...selectKeys(wrapper)].sort()).toEqual([...PAGE_SEO_PAGE_ORDER].sort())
  })

  it('renders the PRODUCT order even when the server array arrives scrambled', async () => {
    // Deliberately reversed server order — the contract promises none, so this must not matter.
    const scrambled = [...seedRows()].reverse()
    const wrapper = await mount({ data: scrambled })
    expect(selectKeys(wrapper)).toEqual([...PAGE_SEO_PAGE_ORDER])
  })
})

describe('selection — local state, home-first, refresh-stable', () => {
  it('selects home BY NAME on first render', async () => {
    const wrapper = await mount()
    const selected = wrapper.find('[data-seo-page-select][aria-selected="true"]')
    expect(selected.attributes('data-seo-page-select')).toBe('home')
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).toContain('Home title')
  })

  it('selecting another page swaps the displayed state', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-seo-page-select="about"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).toContain('About — Eslam Muatamed')
    expect(wrapper.find('[data-seo-value-canonical="en"]').text()).toContain('https://eslammuatamed.com/about')
  })

  it('selection SURVIVES a background refresh that replaces the rows', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    // A refresh brings NEW data (home's title changed server-side); about STAYS selected.
    const refreshed = seedRows().map(rowItem =>
      rowItem.pageKey === 'home' ? row('home', { metaTitle: 'Home title v2' }) : rowItem
    )
    holder.holdFirst = true
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()
    await releaseResponse(refreshed)

    expect(wrapper.find('[data-seo-page-select="about"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).not.toContain('v2')
    // And the refreshed value IS there once the operator switches back to home.
    await wrapper.find('[data-seo-page-select="home"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).toContain('Home title v2')
    expect(holder.calls.filter(call => call.path === '/admin/seo/pages')).toHaveLength(2)
  })

  it('a MISSING selected key falls back deterministically to home after refresh', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()

    // Contract-impossible but defensive: the refreshed collection no longer contains `about`.
    const withoutAbout = seedRows().filter(rowItem => rowItem.pageKey !== 'about')
    holder.holdFirst = true
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()
    await releaseResponse(withoutAbout)

    const selected = wrapper.find('[data-seo-page-select][aria-selected="true"]')
    expect(selected.attributes('data-seo-page-select')).toBe('home')
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
  })
})

describe('the read-only display per locale', () => {
  it('renders ENGLISH values for the selected page', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).toBe('About — Eslam Muatamed')
    expect(wrapper.find('[data-seo-value-meta-description="en"]').text()).toBe('Engineering background.')
    expect(wrapper.find('[data-seo-value-canonical="en"]').text()).toBe('https://eslammuatamed.com/about')
    expect(wrapper.find('[data-seo-value-og-image="en"]').text()).toContain(OG_ID)
  })

  it('renders ARABIC values independently, never falling back to English', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-seo-value-meta-title="ar"]').text()).toBe('نبذة — إسلام معتمد')
    // Arabic has no canonical override: the explicit not-set state, NOT the English value.
    expect(wrapper.find('[data-seo-value-canonical="ar"]').text()).not.toContain('eslammuatamed.com/about')
  })

  it('NULL values show the explicit localized not-set state, never an empty field', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    for (const selector of ['[data-seo-value-canonical="ar"]', '[data-seo-value-meta-description="ar"]']) {
      const text = wrapper.find(selector).text()
      expect(text).toMatch(/Not set/)
      expect(text).not.toContain('Engineering')
    }
  })

  it('canonical values stay LTR under an ARABIC dashboard chrome', async () => {
    const wrapper = await mount({ arabicChrome: true })
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    await flushPromises()
    for (const node of wrapper.findAll('[data-seo-value-canonical]')) {
      expect(node.attributes('dir')).toBe('ltr')
    }
    // The chrome really was Arabic for this mount — the test would be vacuous otherwise.
    expect(document.cookie).toContain('dashboard_locale=ar')
  })
})

describe('the request-state contract', () => {
  it('initial load with NO usable data renders the skeleton, then the loaded surface', async () => {
    const wrapper = await mountHeld(seedRows())
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(false)
    await releaseResponse()
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
  })

  it('error with NO usable data renders error + retry, and retry REFETCHES the collection', async () => {
    const wrapper = await mount({ data: { status: 500 } })
    expect(wrapper.find('[data-seo-failed]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(false)

    holder.response = seedRows()
    await wrapper.find('[data-seo-failed] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
    expect(holder.calls.filter(call => call.path === '/admin/seo/pages')).toHaveLength(2)
  })

  it('FORBIDDEN renders the established denied state, not empty, not error', async () => {
    const wrapper = await mount({ data: { status: 403 } })
    expect(wrapper.find('[data-seo-forbidden]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-failed]').exists()).toBe(false)
    expect(wrapper.find('[data-seo-empty]').exists()).toBe(false)
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(false)
  })

  it('an EMPTY collection renders the explicit empty state', async () => {
    const wrapper = await mount({ data: [] })
    expect(wrapper.find('[data-seo-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(false)
  })

  it('a REFRESH keeps usable data visible and its indication is restrained', async () => {
    const wrapper = await mountHeld(seedRows())
    await releaseResponse()
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)

    // Hold the SECOND response in flight: the loaded surface stays, values unchanged.
    holder.holdFirst = true
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await flushPromises()
    expect(holder.calls).toHaveLength(2)
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
    expect(wrapper.find('[data-seo-value-meta-title="en"]').text()).toContain('Home title')

    await releaseResponse(seedRows())
    expect(wrapper.find('[data-seo-loaded]').exists()).toBe(true)
  })
})

describe('structurally READ-ONLY — no write affordance exists', () => {
  it('every request the surface can issue is a GET to the single admin list', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-seo-page-select="about"]').trigger('click')
    holder.holdFirst = true
    await wrapper.find('[data-seo-refresh]').trigger('click')
    await releaseResponse(seedRows())
    for (const call of holder.calls) {
      expect(call.method).toBe('GET')
      expect(call.path).toBe('/admin/seo/pages')
    }
  })

  it('the page source contains no mutation verb, picker, form control or save affordance', () => {
    // `import.meta.url` is a virtual app path under the Nuxt test environment, so resolve from cwd.
    const source = readFileSync('app/pages/dashboard/seo/index.vue', 'utf8')
    expect(source).not.toMatch(/method:\s*['"](?:PATCH|POST|DELETE)['"]/i)
    expect(source).not.toMatch(/\b(buildPageSeoPatch|useAdminPageSeoWrites|MediaPicker)\b/)
    expect(source).not.toMatch(/<(UForm|UInput|UTextarea|input|textarea)\b/i)
    expect(source).not.toMatch(/data-seo-save|@submit/i)
  })
})
