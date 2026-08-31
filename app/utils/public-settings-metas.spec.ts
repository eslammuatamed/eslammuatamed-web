import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BING_SITE_VERIFICATION_META_NAME,
  GOOGLE_SITE_VERIFICATION_META_NAME,
  projectPublicSettingsMetas,
} from './public-settings-metas'

// These prove the projection itself, not the wiring: a Settings payload's verification tokens and
// custom metas must come out as an ordered list of name/content descriptors — verifications first,
// customs verbatim in API order — with blanks omitted, duplicates preserved, and NOTHING else
// expressible. The failure paths are exercised directly: null/undefined/whitespace tokens, hostile
// extra runtime properties, GTM fields that must have zero effect.

/** A live-shaped source: every owned field present at its contract type (`string | null` / array). */
function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    googleSiteVerification: null,
    bingSiteVerification: null,
    customMetas: [],
    ...overrides,
  }
}

describe('Google verification — vendor-pinned `google-site-verification`', () => {
  it('t1 — a populated token emits exactly one descriptor', () => {
    const out = projectPublicSettingsMetas(source({ googleSiteVerification: 'google-abc123' }))
    expect(out).toEqual([{ name: 'google-site-verification', content: 'google-abc123' }])
  })

  it('t2 — the token content is preserved: case and internal characters untouched', () => {
    // Outer whitespace MAY be normalized (house convention); nothing inside may change.
    const out = projectPublicSettingsMetas(source({ googleSiteVerification: '  gWfA_2Kx9.yZ-TOKEN_part2  ' }))
    expect(out).toEqual([
      { name: 'google-site-verification', content: 'gWfA_2Kx9.yZ-TOKEN_part2' },
    ])
  })

  it('t3 — a null token emits none', () => {
    expect(projectPublicSettingsMetas(source({ googleSiteVerification: null }))).toEqual([])
  })

  it('t4 — an undefined/absent token emits none', () => {
    expect(projectPublicSettingsMetas({ bingSiteVerification: null, customMetas: [] })).toEqual([])
    expect(projectPublicSettingsMetas(source({ googleSiteVerification: undefined }))).toEqual([])
  })

  it('t5 — empty and whitespace-only tokens emit none (isBlank convention)', () => {
    expect(projectPublicSettingsMetas(source({ googleSiteVerification: '' }))).toEqual([])
    expect(projectPublicSettingsMetas(source({ googleSiteVerification: '   ' }))).toEqual([])
    expect(projectPublicSettingsMetas(source({ googleSiteVerification: '\t\n ' }))).toEqual([])
  })
})

describe('Bing verification — vendor-pinned `msvalidate.01`', () => {
  it('t6 — a populated token emits exactly one msvalidate.01 descriptor', () => {
    const out = projectPublicSettingsMetas(source({ bingSiteVerification: 'bing-def456' }))
    expect(out).toEqual([{ name: 'msvalidate.01', content: 'bing-def456' }])
  })

  it('t7 — the token content is preserved verbatim', () => {
    const out = projectPublicSettingsMetas(source({ bingSiteVerification: 'Bing_Def456.7890abcdef' }))
    expect(out).toEqual([{ name: 'msvalidate.01', content: 'Bing_Def456.7890abcdef' }])
  })

  it('t8 — a null token emits none', () => {
    expect(projectPublicSettingsMetas(source({ bingSiteVerification: null }))).toEqual([])
  })

  it('t9 — an undefined/absent token emits none', () => {
    expect(projectPublicSettingsMetas({ googleSiteVerification: null, customMetas: [] })).toEqual([])
  })

  it('t10 — empty and whitespace-only tokens emit none', () => {
    expect(projectPublicSettingsMetas(source({ bingSiteVerification: '' }))).toEqual([])
    expect(projectPublicSettingsMetas(source({ bingSiteVerification: ' \t ' }))).toEqual([])
  })

  it('t11 — the rejected alias `bing-site-verification` is NEVER emitted for any input', () => {
    const populated = projectPublicSettingsMetas(source({ bingSiteVerification: 'bing-def456' }))
    const bothBlank = projectPublicSettingsMetas(source())
    for (const out of [populated, bothBlank]) {
      expect(out.some(meta => meta.name === 'bing-site-verification')).toBe(false)
    }
    expect(BING_SITE_VERIFICATION_META_NAME).toBe('msvalidate.01')
  })
})

describe('both tokens together', () => {
  it('t12 — deterministic order: Google then Bing', () => {
    const out = projectPublicSettingsMetas(
      source({ googleSiteVerification: 'g-token', bingSiteVerification: 'b-token' }),
    )
    expect(out.map(meta => meta.name)).toEqual(['google-site-verification', 'msvalidate.01'])
  })

  it('t13 — one absent token does not affect the other', () => {
    expect(
      projectPublicSettingsMetas(source({ googleSiteVerification: 'g-only' })),
    ).toEqual([{ name: 'google-site-verification', content: 'g-only' }])
    expect(
      projectPublicSettingsMetas(source({ bingSiteVerification: 'b-only' })),
    ).toEqual([{ name: 'msvalidate.01', content: 'b-only' }])
  })
})

