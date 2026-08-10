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

  // D10-20: the API returns `category: null` when the category has no translation in the requested
  // locale. Absence is rendered as absence — no chip, no placeholder, and the row still reads.
  describe('with an untranslated category (D10-20)', () => {
    const withoutCategory = () =>
      mountSuspended(ArticleRow, { props: { article: article({ category: null }) }, global: { stubs } })

    it('still renders the article', async () => {
      const wrapper = await withoutCategory()
      expect(wrapper.find('h3 a').text()).toBe('Designing a modular monolith')
      expect(wrapper.text()).toContain('blog.minRead')
    })

    it('renders no category name and no placeholder in its place', async () => {
      const wrapper = await withoutCategory()
      expect(wrapper.text()).not.toContain('Engineering')
      expect(wrapper.text()).not.toContain('Uncategorized')
    })

    it('drops the category separator so the meta line does not open on a stray dot', async () => {
      // The meta line is whatever contains the <time> — found structurally, not by class, so a
      // styling change cannot quietly turn this assertion into a no-op.
      const metaLine = (w: Awaited<ReturnType<typeof withoutCategory>>) =>
        w.find('time').element.parentElement!

      const withCategory = await mountSuspended(ArticleRow, {
        props: { article: article() },
        global: { stubs }
      })
      // Normally the line opens on the category, then a separator, then the date.
      expect(metaLine(withCategory).firstElementChild?.textContent).toBe('Engineering')
      expect(metaLine(withCategory).querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2)

      // Without a category the line opens directly on the date, one separator lighter — the
      // remaining one still divides date from reading time.
      const wrapper = await withoutCategory()
      expect(metaLine(wrapper).firstElementChild?.tagName.toLowerCase()).toBe('time')
      expect(metaLine(wrapper).querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1)
      expect(metaLine(wrapper).textContent!.trimStart().startsWith('·')).toBe(false)
    })

    it('emits no category link at all, empty-query or otherwise', async () => {
      const wrapper = await withoutCategory()
      const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
      expect(hrefs).toEqual(['/blog/designing-a-modular-monolith'])
      expect(hrefs.some((href) => href.includes('category='))).toBe(false)
    })
  })
})
