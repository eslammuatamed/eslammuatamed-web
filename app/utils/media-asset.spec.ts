import { describe, expect, it } from 'vitest'
import type { MediaAsset, MediaVariant } from '~/types/models'
import { dimensionsOf, libraryAltFor, thumbnailFor } from './media-asset'

const variant = (format: 'WEBP' | 'AVIF', width: number): MediaVariant => ({
  format, width, height: Math.round(width * 0.75), url: `https://media.example.com/${format}-${width}.x`
} as MediaVariant)

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'a1',
    kind: 'IMAGE',
    url: 'https://media.example.com/widest.webp',
    mimeType: 'image/webp',
    sizeBytes: 1000,
    originalFilename: 'desk.jpg',
    width: 2400,
    height: 1350,
    blurhash: null,
    contentHash: 'abc',
    variants: [variant('WEBP', 1920), variant('AVIF', 320), variant('WEBP', 640), variant('WEBP', 320)],
    alts: [{ locale: 'en', alt: 'A desk' }, { locale: 'ar', alt: 'مكتب' }],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  } as MediaAsset
}

describe('thumbnailFor', () => {
  it('picks the NARROWEST WebP rendition', () => {
    // `asset.url` is the WIDEST rendition by contract, so using it would pull a 1920px file into a
    // ~200px card, twelve times per page.
    expect(thumbnailFor(asset())?.width).toBe(320)
    expect(thumbnailFor(asset())?.format).toBe('WEBP')
  })

  it('never returns AVIF, which a plain <img src> cannot advertise a type for', () => {
    const avifOnly = asset({ variants: [variant('AVIF', 320), variant('AVIF', 640)] })
    expect(thumbnailFor(avifOnly)).toBeNull()
  })

  it('returns null for a PDF and for an image with no variants', () => {
    expect(thumbnailFor(asset({ kind: 'PDF', variants: [] }))).toBeNull()
    expect(thumbnailFor(asset({ variants: [] }))).toBeNull()
  })
})

describe('libraryAltFor', () => {
  it('returns the asset-level default for the requested locale', () => {
    expect(libraryAltFor(asset(), 'en')).toBe('A desk')
    expect(libraryAltFor(asset(), 'ar')).toBe('مكتب')
  })

  it('returns null rather than borrowing another locale — no cross-locale fallback (D10-6)', () => {
    const englishOnly = asset({ alts: [{ locale: 'en', alt: 'A desk' }] } as Partial<MediaAsset>)
    expect(libraryAltFor(englishOnly, 'ar')).toBeNull()
  })

  it('returns null when the asset has no alts at all', () => {
    expect(libraryAltFor(asset({ alts: [] } as Partial<MediaAsset>), 'en')).toBeNull()
  })
})

describe('dimensionsOf', () => {
  it('formats image dimensions', () => {
    expect(dimensionsOf(asset())).toBe('2400 × 1350')
  })

  it('returns null for a PDF, which has no dimensions by contract', () => {
    expect(dimensionsOf(asset({ kind: 'PDF', width: null, height: null }))).toBeNull()
  })
})
