// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ArticleListItem } from '~/types/models'
import { formatDate } from '../../utils/format'
import ArticleRow from './ArticleRow.vue'

// Article row (FR-PUB-015 writing slice) — an article as a reading-list entry: title links to
// `/blog/{slug}`, category name, reading-time label and the formatted publish date.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  UIcon: { template: '<i />', props: ['name'] }
}

const article = (overrides: Partial<ArticleListItem> = {}): ArticleListItem => ({
  id: 'a1',
  title: 'Designing a modular monolith',
  slug: 'designing-a-modular-monolith',
  excerpt: 'Why one deployable with hard module seams beats microservices here.',
  readingTimeMin: 7,
  publishAt: '2026-03-15T00:00:00.000Z',
  coverImageId: null,
  coverImage: null,
  category: { id: 'c1', name: 'Engineering', slug: 'engineering' },
  tags: [],
  availableLocales: ['en'],
  ...overrides
})

describe('ContentArticleRow', () => {
  it('renders the title linking to /blog/{slug}', async () => {
    const wrapper = await mountSuspended(ArticleRow, { props: { article: article() }, global: { stubs } })
    const link = wrapper.find('h3 a')
    expect(link.text()).toBe('Designing a modular monolith')
    expect(link.attributes('href')).toBe('/blog/designing-a-modular-monolith')
  })

  it('renders the category name and the reading-time label', async () => {
    const wrapper = await mountSuspended(ArticleRow, { props: { article: article() }, global: { stubs } })
    expect(wrapper.text()).toContain('Engineering')
    expect(wrapper.text()).toContain('blog.minRead')
  })

  it('renders the formatted publish date', async () => {
    const art = article()
    const wrapper = await mountSuspended(ArticleRow, { props: { article: art }, global: { stubs } })
    const time = wrapper.find('time')
    expect(time.attributes('datetime')).toBe(art.publishAt)
    expect(time.text()).toBe(formatDate(art.publishAt!, 'en'))
  })
})
