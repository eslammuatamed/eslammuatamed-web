// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ArticleListItem } from '~/types/models'
import LatestArticles from './LatestArticles.vue'

// Shows up to 3 latest articles (FR-PUB-014); omits itself when empty (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const make = (id: string): ArticleListItem => ({
  id,
  title: id,
  slug: id,
  excerpt: '',
  readingTimeMin: 1,
  publishAt: null,
  coverImageId: null,
  coverImage: null,
  category: { id: 'c', name: 'Cat', slug: 'cat' },
  tags: [],
  availableLocales: ['en']
})

const stubs = {
  UContainer: { template: '<div><slot /></div>' },
  UiSectionHeader: { template: '<div><slot name="action" /></div>', props: ['eyebrow', 'title'] },
  UiStateError: { template: '<div class="state-error" />' },
  UiSectionSkeleton: { template: '<div />', props: ['count'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  ContentArticleCard: { template: '<article class="acard">{{ article.id }}</article>', props: ['article'] }
}

describe('HomeLatestArticles', () => {
  it('renders at most 3 article cards', async () => {
    const articles = [make('a'), make('b'), make('c'), make('d')]
    const wrapper = await mountSuspended(LatestArticles, { props: { articles }, global: { stubs } })
    expect(wrapper.findAll('.acard')).toHaveLength(3)
  })

  it('omits the section when there are no articles', async () => {
    const wrapper = await mountSuspended(LatestArticles, { props: { articles: [] }, global: { stubs } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