describe('customMetas — verbatim projection of the contract shape', () => {
  it('t14 — one item passes name/content through EXACTLY (no trim, no rewrite)', () => {
    const out = projectPublicSettingsMetas(
      source({ customMetas: [{ name: 'theme-color', content: ' #0b0b0f ' }] }),
    )
    expect(out).toEqual([{ name: 'theme-color', content: ' #0b0b0f ' }])
  })

  it('t15 — multiple items preserve exact API order (no sorting)', () => {
    const out = projectPublicSettingsMetas(
      source({
        customMetas: [
          { name: 'zeta-tag', content: 'last' },
          { name: 'alpha-tag', content: 'first-alphabetically' },
          { name: 'mid-tag', content: 'middle' },
        ],
      }),
    )
    expect(out.map(meta => meta.name)).toEqual(['zeta-tag', 'alpha-tag', 'mid-tag'])
  })

  it('t16 — duplicate custom names are preserved as independent entries', () => {
    // The contract allows arbitrary names and defines no reconciliation; both survive.
    const out = projectPublicSettingsMetas(
      source({
        customMetas: [
          { name: 'theme-color', content: '#0b0b0f' },
          { name: 'theme-color', content: '#ffffff' },
        ],
      }),
    )
    expect(out).toEqual([
      { name: 'theme-color', content: '#0b0b0f' },
      { name: 'theme-color', content: '#ffffff' },
    ])
  })

  it('t17 — a custom name colliding with Google is NOT application-filtered', () => {
    const out = projectPublicSettingsMetas(
      source({
        googleSiteVerification: 'g-real',
        customMetas: [{ name: 'google-site-verification', content: 'impostor' }],
      }),
    )
    expect(out).toContainEqual({ name: 'google-site-verification', content: 'g-real' })
    expect(out).toContainEqual({ name: 'google-site-verification', content: 'impostor' })
    expect(out).toHaveLength(2)
  })

  it('t18 — a custom name colliding with Bing is NOT application-filtered', () => {
    const out = projectPublicSettingsMetas(
      source({
        bingSiteVerification: 'b-real',
        customMetas: [{ name: 'msvalidate.01', content: 'impostor' }],
      }),
    )
    expect(out).toHaveLength(2)
    expect(out.filter(meta => meta.name === 'msvalidate.01')).toEqual([
      { name: 'msvalidate.01', content: 'b-real' },
      { name: 'msvalidate.01', content: 'impostor' },
    ])
  })

  it('t19 — arbitrary valid names pass through', () => {
    const out = projectPublicSettingsMetas(
      source({
        customMetas: [
          { name: 'format-detection', content: 'telephone=no' },
          { name: 'some-vendor-thing.v2_beta', content: 'x' },
        ],
      }),
    )
    expect(out).toEqual([
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'some-vendor-thing.v2_beta', content: 'x' },
    ])
  })

  it('t20 — an empty customMetas array emits no descriptors', () => {
    expect(projectPublicSettingsMetas(source())).toEqual([])
    expect(
      projectPublicSettingsMetas(source({ googleSiteVerification: null, bingSiteVerification: null, customMetas: [] })),
    ).toEqual([])
  })
})

describe('combined order', () => {
  it('t21 — verification entries precede custom entries', () => {
    const out = projectPublicSettingsMetas(
      source({
        googleSiteVerification: 'g-token',
        bingSiteVerification: 'b-token',
        customMetas: [{ name: 'theme-color', content: '#0b0b0f' }],
      }),
    )
    expect(out.map(meta => meta.name)).toEqual([
      'google-site-verification',
      'msvalidate.01',
      'theme-color',
    ])
  })

  it('t22 — exact custom ordering remains intact after the verification entries', () => {
    const out = projectPublicSettingsMetas(
      source({
        bingSiteVerification: 'b-token',
        customMetas: [
          { name: 'c-third', content: '3' },
          { name: 'a-first', content: '1' },
          { name: 'b-second', content: '2' },
        ],
      }),
    )
    expect(out).toEqual([
      { name: 'msvalidate.01', content: 'b-token' },
      { name: 'c-third', content: '3' },
      { name: 'a-first', content: '1' },
      { name: 'b-second', content: '2' },
    ])
  })
})

