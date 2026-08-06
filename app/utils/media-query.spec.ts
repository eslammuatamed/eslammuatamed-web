import { describe, expect, it } from 'vitest'
import { parseMediaQuery } from './media-query'

/**
 * The `/dashboard/media` route-query contract. Total by design: any input yields a valid result, so
 * a mistyped URL degrades to a sane grid rather than an error state.
 */
describe('parseMediaQuery', () => {
  it('defaults an empty query', () => {
    expect(parseMediaQuery({})).toEqual({ q: undefined, kind: undefined, page: 1 })
  })

  it('reads a search, a kind and a page', () => {
    expect(parseMediaQuery({ q: 'desk', kind: 'IMAGE', page: '3' }))
      .toEqual({ q: 'desk', kind: 'IMAGE', page: 3 })
  })

  it('collapses an empty or whitespace search to `undefined`', () => {
    // `?q=` and no `q` at all must be ONE state, or they would fetch two different URLs and the
    // "no filter" empty-state copy would depend on how the reader got there.
    expect(parseMediaQuery({ q: '' }).q).toBeUndefined()
    expect(parseMediaQuery({ q: '   ' }).q).toBeUndefined()
  })

  it('trims a search', () => {
    expect(parseMediaQuery({ q: '  desk  ' }).q).toBe('desk')
  })

  it('drops an unrecognised kind rather than failing', () => {
    expect(parseMediaQuery({ kind: 'VIDEO' }).kind).toBeUndefined()
    expect(parseMediaQuery({ kind: 'image' }).kind).toBeUndefined()
  })

  it.each([['abc'], ['0'], ['-3'], ['1.5'], ['']])('falls back to page 1 for %o', (page) => {
    expect(parseMediaQuery({ page }).page).toBe(1)
  })

  it('takes the first entry of a repeated parameter', () => {
    // Vue Router really does hand back an array for `?page=1&page=2`.
    expect(parseMediaQuery({ page: ['2', '5'], q: ['desk', 'lamp'] })).toEqual({
      q: 'desk', kind: undefined, page: 2
    })
  })

  it('never throws, whatever arrives', () => {
    expect(() => parseMediaQuery({ q: [null], kind: [null], page: [null] })).not.toThrow()
  })
})
