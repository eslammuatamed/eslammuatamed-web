import { describe, expect, it } from 'vitest'
import { assertGovernedUrlCoverage, describeCoverage, pathOf } from './lighthouse-coverage.mjs'
import { GOVERNED_PATHS, PROFILES, resolveProfile } from './lighthouse-governed-urls.cjs'

const ORIGIN = 'https://127.0.0.1:46309'

/** The reports a complete, correct collection produces for one profile. */
const fullFor = (formFactor, paths = GOVERNED_PATHS) =>
  paths.map(path => ({ formFactor, url: `${ORIGIN}${path}` }))

describe('governed Lighthouse URL coverage', () => {
  it('accepts exactly the governed population for one profile', () => {
    const covered = assertGovernedUrlCoverage(fullFor('mobile'), ['mobile'])
    expect(covered).toHaveLength(1)
    expect(covered[0].profile).toBe('mobile')
    // Pinned to the LITERAL count. Comparing against GOVERNED_PATHS.length on both sides would
    // pass just as happily if the list were emptied.
    expect(covered[0].paths).toHaveLength(16)
    expect(GOVERNED_PATHS).toHaveLength(16)
  })

  it('accepts both profiles when both were collected', () => {
    const covered = assertGovernedUrlCoverage([...fullFor('mobile'), ...fullFor('desktop')], PROFILES)
    expect(covered.map(c => c.profile)).toEqual(['mobile', 'desktop'])
  })

  // DIRECTION 1 — the truncated collection. This is the one a forward-only check catches.
  it('REJECTS a profile that is missing a governed URL, naming it', () => {
    const short = fullFor('mobile', GOVERNED_PATHS.filter(p => p !== '/ar/contact'))
    expect(() => assertGovernedUrlCoverage(short, ['mobile']))
      .toThrow(/MISSING: mobile collected 15\/16 governed URLs — no runs for \/ar\/contact/)
  })

  // DIRECTION 2 — the one a forward-only check MISSES: reports that are not the governed population.
  it('REJECTS runs for a URL that is not governed', () => {
    const extra = [...fullFor('mobile'), { formFactor: 'mobile', url: `${ORIGIN}/dashboard` }]
    expect(() => assertGovernedUrlCoverage(extra, ['mobile']))
      .toThrow(/UNGOVERNED: mobile \/dashboard has reports but is not in the governed URL population/)
  })

  // The sharding failure mode in full: a `desktop` shard that actually collected mobile. The
  // reports are internally consistent and the median gate would apply mobile thresholds to them
  // and pass. Only coverage against the EXPECTED profile catches it.
  it('REJECTS a shard that collected the wrong profile', () => {
    expect(() => assertGovernedUrlCoverage(fullFor('mobile'), ['desktop']))
      .toThrow(/UNEXPECTED PROFILE: reports for "mobile"/)
  })

  it('reports BOTH directions at once rather than only the first', () => {
    const both = [
      ...fullFor('mobile', GOVERNED_PATHS.filter(p => p !== '/about')),
      { formFactor: 'mobile', url: `${ORIGIN}/dashboard` }
    ]
    const run = () => assertGovernedUrlCoverage(both, ['mobile'])
    expect(run).toThrow(/UNGOVERNED: mobile \/dashboard/)
    expect(run).toThrow(/MISSING: mobile collected 15\/16/)
  })

  it('REFUSES an empty expectation, which any collection would satisfy', () => {
    expect(() => assertGovernedUrlCoverage(fullFor('mobile'), []))
      .toThrow(/an empty expectation is satisfied by an empty collection/)
  })

  it('REFUSES to assert coverage for a profile that is not governed', () => {
    expect(() => assertGovernedUrlCoverage(fullFor('mobile'), ['tablet']))
      .toThrow(/"tablet" is not a governed Lighthouse profile/)
  })

  it('compares paths, not origins — the governed frontend binds an ephemeral port', () => {
    const other = GOVERNED_PATHS.map(path => ({ formFactor: 'mobile', url: `https://127.0.0.1:1234${path}` }))
    expect(() => assertGovernedUrlCoverage(other, ['mobile'])).not.toThrow()
  })

  it('normalises a trailing slash, except on root', () => {
    expect(pathOf(`${ORIGIN}/ar/projects/`)).toBe('/ar/projects')
    expect(pathOf(`${ORIGIN}/`)).toBe('/')
  })

  it('treats an unparseable requestedUrl as infrastructure, not a low score', () => {
    expect(() => pathOf('not a url', 'lhr-3.json'))
      .toThrow(/lhr-3\.json: requestedUrl "not a url" is not a valid URL/)
  })

  it('states the verified count rather than merely that it passed', () => {
    expect(describeCoverage(assertGovernedUrlCoverage(fullFor('desktop'), ['desktop'])))
      .toBe('desktop: all 16/16 governed URLs collected')
  })
})

describe('governed Lighthouse profile resolution', () => {
  it.each(PROFILES)('accepts the governed profile %s', profile => {
    expect(resolveProfile(profile)).toBe(profile)
  })

  // The superseded expression was `LHCI_PROFILE === 'desktop' ? 'desktop' : 'mobile'`, so every one
  // of these silently resolved to 'mobile' — a passing gate for an unmeasured configuration.
  it.each([undefined, '', 'Desktop', 'MOBILE', 'desktop ', 'tablet', null])(
    'THROWS rather than defaulting for %o', value => {
      expect(() => resolveProfile(value)).toThrow(/expected exactly one of "mobile" or "desktop"/)
    }
  )
})
