import { describe, expect, it } from 'vitest'
import {
  ADMIN_ARTICLES_PER_PAGE,
  adminArticlesQueryKey,
  adminArticlesRequestQuery,
  parseAdminArticlesQuery
} from './admin-articles-query'

/**
 * The route-query contract for `/dashboard/articles`.
 *
 * TOTAL BY CONSTRUCTION: every input yields a valid result, so the page never branches on a parse
 * failure and a mistyped address degrades to the default view rather than to an error.
 */

describe('parsing is total — a malformed address degrades, never throws', () => {
  it('defaults an empty query', () => {
    expect(parseAdminArticlesQuery({})).toEqual({ page: 1, status: 'all' })
  })

  it.each([
    ['page=0', { page: '0' }],
    ['a negative page', { page: '-3' }],
    ['a fractional page', { page: '1.5' }],
    ['a non-numeric page', { page: 'three' }],
    ['an empty page', { page: '' }]
  ])('falls back to page 1 for %s', (_label, query) => {
    expect(parseAdminArticlesQuery(query).page).toBe(1)
  })

  it('falls back to `all` for a status outside the contract enum', () => {
    expect(parseAdminArticlesQuery({ status: 'RETIRED' }).status).toBe('all')
  })

  it('accepts every status the contract defines', () => {
    for (const status of ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const) {
      expect(parseAdminArticlesQuery({ status }).status).toBe(status)
    }
  })

  it('takes the FIRST value when a parameter is repeated', () => {
    // `?page=2&page=9` really does arrive as an array from Vue Router.
    expect(parseAdminArticlesQuery({ page: ['2', '9'] }).page).toBe(2)
    expect(parseAdminArticlesQuery({ status: ['DRAFT', 'PUBLISHED'] }).status).toBe('DRAFT')
  })

  it('reads a trimmed title search from the URL and omits whitespace-only search', () => {
    expect(parseAdminArticlesQuery({ q: '  nestjs  ' }) as { q?: string }).toMatchObject({ q: 'nestjs' })
    expect((parseAdminArticlesQuery({ q: '   ' }) as { q?: string }).q).toBeUndefined()
  })

  it('takes the first repeated search value and clamps it to the backend maximum', () => {
    expect(parseAdminArticlesQuery({ q: ['nest', 'ignored'] }) as { q?: string }).toMatchObject({ q: 'nest' })
    expect((parseAdminArticlesQuery({ q: 'x'.repeat(121) }) as { q?: string }).q).toHaveLength(120)
  })
})

describe('the request it builds', () => {
  it('always sends an explicit perPage, so the URL and the request agree', () => {
    expect(adminArticlesRequestQuery({ page: 1, status: 'all' }))
      .toEqual({ page: 1, perPage: ADMIN_ARTICLES_PER_PAGE })
  })

  it('NEVER sends `all` — it is this app\'s spelling, not a value the API accepts', () => {
    expect(adminArticlesRequestQuery({ page: 1, status: 'all' })).not.toHaveProperty('status')
  })

  it('sends a real status through unchanged', () => {
    expect(adminArticlesRequestQuery({ page: 2, status: 'DRAFT' }))
      .toEqual({ page: 2, perPage: ADMIN_ARTICLES_PER_PAGE, status: 'DRAFT' })
  })

  it('sends a committed title search alongside status and pagination', () => {
    expect(adminArticlesRequestQuery({ page: 2, status: 'PUBLISHED', q: 'nestjs' } as never))
      .toEqual({ page: 2, perPage: ADMIN_ARTICLES_PER_PAGE, status: 'PUBLISHED', q: 'nestjs' })
  })

  it('sends no sort parameter; title search is the only supported text query', () => {
    const built = adminArticlesRequestQuery({ page: 1, status: 'PUBLISHED' })
    expect(Object.keys(built).sort()).toEqual(['page', 'perPage', 'status'])
  })
})

describe('the view identity behind the keep-or-clear rule', () => {
  it('is equal for the same view and different for a different one', () => {
    const key = adminArticlesQueryKey
    expect(key({ page: 1, status: 'all' })).toBe(key({ page: 1, status: 'all' }))
    expect(key({ page: 1, status: 'all' })).not.toBe(key({ page: 2, status: 'all' }))
    expect(key({ page: 1, status: 'all' })).not.toBe(key({ page: 1, status: 'DRAFT' }))
    expect(
      key({ page: 1, status: 'all', q: 'nest' } as never),
      'different title searches must never share stale-response identity'
    ).not.toBe(key({ page: 1, status: 'all', q: 'nestjs' } as never))
  })
})
