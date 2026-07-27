import { describe, expect, it } from 'vitest'
import { blurhashAverageColor } from './blurhash'

// The contract's own example hash, so the test is pinned to a value the API actually emits.
const CONTRACT_EXAMPLE = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

describe('blurhashAverageColor', () => {
  it('decodes the contract example to a concrete colour', () => {
    const colour = blurhashAverageColor(CONTRACT_EXAMPLE)
    expect(colour).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/)
  })

  it('is deterministic — the same hash always yields the same colour', () => {
    expect(blurhashAverageColor(CONTRACT_EXAMPLE)).toBe(blurhashAverageColor(CONTRACT_EXAMPLE))
  })

  it('produces different colours for different hashes', () => {
    expect(blurhashAverageColor('LEHV6nWB2yk8pyo0adR*.7kCMdnj'))
      .not.toBe(blurhashAverageColor('L6PZfSi_.AyE_3t7t7R**0o#DgR4'))
  })

  it('keeps every channel inside the 0-255 range', () => {
    const match = blurhashAverageColor('L6PZfSi_.AyE_3t7t7R**0o#DgR4')!.match(/\d{1,3}/g)!
    for (const channel of match) expect(Number(channel)).toBeLessThanOrEqual(255)
    expect(match).toHaveLength(3)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['too short to contain a DC term', 'LEH']
  ])('returns null for %s rather than a broken style', (_label, hash) => {
    expect(blurhashAverageColor(hash)).toBeNull()
  })

  it('returns null for a hash containing characters outside the base83 alphabet', () => {
    // CMS data can be malformed; a bad hash must degrade to the token surface, not throw.
    expect(blurhashAverageColor('LE\\/V6nWB2yk8pyo0adR*.7kCMdnj')).toBeNull()
  })
})
