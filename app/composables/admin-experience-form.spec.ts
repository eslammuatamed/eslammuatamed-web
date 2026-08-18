import process from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  emptyExperienceTranslationForm,
  experienceClearedLocales,
  experienceDateInputToApi,
  experienceFieldErrorLocale,
  experienceFieldErrorName,
  experienceFillState,
  experienceFormSchema,
  experienceIsoToDateInput,
  experiencePayload,
  experiencePayloadLocales,
  experienceTranslationInUse,
  initialExperienceForm,
  isExperienceFormDirty,
  type ExperienceFormState
} from './admin-experience-form'
import type { AdminExperience, AdminExperienceTranslation } from './admin-experience-types'

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   ⚠ THE TIME ZONE IS PINNED, AND THE PIN IS ASSERTED BEFORE ANYTHING DEPENDS ON IT.

   The defect these date tests exist to catch — reading a calendar date through the operator's local
   wall-clock — is INVISIBLE on the machine this suite normally runs on. `Africa/Cairo` is UTC+2/+3,
   a POSITIVE offset, where `2022-01-01T00:00:00.000Z` still reads as the 1st. The defect appears
   only at a NEGATIVE offset, where it reads as `2021-12-31`.

   So the zone is set to `America/New_York` and `preconditions` asserts it actually took effect. If
   Node ever stops honouring a mid-process `TZ` change, that assertion FAILS rather than letting
   every date test below silently degrade into a tautology on whatever zone the machine happens to
   have. An unasserted pin is not a pin.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
beforeAll(() => {
  process.env.TZ = 'America/New_York'
})

describe('preconditions — the instrument', () => {
  it('actually runs at a NEGATIVE UTC offset, or every date test below is vacuous', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York')
    // The concrete shift the production code must not perform, demonstrated on `Date` itself.
    // If this stops being true the zone pin is not doing what these tests assume it does.
    expect(new Date('2022-01-01T00:00:00.000Z').getDate()).toBe(31)
  })
})

function translation(over: Partial<AdminExperienceTranslation> = {}): AdminExperienceTranslation {
  return {
    role: 'Senior Software Engineer',
    company: 'Findropica',
    location: 'Cairo, Egypt',
    impact: '- Cut deploy time by 60%.',
    ...over
  }
}

function experience(over: Partial<AdminExperience> = {}): AdminExperience {
  return {
    id: 'e1',
    startDate: '2022-01-01T00:00:00.000Z',
    endDate: null,
    isCurrent: true,
    employmentType: 'FULL_TIME',
    order: 0,
    technologyIds: ['s1', 's2', 's3'],
    translations: { en: translation(), ar: translation({ role: 'مهندس برمجيات أول' }) },
    ...over
  } as AdminExperience
}

/** A complete, valid form — the baseline every negative case departs from by exactly one field. */
function validForm(over: Partial<ExperienceFormState> = {}): ExperienceFormState {
  return {
    ...initialExperienceForm(experience()),
    ...over
  }
}

const t = (key: string) => key

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   DATES — A CALENDAR DATE IS NOT AN INSTANT
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('a stored date-time reads back as the SAME calendar day in any zone', () => {
  it('does not walk UTC midnight back a day at a negative offset', () => {
    // The whole point. A local-wall-clock implementation returns `2021-12-31` here — the
    // precondition test above proves `Date` really does that under this pin.
    expect(experienceIsoToDateInput('2022-01-01T00:00:00.000Z')).toBe('2022-01-01')
  })

  it('reads a date-time with a real time-of-day by its UTC calendar day', () => {
    expect(experienceIsoToDateInput('2024-06-30T23:30:00.000Z')).toBe('2024-06-30')
  })

  it('accepts a bare date string unchanged — the write format round-trips', () => {
    expect(experienceIsoToDateInput('2022-01-01')).toBe('2022-01-01')
  })

  it('answers empty for an absent or unparseable value rather than inventing one', () => {
    expect(experienceIsoToDateInput(null)).toBe('')
    expect(experienceIsoToDateInput(undefined)).toBe('')
    expect(experienceIsoToDateInput('')).toBe('')
    expect(experienceIsoToDateInput('not-a-date')).toBe('')
    expect(experienceIsoToDateInput('2022-13-45T00:00:00.000Z')).toBe('')
  })

  it('survives a full round trip without drifting', () => {
    // Three round trips, because a one-day-per-trip drift is what the local-zone bug produces and a
    // single conversion could hide a compensating pair of errors.
    let value = experienceIsoToDateInput('2022-01-01T00:00:00.000Z')
    for (let i = 0; i < 3; i++) {
      value = experienceIsoToDateInput(experienceDateInputToApi(value) as string)
    }
    expect(value).toBe('2022-01-01')
  })
})

