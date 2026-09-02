// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TaxonomyRedirectPage from './index.vue'

const redirect = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => redirect)

afterEach(() => redirect.mockReset())

describe('the legacy Taxonomy route', () => {
  it('retains dashboard authentication and replaces the legacy history entry with Categories', async () => {
    redirect.mockResolvedValue(undefined)
    const wrapper = await mountSuspended(TaxonomyRedirectPage)
    expect(redirect).toHaveBeenCalledWith('/dashboard/categories', { replace: true })
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })
})
