// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { ArticleListItem } from '~/types/models'
import Writing from './Writing.vue'

// Writing (FR-PUB-015 slice) caps the article list at 3 (the page already requests perPage 3, but the
// component enforces the cap itself). Empty result omits the section unless loading/erroring
// (NFR-DEGRADE).
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiSectionHead: {
    props: ['eyebrow', 'title', 'titleId'],
    template: '<div><h2 :id="titleId">{{ title }}</h2><slot name="action" /></div>'
  },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  ContentArticleRow: { template: '<div class="article-row">{{ article.slug }}</div>', props: ['article'] },
  AppLink: { template: '<a :href="to"><slot /></a>', props: ['to', 'external'] },
  UIcon: { template: '<i />', props: ['name'] }
}

const article = (overrides: Partial<ArticleListItem>): ArticleListItem => ({
  id: overrides.slug ?? 'id',
  title: 'Title',
  slug: 'article',
  excerpt: 'Excerpt',
  readingTimeMin: 5,
  publishAt: '2026-01-01T00:00:00.000Z',
  coverImageId: null,
  coverImage: null,
  category: { id: 'c1', name: 'Engineering', slug: 'engineering' },
  tags: [],
  availableLocales: ['en'],
  ...overrides
})

describe('HomeWriting', () => {
  it('caps the article list at 3, preserving order', async () => {
    const articles: ArticleListItem[] = [
      article({ slug: 'a' }),
      article({ slug: 'b' }),
      article({ slug: 'c' }),
      article({ slug: 'd' })
    ]
    const wrapper = await mountSuspended(Writing, { props: { articles }, global: { stubs } })
    const slugs = wrapper.findAll('.article-row').map(el => el.text())
    expect(slugs).toEqual(['a', 'b', 'c'])
  })

  it('hides when there are no articles and the section is idle', async () => {
    const wrapper = await mountSuspended(Writing, {
      props: { articles: [], pending: false, error: false },
      global: { stubs }
    })
    expect(wrapper.find('#writing-title').exists()).toBe(false)
  })

  it('shows a skeleton while pending, even with no articles yet', async () => {
    const wrapper = await mountSuspended(Writing, {
      props: { articles: null, pending: true },
      global: { stubs }
    })
    expect(wrapper.find('#writing-title').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders an inline error and emits retry', async () => {
    const wrapper = await mountSuspended(Writing, {
      props: { articles: null, error: true },
      global: { stubs }
    })
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
