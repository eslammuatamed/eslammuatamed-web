import * as z from 'zod'
import {
  EXPERIENCE_EMPLOYMENT_TYPES,
  EXPERIENCE_LOCALES,
  EXPERIENCE_REQUIRED_TRANSLATION_FIELDS,
  experienceHasTranslation,
  type ExperienceLocale,
  type ExperienceRequiredField
} from '~/composables/admin-experience-fields'
import type {
  AdminExperience,
  CreateExperiencePayload,
  EmploymentType
} from '~/composables/admin-experience-types'

/**
 * The Experiences EDITOR's form model, payload builder and Zod schema (FE-3 module 1, `M1·U3`).
 *
 * SEPARATE FROM `admin-experience-fields.ts` BY DESIGN, and the boundary was created before this
 * file existed. Articles measured the cost of not having it: the collection route gained 8,889 B
 * when the editor's form model and Zod schema landed in the file the list imported from, and
 * splitting them recovered 6,211 B (§10.1). Only the editor imports this file — the collection
 * imports `admin-experience-fields.ts` and must never reach past it.
 *
 * Nuxt-free and runtime-free, so it unit-tests without a Nuxt environment.
 */
const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE EDITOR'S FORM MODEL
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * One locale's authored fields — ALL FOUR REQUIRED, which is a contract fact.
 *
 * `ExperienceTranslationDto` declares `role`, `company`, `location` and `impact` as required and
 * carries NO optional per-locale field. So unlike `ArticleTranslationForm` there is nothing here
 * that is nullable, nothing that clears on an explicit `null`, and no SEO subsection: the
 * "`''` becomes `null` to clear a field" rule (D10-23) that Articles needs per translation has
 * nothing to apply to on this entity.
 */
export interface ExperienceTranslationForm {
  role: string
  company: string
  location: string
  impact: string
}

export interface ExperienceFormState {
  /**
   * `YYYY-MM-DD`, the value of an `<input type="date">`, or `''` when unset.
   *
   * ⚠ A CALENDAR DATE, NOT AN INSTANT — see `experienceIsoToDateInput`. This is the read/write
   * asymmetry this module carries: the API READS `startDate`/`endDate` back as `date-time`
   * (`2022-01-01T00:00:00.000Z`) and WRITES them as `date` (`2022-01-01`).
   */
  startDate: string
  /** `''` is UNSET, and becomes the explicit `null` that clears the stored value (D10-23). */
  endDate: string
  isCurrent: boolean
  employmentType: EmploymentType
  order: number
  /**
   * ⚠ REPLACE-WHOLESALE. The contract says so in as many words: "Skill ids; replaces the full set.
   * Empty array clears." This array is ALWAYS sent — see `experiencePayload` for why omitting it
   * would produce a form that can never clear a relation.
   */
  technologyIds: string[]
  translations: Record<ExperienceLocale, ExperienceTranslationForm>
}

export function emptyExperienceTranslationForm(): ExperienceTranslationForm {
  return { role: '', company: '', location: '', impact: '' }
}

const text = (value: string | null | undefined): string => value ?? ''

/* ── dates ─────────────────────────────────────────────────────────────────────────────────────
   ⚠ THESE ARE CALENDAR DATES AND MUST NOT BE READ THROUGH THE OPERATOR'S TIME ZONE.

   `admin-article-form.ts` converts `publishAt` through LOCAL wall-clock getters, and that is
   correct THERE for the opposite reason it is wrong here: `publishAt` is a real INSTANT, and a
   scheduling control that displayed the UTC wall-clock would silently shift a scheduled article by
   the operator's offset.

   An employment start date is not an instant. It has no time of day and belongs to no zone — the
   API stores it as a `date` and hands it back at UTC midnight. Reading that through
   `new Date(iso).getFullYear()/getMonth()/getDate()` returns the PREVIOUS DAY for every operator
   at a negative UTC offset: `2022-01-01T00:00:00.000Z` renders as `2021-12-31` in New York, and
   saving then writes that shifted date back. Each round trip walks the date one day further.

   ⚠ AND THE DEFECT IS INVISIBLE HERE. This machine is `Africa/Cairo` (UTC+2/+3), a POSITIVE
   offset, where the local-zone reading returns the correct day — so a green suite on this laptop
   is not evidence. `admin-experience-form.spec.ts` pins `TZ=America/New_York` and asserts the
   pin took effect before asserting anything about the conversion. */

