import { describe, expect, it } from 'vitest'
import { impactBullets } from './format'

// Pure helper — no Nuxt runtime needed. `impactBullets` is the single definition of "what a bullet
// is" for BOTH experience presentations (`ContentTimelineEntry` on the home page and `/experience`,
// `ResumeEntry` on `/resume`). Mutating it must break both, which is what makes it worth one
// definition rather than two identical parsers; these cases pin the parsing rules themselves.
describe('impactBullets', () => {
  it('strips Markdown bullet markers and blank lines', () => {
    expect(impactBullets('- One\n- Two\n\n* Three')).toEqual(['One', 'Two', 'Three'])
  })

  it('returns nothing for null, undefined or empty impact', () => {
    expect(impactBullets(null)).toEqual([])
    expect(impactBullets(undefined)).toEqual([])
    expect(impactBullets('')).toEqual([])
  })

  it('leaves inner punctuation untouched', () => {
    expect(impactBullets('- Built Vue.js + Inertia.js — end to end')).toEqual([
      'Built Vue.js + Inertia.js — end to end'
    ])
  })
})