describe('the date input maps back onto the write DTO', () => {
  it('sends an unset date as the explicit null that CLEARS it (D10-23)', () => {
    expect(experienceDateInputToApi('')).toBeNull()
    expect(experienceDateInputToApi('   ')).toBeNull()
  })

  it('passes a real date through', () => {
    expect(experienceDateInputToApi('2024-06-30')).toBe('2024-06-30')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SEEDING
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('seeding the form', () => {
  it('carries the saved skill relation onto the form', () => {
    // The silent-wipe guard, at its source: a form seeded with `[]` and saved REPLACES the relation.
    expect(initialExperienceForm(experience()).technologyIds).toEqual(['s1', 's2', 's3'])
  })

  it('copies the relation rather than aliasing it, so editing the form cannot mutate the entity', () => {
    const entity = experience()
    const form = initialExperienceForm(entity)
    form.technologyIds.push('s4')
    expect(entity.technologyIds).toEqual(['s1', 's2', 's3'])
  })

  it('seeds a missing locale EMPTY rather than from its sibling', () => {
    const form = initialExperienceForm(experience({ translations: { en: translation() } } as Partial<AdminExperience>))
    expect(form.translations.ar).toEqual(emptyExperienceTranslationForm())
    expect(form.translations.en.role).toBe('Senior Software Engineer')
  })

  it('seeds a NEW experience with no relation, no dates and the first employment type', () => {
    const form = initialExperienceForm(null)
    expect(form.technologyIds).toEqual([])
    expect(form.startDate).toBe('')
    expect(form.endDate).toBe('')
    expect(form.isCurrent).toBe(false)
    expect(form.employmentType).toBe('FULL_TIME')
    expect(form.order).toBe(0)
  })

  it('reads isCurrent from the server and never re-derives it from endDate', () => {
    // The two CAN contradict each other — the API has no cross-field rule — and the editor must
    // show what is stored, not what it would have inferred.
    const form = initialExperienceForm(experience({ isCurrent: true, endDate: '2024-06-30T00:00:00.000Z' }))
    expect(form.isCurrent).toBe(true)
    expect(form.endDate).toBe('2024-06-30')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE PAYLOAD — THREE CLEARING SEMANTICS IN ONE SAVE
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('technologyIds is ALWAYS sent — replace-wholesale, and clearing must be expressible', () => {
  it('sends the untouched relation on a no-touch save', () => {
    const payload = experiencePayload(validForm())
    expect(payload.technologyIds).toEqual(['s1', 's2', 's3'])
  })

  it('sends an EMPTY ARRAY when every skill is deselected, rather than omitting the key', () => {
    // ⚠ THE DISCRIMINATING CASE. A builder that OMITTED `technologyIds` would still pass the
    // no-touch test above — the relation survives precisely because nothing was sent — while making
    // "remove every skill from this role" impossible: omission PRESERVES. Only this assertion
    // separates the two implementations.
    const payload = experiencePayload(validForm({ technologyIds: [] }))
    expect(Object.keys(payload)).toContain('technologyIds')
    expect(payload.technologyIds).toEqual([])
  })

  it('copies the array so a later form edit cannot reach into a sent payload', () => {
    const form = validForm()
    const payload = experiencePayload(form)
    form.technologyIds.push('s9')
    expect(payload.technologyIds).toEqual(['s1', 's2', 's3'])
  })
})

describe('the payload carries dates as calendar dates', () => {
  it('sends startDate as YYYY-MM-DD, not as an instant', () => {
    expect(experiencePayload(validForm()).startDate).toBe('2022-01-01')
  })

  it('sends an unset endDate as explicit null', () => {
    expect(experiencePayload(validForm({ endDate: '' })).endDate).toBeNull()
  })

  it('sends a real endDate through', () => {
    expect(experiencePayload(validForm({ isCurrent: false, endDate: '2024-06-30' })).endDate).toBe('2024-06-30')
  })
})

describe('which locales the payload carries', () => {
  it('sends every locale in use, not only the tab being edited', () => {
    // `translations` UPSERT and never delete: sending only the active tab leaves the other
    // language's stored text untouched while the operator believes the whole role was saved.
    expect(experiencePayloadLocales(validForm())).toEqual(['en', 'ar'])
    expect(experiencePayload(validForm()).translations).toHaveLength(2)
  })

  it('omits a locale nobody has written', () => {
    const form = validForm()
    form.translations.ar = emptyExperienceTranslationForm()
    expect(experiencePayloadLocales(form)).toEqual(['en'])
  })

  it('trims each field so whitespace never becomes content', () => {
    const form = validForm()
    form.translations.en.role = '  Staff Engineer  '
    const sent = experiencePayload(form).translations[0] as { role: string }
    expect(sent.role).toBe('Staff Engineer')
  })
})

describe('a locale is in use when any required field is written', () => {
  it('counts a single field', () => {
    expect(experienceTranslationInUse({ ...emptyExperienceTranslationForm(), role: 'x' })).toBe(true)
  })

  it('does not count whitespace', () => {
    expect(experienceTranslationInUse({ ...emptyExperienceTranslationForm(), role: '   ' })).toBe(false)
  })

  it('reports fill state across the four required fields', () => {
    expect(experienceFillState(emptyExperienceTranslationForm())).toBe('empty')
    expect(experienceFillState({ ...emptyExperienceTranslationForm(), role: 'x' })).toBe('partial')
    expect(experienceFillState(translation())).toBe('complete')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   422 MAPPING
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('422 field paths map back onto the right locale tab', () => {
  it('resolves an index against the array THIS request sent', () => {
    expect(experienceFieldErrorName('translations[1].role', ['en', 'ar'])).toBe('translations.ar.role')
    expect(experienceFieldErrorLocale('translations[1].role', ['en', 'ar'])).toBe('ar')
  })

  it('resolves a SINGLE-locale payload against its own ordering, not a canonical list', () => {
    // The case that actually bites: an Arabic-only role sends ONE entry, so index 0 is Arabic. An
    // implementation resolving against a canonical ['en','ar'] pins the error to the English tab —
    // a field the operator deliberately left empty — while the real problem stays invisible.
    expect(experienceFieldErrorName('translations[0].company', ['ar'])).toBe('translations.ar.company')
    expect(experienceFieldErrorLocale('translations[0].company', ['ar'])).toBe('ar')
  })

  it('passes a non-translation path through unchanged and reports no locale', () => {
    expect(experienceFieldErrorName('startDate', ['en'])).toBe('startDate')
    expect(experienceFieldErrorLocale('startDate', ['en'])).toBeNull()
  })

  it('refuses to guess when the index is outside the sent array', () => {
    expect(experienceFieldErrorName('translations[3].role', ['en'])).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   DIRTY TRACKING
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('dirty tracking', () => {
  it('is clean against its own seed', () => {
    const initial = initialExperienceForm(experience())
    expect(isExperienceFormDirty(initialExperienceForm(experience()), initial)).toBe(false)
  })

  it('does not treat re-ordering the same skill selection as an edit', () => {
    const initial = initialExperienceForm(experience())
    const form = validForm({ technologyIds: ['s3', 's1', 's2'] })
    expect(isExperienceFormDirty(form, initial)).toBe(false)
  })

  it('sees a real change to the selection', () => {
    const initial = initialExperienceForm(experience())
    expect(isExperienceFormDirty(validForm({ technologyIds: ['s1', 's2'] }), initial)).toBe(true)
  })

  it('sees a changed date, employment type and order', () => {
    const initial = initialExperienceForm(experience())
    expect(isExperienceFormDirty(validForm({ startDate: '2021-01-01' }), initial)).toBe(true)
    expect(isExperienceFormDirty(validForm({ employmentType: 'CONTRACT' }), initial)).toBe(true)
    expect(isExperienceFormDirty(validForm({ order: 7 }), initial)).toBe(true)
  })
})

describe('emptying a locale that is already saved is BLOCKED, not silently dropped', () => {
  it('names the emptied locale', () => {
    const saved = experience()
    const form = validForm()
    form.translations.ar = emptyExperienceTranslationForm()
    expect(experienceClearedLocales(form, saved)).toEqual(['ar'])
  })

  it('reports nothing for a locale that was never saved', () => {
    const saved = experience({ translations: { en: translation() } } as Partial<AdminExperience>)
    const form = initialExperienceForm(saved)
    expect(experienceClearedLocales(form, saved)).toEqual([])
  })

  it('reports nothing on create, where there is no stored text to lose', () => {
    expect(experienceClearedLocales(initialExperienceForm(null), null)).toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE ZOD SCHEMA
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/** Every issue path the schema produced, joined — the shape a `UFormField name` is matched against. */
function issuePaths(form: ExperienceFormState, saved: AdminExperience | null = null): string[] {
  const result = experienceFormSchema(t, saved).safeParse(form)
  return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'))
}

describe('the isCurrent ⇄ endDate rule is FIELD-OWNED, not a form-level refinement', () => {
  it('rejects a current role that also has an end date', () => {
    const paths = issuePaths(validForm({ isCurrent: true, endDate: '2024-06-30' }))
    expect(paths).toContain('endDate')
  })

  it('⚠ attaches the error to `endDate` and to nothing else — an empty path renders nowhere', () => {
    // THE EXIT CRITERION. A `.refine()` on the object produces an issue whose path is `[]`; the
    // save is blocked but `UFormField name="endDate"` never renders the message, so the operator is
    // stopped by something they cannot see. This asserts the path is exactly `endDate`, which an
    // empty-path implementation fails while still "rejecting" the input.
    const result = experienceFormSchema(t, null).safeParse(validForm({ isCurrent: true, endDate: '2024-06-30' }))
    expect(result.success).toBe(false)
    if (result.success) return
    const rule = result.error.issues.filter(
      issue => issue.message === 'dashboard.experiences.validation.currentHasEndDate'
    )
    expect(rule).toHaveLength(1)
    expect(rule[0]?.path).toEqual(['endDate'])
  })

  it('accepts a current role with no end date', () => {
    expect(issuePaths(validForm({ isCurrent: true, endDate: '' }))).toEqual([])
  })

  it('accepts an ended role with an end date', () => {
    expect(issuePaths(validForm({ isCurrent: false, endDate: '2024-06-30' }))).toEqual([])
  })

  it('does not silently clear the typed end date to make the form valid', () => {
    // Blocking is the decision. A schema that repaired the contradiction would destroy a date the
    // operator typed, invisibly — and there would be nothing left for this test to observe.
    const form = validForm({ isCurrent: true, endDate: '2024-06-30' })
    void issuePaths(form)
    expect(form.endDate).toBe('2024-06-30')
  })
})

describe('the schema on dates', () => {
  it('requires a start date, on the start-date field', () => {
    expect(issuePaths(validForm({ startDate: '' }))).toContain('startDate')
  })

  it('rejects an end date before the start date, on the end-date field', () => {
    const paths = issuePaths(validForm({ isCurrent: false, startDate: '2022-01-01', endDate: '2021-12-31' }))
    expect(paths).toContain('endDate')
  })

  it('accepts an end date equal to the start date', () => {
    expect(issuePaths(validForm({ isCurrent: false, startDate: '2022-01-01', endDate: '2022-01-01' }))).toEqual([])
  })
})

describe('the schema on translations', () => {
  it('demands at least one written language, on the first locale\'s fields', () => {
    const form = validForm()
    form.translations.en = emptyExperienceTranslationForm()
    form.translations.ar = emptyExperienceTranslationForm()
    const paths = issuePaths(form)
    expect(paths).toContain('translations.en.role')
    expect(paths).toContain('translations.en.impact')
  })

  it('demands a half-written language be completed, per missing field', () => {
    const form = validForm()
    form.translations.ar = { ...emptyExperienceTranslationForm(), role: 'مهندس' }
    const paths = issuePaths(form)
    expect(paths).toContain('translations.ar.company')
    expect(paths).toContain('translations.ar.location')
    expect(paths).toContain('translations.ar.impact')
    // The field that WAS written must not be reported — an error on a filled input is noise the
    // operator cannot act on.
    expect(paths).not.toContain('translations.ar.role')
  })

  it('permits a single-language role', () => {
    const form = validForm()
    form.translations.ar = emptyExperienceTranslationForm()
    expect(issuePaths(form)).toEqual([])
  })

  it('blocks emptying a language the server already holds', () => {
    const saved = experience()
    const form = validForm()
    form.translations.ar = emptyExperienceTranslationForm()
    expect(issuePaths(form, saved)).toContain('translations.ar.role')
  })
})

describe('the schema on the shared fields', () => {
  it('rejects a negative order, on the order field', () => {
    expect(issuePaths(validForm({ order: -1 }))).toContain('order')
  })

  it('rejects a non-integer order', () => {
    expect(issuePaths(validForm({ order: 1.5 }))).toContain('order')
  })

  it('accepts every employment type the contract declares', () => {
    for (const value of ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'] as const) {
      expect(issuePaths(validForm({ employmentType: value }))).toEqual([])
    }
  })

  it('rejects an employment type the contract does not declare', () => {
    expect(issuePaths(validForm({ employmentType: 'INTERNSHIP' as never }))).toContain('employmentType')
  })
})
