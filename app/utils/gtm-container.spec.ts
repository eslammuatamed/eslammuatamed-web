import { describe, expect, it } from 'vitest'
import { isEligibleGtmContainerId } from './gtm-container'

/**
 * Focused unit coverage for the GTM container-id eligibility guard (FE4-U2e2). The structural
 * contract tests live in config/gtm.spec.ts; this file exercises the guard as a pure function,
 * including the boundary of the backend's publication pattern.
 */
describe('isEligibleGtmContainerId', () => {
  it('accepts the 4-character tail floor', () => {
    expect(isEligibleGtmContainerId('GTM-ABCD')).toBe(true)
  })

  it('accepts the 12-character tail ceiling', () => {
    expect(isEligibleGtmContainerId('GTM-A1B2C3D4E5F6')).toBe(true)
  })

  it('rejects a 3-character tail (below the floor)', () => {
    expect(isEligibleGtmContainerId('GTM-ABC')).toBe(false)
  })

  it('rejects a 13-character tail (above the ceiling)', () => {
    expect(isEligibleGtmContainerId('GTM-A1B2C3D4E5F67')).toBe(false)
  })

  it('rejects non-string values outright', () => {
    for (const value of [null, undefined, 12345, {}, [], true]) {
      expect(isEligibleGtmContainerId(value)).toBe(false)
    }
  })
})
