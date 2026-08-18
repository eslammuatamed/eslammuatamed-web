import type {
  AdminProject,
  AdminProjectTranslation,
  CreateProjectPayload,
  ProjectGalleryItemInput,
  ProjectTranslationInput
} from '~/composables/admin-project-types'

/**
 * The Projects editor's form model and the pure rules over it.
 *
 * Nuxt-free on purpose, exactly like `utils/portrait-form.ts`: every rule below is a decision about
 * what the API will accept and what the operator meant, and both are testable without a runtime.
 *
 * ── THE THREE RULES THIS MODULE EXISTS TO GET RIGHT ─────────────────────────────────────────────
 *
 * 1. NO CROSS-LOCALE FALLBACK. A missing translation is seeded EMPTY, never from the other locale.
 *    The public site resolves per-locale slugs and content (D04-2/D10-6); copying English into the
 *    Arabic boxes here would publish English prose under an Arabic URL on the next save, and the
 *    operator would have no way to see that it had happened.
 *
 * 2. SAVING CONTENT MUST NOT CHANGE PUBLICATION. `isPublished` is carried in the form, seeded from
 *    the server, and only ever moved by its own control — see `buildProjectPayload` for why it is
 *    always SENT rather than omitted.
 *
 * 3. A HALF-TYPED TRANSLATION IS NEVER SILENTLY DROPPED. The contract requires all eleven narrative
 *    fields on any translation it accepts, so a locale is either whole or absent. `validateProjectForm`
 *    blocks the save and names the empty fields instead of quietly discarding what was typed.
 */

/**
 * The two authored locales (D04-2). These are CONTENT locales — independent of the dashboard's own
 * chrome language, which is a separate persisted preference (D02-15).
 */
export const PROJECT_LOCALES = ['en', 'ar'] as const
export type ProjectLocale = (typeof PROJECT_LOCALES)[number]

/**
 * The eleven fields `ProjectTranslationDto` requires. A translation carrying ten of them is a 422,
 * which is why completeness is measured over exactly this list and nothing else.
 */
export const REQUIRED_TRANSLATION_FIELDS = [
  'title',
  'slug',
  'summary',
  'overview',
  'businessProblem',
  'solution',
  'role',
  'architecture',
  'challenges',
  'features',
  'lessonsLearned'
] as const
export type RequiredTranslationField = (typeof REQUIRED_TRANSLATION_FIELDS)[number]

/** The per-translation SEO fields. Optional on the wire, so blank means "send nothing". */
export const OPTIONAL_TRANSLATION_FIELDS = ['metaTitle', 'metaDescription', 'canonicalUrl'] as const
export type OptionalTranslationField = (typeof OPTIONAL_TRANSLATION_FIELDS)[number]

export type ProjectTranslationForm =
  Record<RequiredTranslationField, string>
  & Record<OptionalTranslationField, string>
  & { ogImageId: string | null }

export interface ProjectGalleryItemForm {
  /**
   * Identity that survives a reorder.
   *
   * Keying gallery rows by ARRAY INDEX would make "move up" look to Vue like an edit of two rows
   * rather than a swap of two identities — the MediaPicker instances would be reused in place and
   * each would re-resolve the other's asset, flashing the wrong preview into the wrong row. An
   * existing item uses its server id; a new one gets a monotonic local key.
   */
  readonly key: string
  mediaAssetId: string | null
  captions: Record<ProjectLocale, string>
}

export interface ProjectFormState {
  featured: boolean
  isPublished: boolean
  order: number
  /** Text, not a number: an empty box is a real state (`year` is nullable) and `NaN` is not. */
  year: string
  /** Nullable on the wire; `''` here, mapped to `null` on the way out. */
  liveUrl: string
  repoUrl: string
  technologyIds: string[]
  gallery: ProjectGalleryItemForm[]
  translations: Record<ProjectLocale, ProjectTranslationForm>
}

export function emptyTranslationForm(): ProjectTranslationForm {
  return {
    title: '', slug: '', summary: '', overview: '', businessProblem: '', solution: '',
    role: '', architecture: '', challenges: '', features: '', lessonsLearned: '',
    metaTitle: '', metaDescription: '', canonicalUrl: '', ogImageId: null
  }
}

function translationFormFrom(translation: AdminProjectTranslation | undefined): ProjectTranslationForm {
  // The ABSENT case returns the empty form and never consults the other locale — rule 1 above.
  if (!translation) return emptyTranslationForm()
  return {
    title: translation.title,
    slug: translation.slug,
    summary: translation.summary,
    overview: translation.overview,
    businessProblem: translation.businessProblem,
    solution: translation.solution,
    role: translation.role,
    architecture: translation.architecture,
    challenges: translation.challenges,
    features: translation.features,
    lessonsLearned: translation.lessonsLearned,
    metaTitle: translation.metaTitle ?? '',
    metaDescription: translation.metaDescription ?? '',
    canonicalUrl: translation.canonicalUrl ?? '',
    ogImageId: translation.ogImageId
  }
}

