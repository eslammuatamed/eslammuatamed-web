// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { callTel, replyMailto, useMessages, MESSAGES_PER_PAGE } from './useMessages'
import { parseMessagesQuery } from '~/utils/messages-query'

const holder = vi.hoisted(() => ({ api: null as unknown }))
mockNuxtImport('useApi', () => () => holder.api)

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

describe('view validation lives in ONE place (Zod-first policy)', () => {
  // `isMessagesView` was removed; the route-query schema is the single validator. These assert the
  // same governed rule through the canonical parser rather than a second copy of it.
  it.each(['inbox', 'archived'])('accepts %s', (v) => {
    expect(parseMessagesQuery({ view: v }).view).toBe(v)
  })

  it.each(['all', 'unread', 'read', ''])('falls back to inbox for %s', (v) => {
    expect(parseMessagesQuery({ view: v }).view).toBe('inbox')
  })
})

describe('pagination constant', () => {
  it('matches the API default and stays within its max of 50', () => {
    expect(MESSAGES_PER_PAGE).toBe(12)
    expect(MESSAGES_PER_PAGE).toBeLessThanOrEqual(50)
  })
})

/**
 * The Inbox's copy contract.
 *
 * ⚠ THIS BLOCK USED TO ENFORCE THE OPPOSITE. It was titled "dashboard copy is English-only by
 * decision" and asserted that `ar.json` carried NO `dashboard.messages` or `dashboard.nav` keys —
 * a correct guard at the time, protecting a governed decision from being "fixed" by someone
 * mistaking it for a parity gap. Owner decision **OD-11 (D02-15)** reverses that decision, so the
 * guard is inverted rather than deleted: the Inbox namespace must now be translated, and a
 * regression that drops the Arabic copy has to fail somewhere.
 *
 * Whole-catalogue parity now lives in `i18n/locale-parity.spec.ts`, which did not exist while
 * dashboard chrome was English-only. What stays here is what is specific to THIS module: the keys
 * the Inbox actually consumes, the exact owner-specified retention sentence, and the two retired
 * key sets that must not come back.
 */
describe('the Inbox copy contract', () => {
  const localeFile = (code: string) =>
    JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')) as Record<string, Record<string, unknown>>

  const INBOX_KEYS = ['title', 'view', 'column', 'status', 'detail', 'actions', 'retentionNotice', 'staleSelection', 'staleNotice', 'forbiddenTitle', 'offlineTitle'] as const

  it('every key the Inbox uses exists in en.json', () => {
    const messages = localeFile('en').dashboard?.messages as Record<string, unknown> | undefined
    expect(messages).toBeDefined()
    for (const key of INBOX_KEYS) {
      expect(messages).toHaveProperty(key)
    }
  })

  it('carries the exact owner-specified retention sentence', () => {
    const messages = localeFile('en').dashboard?.messages as Record<string, string>
    expect(messages.retentionNotice)
      .toBe('Archived messages are retained for 12 months from the date they were archived.')
  })

  it('translates every Inbox key the page consumes into ar.json', () => {
    // The inverse of the assertion this replaced. Asserted on the SAME key list the English test
    // above uses, so the two cannot drift: adding a key to one list without the other is what
    // produces a raw `dashboard.messages.…` key path on screen (D02-15).
    const messages = localeFile('ar').dashboard?.messages as Record<string, unknown> | undefined
    expect(messages).toBeDefined()
    for (const key of INBOX_KEYS) {
      expect(messages).toHaveProperty(key)
    }

    // The shell namespace too: the sidebar renders on every dashboard route, so an untranslated
    // `dashboard.nav` leaks key paths into every module rather than only this one.
    expect(localeFile('ar').dashboard).toHaveProperty('nav')
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

/**
 * Out-of-order responses. Regression for a real race: responses are not guaranteed to arrive in the
 * order they were requested, so a slow Inbox response could land after a fast Archived one and leave
 * Inbox rows on screen under the Archived view. That is stale DATA, not stale feedback.
 */
describe('useMessages — only the newest request may write', () => {
  const page = (subject: string) => ({
    data: [{ id: 'x', name: 'n', email: null, phone: '+20100', subject, body: 'b', isRead: false, isArchived: false, archivedAt: null, meta: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
    meta: { page: 1, perPage: 12, total: 1, totalPages: 1 }
  })

  function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('discards a superseded response that arrives last', async () => {
    const slowInbox = deferred<ReturnType<typeof page>>()
    const fastArchived = deferred<ReturnType<typeof page>>()
    holder.api = vi.fn()
      .mockReturnValueOnce(slowInbox.promise)
      .mockReturnValueOnce(fastArchived.promise)

    const { items, load, pending } = useMessages()
    const first = load('inbox', 1)
    const second = load('archived', 1)

    fastArchived.resolve(page('ARCHIVED'))
    await second
    expect(items.value[0]?.subject).toBe('ARCHIVED')

    // The superseded Inbox response lands last and must be ignored.
    slowInbox.resolve(page('INBOX'))
    await first
    expect(items.value[0]?.subject).toBe('ARCHIVED')
    expect(pending.value).toBe(false)
  })

  it('a superseded FAILURE does not clear the current rows or raise an error state', async () => {
    const slow = deferred<ReturnType<typeof page>>()
    const fast = deferred<ReturnType<typeof page>>()
    holder.api = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)

    const { items, failed, load } = useMessages()
    const first = load('inbox', 1)
    const second = load('archived', 1)

    fast.resolve(page('CURRENT'))
    await second

    slow.reject(new Error('superseded'))
    await first

    expect(items.value[0]?.subject).toBe('CURRENT')
    expect(failed.value).toBe(false)
  })

  it('keeps rendered rows through a current refresh failure, then replaces them on retry', async () => {
    holder.api = vi.fn()
      .mockResolvedValueOnce(page('HELD'))
      .mockRejectedValueOnce(new Error('temporary transport failure'))
      .mockResolvedValueOnce(page('RECOVERED'))

    const { items, failed, load } = useMessages()
    await load('inbox', 1)
    expect(items.value[0]?.subject).toBe('HELD')

    await load('inbox', 2)
    // This is the collection contract: a failed page/filter refresh is stale data, not permission
    // to blank the usable list underneath the operator.
    expect(items.value[0]?.subject).toBe('HELD')
    expect(failed.value).toBe(true)

    await load('inbox', 2)
    expect(items.value[0]?.subject).toBe('RECOVERED')
    expect(failed.value).toBe(false)
  })
})
