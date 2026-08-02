import { describe, expect, it } from 'vitest'
import {
  CONTACT_LIMITS,
  MIN_FILL_MS,
  formatRetryAfter,
  parseRetryAfterSeconds,
  remainingFillWaitMs,
  toElapsedMs
} from './contact'

describe('MIN_FILL_MS', () => {
  // Mirrored from the API's anti-spam.ts. If this drifts, genuine submissions start being dropped
  // as spam with a success receipt — the failure the deferred-dispatch design exists to prevent.
  it('matches the API threshold', () => {
    expect(MIN_FILL_MS).toBe(3000)
  })
})

describe('remainingFillWaitMs', () => {
  it('returns the full threshold for an instant submission', () => {
    expect(remainingFillWaitMs(0)).toBe(3000)
  })

  it('returns only the remainder for a partly-elapsed fill', () => {
    expect(remainingFillWaitMs(1200)).toBe(1800)
  })

  it('returns 0 exactly at the threshold, so the wait loop terminates', () => {
    expect(remainingFillWaitMs(3000)).toBe(0)
  })

  it('never returns a negative wait once the threshold has passed', () => {
    expect(remainingFillWaitMs(9000)).toBe(0)
  })
})

describe('toElapsedMs', () => {
  it('rounds a fractional performance.now() delta to an integer', () => {
    expect(toElapsedMs(8200.6)).toBe(8201)
    expect(toElapsedMs(8200.2)).toBe(8200)
  })

  it('floors at 0 rather than emitting a negative duration', () => {
    expect(toElapsedMs(-5)).toBe(0)
  })

  // The value is measured, never manufactured: a genuine 8.2s fill reports 8200, not the threshold.
  it('reports the real duration rather than the threshold', () => {
    expect(toElapsedMs(8200)).toBe(8200)
    expect(toElapsedMs(3000)).toBe(3000)
  })
})

describe('parseRetryAfterSeconds', () => {
  it('accepts a positive integer of seconds', () => {
    expect(parseRetryAfterSeconds('3600')).toBe(3600)
    expect(parseRetryAfterSeconds('1')).toBe(1)
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseRetryAfterSeconds('  120  ')).toBe(120)
  })

  // Everything below must fall back to the static message — never a fabricated duration.
  it.each([
    ['absent', undefined],
    ['null (the pre-CORS-fix reality in a browser)', null],
    ['empty', ''],
    ['whitespace only', '   '],
    ['zero', '0'],
    ['negative', '-60'],
    ['fractional', '60.5'],
    ['an HTTP-date', 'Wed, 21 Oct 2015 07:28:00 GMT'],
    ['non-numeric', 'soon'],
    ['numeric with a suffix', '60s'],
    ['not a number', 'NaN'],
    ['infinite', 'Infinity']
  ])('returns null for %s', (_label, header) => {
    expect(parseRetryAfterSeconds(header as string | null | undefined)).toBeNull()
  })
})

describe('formatRetryAfter', () => {
  it('uses seconds below a minute', () => {
    expect(formatRetryAfter(45, 'en')).toBe('in 45 seconds')
  })

  it('uses minutes below an hour', () => {
    expect(formatRetryAfter(120, 'en')).toBe('in 2 minutes')
  })

  it('uses hours below a day', () => {
    expect(formatRetryAfter(3600, 'en')).toBe('in 1 hour')
  })

  it('uses days at and above a day', () => {
    expect(formatRetryAfter(86400, 'en')).toBe('in 1 day')
  })

  // Rounding DOWN would advise a retry before the window reopens — the copy would be wrong.
  it('rounds up so the visitor is never told to retry early', () => {
    expect(formatRetryAfter(61, 'en')).toBe('in 2 minutes')
    expect(formatRetryAfter(3601, 'en')).toBe('in 2 hours')
  })

  // The concrete reason Intl owns this rather than a `{count} دقيقة` interpolation: Arabic marks
  // exactly two as a DUAL, which drops the numeral entirely — "خلال دقيقتين", not "خلال 2 دقيقة".
  // Three-to-ten then take the plural, and eleven-plus take the singular. No hand-written branch
  // was going to get that right, and the Web has no business encoding Arabic grammar.
  it('renders the Arabic dual without a numeral (the case a manual plural branch gets wrong)', () => {
    expect(formatRetryAfter(120, 'ar')).toBe('خلال دقيقتين')
    expect(formatRetryAfter(7200, 'ar')).toBe('خلال ساعتين')
  })

  it('renders the Arabic 3–10 plural with a numeral', () => {
    expect(formatRetryAfter(300, 'ar')).toBe('خلال 5 دقائق')
  })

  it('differs from the English rendering', () => {
    expect(formatRetryAfter(120, 'ar')).not.toBe(formatRetryAfter(120, 'en'))
  })

  // D03-4: Western Arabic digits in BOTH locales. Intl.RelativeTimeFormat('ar') defaults to
  // Eastern Arabic digits (٥), which would look wrong beside every other number on the site.
  it('pins latn digits on the Arabic route (D03-4)', () => {
    for (const seconds of [45, 120, 3600, 86400]) {
      expect(formatRetryAfter(seconds, 'ar')).not.toMatch(/[٠-٩]/)
    }
    expect(formatRetryAfter(300, 'ar')).toMatch(/5/)
  })
})

describe('CONTACT_LIMITS', () => {
  // Mirrored from CreateContactMessageDto so the client rejects exactly what the server would.
  it('matches the API caps', () => {
    expect(CONTACT_LIMITS).toEqual({ name: 200, email: 320, subject: 300, body: 5000 })
  })
})
