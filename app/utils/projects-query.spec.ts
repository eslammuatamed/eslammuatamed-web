import { describe, expect, it } from 'vitest'
import { buildFilterQuery, buildPageQuery, readPage, readTechnology } from './projects-query'

const UUID = '019f89b5-3050-7161-af37-3e9a2cbf41ed'

describe('readTechnology', () => {
  it('reads a technology UUID from the query', () => {
    expect(readTechnology({ technology: UUID })).toBe(UUID)
  })

  it.each([
    ['absent', {}],
    ['empty string', { technology: '' }],
    ['null (bare ?technology)', { technology: null }],
    ['repeated parameter', { technology: [UUID, UUID] }]
  ])('treats %s as no filter', (_label, query) => {
    expect(readTechnology(query)).toBeUndefined()
  })
})

describe('readPage', () => {
  it('reads a valid page number', () => {
    expect(readPage({ page: '3' })).toBe(3)
  })

  it.each([
    ['absent', {}],
    ['zero', { page: '0' }],
    ['negative', { page: '-2' }],
    ['fractional', { page: '1.5' }],
    ['non-numeric', { page: 'abc' }]
  ])('falls back to page 1 for %s', (_label, query) => {
    expect(readPage(query)).toBe(1)
  })
})

describe('buildFilterQuery', () => {
  it('resets pagination when the filter changes', () => {
    // The absence of `page` is the whole point: keeping page 3 across a filter change would land on
    // an out-of-range page and render an empty list that reads as a broken filter.
    expect(buildFilterQuery(UUID)).toEqual({ technology: UUID })
  })

  it('clears the query entirely when the filter is removed', () => {
    expect(buildFilterQuery(undefined)).toEqual({})
  })
})

describe('buildPageQuery', () => {
  it('carries the active filter across a page change', () => {
    expect(buildPageQuery(UUID, 2)).toEqual({ technology: UUID, page: '2' })
  })

  it('omits page=1 so the first page has exactly one URL', () => {
    expect(buildPageQuery(UUID, 1)).toEqual({ technology: UUID })
  })

  it('omits the filter when none is active', () => {
    expect(buildPageQuery(undefined, 3)).toEqual({ page: '3' })
  })

  it('produces an empty query for the unfiltered first page', () => {
    expect(buildPageQuery(undefined, 1)).toEqual({})
  })
})
