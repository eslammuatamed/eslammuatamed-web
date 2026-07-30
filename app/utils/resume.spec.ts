import { describe, expect, it } from 'vitest'
import type { ProfileLink, Skill } from '~/types/models'
import { formatFileSize, groupSkills, impactBullets, resumeEmail, resumeLinks } from './resume'

// Pure helpers — no Nuxt runtime needed. These pin the rules that are invisible in the rendered
// output until they are wrong: registry order, the professional-email rule, and the fact that a
// malformed descriptor degrades rather than printing "NaN kB".

const skill = (id: string, label: string, group: string | null): Skill => ({
  id,
  label,
  group,
  order: 0,
  brandColor: null,
  availableLocales: ['en', 'ar']
})

const UNITS = { kb: 'kB', mb: 'MB' }

describe('groupSkills', () => {
  it('groups by the API group, preserving arrival order within each group', () => {
    const groups = groupSkills([
      skill('1', 'Vue.js', 'Frontend'),
      skill('2', 'Nuxt', 'Frontend'),
      skill('3', 'NestJS', 'Backend')
    ])

    expect(groups).toEqual([
      { group: 'Frontend', skills: [expect.objectContaining({ label: 'Vue.js' }), expect.objectContaining({ label: 'Nuxt' })] },
      { group: 'Backend', skills: [expect.objectContaining({ label: 'NestJS' })] }
    ])
  })

  // The binding rule: group order is FIRST APPEARANCE in the API sequence. Sorting groups
  // alphabetically here would silently reimpose a Web-side order over the owner's curated one.
  it('orders groups by first appearance, never alphabetically', () => {
    const groups = groupSkills([
      skill('1', 'NestJS', 'Zebra'),
      skill('2', 'Vue.js', 'Alpha')
    ])

    expect(groups.map(g => g.group)).toEqual(['Zebra', 'Alpha'])
  })

  // Interleaved members rejoin their group without disturbing the group sequence.
  it('reunites a group whose members are not adjacent', () => {
    const groups = groupSkills([
      skill('1', 'Vue.js', 'Frontend'),
      skill('2', 'NestJS', 'Backend'),
      skill('3', 'Nuxt', 'Frontend')
    ])

    expect(groups.map(g => g.group)).toEqual(['Frontend', 'Backend'])
    expect(groups[0]!.skills.map(s => s.label)).toEqual(['Vue.js', 'Nuxt'])
  })

  it('keeps an ungrouped skill instead of dropping it', () => {
    const groups = groupSkills([skill('1', 'Git', null)])
    expect(groups).toEqual([{ group: '', skills: [expect.objectContaining({ label: 'Git' })] }])
  })

  it('returns nothing for an empty registry', () => {
    expect(groupSkills([])).toEqual([])
  })
})

describe('resumeEmail', () => {
  it('uses the professional address', () => {
    expect(resumeEmail({ professionalEmail: 'hello@example.com' })).toBe('hello@example.com')
  })

  // The rule this file exists to defend: a résumé must never quietly print the website's general
  // inbox. `contactEmail` is not even reachable from this helper's signature.
  it('returns null rather than falling back when the professional address is absent', () => {
    expect(resumeEmail({ professionalEmail: null })).toBeNull()
  })
})

describe('resumeLinks', () => {
  const link = (label: string, url: string): ProfileLink => ({ label, url })

  it('preserves API order verbatim', () => {
    const links = resumeLinks([link('GitHub', 'https://github.com/x'), link('LinkedIn', 'https://linkedin.com/in/x')])
    expect(links.map(l => l.label)).toEqual(['GitHub', 'LinkedIn'])
  })

  it('drops entries that would render as dead anchors', () => {
    const links = resumeLinks([
      link('GitHub', 'https://github.com/x'),
      link('Broken', 'not-a-url'),
      link('Relative', '/somewhere')
    ])
    expect(links.map(l => l.label)).toEqual(['GitHub'])
  })

  it('tolerates an absent list', () => {
    expect(resumeLinks(undefined)).toEqual([])
  })
})

describe('formatFileSize', () => {
  it('formats sub-megabyte sizes in kB with no fraction', () => {
    expect(formatFileSize(97805, 'en', UNITS)).toBe('98 kB')
  })

  it('formats megabyte sizes with one fraction digit', () => {
    expect(formatFileSize(2_450_000, 'en', UNITS)).toBe('2.5 MB')
  })

  it('switches unit exactly at 1,000,000 bytes (decimal units, as browsers show)', () => {
    expect(formatFileSize(999_999, 'en', UNITS)).toBe('1,000 kB')
    expect(formatFileSize(1_000_000, 'en', UNITS)).toBe('1 MB')
  })

  // D03-4: digits stay Western in Arabic. The unit string is localized by the caller.
  it('keeps Western digits in Arabic', () => {
    const formatted = formatFileSize(97805, 'ar', { kb: 'كيلوبايت', mb: 'ميجابايت' })
    expect(formatted).toContain('كيلوبايت')
    expect(formatted).toMatch(/\d/)
    expect(formatted).not.toMatch(/[٠-٩]/)
  })

  // A malformed descriptor must print no size rather than "NaN kB"; the download action survives.
  it('returns null for a non-finite or negative size', () => {
    expect(formatFileSize(Number.NaN, 'en', UNITS)).toBeNull()
    expect(formatFileSize(-1, 'en', UNITS)).toBeNull()
  })

  it('formats a zero-byte file rather than rejecting it', () => {
    expect(formatFileSize(0, 'en', UNITS)).toBe('0 kB')
  })
})

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
