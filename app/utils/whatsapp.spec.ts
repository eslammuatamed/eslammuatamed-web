import { describe, expect, it } from 'vitest'
import { buildWhatsappUrl } from './whatsapp'

const MESSAGE = 'Hi Eslam, I found you through your portfolio.'

describe('buildWhatsappUrl', () => {
  it('builds the wa.me URL from a canonical E.164 number', () => {
    expect(buildWhatsappUrl('+201002785408', MESSAGE)).toBe(
      `https://wa.me/201002785408?text=${encodeURIComponent(MESSAGE)}`
    )
  })

  it('emits exactly the wa.me origin and never a bare number path', () => {
    const url = new URL(buildWhatsappUrl('+201002785408', MESSAGE)!)
    expect(url.origin).toBe('https://wa.me')
    expect(url.pathname).toBe('/201002785408')
  })

  it('URL-encodes the prefilled message', () => {
    const url = buildWhatsappUrl('+201002785408', 'a b & c?')
    // The raw text must never reach the href: an unencoded `&` would truncate the message at the
    // ampersand and an unencoded space would break the link entirely.
    expect(url).toContain('?text=a%20b%20%26%20c%3F')
    expect(url).not.toContain(' ')
    expect(new URL(url!).searchParams.get('text')).toBe('a b & c?')
  })

  it('returns null when the setting is absent', () => {
    expect(buildWhatsappUrl(null, MESSAGE)).toBeNull()
    expect(buildWhatsappUrl(undefined, MESSAGE)).toBeNull()
    expect(buildWhatsappUrl('', MESSAGE)).toBeNull()
    expect(buildWhatsappUrl('   ', MESSAGE)).toBeNull()
  })

  it('tolerates surrounding whitespace on an otherwise canonical number', () => {
    expect(buildWhatsappUrl('  +201002785408  ', MESSAGE)).toBe(
      `https://wa.me/201002785408?text=${encodeURIComponent(MESSAGE)}`
    )
  })

  it('returns null for a value that is not a plausible E.164 number', () => {
    expect(buildWhatsappUrl('not a phone', MESSAGE)).toBeNull()
    expect(buildWhatsappUrl('+0100', MESSAGE)).toBeNull()
    // Human formatting is not accepted here — widening the gate past `isPlausibleE164` is what would
    // let the Footer link a number the Contact form would reject.
    expect(buildWhatsappUrl('+20 100 278 5408', MESSAGE)).toBeNull()
  })

  it('returns null for a number written without the leading plus', () => {
    // `isPlausibleE164` requires the `+`. Accepting the bare form here would be a second, looser
    // validator by another name.
    expect(buildWhatsappUrl('201002785408', MESSAGE)).toBeNull()
  })

  it('rejects Arabic-Indic digits rather than folding them to ASCII', () => {
    // Governed E.164 data, not visitor input: see the rationale on `buildWhatsappUrl`.
    expect(buildWhatsappUrl('+٢٠١٠٠٢٧٨٥٤٠٨', MESSAGE)).toBeNull()
    expect(buildWhatsappUrl('+۲۰۱۰۰۲۷۸۵۴۰۸', MESSAGE)).toBeNull()
  })

  it('never emits a non-https scheme, whatever the input', () => {
    for (const hostile of ['javascript:alert(1)', '+1', 'wa.me/evil', '//evil.example']) {
      const url = buildWhatsappUrl(hostile, MESSAGE)
      expect(url === null || url.startsWith('https://wa.me/')).toBe(true)
    }
  })
})