describe('output security boundary — name/content is all that can exist', () => {
  it('t23/t24 — no property/http-equiv keys: even hostile extra runtime fields are dropped by construction', () => {
    // The generated contract cannot carry these fields, but JS callers can supply wider objects;
    // the projection CONSTRUCTS fresh pairs, so nothing outside name/content survives.
    const hostile = source({
      customMetas: [
        {
          name: 'theme-color',
          content: '#0b0b0f',
          property: 'og:image',
          httpEquiv: 'refresh',
          innerHTML: '<script>alert(1)</script>',
          onclick: 'alert(1)',
          charset: 'utf-7',
        },
      ],
      googleSiteVerification: 'g-token',
    }) as Parameters<typeof projectPublicSettingsMetas>[0]

    const out = projectPublicSettingsMetas(hostile)
    for (const descriptor of out) {
      expect(Object.keys(descriptor).sort()).toEqual(['content', 'name'])
      expect(descriptor).not.toHaveProperty('property')
      expect(descriptor).not.toHaveProperty('httpEquiv')
      expect(descriptor).not.toHaveProperty('http-equiv')
    }
    expect(out).toEqual([
      { name: 'google-site-verification', content: 'g-token' },
      { name: 'theme-color', content: '#0b0b0f' },
    ])
  })

  it('t25 — no script/raw-html capability exists on any output item', () => {
    const out = projectPublicSettingsMetas(
      source({
        customMetas: [{ name: 'x', content: '<script>alert(1)</script>' }],
      }),
    )
    for (const descriptor of out) {
      // The VALUE is inert attribute data (the renderer escapes it); the SHAPE must never offer
      // an HTML/script sink field.
      expect(Object.keys(descriptor)).toEqual(expect.arrayContaining(['name', 'content']))
      expect(Object.keys(descriptor)).not.toContain('innerHTML')
      expect(Object.keys(descriptor)).not.toContain('textContent')
      expect(Object.keys(descriptor)).not.toContain('children')
      expect(Object.keys(descriptor)).not.toContain('tag')
    }
  })

  it('t26 — structurally incapable of producing a script element (source-level proof)', () => {
    const code = readFileSync('app/utils/public-settings-metas.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    expect(code).not.toMatch(/<script|innerHTML|textContent|dangerouslySetInnerHTML/)
    expect(code).not.toMatch(/\bcreateElement\b|\bnoscript\b|\biframe\b/)
  })

  it('t27 — gtmContainerId/analyticsEnabled have ZERO effect on the output', () => {
    const plain = source({ googleSiteVerification: 'g-token' })
    const withGtm = source({
      googleSiteVerification: 'g-token',
      gtmContainerId: 'GTM-ABCD123',
      analyticsEnabled: true,
    }) as Parameters<typeof projectPublicSettingsMetas>[0]

    expect(projectPublicSettingsMetas(withGtm)).toEqual(projectPublicSettingsMetas(plain))
    expect(JSON.stringify(projectPublicSettingsMetas(withGtm))).not.toContain('GTM')
  })
})

describe('totality and purity around the shared read', () => {
  it('absent/null settings (failed read) project to an empty list rather than throwing', () => {
    expect(projectPublicSettingsMetas(null)).toEqual([])
    expect(projectPublicSettingsMetas(undefined)).toEqual([])
  })

  it('never mutates the input; output items are independent objects', () => {
    const input = source({
      googleSiteVerification: ' padded ',
      customMetas: [{ name: 'theme-color', content: '#0b0b0f' }],
    })
    const snapshot = JSON.parse(JSON.stringify(input))

    const out = projectPublicSettingsMetas(input as Parameters<typeof projectPublicSettingsMetas>[0])
    out[0]!.content = 'MUTATED'
    out[out.length - 1]!.name = 'MUTATED'

    expect(input).toEqual(snapshot)
    expect(GOOGLE_SITE_VERIFICATION_META_NAME).toBe('google-site-verification')
  })
})

describe('source boundary — pure projection only', () => {
  // Scan CODE, not prose: strip comments so this header documentation (which must EXPLAIN the
  // exclusions by naming them) cannot false-positive. After stripping, the banned identifiers
  // must not appear anywhere — executable calls AND stray references alike.
  const code = readFileSync('app/utils/public-settings-metas.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('t28 — performs no head ownership (no useHead/useSeoMeta)', () => {
    expect(code).not.toMatch(/useHead|useSeoMeta|useServerSeoMeta/)
  })

  it('t29 — performs no network/API reads', () => {
    expect(code).not.toMatch(/\$fetch|useFetch|useAsyncData|useApi|ofetch|fetch\s*\(/)
  })

  it('t30 — owns no PageSeo dependency', () => {
    expect(code).not.toMatch(/PageSeo/i)
    expect(code).not.toMatch(/page-seo-metadata|entity-social-image/)
  })

  it('t31 — produces no canonical/link output in any form', () => {
    expect(code).not.toMatch(/canonical/i)
    expect(code).not.toMatch(/\brel\s*:|\bhref\s*:/)
  })

  it('t32 — generates no structured data', () => {
    expect(code).not.toMatch(/ld\+json|useSchemaOrg|\bschema\b/i)
  })
})
