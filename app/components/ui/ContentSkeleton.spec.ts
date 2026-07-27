// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ContentSkeleton from './ContentSkeleton.vue'

// ContentSkeleton (007 loading system) renders initial-load placeholders whose block geometry matches
// the real composition per variant, wrapped in one polite `role="status"` live region so assistive tech
// announces a single load rather than a wall of decorative (`aria-hidden`) blocks.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

describe('UiContentSkeleton', () => {
  it('exposes an accessible, localized status region regardless of variant', async () => {
    const wrapper = await mountSuspended(ContentSkeleton, { props: { variant: 'rows' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBe('state.loading')
    expect(wrapper.find('.sr-only').text()).toBe('state.loading')
  })

  it('default "rows" variant renders `count` generic blocks (default count 3)', async () => {
    const wrapper = await mountSuspended(ContentSkeleton)
    expect(wrapper.findAll('.skeleton')).toHaveLength(3)
  })

  it('"capabilities" variant renders 4 labelled columns regardless of count', async () => {
    const wrapper = await mountSuspended(ContentSkeleton, { props: { variant: 'capabilities', count: 99 } })
    expect(wrapper.findAll('.border-t')).toHaveLength(4)
  })

  it('"work" variant renders `count` hairline-separated rows', async () => {
    const wrapper = await mountSuspended(ContentSkeleton, { props: { variant: 'work', count: 2 } })
    expect(wrapper.findAll('.border-t')).toHaveLength(2)
  })

  it('"timeline" variant indents each row with ps-8', async () => {
    const wrapper = await mountSuspended(ContentSkeleton, { props: { variant: 'timeline', count: 1 } })
    expect(wrapper.find('.border-t').classes()).toContain('ps-8')
  })

  it('"articles" variant omits the second detail line that "work"/"timeline" show', async () => {
    const work = await mountSuspended(ContentSkeleton, { props: { variant: 'work', count: 1 } })
    const articles = await mountSuspended(ContentSkeleton, { props: { variant: 'articles', count: 1 } })
    expect(work.findAll('.skeleton')).toHaveLength(4)
    expect(articles.findAll('.skeleton')).toHaveLength(3)
  })

  it('"quotes" variant renders `count` pull-quote cards', async () => {
    const wrapper = await mountSuspended(ContentSkeleton, { props: { variant: 'quotes', count: 3 } })
    expect(wrapper.findAll('.border-t')).toHaveLength(3)
  })
})
