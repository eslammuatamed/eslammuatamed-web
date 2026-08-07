import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { entitySocialImage } from './entity-social-image'
import {
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_PATH,
  SOCIAL_IMAGE_WIDTH,
  absoluteSocialUrl,
  isBlank,
  pickMeta,
} from './metadata'

// These prove the fallback hierarchy itself. The point of the suite is that the FAILURE paths
// are exercised, not reasoned about: a Settings response that is absent, null, empty or
// whitespace-only must all resolve to the committed tier, and a blank/relative site URL must
// omit the tag rather than emit a broken relative URL.

describe('isBlank', () => {
  it('treats null, undefined, empty and whitespace-only as missing', () => {
    expect(isBlank(null)).toBe(true)
    expect(isBlank(undefined)).toBe(true)
    expect(isBlank('')).toBe(true)
    expect(isBlank('   ')).toBe(true)
    expect(isBlank('\t\n ')).toBe(true)
  })

  it('treats non-strings as missing rather than coercing them', () => {
    expect(isBlank(0)).toBe(true)
    expect(isBlank(false)).toBe(true)
    expect(isBlank({})).toBe(true)
  })

  it('accepts a real value', () => {
    expect(isBlank('Eslam Muatamed')).toBe(false)
    expect(isBlank(' padded ')).toBe(false)
  })
})

describe('pickMeta', () => {
  it('prefers the first tier when it is present', () => {
    expect(pickMeta('page title', 'settings title', 'committed title')).toBe('page title')
  })

  it('falls through a null Settings value to the committed default', () => {
    expect(pickMeta(null, null, 'committed title')).toBe('committed title')
  })

  it('falls through a WHITESPACE-ONLY Settings value to the committed default', () => {
    // The case most likely to slip through: '' is usually handled, '   ' usually is not.
    expect(pickMeta(null, '   ', 'committed title')).toBe('committed title')
  })

  it('trims the value it returns', () => {
    expect(pickMeta('  spaced  ')).toBe('spaced')
  })

  it('returns undefined when every tier is blank, so the tag can be omitted', () => {
    expect(pickMeta(null, undefined, '', '  ')).toBeUndefined()
  })
})

describe('absoluteSocialUrl', () => {
  const site = 'https://eslammuatamed.com'

  it('builds an absolute URL from the committed relative asset', () => {
    expect(absoluteSocialUrl(SOCIAL_IMAGE_PATH, site)).toBe(
      `https://eslammuatamed.com${SOCIAL_IMAGE_PATH}`,
    )
  })

  it('does not double the slash when the site URL has a trailing one', () => {
    expect(absoluteSocialUrl('/social-card.png', 'https://eslammuatamed.com/')).toBe(
      'https://eslammuatamed.com/social-card.png',
    )
  })

  it('passes an already-absolute media URL through unchanged', () => {
    const media = 'https://media.eslammuatamed.com/covers/abc.png'
    expect(absoluteSocialUrl(media, site)).toBe(media)
  })

  it('omits the tag when the image path is blank', () => {
    expect(absoluteSocialUrl(null, site)).toBeUndefined()
    expect(absoluteSocialUrl('   ', site)).toBeUndefined()
  })

  it('omits the tag rather than emitting a RELATIVE url when the site URL is unusable', () => {
    expect(absoluteSocialUrl('/social-card.png', null)).toBeUndefined()
    expect(absoluteSocialUrl('/social-card.png', '   ')).toBeUndefined()
    expect(absoluteSocialUrl('/social-card.png', '/not-absolute')).toBeUndefined()
  })
})

