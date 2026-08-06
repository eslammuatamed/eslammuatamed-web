import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * The committed locale dictionaries are governed public copy, so positioning-strategy v2.0.0 §9's
 * banned-string list is enforced here rather than trusted.
 *
 * This exists because the divergence it guards against was real: `seo.about.description` carried the
 * superseded `JavaScript Product Engineer — frontend-led` title in English and the substance of the
 * §9-banned Arabic string, and §8's own divergence table recorded the gap for weeks without anything
 * failing. A list in a document is not a gate; this is.
 *
 * TWO RULES, not one. §9 bans strings, but §2 makes the *presence* of `Frontend Engineer` and
 * `Frontend Developer` in relevant SEO copy a standing requirement — "a positioning statement is not
 * a replacement for the terms people actually search". Only asserting absence would let the fix
 * regress by deleting the search terms instead of restoring the old title, which passes an
 * absence-only test while breaking the same requirement.
 *
 * ## Why these are patterns and not literal `includes` checks
 *
 * - §9 prints the Arabic ban with an em dash (`مهندس برمجيات للمنتجات — متخصص…`) while the value that
 *   was actually shipped used a comma. An exact-substring assertion PASSES on the broken value. The
 *   ban is therefore expressed as its two component constructions, which is what makes it substantive
 *   rather than punctuation-sensitive.
 * - `JavaScript Product Engineer` is a substring of the APPROVED title
 *   `Full-Stack JavaScript Product Engineer` (§2), so the superseded title is matched with a negative
 *   lookbehind. Banning the bare phrase would fail on `seo.defaultTitle`, which is correct.
 * - The bare label `هندسة الواجهات الأمامية` is §5's approved Arabic for "Frontend Engineering" and is
 *   NOT banned. Only the retired qualifier construction (`متخصص في … باستخدام`) is.
 */

interface BannedPattern {
  /** positioning-strategy v2.0.0 §9 row this enforces */
  readonly rule: string
  readonly pattern: RegExp
}

const BANNED: readonly BannedPattern[] = [
  {
    rule: '§9 — the superseded v1.x primary title `JavaScript Product Engineer`',
    pattern: /(?<!Full-Stack )JavaScript Product Engineer/i
  },
  {
    rule: '§9 — the retired qualifier `frontend-led`',
    pattern: /frontend-led/i
  },
  {
    rule: '§9 — `Frontend Engineer specializing in Vue.js & Nuxt.js` and its variants',
    pattern: /specializing in (Vue|Nuxt)/i
  },
  {
    rule: '§2 — `Frontend-focused` is the INTERNAL statement and is never a display string',
    pattern: /Frontend-focused/i
  },
  {
    rule: '§9 — displayed proficiency levels and rated skill labels',
    pattern: /\b(Mid-Level|Junior|Senior|Expert|Advanced|Intermediate)\b/i
  },
  {
    rule: '§3/§9 — the superseded Arabic title `مهندس برمجيات للمنتجات`',
    pattern: /مهندس برمجيات للمنتجات/
  },
  {
    rule: '§9 — the retired Arabic qualifier construction `متخصص في هندسة الواجهات الأمامية باستخدام`',
    pattern: /متخصص في هندسة الواجهات الأمامية باستخدام/
  },
  {
    rule: '§9 — the pre-v1.0.0 Arabic pair `مهندس واجهات أمامية — Vue.js و Nuxt.js`',
    pattern: /مهندس واجهات أمامية\s*(—|-|متخصص)/
  },
  {
    rule: '§9 — `Backend specialist`',
    pattern: /backend specialist/i
  },
  {
    rule: '§9 — a formal `Team Lead` title',
    pattern: /\bTeam Lead\b/i
  }
]

const LOCALES = ['en', 'ar'] as const

function load(locale: string): Record<string, unknown> {
  const path = resolve(process.cwd(), `i18n/locales/${locale}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

/** Every leaf string in the dictionary, keyed by its dotted path so a failure names the offender. */
function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, index) => strings(item, `${path}[${index}]`))
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => strings(value, path ? `${path}.${key}` : key))
  }
  return []
}

describe('governed public copy — positioning-strategy v2.0.0', () => {
  for (const locale of LOCALES) {
    const entries = strings(load(locale))

    it(`${locale}.json contains no §9 banned string`, () => {
      const hits = entries.flatMap(([key, value]) =>
        BANNED.filter(banned => banned.pattern.test(value)).map(
          banned => `${locale}.json ${key}: ${banned.rule}\n    value: ${value}`
        )
      )

      expect(hits).toEqual([])
    })

    // §2: the primary title is a positioning statement, not a replacement for what recruiters type
    // into a search box. Scoped to `seo.*` — §2 says "relevant SEO copy", and visible chrome is
    // explicitly not where these belong (the displayed title is the §2 tagline, one governed value).
    it(`${locale}.json keeps Frontend Engineer and Frontend Developer present in SEO copy`, () => {
      const seo = entries
        .filter(([key]) => key.startsWith('seo.'))
        .map(([, value]) => value)
        .join(' ')

      expect(seo).toMatch(/frontend engineer/i)
      expect(seo).toMatch(/frontend developer/i)
    })
  }

  // §8, ONE VALUE SEVERAL CONSUMERS: `brand.role` is the offline fallback for the CMS tagline, so it
  // must be the approved two-line composition — identical in both locales, English in both (§3).
  it('brand.role is the approved two-line title, in English, in both locales', () => {
    const roles = LOCALES.map(locale => (load(locale).brand as Record<string, string>).role)

    expect(roles[0]).toBe('Full-Stack JavaScript\nProduct Engineer')
    expect(new Set(roles).size).toBe(1)
  })
})