/**
 * The stored `date-time` → the `<input type="date">` value.
 *
 * Done as a STRING slice rather than through `Date`, so no zone is ever consulted and there is no
 * offset for a conversion to apply. `Date` is used only to reject a value that is not a date at
 * all; it never produces the result.
 */
export function experienceIsoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (!match) return ''
  return Number.isNaN(new Date(match[1] as string).getTime()) ? '' : (match[1] as string)
}

/** The `<input type="date">` value → what the write DTO wants, or `null` when unset. */
export function experienceDateInputToApi(value: string): string | null {
  return blank(value) ? null : value.trim()
}

/**
 * Seed the form from the server entity, or empty for a new experience.
 *
 * ⚠ `technologyIds` IS SEEDED FROM THE ENTITY, and the failure this prevents is the silent one the
 * e2e backend was built to catch: a form that holds `[]` while the GET is still in flight, and is
 * then saved, REPLACES a real relation with nothing — no 422, no error, every gate green. The
 * editor additionally refuses to render fields before the entity resolves (§14.9 criterion 3), so
 * there is no window in which an operator can submit this empty. Both halves are required: the
 * seeding makes the value right, the resolving gate makes it unreachable while it is wrong.
 *
 * A locale the experience does not have is seeded EMPTY, never from its sibling — the collection
 * falls back across locales to IDENTIFY a row, the editor must not, because a pre-filled Arabic tab
 * holding English text is how an operator saves a translation nobody wrote.
 */
export function initialExperienceForm(experience: AdminExperience | null): ExperienceFormState {
  const translations = {} as Record<ExperienceLocale, ExperienceTranslationForm>
  for (const locale of EXPERIENCE_LOCALES) {
    const saved = experience?.translations[locale]
    translations[locale] = saved
      ? {
          role: text(saved.role),
          company: text(saved.company),
          location: text(saved.location),
          impact: text(saved.impact)
        }
      : emptyExperienceTranslationForm()
  }
  return {
    startDate: experienceIsoToDateInput(experience?.startDate ?? null),
    endDate: experienceIsoToDateInput(experience?.endDate ?? null),
    isCurrent: experience?.isCurrent ?? false,
    employmentType: experience?.employmentType ?? EXPERIENCE_EMPLOYMENT_TYPES[0],
    order: experience?.order ?? 0,
    technologyIds: [...(experience?.technologyIds ?? [])],
    translations
  }
}

/**
 * Is the operator authoring this locale at all?
 *
 * Any non-blank required field counts. Unlike Articles there is no optional field to disqualify —
 * all four ARE the translation — so this is the whole test rather than a deliberate narrowing of it.
 */
export function experienceTranslationInUse(form: ExperienceTranslationForm): boolean {
  return EXPERIENCE_REQUIRED_TRANSLATION_FIELDS.some(field => !blank(form[field]))
}

export type ExperienceFillState = 'empty' | 'partial' | 'complete'

/** How much of one locale is filled in — drives the tab badge (FR-DSH-011). */
export function experienceFillState(form: ExperienceTranslationForm): ExperienceFillState {
  const filled = EXPERIENCE_REQUIRED_TRANSLATION_FIELDS.filter(field => !blank(form[field])).length
  if (filled === 0) return 'empty'
  return filled === EXPERIENCE_REQUIRED_TRANSLATION_FIELDS.length ? 'complete' : 'partial'
}

/** Required fields still missing in a locale that is being authored. */
export function experienceMissingFields(form: ExperienceTranslationForm): ExperienceRequiredField[] {
  return EXPERIENCE_REQUIRED_TRANSLATION_FIELDS.filter(field => blank(form[field]))
}