describe('entitySocialImage — format gate', () => {
  const site = 'https://eslammuatamed.com'
  const base = { width: 1600, height: 900, alt: 'A cover' }

  it('honours a PNG entity image and carries width/height/alt with it', () => {
    expect(
      entitySocialImage({ ...base, url: 'https://media.eslammuatamed.com/a/cover.png' }, site),
    ).toEqual({
      url: 'https://media.eslammuatamed.com/a/cover.png',
      width: 1600,
      height: 900,
      alt: 'A cover',
    })
  })

  it('honours JPEG in both spellings', () => {
    expect(entitySocialImage({ ...base, url: 'https://m.example.com/a.jpg' }, site)?.url).toBe(
      'https://m.example.com/a.jpg',
    )
    expect(entitySocialImage({ ...base, url: 'https://m.example.com/a.jpeg' }, site)?.url).toBe(
      'https://m.example.com/a.jpeg',
    )
  })

  it('REJECTS WebP — the format the media API actually serves today', () => {
    // PublicMediaImageDescriptor.url is documented as the widest PUBLIC WebP rendition, so this
    // is the live case: fall back to the committed PNG rather than emit an unreliable preview.
    expect(
      entitySocialImage({ ...base, url: 'https://media.eslammuatamed.com/a/1920-webp.webp' }, site),
    ).toBeUndefined()
  })

  it('REJECTS AVIF and any unknown or absent extension', () => {
    expect(entitySocialImage({ ...base, url: 'https://m.example.com/a.avif' }, site)).toBeUndefined()
    expect(entitySocialImage({ ...base, url: 'https://m.example.com/a.tiff' }, site)).toBeUndefined()
    expect(entitySocialImage({ ...base, url: 'https://m.example.com/no-extension' }, site)).toBeUndefined()
  })

  it('prefers a declared MIME type over the URL extension', () => {
    // Future-proofing: once the contract declares a type, it wins.
    expect(
      entitySocialImage({ ...base, url: 'https://m.example.com/opaque', mimeType: 'image/png' }, site)?.url,
    ).toBe('https://m.example.com/opaque')
    expect(
      entitySocialImage({ ...base, url: 'https://m.example.com/a.png', mimeType: 'image/webp' }, site),
    ).toBeUndefined()
  })

  it('does not read a format out of the query string', () => {
    expect(
      entitySocialImage({ ...base, url: 'https://m.example.com/a.webp?as=.png' }, site),
    ).toBeUndefined()
  })

  it('rejects a missing, blank or relative entity image', () => {
    expect(entitySocialImage(null, site)).toBeUndefined()
    expect(entitySocialImage({ ...base, url: '   ' }, site)).toBeUndefined()
    // Relative: the format is fine but the URL cannot be made absolute without a usable site URL.
    expect(entitySocialImage({ ...base, url: '/covers/a.png' }, null)).toBeUndefined()
  })
})

describe('committed social asset contract', () => {
  it('is the branded card at the Open Graph standard size, not the favicon', () => {
    // Asserted as a SHAPE plus a bytes check, never as a literal filename. A literal is what let the
    // previous defect hide: the constant and the test agreed with each other while both pointed at an
    // asset the owner had already replaced. Here the test cannot pass unless the name the metadata
    // publishes is genuinely derived from the bytes that ship in `public/`.
    expect(SOCIAL_IMAGE_PATH).toMatch(/^\/social-card-[0-9a-f]{8}\.png$/)
    expect(SOCIAL_IMAGE_PATH).not.toMatch(/favicon/)
    expect(SOCIAL_IMAGE_WIDTH).toBe(1200)
    expect(SOCIAL_IMAGE_HEIGHT).toBe(630)
  })

  it('publishes a filename derived from the bytes actually shipped in public/', () => {
    const file = new URL(`../../public${SOCIAL_IMAGE_PATH}`, import.meta.url)
    const bytes = readFileSync(file)
    const sha8 = createHash('sha256').update(bytes).digest('hex').slice(0, 8)

    // The whole point of content addressing, asserted rather than assumed: the eight hex characters in
    // the published URL must be this file's own hash. Swap in a stale asset and this fails; rename the
    // file without regenerating and this fails.
    expect(SOCIAL_IMAGE_PATH).toBe(`/social-card-${sha8}.png`)

    // PNG magic number, and the IHDR dimensions read out of the real file rather than compared against
    // another constant — so `og:image:width`/`height` are checked against the image, not against
    // themselves.
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    expect(bytes.readUInt32BE(16)).toBe(SOCIAL_IMAGE_WIDTH)
    expect(bytes.readUInt32BE(20)).toBe(SOCIAL_IMAGE_HEIGHT)
  })

  it('keeps the superseded fixed-name asset available but unreferenced', () => {
    // The old URL is already in crawler caches, so it must keep resolving — byte-identical, so "the old
    // URL still works" cannot drift into "the old URL serves something else". Nothing may POINT at it.
    const legacy = readFileSync(new URL('../../public/social-card.png', import.meta.url))
    const current = readFileSync(new URL(`../../public${SOCIAL_IMAGE_PATH}`, import.meta.url))
    expect(legacy.equals(current)).toBe(true)
    expect(SOCIAL_IMAGE_PATH).not.toBe('/social-card.png')
  })
})