/** Monotonic local key for gallery rows the operator adds; server rows use their own id. */
let galleryKeySeq = 0

export function newGalleryItem(): ProjectGalleryItemForm {
  galleryKeySeq += 1
  return { key: `new-${galleryKeySeq}`, mediaAssetId: null, captions: { en: '', ar: '' } }
}

/**
 * Seed the form from a loaded project, or produce the blank form for a new one.
 *
 * A NEW project starts UNPUBLISHED and UNFEATURED. That is the contract's own default for
 * `isPublished`, and it is the only safe default for a surface that publishes to a live site: the
 * operator opts in to visibility, never out of it.
 */
export function initialProjectForm(project: AdminProject | null): ProjectFormState {
  if (!project) {
    return {
      featured: false,
      isPublished: false,
      order: 0,
      year: '',
      liveUrl: '',
      repoUrl: '',
      technologyIds: [],
      gallery: [],
      translations: { en: emptyTranslationForm(), ar: emptyTranslationForm() }
    }
  }
  return {
    featured: project.featured,
    isPublished: project.isPublished,
    order: project.order,
    year: project.year === null ? '' : String(project.year),
    liveUrl: project.liveUrl ?? '',
    repoUrl: project.repoUrl ?? '',
    technologyIds: [...project.technologyIds],
    gallery: [...project.gallery]
      // The API's order is authoritative; the array index becomes `order` on the way out, so the
      // two can only agree if the array is sorted by it on the way in.
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        key: item.id,
        mediaAssetId: item.mediaAssetId,
        captions: {
          en: item.translations.en?.caption ?? '',
          ar: item.translations.ar?.caption ?? ''
        }
      })),
    translations: {
      en: translationFormFrom(project.translations.en),
      ar: translationFormFrom(project.translations.ar)
    }
  }
}

/* ── translation completeness ──────────────────────────────────────────────────────────────────── */

const blank = (value: string): boolean => value.trim().length === 0

/**
 * Which locales a project actually HAS, for the list's completeness column.
 *
 * Derived from the translation MAP — the presence of the key is the signal, exactly as the contract
 * describes it. `title`/`slug` are checked as well, and only those two: the API accepts a
 * translation only with all eleven narrative fields, so a row that has a title and a slug has the
 * rest by construction, while a map entry with neither is a shape no publish path can have produced
 * and must not be counted as a translation the operator can rely on.
 *
 * NOT derived from `q`, from the UI locale, or from any fallback: a locale the project does not have
 * must READ as missing everywhere, which is the whole point of showing this column.
 */
export function hasTranslation(project: AdminProject, locale: ProjectLocale): boolean {
  const translation = project.translations[locale]
  if (!translation) return false
  return !blank(translation.title) && !blank(translation.slug)
}


/** How much of one locale the operator has filled in. */
export type TranslationFillState = 'empty' | 'partial' | 'complete'

export function translationFillState(form: ProjectTranslationForm): TranslationFillState {
  const filled = REQUIRED_TRANSLATION_FIELDS.filter(field => !blank(form[field])).length
  if (filled === REQUIRED_TRANSLATION_FIELDS.length) return 'complete'
  // The optional SEO fields count towards "the operator typed something here", so a locale holding
  // only a meta description is `partial` and blocks the save rather than being dropped unnoticed.
  const touchedOptional = OPTIONAL_TRANSLATION_FIELDS.some(field => !blank(form[field])) || form.ogImageId !== null
  return filled === 0 && !touchedOptional ? 'empty' : 'partial'
}

export function missingRequiredFields(form: ProjectTranslationForm): RequiredTranslationField[] {
  return REQUIRED_TRANSLATION_FIELDS.filter(field => blank(form[field]))
}

/* ── validation ────────────────────────────────────────────────────────────────────────────────── */

export interface ProjectFormErrors {
  /** Locales with some fields filled and some empty — the API would 422, and dropping them would lose work. */
  readonly partialLocales: readonly ProjectLocale[]
  /** Per locale, which of the eleven required fields are still empty. Only meaningful for a partial locale. */
  readonly missingFields: Readonly<Record<ProjectLocale, readonly RequiredTranslationField[]>>
  /** A locale that WAS saved and is now entirely empty — see below. */
  readonly clearedLocales: readonly ProjectLocale[]
  /** The contract requires at least one complete translation. */
  readonly noTranslation: boolean
  /** Indices of gallery rows with no image chosen; `mediaAssetId` is required on every item. */
  readonly galleryWithoutAsset: readonly number[]
  readonly invalidYear: boolean
  readonly invalidOrder: boolean
}

