import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * Locale-catalogue parity — the gate that makes an untranslated dashboard string a FAILURE.
 *
 * Owner decision OD-11 (D02-15) makes the Dashboard chrome bilingual, and the failure mode that
 * decision introduces is invisible: vue-i18n has no `fallbackLocale` here (deliberately — a fallback
 * would render English text in an Arabic dashboard and look like a translation choice), so a key
 * present in `en.json` and absent from `ar.json` renders its own RAW KEY PATH on screen.
 * `dashboard.media.title` where a heading belongs. Nothing throws, nothing warns, `vue-tsc` sees
 * nothing, and the build is green.
 *
 * That is not hypothetical: it is precisely what `/ar/dashboard/**` did before OD-11 — measured by
 * the M4-A lane, which left it unasserted because every candidate fix was a governed decision. This
 * file is the assertion that became possible once the decision was made.
 *
 * ## Three rules, because parity alone is not enough
 *
 * 1. **Key parity, both directions.** A key in one catalogue and not the other is a defect whichever
 *    way round it is: `en`-only renders key paths to an Arabic operator, `ar`-only is dead weight
 *    that survives the string it was written for.
 * 2. **No blank values.** `""` satisfies key parity perfectly and renders nothing at all — a missing
 *    button label rather than an obviously wrong one, which is harder to notice, not easier.
 * 3. **Interpolation parity.** `"Signed in as {email}"` translated without its `{email}` placeholder
 *    passes both rules above and silently drops the operator's identity from the sentence. The
 *    placeholder SET has to match; order does not, because word order legitimately differs between
 *    English and Arabic.
 *
 * Deliberately NOT asserted: that an Arabic value differs from its English one. `SEO`, `PDF`,
 * `GitHub` and `English` are correct as-is in Arabic copy, so that rule would be noise — and noise in
 * a gate is how gates get muted.
 */

const LOCALES = ['en', 'ar'] as const

function readCatalogue(locale: string): Record<string, unknown> {
  const path = resolve(process.cwd(), `i18n/locales/${locale}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

/** Flatten to dotted leaf paths, so a missing whole SECTION reports as its individual keys. */
function flatten(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (typeof value === 'string') {
    out.set(prefix.replace(/\.$/, ''), value)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flatten(child, `${prefix}${key}.`)) out.set(path, leaf)
    }
  }
  return out
}

/**
 * vue-i18n's named-interpolation form. Matches `{email}` but not `{0}` (list interpolation, which
 * this app does not use) and not `{{ }}`, so a doubled brace in copy cannot be read as a placeholder.
 */
function placeholders(message: string): Set<string> {
  return new Set(Array.from(message.matchAll(/\{([a-zA-Z][\w]*)\}/g), match => match[1] as string))
}

const catalogues = new Map(LOCALES.map(locale => [locale, flatten(readCatalogue(locale))]))

describe('locale catalogues are at parity', () => {
  for (const locale of LOCALES) {
    const other = LOCALES.find(item => item !== locale) as (typeof LOCALES)[number]

    it(`every key in ${locale}.json exists in ${other}.json`, () => {
      const source = catalogues.get(locale) as Map<string, string>
      const target = catalogues.get(other) as Map<string, string>
      const missing = [...source.keys()].filter(key => !target.has(key)).sort()

      // The message carries the keys, not just the count: a bare count sends the next reader back to
      // re-derive the list that this assertion already had in hand.
      expect(missing, `${other}.json is missing ${missing.length} key(s): ${missing.join(', ')}`)
        .toEqual([])
    })

    it(`${locale}.json has no blank message`, () => {
      const blank = [...(catalogues.get(locale) as Map<string, string>)]
        .filter(([, message]) => message.trim() === '')
        .map(([key]) => key)
        .sort()

      expect(blank, `${locale}.json has blank values at: ${blank.join(', ')}`).toEqual([])
    })
  }

  it('a translated message keeps every placeholder its source has', () => {
    const en = catalogues.get('en') as Map<string, string>
    const ar = catalogues.get('ar') as Map<string, string>

    const mismatched: string[] = []
    for (const [key, source] of en) {
      const target = ar.get(key)
      if (target === undefined) continue // reported by the parity assertion above

      const expected = [...placeholders(source)].sort()
      const actual = [...placeholders(target)].sort()
      if (expected.join('|') !== actual.join('|')) {
        mismatched.push(`${key} — en {${expected.join(', ')}} vs ar {${actual.join(', ')}}`)
      }
    }

    expect(mismatched, `placeholder mismatch:\n${mismatched.join('\n')}`).toEqual([])
  })
})
