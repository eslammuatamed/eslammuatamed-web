import { describe, expect, it } from 'vitest'
import {
  COUNTRY_RULES,
  DIAL_CODES,
  OTHER_DIAL_CODE,
  normalizePhone,
  toAsciiDigits,
  validatePhone,
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


// ── country-aware normalization (D13-6) ───────────────────────────────────────────────────────
// Structural validation only: that a number is well-formed for the selected plan, never that it is
// in service or belongs to the sender. The API stays authoritative.

const norm = (code: string, input: string) => normalizePhone(code as never, input)
const ok = (code: string, input: string) => {
  const n = norm(code, input)
  return n !== null && validatePhone(code as never, n)
}

describe('toAsciiDigits', () => {
  it('folds Arabic-Indic digits', () => {
    expect(toAsciiDigits('٠١٠٠٢٧٨٥٤٠٨')).toBe('01002785408')
  })

  it('folds Extended Arabic-Indic (Persian) digits', () => {
    expect(toAsciiDigits('۰۱۰۰۲۷۸۵۴۰۸')).toBe('01002785408')
  })

  it('leaves ASCII and punctuation alone', () => {
    expect(toAsciiDigits('+20 100-278')).toBe('+20 100-278')
  })
})

describe('normalizePhone — general rules', () => {
  it('returns null for an empty entry so "no phone" stays distinct from "bad phone"', () => {
    expect(norm('+20', '   ')).toBeNull()
  })

  it('removes spaces, hyphens, parentheses and dots', () => {
    expect(norm('+20', '(0100) 278-5408')).toBe('+201002785408')
    expect(norm('+20', '0100.278.5408')).toBe('+201002785408')
  })

  it('rewrites a leading 00 international prefix to +', () => {
    expect(norm('+20', '00201002785408')).toBe('+201002785408')
  })

  it('adds the selected dialing code to a local national number', () => {
    expect(norm('+965', '51234567')).toBe('+96551234567')
  })

  it('never doubles an already-present dialing code', () => {
    expect(norm('+20', '201002785408')).toBe('+201002785408')
    expect(norm('+20', '+201002785408')).toBe('+201002785408')
  })

  it('strips the trunk prefix only where the plan defines one', () => {
    expect(norm('+20', '01002785408')).toBe('+201002785408')
    // Kuwait has no trunk prefix, so a leading digit is part of the number.
    expect(norm('+965', '51234567')).toBe('+96551234567')
  })

  it('keeps a conflicting international number as typed so it is rejected, not re-homed', () => {
    expect(norm('+20', '+966512345678')).toBe('+966512345678')
    expect(ok('+20', '+966512345678')).toBe(false)
  })

  describe('Other country', () => {
    it('accepts a complete + international number', () => {
      expect(ok(OTHER_DIAL_CODE, '+1 202 555 0123')).toBe(true)
      expect(norm(OTHER_DIAL_CODE, '+1 202 555 0123')).toBe('+12025550123')
    })

    it('rejects a number without the leading +', () => {
      expect(ok(OTHER_DIAL_CODE, '2025550123')).toBe(false)
    })

    it('accepts 00 as the international prefix', () => {
      expect(norm(OTHER_DIAL_CODE, '0012025550123')).toBe('+12025550123')
    })
  })
})

describe('Egypt (+20)', () => {
  // Every one of these is the same number written the way a real visitor might type it.
  it.each([
    ['national with trunk zero', '01002785408'],
    ['spaced', '0100 278 5408'],
    ['hyphenated', '0100-278-5408'],
    ['country code, no plus', '201002785408'],
    ['full E.164', '+201002785408'],
    ['00 prefix', '00201002785408'],
    ['Arabic digits', '٠١٠٠٢٧٨٥٤٠٨']
  ])('%s normalizes to +201002785408', (_label, input) => {
    expect(norm('+20', input)).toBe('+201002785408')
    expect(ok('+20', input)).toBe(true)
  })

  it.each([['010'], ['011'], ['012'], ['015']])('accepts the %s mobile prefix', (prefix) => {
    expect(ok('+20', `${prefix}02785408`)).toBe(true)
  })

  it.each([
    ['unassigned mobile prefix', '01302785408'],
    ['too short', '0100278540'],
    ['too long', '010027854080'],
    ['duplicated country code', '+2020100278540'],
    ['another country while Egypt is selected', '+966512345678']
  ])('rejects %s', (_label, input) => {
    expect(ok('+20', input)).toBe(false)
  })
})

describe('GCC plans', () => {
  it.each([
    ['+966', '0512345678', '+966512345678'],
    ['+971', '0512345678', '+971512345678']
  ])('%s strips the trunk zero → %s', (code, input, expected) => {
    expect(norm(code, input)).toBe(expected)
    expect(ok(code, input)).toBe(true)
  })

  it.each([
    ['+965', '51234567'],
    ['+974', '33123456'],
    ['+973', '36123456'],
    ['+968', '91234567']
  ])('%s accepts its 8-digit national number', (code, input) => {
    expect(ok(code, input)).toBe(true)
  })

  it.each([
    ['+966', '0412345678'],
    ['+971', '0412345678']
  ])('%s rejects a non-mobile prefix', (code, input) => {
    expect(ok(code, input)).toBe(false)
  })

  it.each([
    ['+965', '5123456'],
    ['+974', '331234567'],
    ['+973', '3612345'],
    ['+968', '912345678']
  ])('%s rejects an incorrect national length', (code, input) => {
    expect(ok(code, input)).toBe(false)
  })
})

describe('COUNTRY_RULES coverage', () => {
  it('defines a rule for every offered dialing code', () => {
    for (const code of DIAL_CODES) expect(COUNTRY_RULES[code]).toBeDefined()
  })

  it('offers exactly the seven approved markets', () => {
    expect([...DIAL_CODES]).toEqual(['+20', '+966', '+971', '+965', '+974', '+973', '+968'])
  })
})
