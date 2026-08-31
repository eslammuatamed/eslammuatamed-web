// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTranslatableForm } from './useTranslatableForm'

/**
 * The extracted 422 / tab-activation machinery (`M1·U4b`).
 *
 * It is now the SINGLE point of failure for both editors' error handling, so it is tested directly
 * rather than only through whichever editor happens to exercise it. The per-module wrappers this
 * replaced had their own specs; those cases live in `dashboard-translation-errors.spec.ts`, which
 * owns the path-resolution RULE. What is tested here is the BEHAVIOUR built on top of it: which tab
 * gets activated, what reaches `UFormField`, and what is deliberately left unattached.
 */
type L = 'en' | 'ar'

function harness(active: L = 'en') {
  const activeLocale = ref<L>(active)
  const api = useTranslatableForm<L>({
    locales: ['en', 'ar'],
    activeLocale,
    scope: '[data-test-editor]'
  })
  return { activeLocale, ...api }
}

describe('a 422 lands on the field and the tab that caused it', () => {
  it('resolves the array index against the ordering THIS request sent', () => {
    const h = harness('en')
    h.applyFieldErrors([{ field: 'translations[1].role', message: 'too long' }], ['en', 'ar'])

    expect(h.serverFieldErrors.value).toEqual({ 'translations.ar.role': 'too long' })
    expect(h.activeLocale.value, 'the offending tab must be activated').toBe('ar')
    expect(h.localesWithErrors.value.has('ar')).toBe(true)
  })

  it('resolves a SINGLE-locale payload against its own ordering, not a canonical list', () => {
    // The case that bites: an Arabic-only entity sends ONE entry, so index 0 is Arabic. Resolving
    // against a canonical ['en','ar'] would pin the error to a tab the operator left empty.
    const h = harness('en')
    h.applyFieldErrors([{ field: 'translations[0].company', message: 'required' }], ['ar'])

    expect(h.serverFieldErrors.value).toEqual({ 'translations.ar.company': 'required' })
    expect(h.activeLocale.value).toBe('ar')
  })

  it('keeps an unresolvable path in the summary but attaches it to no field', () => {
    const h = harness('en')
    h.applyFieldErrors([{ field: 'translations[7].role', message: 'mystery' }], ['en'])

    // Better unattached than confidently pinned to the wrong input.
    expect(h.serverFieldErrors.value).toEqual({})
    expect(h.fieldErrorSummary.value).toEqual([{ locale: null, message: 'mystery' }])
    expect(h.activeLocale.value, 'no locale to switch to').toBe('en')
  })

  it('passes a non-translation path through and switches no tab', () => {
    const h = harness('en')
    h.applyFieldErrors([{ field: 'startDate', message: 'required' }], ['en', 'ar'])

    expect(h.serverFieldErrors.value).toEqual({ startDate: 'required' })
    expect(h.fieldErrorSummary.value[0]?.locale).toBeNull()
    expect(h.activeLocale.value).toBe('en')
  })

  it('activates the FIRST offending locale when several are wrong', () => {
    const h = harness('en')
    h.applyFieldErrors([
      { field: 'translations[1].role', message: 'ar bad' },
      { field: 'translations[0].role', message: 'en bad' }
    ], ['en', 'ar'])

    expect(h.activeLocale.value, 'the first problem in the list, not the last').toBe('ar')
    expect(h.localesWithErrors.value).toEqual(new Set(['ar', 'en']))
  })
})

describe('a client-side (Zod) failure gets the same treatment', () => {
  it('reads the locale straight off the FORM path — there is no request to resolve against', () => {
    const h = harness('en')
    h.onValidationError({ errors: [{ name: 'translations.ar.impact', message: 'required' }] } as never)

    expect(h.activeLocale.value).toBe('ar')
    expect(h.fieldErrorSummary.value).toEqual([{ locale: 'ar', message: 'required' }])
    // Client errors are rendered by `UForm` itself; the server map must stay empty or the same
    // message would be shown twice on one field.
    expect(h.serverFieldErrors.value).toEqual({})
  })

  it('leaves a non-translation issue unlocalised and switches no tab', () => {
    const h = harness('en')
    h.onValidationError({ errors: [{ name: 'endDate', message: 'before start' }] } as never)

    expect(h.fieldErrorSummary.value).toEqual([{ locale: null, message: 'before start' }])
    expect(h.activeLocale.value).toBe('en')
  })

  it('builds its path pattern from the caller\'s locales, not a hard-coded pair', () => {
    // A module with a different locale set must not silently stop matching. `fr` is not in the
    // list, so its path is correctly NOT read as locale-scoped.
    const h = harness('en')
    h.onValidationError({ errors: [{ name: 'translations.fr.role', message: 'x' }] } as never)
    expect(h.fieldErrorSummary.value).toEqual([{ locale: null, message: 'x' }])
  })
})

describe('stale errors do not outlive what they described', () => {
  it('reset clears both surfaces', () => {
    const h = harness('en')
    h.applyFieldErrors([{ field: 'translations[0].role', message: 'x' }], ['en'])
    expect(h.fieldErrorSummary.value).toHaveLength(1)

    h.reset()
    expect(h.serverFieldErrors.value).toEqual({})
    expect(h.fieldErrorSummary.value).toEqual([])
    expect(h.localesWithErrors.value.size).toBe(0)
  })

  it('clears SERVER errors when the watched form changes', async () => {
    const form = ref({ title: 'a' })
    const activeLocale = ref<L>('en')
    const api = useTranslatableForm<L>({
      locales: ['en', 'ar'],
      activeLocale,
      scope: '[data-test-editor]',
      clearOn: form
    })

    api.applyFieldErrors([{ field: 'translations[0].role', message: 'x' }], ['en'])
    expect(Object.keys(api.serverFieldErrors.value)).toHaveLength(1)

    // A server error describes the input that was SENT. The moment the operator edits, it is
    // describing something that no longer exists.
    form.value.title = 'b'
    await nextTick()
    expect(api.serverFieldErrors.value).toEqual({})
  })

  it('does not clear the SUMMARY on edit, so the operator can still read what was wrong', async () => {
    const form = ref({ title: 'a' })
    const activeLocale = ref<L>('en')
    const api = useTranslatableForm<L>({
      locales: ['en', 'ar'],
      activeLocale,
      scope: '[data-test-editor]',
      clearOn: form
    })
    api.applyFieldErrors([{ field: 'translations[0].role', message: 'x' }], ['en'])

    form.value.title = 'b'
    await nextTick()
    // The per-field marks go because they pointed at stale input; the list of what failed stays
    // until the next save replaces it. Losing both would erase the only record mid-correction.
    expect(api.fieldErrorSummary.value).toHaveLength(1)
  })
})
