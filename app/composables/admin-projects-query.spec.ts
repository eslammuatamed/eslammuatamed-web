import { describe, expect, it } from 'vitest'
import {
  ADMIN_PROJECTS_PER_PAGE,
  adminProjectsRequestQuery,
  parseAdminProjectsQuery
} from './admin-projects-query'

/**
 * The list's query contract.
 *
 * Two things are being proved, and they are different. The PARSER must be total — every address a
 * hand-edit can produce yields a usable view rather than an error — and the REQUEST BUILDER must
 * send exactly what the API accepts, since `forbidNonWhitelisted` turns a stray parameter into a
 * 422 rather than something harmless.
 */

const parse = parseAdminProjectsQuery

describe('parseAdminProjectsQuery — defaults', () => {
  it('reads an empty query as page 1, no search, and both states of both filters', () => {
    expect(parse({})).toEqual({
      page: 1,
      q: undefined,
      published: 'all',
      featured: 'all',
      sortBy: undefined,
      sortOrder: 'asc'
    })
  })

  it('defaults the filters to `all`, because omitting them returns BOTH states from the API', () => {
    // The operator opening the module must see drafts as well as published work; anything else
    // would hide the very rows the dashboard exists to manage.
    expect(parse({}).published).toBe('all')
    expect(parse({}).featured).toBe('all')
  })
})

describe('parseAdminProjectsQuery — a malformed address is corrected, never rejected', () => {
  it.each([
    ['abc', 1],
    ['0', 1],
    ['-3', 1],
    ['2.5', 1],
    ['', 1],
    ['4', 4]
  ])('reads ?page=%s as %i', (input, expected) => {
    expect(parse({ page: input }).page).toBe(expected)
  })

  it('takes the first entry when a parameter is repeated', () => {
    // `?page=2&page=9` really does arrive as an array; an array must not crash the parse.
    expect(parse({ page: ['2', '9'] }).page).toBe(2)
    expect(parse({ published: ['no', 'yes'] }).published).toBe('no')
  })

  it('reads an unrecognised filter or sort column as its default rather than erroring', () => {
    expect(parse({ published: 'maybe' }).published).toBe('all')
    expect(parse({ featured: '1' }).featured).toBe('all')
    expect(parse({ sortBy: 'title' }).sortBy).toBeUndefined()
    expect(parse({ sortOrder: 'sideways' }).sortOrder).toBe('asc')
  })
})

describe('parseAdminProjectsQuery — the search', () => {
  it('has exactly ONE representation of "no search"', () => {
    // `?q=` and no `q` at all must not be two states that fetch two different URLs.
    expect(parse({ q: '' }).q).toBeUndefined()
    expect(parse({ q: '   ' }).q).toBeUndefined()
    expect(parse({}).q).toBeUndefined()
  })

  it('trims the search', () => {
    expect(parse({ q: '  api platform ' }).q).toBe('api platform')
  })

  it('CLAMPS an over-long search to the contract limit instead of discarding it', () => {
    // 120 chars is a 422 boundary (D10-18). Dropping the whole search would read as "your filter did
    // nothing"; shortening it does what the operator asked, as far as the API allows.
    const long = 'x'.repeat(200)
    expect(parse({ q: long }).q).toHaveLength(120)
  })
})

describe('adminProjectsRequestQuery — what actually goes on the wire', () => {
  it('always sends the page and the explicit perPage', () => {
    expect(adminProjectsRequestQuery(parse({ page: '3' }))).toEqual({
      page: 3,
      perPage: ADMIN_PROJECTS_PER_PAGE
    })
  })

  it('OMITS a filter set to `all` — the absence of the parameter is what returns both states', () => {
    const sent = adminProjectsRequestQuery(parse({}))
    expect(sent).not.toHaveProperty('isPublished')
    expect(sent).not.toHaveProperty('featured')
    expect(sent).not.toHaveProperty('q')
  })

  it('sends `false`, not an omission, when a filter is set to `no`', () => {
    // These are different requests: omitted means "either", `false` means "drafts only".
    const sent = adminProjectsRequestQuery(parse({ published: 'no', featured: 'no' }))
    expect(sent.isPublished).toBe(false)
    expect(sent.featured).toBe(false)
  })

  it('sends `true` when a filter is set to `yes`', () => {
    const sent = adminProjectsRequestQuery(parse({ published: 'yes', featured: 'yes' }))
    expect(sent.isPublished).toBe(true)
    expect(sent.featured).toBe(true)
  })

  it('never sends `sortOrder` without `sortBy`, which the contract documents as ignored', () => {
    const sent = adminProjectsRequestQuery(parse({ sortOrder: 'desc' }))
    expect(sent).not.toHaveProperty('sortOrder')
    expect(sent).not.toHaveProperty('sortBy')
  })

  it('sends the pair together once a column is chosen', () => {
    expect(adminProjectsRequestQuery(parse({ sortBy: 'year', sortOrder: 'desc' }))).toMatchObject({
      sortBy: 'year',
      sortOrder: 'desc'
    })
  })

  it('sends every parameter at once when every control is used', () => {
    expect(adminProjectsRequestQuery(parse({
      page: '2', q: 'api', published: 'yes', featured: 'no', sortBy: 'order', sortOrder: 'asc'
    }))).toEqual({
      page: 2,
      perPage: ADMIN_PROJECTS_PER_PAGE,
      q: 'api',
      isPublished: true,
      featured: false,
      sortBy: 'order',
      sortOrder: 'asc'
    })
  })
})
