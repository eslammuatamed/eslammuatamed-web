import { describe, expect, it } from 'vitest'
import { parseMessagesQuery } from './messages-query'

const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

describe('parseMessagesQuery — defaults', () => {
  it('an empty query is the Inbox, page 1, no selection', () => {
    expect(parseMessagesQuery({})).toEqual({ view: 'inbox', page: 1, message: undefined })
  })

  it('reads a fully-specified query', () => {
    expect(parseMessagesQuery({ view: 'archived', page: '3', message: ID }))
      .toEqual({ view: 'archived', page: 3, message: ID })
  })
})

describe('parseMessagesQuery — view', () => {
  it.each(['inbox', 'archived'])('accepts %s', (view) => {
    expect(parseMessagesQuery({ view }).view).toBe(view)
  })

  // Only two views are governed (owner decision 4); a retired filter must not resurrect one.
  it.each(['all', 'unread', 'read', '', 'INBOX', '../etc'])('falls back to inbox for %s', (view) => {
    expect(parseMessagesQuery({ view }).view).toBe('inbox')
  })
})

describe('parseMessagesQuery — page', () => {
  it.each([['2', 2], ['10', 10], ['007', 7]])('reads %s as %i', (raw, expected) => {
    expect(parseMessagesQuery({ page: raw }).page).toBe(expected)
  })

  // These would otherwise reach the API as an out-of-range offset.
  it.each(['0', '-3', 'abc', '1.5', '', 'Infinity', 'NaN'])('falls back to 1 for %s', (raw) => {
    expect(parseMessagesQuery({ page: raw }).page).toBe(1)
  })
})

describe('parseMessagesQuery — message', () => {
  it('keeps a valid uuid', () => {
    expect(parseMessagesQuery({ message: ID }).message).toBe(ID)
  })

  // A malformed id is dropped rather than sent to the API, which would answer 400/404 for a typo.
  it.each(['not-a-uuid', '123', '', 'null', `${ID}x`])('drops %s', (raw) => {
    expect(parseMessagesQuery({ message: raw }).message).toBeUndefined()
  })
})

describe('parseMessagesQuery — hostile shapes', () => {
  // Vue Router really does hand back arrays for a repeated key, and null for a bare `?view`.
  it('takes the first entry of a repeated parameter', () => {
    expect(parseMessagesQuery({ view: ['archived', 'inbox'], page: ['2', '9'] }))
      .toMatchObject({ view: 'archived', page: 2 })
  })

  it('survives null values', () => {
    expect(parseMessagesQuery({ view: null, page: null, message: null }))
      .toEqual({ view: 'inbox', page: 1, message: undefined })
  })

  it('survives an empty array', () => {
    expect(parseMessagesQuery({ view: [], page: [] })).toMatchObject({ view: 'inbox', page: 1 })
  })

  it('never throws, whatever it is given', () => {
    const hostile: unknown[] = [{}, { view: 0 }, { page: {} }, { message: [] }, { view: ['x'] }]
    for (const q of hostile) {
      expect(() => parseMessagesQuery(q as never)).not.toThrow()
    }
  })
})

describe('parseMessagesQuery — purity', () => {
  it('does not mutate the query it is given', () => {
    const query = { view: 'bogus', page: 'abc', other: 'keep' }
    const snapshot = structuredClone(query)
    parseMessagesQuery(query)
    expect(query).toEqual(snapshot)
  })

  it('reads only the governed keys, so unrelated parameters survive elsewhere', () => {
    // The parser returns the governed triple and nothing else; writing merges, so `other` is
    // untouched in the URL. (Zod omits `message` entirely when it is undefined, which is
    // behaviourally identical to an explicit undefined for every consumer here.)
    const parsed = parseMessagesQuery({ other: 'keep', view: 'archived' })
    expect(parsed).toEqual({ view: 'archived', page: 1 })
    expect(parsed).not.toHaveProperty('other')
  })
})
