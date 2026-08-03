// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { callTel, isMessagesView, replyMailto, MESSAGES_PER_PAGE } from './useMessages'

describe('replyMailto — the guard that makes mailto:null impossible', () => {
  it('returns null when there is no email — a phone-only message is a supported shape', () => {
    expect(replyMailto({ email: null, subject: 'Hello' })).toBeNull()
  })

  it('builds a mailto with a Re: prefixed, encoded subject and an EMPTY body', () => {
    const url = replyMailto({ email: 'alex@example.com', subject: 'Project inquiry' })
    expect(url).toBe('mailto:alex%40example.com?subject=Re%3A%20Project%20inquiry')
    // Owner decision 8: subject only. A prefilled body would put words in the owner's mouth.
    expect(url).not.toContain('body=')
  })

  it('does not double-prefix a subject that already starts with Re:', () => {
    expect(replyMailto({ email: 'a@b.com', subject: 'Re: Already' }))
      .toBe('mailto:a%40b.com?subject=Re%3A%20Already')
  })

  it('encodes a subject carrying characters that would break the URL', () => {
    const url = replyMailto({ email: 'a@b.com', subject: 'Q&A: "x" #1 <tag>' })
    expect(url).not.toMatch(/[&#"<>]/)
  })

  it('encodes Arabic subjects rather than emitting raw bytes', () => {
    const url = replyMailto({ email: 'a@b.com', subject: 'استفسار' })
    expect(url).toContain('%D8%A7')
  })
})

describe('callTel', () => {
  it('builds a tel: URL from the stored E.164 value', () => {
    expect(callTel('+201002785408')).toBe('tel:+201002785408')
  })

  it('strips spacing without reformatting or repairing the number', () => {
    expect(callTel('+20 100 278 5408')).toBe('tel:+201002785408')
  })
})

describe('isMessagesView — exactly two views (owner decision 4)', () => {
  it.each(['inbox', 'archived'])('accepts %s', (v) => {
    expect(isMessagesView(v)).toBe(true)
  })

  it.each(['all', 'unread', 'read', '', undefined, null, 1])('rejects %s', (v) => {
    expect(isMessagesView(v)).toBe(false)
  })
})

describe('pagination constant', () => {
  it('matches the API default and stays within its max of 50', () => {
    expect(MESSAGES_PER_PAGE).toBe(12)
    expect(MESSAGES_PER_PAGE).toBeLessThanOrEqual(50)
  })
})

/**
 * The English-only boundary (owner decision 10), enforced rather than merely intended.
 *
 * There is no whole-file EN/AR parity gate in this repository — parity is asserted per page spec
 * over that page's OWNED namespaces — so English-only dashboard keys break nothing and no public
 * parity check is weakened. This test states the boundary explicitly so the decision cannot be
 * quietly reversed by someone "fixing" a perceived parity gap with machine-translated chrome.
 */
describe('dashboard copy is English-only by decision', () => {
  const localeFile = (code: string) =>
    JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')) as Record<string, Record<string, unknown>>

  it('every key the Inbox uses exists in en.json', () => {
    const en = localeFile('en')
    const messages = en.dashboard?.messages as Record<string, unknown> | undefined
    expect(messages).toBeDefined()
    for (const key of ['title', 'view', 'column', 'status', 'detail', 'actions', 'retentionNotice', 'staleSelection', 'forbiddenTitle', 'offlineTitle']) {
      expect(messages).toHaveProperty(key)
    }
  })

  it('carries the exact owner-specified retention sentence', () => {
    const messages = localeFile('en').dashboard?.messages as Record<string, string>
    expect(messages.retentionNotice)
      .toBe('Archived messages are retained for 12 months from the date they were archived.')
  })

  it('adds NO dashboard.messages or dashboard.nav keys to ar.json', () => {
    const ar = localeFile('ar').dashboard ?? {}
    expect(ar).not.toHaveProperty('messages')
    expect(ar).not.toHaveProperty('nav')
  })

  it('does not carry the retired archiveConfirm keys in either locale', () => {
    for (const code of ['en', 'ar']) {
      const dash = (localeFile(code).dashboard ?? {}) as Record<string, Record<string, unknown>>
      expect(dash.messages ?? {}).not.toHaveProperty('archiveConfirm')
    }
  })

  it('ships no All/Unread/Read filter copy — two views only', () => {
    const view = (localeFile('en').dashboard?.messages as Record<string, Record<string, unknown>>)?.view ?? {}
    expect(Object.keys(view)).toEqual(expect.arrayContaining(['inbox', 'archived']))
    expect(view).not.toHaveProperty('all')
    expect(view).not.toHaveProperty('unread')
    expect(view).not.toHaveProperty('read')
  })
})