/**
 * Locales that EXISTED on the saved experience and have been emptied in the form.
 *
 * This must block the save, for the reason Articles records and the e2e backend reproduces:
 * `PATCH /admin/experiences/{id}` UPSERTS translations and NEVER deletes them, so omitting an
 * emptied locale from the payload would report success while the old text stayed live on the
 * public site.
 */
export function experienceClearedLocales(
  form: ExperienceFormState,
  saved: AdminExperience | null
): ExperienceLocale[] {
  if (!saved) return []
  return EXPERIENCE_LOCALES.filter(locale =>
    experienceHasTranslation(saved, locale) && !experienceTranslationInUse(form.translations[locale])
  )
}

/** The locales the payload will carry, in the order it will carry them. */
export function experiencePayloadLocales(form: ExperienceFormState): ExperienceLocale[] {
  return EXPERIENCE_LOCALES.filter(locale => experienceTranslationInUse(form.translations[locale]))
}

/**
 * Build the write payload.
 *
 * ⚠ `technologyIds` IS ALWAYS PRESENT, and that is the load-bearing line in this function.
 *
 * The three clearing semantics in one save differ, and this key is the one that bites:
 *
 *   · `translations` UPSERT and never delete — so every in-use locale is sent, not only the active
 *     tab, or the other language's stored text survives a save the operator believed covered it.
 *   · `endDate` clears on an explicit `null` and PRESERVES when omitted (D10-23).
 *   · `technologyIds` REPLACES the whole set when present, `[]` CLEARS it, and OMITTING it
 *     PRESERVES what the server holds.
 *
 * That last semantic makes omission look attractive and it is a trap: a builder that omitted the
 * key would pass a no-touch save test — the relation survives precisely because nothing was sent —
 * while making "remove every skill from this role" INEXPRESSIBLE. The operator would deselect all
 * five, save, get a 200, and find them all still there. So the key is always sent, and the
 * discriminating test is the CLEAR case, not the no-touch case.
 */
export function experiencePayload(form: ExperienceFormState): CreateExperiencePayload {
  return {
    startDate: experienceDateInputToApi(form.startDate),
    endDate: experienceDateInputToApi(form.endDate),
    isCurrent: form.isCurrent,
    employmentType: form.employmentType,
    order: form.order,
    technologyIds: [...form.technologyIds],
    translations: experiencePayloadLocales(form).map(locale => {
      const value = form.translations[locale]
      return {
        locale,
        role: value.role.trim(),
        company: value.company.trim(),
        location: value.location.trim(),
        impact: value.impact.trim()
      }
    })
  } as CreateExperiencePayload
}

/**
 * A stable comparison string for dirty tracking.
 *
 * Skill ids are SORTED: reordering the same selection is not an edit, and without this the unsaved
 * guard would challenge an operator who ticked a skill off and back on.
 */
function comparable(form: ExperienceFormState): string {
  return JSON.stringify({
    startDate: form.startDate,
    endDate: form.endDate,
    isCurrent: form.isCurrent,
    employmentType: form.employmentType,
    order: form.order,
    technologyIds: [...form.technologyIds].sort(),
    translations: EXPERIENCE_LOCALES.map(locale => form.translations[locale])
  })
}