/**
 * @param form    the edited state
 * @param saved   the project as the SERVER last returned it, or `null` when creating
 */
export function validateProjectForm(form: ProjectFormState, saved: AdminProject | null): ProjectFormErrors {
  const partialLocales: ProjectLocale[] = []
  const clearedLocales: ProjectLocale[] = []
  const missingFields = { en: [] as RequiredTranslationField[], ar: [] as RequiredTranslationField[] }
  let complete = 0

  for (const locale of PROJECT_LOCALES) {
    const state = translationFillState(form.translations[locale])
    if (state === 'complete') {
      complete += 1
      continue
    }
    if (state === 'partial') {
      partialLocales.push(locale)
      missingFields[locale] = missingRequiredFields(form.translations[locale])
      continue
    }
    /**
     * EMPTY, but the server has a translation here.
     *
     * `PATCH` UPSERTS TRANSLATIONS PER LOCALE — verified against the API source, not inferred:
     * `ProjectsAdminService.update` issues a `projectTranslation.upsert` per locale in the payload
     * and no `deleteMany` anywhere, unlike `technologyIds` and `gallery`, which really are cleared
     * and rebuilt. So a locale left out of the payload is not deleted; it is UNTOUCHED.
     *
     * That is precisely why this is blocked. An operator who has just cleared every Arabic box has
     * asked for something the endpoint cannot express, and sending the save would report success
     * while the Arabic case study stayed exactly where it was — the silent no-op being mistaken for
     * a deletion. Deleting a translation is not a capability this screen has, so it says so.
     */
    if (saved && hasTranslation(saved, locale)) clearedLocales.push(locale)
  }

  const yearValue = Number(form.year)
  const invalidYear = !blank(form.year) && !(Number.isInteger(yearValue) && yearValue > 0)

  return {
    partialLocales,
    missingFields,
    clearedLocales,
    noTranslation: complete === 0,
    galleryWithoutAsset: form.gallery
      .map((item, index) => (item.mediaAssetId === null ? index : -1))
      .filter(index => index >= 0),
    invalidYear,
    invalidOrder: !Number.isInteger(form.order)
  }
}

export function hasBlockingError(errors: ProjectFormErrors): boolean {
  return errors.partialLocales.length > 0
    || errors.clearedLocales.length > 0
    || errors.noTranslation
    || errors.galleryWithoutAsset.length > 0
    || errors.invalidYear
    || errors.invalidOrder
}

/* ── slug changes on a published project (D04-6) ───────────────────────────────────────────────── */

/**
 * The locales whose slug the operator has changed away from what the server holds.
 *
 * PER LOCALE, because the slugs are per locale: `/projects/x` and `/ar/projects/y` are two addresses
 * and the API creates a redirect record for each one that moves. A single "the slug changed" notice
 * would not tell the operator which URL is about to be retired.
 *
 * The caller gates this on the SAVED publication state, not the form's: whether a redirect is
 * created follows what the site currently serves, so unpublishing and renaming in one save is still
 * a rename of a published URL.
 */
export function changedSlugLocales(form: ProjectFormState, saved: AdminProject | null): ProjectLocale[] {
  if (!saved) return []
  return PROJECT_LOCALES.filter((locale) => {
    const previous = saved.translations[locale]?.slug
    if (!previous || blank(previous)) return false
    const next = form.translations[locale].slug
    return !blank(next) && next.trim() !== previous.trim()
  })
}

/* ── payload ───────────────────────────────────────────────────────────────────────────────────── */

/** Blank optional string → the key is omitted entirely; the DTO types these `string`, never `null`. */
function optional(value: string): string | undefined {
  return blank(value) ? undefined : value.trim()
}

function translationInput(locale: ProjectLocale, form: ProjectTranslationForm): ProjectTranslationInput {
  const metaTitle = optional(form.metaTitle)
  const metaDescription = optional(form.metaDescription)
  const canonicalUrl = optional(form.canonicalUrl)
  return {
    locale,
    title: form.title.trim(),
    slug: form.slug.trim(),
    // The eleven narrative fields are OPAQUE MARKDOWN and are sent verbatim apart from the outer
    // whitespace: reformatting an operator's Markdown is the editor rewriting their content.
    summary: form.summary.trim(),
    overview: form.overview.trim(),
    businessProblem: form.businessProblem.trim(),
    solution: form.solution.trim(),
    role: form.role.trim(),
    architecture: form.architecture.trim(),
    challenges: form.challenges.trim(),
    features: form.features.trim(),
    lessonsLearned: form.lessonsLearned.trim(),
    ...(metaTitle === undefined ? {} : { metaTitle }),
    ...(metaDescription === undefined ? {} : { metaDescription }),
    ...(canonicalUrl === undefined ? {} : { canonicalUrl }),
    ...(form.ogImageId === null ? {} : { ogImageId: form.ogImageId })
  }
}

