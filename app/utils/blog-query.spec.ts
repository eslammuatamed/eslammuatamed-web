import { describe, expect, it } from 'vitest'
import { ARTICLES_PER_PAGE, buildBlogPageQuery, buildCategoryQuery, readCategory } from './blog-query'

// These rules are invisible in the rendered output until they are wrong, and each has a specific
// failure mode: a filter change that kept `page` lands on an out-of-range page and looks like a broken
// filter; pagination that dropped `category` silently widens the result set mid-journey; emitting
// `page=1` or `category=` creates a second URL for the same content.

describe('ARTICLES_PER_PAGE', () => {
  it('is 8, and inside the contract\'s 1..50 perPage bounds', () => {
    // Pinned to the value: the eight-per-page layout is the requirement, and a bounds-only assertion
    // would still pass if it silently reverted to the API's default of 12.
    expect(ARTICLES_PER_PAGE).toBe(8)
    expect(ARTICLES_PER_PAGE).toBeGreaterThanOrEqual(1)
    expect(ARTICLES_PER_PAGE).toBeLessThanOrEqual(50)
  })
})

describe('readCategory', () => {
  it('reads a non-empty string as the active filter', () => {
    expect(readCategory({ category: 'engineering' })).toBe('engineering')
  })

  it('treats absent, empty and repeated values as unfiltered', () => {
    expect(readCategory({})).toBeUndefined()
    // An empty string must not become `category=`, which the contract answers with a 422.
    expect(readCategory({ category: '' })).toBeUndefined()
    // `?category=a&category=b` arrives as an array; there is no single active filter, so it is "all"
    // rather than an arbitrary pick of one.
    expect(readCategory({ category: ['a', 'b'] })).toBeUndefined()
    expect(readCategory({ category: null })).toBeUndefined()
  })

  it('does NOT validate the slug against a pattern', () => {
    // Category slugs are per-locale (D04-2) and authored in the CMS, including Arabic ones. A
    // client-side format guard would reject legitimate values the API accepts, and the page already
    // distinguishes "not selectable in this locale" using the real category list.
    expect(readCategory({ category: 'هندسة-البرمجيات' })).toBe('هندسة-البرمجيات')
  })
})

describe('buildCategoryQuery', () => {
  it('drops page so a filter change returns to the first page', () => {
    // Keeping page 3 across a filter change lands out of range and renders an empty list that reads as
    // a broken filter rather than as the end of a short result set.
    expect(buildCategoryQuery('engineering')).toEqual({ category: 'engineering' })
  })

  it('emits no category key at all when clearing', () => {
    expect(buildCategoryQuery(undefined)).toEqual({})
  })
})

describe('buildBlogPageQuery', () => {
  it('carries the active filter into a page change', () => {
    // Dropping it here would silently widen the result set as the visitor pages through.
    expect(buildBlogPageQuery('engineering', 2)).toEqual({ category: 'engineering', page: '2' })
  })

  it('omits page=1, so one page of content keeps one URL', () => {
    expect(buildBlogPageQuery('engineering', 1)).toEqual({ category: 'engineering' })
    expect(buildBlogPageQuery(undefined, 1)).toEqual({})
  })

  it('emits the page as a string, the form a URL actually carries', () => {
    expect(buildBlogPageQuery(undefined, 4)).toEqual({ page: '4' })
  })
})