export function isExperienceFormDirty(
  form: ExperienceFormState,
  initial: ExperienceFormState
): boolean {
  return comparable(form) !== comparable(initial)
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   VALIDATION — ZOD THROUGH `UForm`, THE ONE DASHBOARD ARCHITECTURE (plan §5.2, §14.3)
   ══════════════════════════════════════════════════════════════════════════════════════════════

   THE SCHEMA IS A FUNCTION OF `t` and is rebuilt when the dashboard language changes. Held as a
   `const` it would keep serving validation messages in whichever language the page loaded in while
   every other string changed around them — the defect FE-2a fixed in `login.vue`, which OD-11
   created by making the language switch state rather than navigation.

   ⚠ THE `isCurrent` ⇄ `endDate` RULE IS CLIENT-ONLY, WITH NOTHING BEHIND IT. The write DTOs carry
   no cross-field constraint and the service accepts a current role that also has an end date — the
   e2e backend deliberately ACCEPTS that payload rather than rejecting it, because rejecting it
   would test this guard against a server rule that does not exist. So this schema is the ONLY thing
   enforcing it, and the only thing that can be caught failing.

   ⚠ AND IT IS REPORTED THROUGH `superRefine` WITH AN EXPLICIT `path`, never as an object-level
   `.refine()`. A top-level refinement produces a FORM-level issue with an empty path, which no
   `UFormField name="endDate"` ever renders — the save would be blocked by a message the operator
   cannot see beside the control that caused it. `path: ['endDate']` is what makes the error
   field-owned, and `admin-experience-form.spec.ts` proves it by removing the path and watching the
   field lose the error while the submit stays blocked. */

type Translate = (key: string, named?: Record<string, unknown>) => string

/** A blank-tolerant field: the emptiness rules live in `superRefine`, where the locale is known. */
const loose = z.string()

export function experienceFormSchema(translate: Translate, saved: AdminExperience | null) {
  const translationShape = z.object({
    role: loose,
    company: loose,
    location: loose,
    impact: loose
  })

  return z
    .object({
      startDate: loose,
      endDate: loose,
      isCurrent: z.boolean(),
      employmentType: z.enum(EXPERIENCE_EMPLOYMENT_TYPES),
      order: z.number().int().min(0, translate('dashboard.experiences.validation.orderInvalid')),
      technologyIds: z.array(z.string()),
      translations: z.object({ en: translationShape, ar: translationShape })
    })
    .superRefine((form, ctx) => {
      /* ── dates ──────────────────────────────────────────────────────────────────────────────── */

      if (blank(form.startDate)) {
        ctx.addIssue({
          code: 'custom',
          path: ['startDate'],
          message: translate('dashboard.experiences.validation.startDateRequired')
        })
      }

      // A CURRENT role has not ended. The contradiction is blocked rather than silently repaired:
      // clearing `endDate` for the operator would destroy a date they typed, and doing it invisibly
      // is worse than refusing. The message is field-owned so it renders on the control at fault.
      if (form.isCurrent && !blank(form.endDate)) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: translate('dashboard.experiences.validation.currentHasEndDate')
        })
      }

      // An end date before the start date. Compared as `YYYY-MM-DD` STRINGS, which sort
      // lexicographically in the same order they sort chronologically — no `Date`, so no zone.
      if (!blank(form.startDate) && !blank(form.endDate) && form.endDate < form.startDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: translate('dashboard.experiences.validation.endBeforeStart')
        })
      }

      /* ── translations ───────────────────────────────────────────────────────────────────────── */

      const inUse = EXPERIENCE_LOCALES.filter(locale =>
        experienceTranslationInUse(form.translations[locale])
      )

      // At least one language must actually be written. The API requires it too, but a 422 saying
      // "you have not written anything" is a round trip that tells the operator nothing the form
      // could not have told them first.
      if (inUse.length === 0) {
        for (const field of EXPERIENCE_REQUIRED_TRANSLATION_FIELDS) {
          ctx.addIssue({
            code: 'custom',
            path: ['translations', EXPERIENCE_LOCALES[0] as string, field],
            message: translate('dashboard.experiences.validation.atLeastOneLocale')
          })
        }
      }

      // A locale being authored must be COMPLETE — and here the SERVER enforces it too, because all
      // four fields are required by the DTO. Reported per missing field anyway, so the message lands
      // on the input rather than on the tab, and so the operator is not told by a 422 what the form
      // already knew.
      for (const locale of inUse) {
        for (const field of experienceMissingFields(form.translations[locale])) {
          ctx.addIssue({
            code: 'custom',
            path: ['translations', locale, field],
            message: translate('dashboard.experiences.validation.fieldRequired')
          })
        }
      }

      // A locale that EXISTS on the server and has been emptied. Blocked rather than dropped from
      // the payload: the PATCH upserts and never deletes, so omitting it would report success while
      // the old text stayed published.
      for (const locale of experienceClearedLocales(form as ExperienceFormState, saved)) {
        ctx.addIssue({
          code: 'custom',
          path: ['translations', locale, 'role'],
          message: translate('dashboard.experiences.validation.cannotClearLocale')
        })
      }
    })
}
