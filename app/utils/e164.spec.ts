import { describe, expect, it } from 'vitest'
import { isPlausibleE164 } from './e164'

// The app's ONE E.164 predicate. It gates the contact form's phone field and, since 018, every
// WhatsApp affordance on the site, so its boundaries are pinned here rather than only being implied
// by the two callers' tests.
describe('isPlausibleE164', () => {
  it('accepts a canonical international number', () => {
    expect(isPlausibleE164('+201002785408')).toBe(true)
    expect(isPlausibleE164('+966501234567')).toBe(true)
  })

  it('requires the leading plus', () => {
    expect(isPlausibleE164('201002785408')).toBe(false)
    expect(isPlausibleE164('00201002785408')).toBe(false)
  })

  it('rejects a zero as the first digit of the country code', () => {
    expect(isPlausibleE164('+0201002785408')).toBe(false)
  })

  it('holds the length boundaries: 8 to 15 digits inclusive', () => {
    // The pattern is `+`, one non-zero digit, then 6-14 more.
    expect(isPlausibleE164(`+1${'2'.repeat(5)}`)).toBe(false) // 7 digits — one short
    expect(isPlausibleE164(`+1${'2'.repeat(6)}`)).toBe(true) // 8 digits — shortest accepted
    expect(isPlausibleE164(`+1${'2'.repeat(14)}`)).toBe(true) // 15 digits — E.164's maximum
    expect(isPlausibleE164(`+1${'2'.repeat(15)}`)).toBe(false) // 16 digits — one too many
  })

  it('rejects anything that is not purely digits after the plus', () => {
    // Human formatting is not tolerated here on purpose: the caller decides whether to normalize
    // first. Widening this predicate would widen every gate in the app at once.
    expect(isPlausibleE164('+20 100 278 5408')).toBe(false)
    expect(isPlausibleE164('+20-100-278-5408')).toBe(false)
    expect(isPlausibleE164('+20100278540a')).toBe(false)
    expect(isPlausibleE164('')).toBe(false)
    expect(isPlausibleE164('+')).toBe(false)
  })

  it('rejects Arabic-Indic and Persian digits', () => {
    // `\d` in JS regex is ASCII-only, and that is relied upon: folding is the caller's decision
    // (`toAsciiDigits`), not this predicate's.
    expect(isPlausibleE164('+٢٠١٠٠٢٧٨٥٤٠٨')).toBe(false)
    expect(isPlausibleE164('+۲۰۱۰۰۲۷۸۵۴۰۸')).toBe(false)
  })

  it('is anchored at both ends', () => {
    // An unanchored pattern would accept a valid number embedded in hostile surroundings.
    expect(isPlausibleE164('call +201002785408 now')).toBe(false)
    expect(isPlausibleE164('+201002785408\njavascript:alert(1)')).toBe(false)
  })
})