function galleryInput(item: ProjectGalleryItemForm, index: number): ProjectGalleryItemInput {
  return {
    // Guarded by `validateProjectForm`; the cast is the type-level statement of that guarantee.
    mediaAssetId: item.mediaAssetId as string,
    // ORDER IS THE ARRAY, not a number the operator maintains by hand. The move-up/move-down
    // controls reorder the array, so the two cannot drift apart.
    order: index,
    // A caption is nullable, so a cleared box really does clear it — unlike the SEO fields above,
    // which are `string | undefined` and can only be omitted.
    translations: {
      en: { caption: blank(item.captions.en) ? null : item.captions.en.trim() },
      ar: { caption: blank(item.captions.ar) ? null : item.captions.ar.trim() }
    }
  }
}

/**
 * The request body, used for BOTH `POST` and `PATCH`.
 *
 * ── WHY `PATCH` SENDS THE WHOLE DOCUMENT EVEN THOUGH IT IS A PARTIAL UPDATE ─────────────────────
 *
 * `isPublished` IS ALWAYS SENT, and the reason is editorial rather than defensive. Omitting it is
 * SAFE — verified against the API source: `isPublished` is `@IsOptional()` with no runtime default
 * (the `default: false` in the contract is Swagger documentation, which is also why
 * openapi-typescript emits the property as non-optional), and Prisma treats the resulting
 * `undefined` as "leave this column alone". The same invariant is load-bearing inside the service
 * itself, where `dto.isPublished ?? existing.isPublished` gates the D04-6 auto-redirect.
 *
 * It is sent anyway because publication is a decision THIS form owns and states on screen before
 * the save: the switch, the "will publish"/"will unpublish"/"stays unpublished" notice and the
 * payload should all say the same thing, and a field that silently disappears from the request
 * when untouched makes that harder to reason about, not easier.
 *
 * `technologyIds` and `gallery` are documented as REPLACED when provided — and really are, via a
 * `deleteMany` and a rebuild — so sending the form's complete set is the operation the operator
 * performed.
 *
 * `translations` carries EVERY locale the form has complete, never only the edited one. The API
 * upserts per locale, so sending only the edited one would also be correct; sending all of them
 * keeps one payload shape for create and update and matches what the form re-seeds from. Empty
 * locales are omitted; a locale that WAS saved and is now empty never reaches here at all —
 * `validateProjectForm` refuses that save.
 */
export function buildProjectPayload(form: ProjectFormState): CreateProjectPayload {
  const complete = PROJECT_LOCALES.filter(
    locale => translationFillState(form.translations[locale]) === 'complete'
  )
  return {
    featured: form.featured,
    isPublished: form.isPublished,
    order: form.order,
    // `''` → `null`, not `undefined`: these are nullable columns and an operator who cleared the box
    // means "there is no live URL", which is a value the API must be told, not a field to omit.
    liveUrl: blank(form.liveUrl) ? null : form.liveUrl.trim(),
    repoUrl: blank(form.repoUrl) ? null : form.repoUrl.trim(),
    year: blank(form.year) ? null : Number(form.year),
    technologyIds: [...form.technologyIds],
    gallery: form.gallery.map(galleryInput),
    translations: complete.map(locale => translationInput(locale, form.translations[locale]))
  }
}

/* ── dirty tracking ────────────────────────────────────────────────────────────────────────────── */

/**
 * A comparable projection of the form.
 *
 * Gallery rows are compared by POSITION and content, deliberately excluding `key`: a reorder must
 * register as a change (it changes `order` on the wire) while re-seeding the same data after a save
 * must not, and the server id that arrives with a saved row would otherwise make every first save
 * look permanently dirty.
 */
function comparable(form: ProjectFormState): string {
  return JSON.stringify({
    featured: form.featured,
    isPublished: form.isPublished,
    order: form.order,
    year: form.year.trim(),
    liveUrl: form.liveUrl.trim(),
    repoUrl: form.repoUrl.trim(),
    // Technology selection is a SET; the order the checkboxes were clicked in is not a change.
    technologyIds: [...form.technologyIds].sort(),
    gallery: form.gallery.map(item => [item.mediaAssetId, item.captions.en.trim(), item.captions.ar.trim()]),
    translations: PROJECT_LOCALES.map(locale => [
      locale,
      ...REQUIRED_TRANSLATION_FIELDS.map(field => form.translations[locale][field].trim()),
      ...OPTIONAL_TRANSLATION_FIELDS.map(field => form.translations[locale][field].trim()),
      form.translations[locale].ogImageId
    ])
  })
}

export function isProjectFormDirty(form: ProjectFormState, initial: ProjectFormState): boolean {
  return comparable(form) !== comparable(initial)
}
