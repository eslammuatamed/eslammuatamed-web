import type { ComputedRef, Ref, WatchSource } from 'vue'
import type { FormErrorEvent } from '@nuxt/ui'
import {
  translationFieldErrorLocale,
  translationFieldErrorName
} from '~/composables/dashboard-translation-errors'

/**
 * The behaviour every translated dashboard editor needs to present a validation failure — from the
 * API or from Zod — on the right field AND on the right locale tab.
 *
 * ── WHY THIS EXISTS, AND WHY IT DID NOT EXIST SOONER (§14.6, `M1·U4`) ───────────────────────────
 * `ArticleEditor` was the only consumer, so §10.2 declined to extract it: an abstraction with one
 * consumer is a guess about the second. `ExperienceEditor` (`M1·U3`) is that second consumer, and
 * the duplication was then MEASURED rather than asserted — 56 byte-identical non-trivial code lines
 * across the two editors, of which this machinery is the largest single block and the only one that
 * is pure behaviour rather than markup. `M1·U4` recorded the verdict; this is it being acted on.
 *
 * ── WHAT IS DELIBERATELY *NOT* IN HERE ─────────────────────────────────────────────────────────
 * Anything entity-specific. This composable knows about LOCALES and FIELD PATHS; it does not know
 * what an article or an experience is, and it holds no form state, no schema, no payload and no
 * save. Each module keeps its own `admin-*-form.ts` — the field lists differ, the clearing semantics
 * differ, and merging them would produce the generic CRUD layer the owner ruled out by name.
 *
 * The tab SELECTION stays with the caller too, as a `Ref` passed in rather than owned here: OD-9
 * says the dashboard application locale seeds the initial tab and the operator owns it thereafter,
 * which is a policy about the editor, not about error handling. This composable only ever MOVES it,
 * and only toward a locale that has an error the operator must see.
 */
export interface TranslatableFormErrors<L extends string> {
  /** Server field errors, keyed by FORM path, for `UFormField`'s own `error` prop. */
  serverFieldErrors: Ref<Record<string, string>>
  /** Every problem, in order, each tagged with the locale it belongs to (or `null`). */
  fieldErrorSummary: Ref<{ locale: L | null, message: string }[]>
  /** Which locales currently carry an error — drives the tab's invalid badge. */
  localesWithErrors: ComputedRef<Set<L>>
  /** Reset both surfaces. Call before a save so a stale failure cannot outlive its request. */
  reset: () => void
  /** Map an API 422 onto the form, activate the offending tab, focus the first bad control. */
  applyFieldErrors: (
    errors: readonly { field: string, message: string }[],
    sentLocales: readonly L[]
  ) => void
  /** The same treatment for a CLIENT-side (Zod) failure, from `UForm`'s `@error`. */
  onValidationError: (event: FormErrorEvent) => void
}

export function useTranslatableForm<L extends string>(options: {
  locales: readonly L[]
  /** The active tab. Owned by the caller (OD-9); moved by this composable only toward an error. */
  activeLocale: Ref<L>
  /**
   * A CSS scope for focusing the first invalid control — e.g. `'[data-experience-editor]'`.
   *
   * Scoped rather than document-wide because two editors must never be able to reach into each
   * other's DOM, and because an unscoped `[aria-invalid="true"]` would also match controls in the
   * dashboard chrome that have nothing to do with this form.
   */
  scope: string
  /**
   * Watch source whose change clears stale SERVER errors — normally the form state.
   *
   * A server error describes the input that was SENT. The moment the operator edits anything it is
   * describing something that no longer exists, and leaving it on screen invites them to "fix" a
   * field that is already correct.
   */
  clearOn?: WatchSource
}): TranslatableFormErrors<L> {
  const { locales, activeLocale, scope } = options

  const serverFieldErrors = ref<Record<string, string>>({}) as Ref<Record<string, string>>
  const fieldErrorSummary = ref<{ locale: L | null, message: string }[]>([]) as
    Ref<{ locale: L | null, message: string }[]>

  const localesWithErrors = computed(() => {
    const found = new Set<L>()
    for (const entry of fieldErrorSummary.value) if (entry.locale) found.add(entry.locale)
    return found
  })

  if (options.clearOn) {
    watch(options.clearOn, () => {
      if (Object.keys(serverFieldErrors.value).length > 0) serverFieldErrors.value = {}
    }, { deep: true })
  }

  function reset(): void {
    fieldErrorSummary.value = []
    serverFieldErrors.value = {}
  }

  /**
   * §14.4 — send the operator to the first problem rather than leaving them to hunt for it.
   *
   * Runs AFTER the tab switch, so the target is on screen when it is focused; `UForm`'s own scroll
   * cannot reach a field inside a panel that was hidden when validation ran.
   */
  function focusFirstError(): void {
    const target = document.querySelector<HTMLElement>(`${scope} [aria-invalid="true"]`)
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function activateFirstOffendingTab(summary: { locale: L | null }[]): void {
    const firstLocale = summary.find(entry => entry.locale)?.locale
    if (firstLocale) activeLocale.value = firstLocale
    void nextTick(() => focusFirstError())
  }

  /**
   * Map a 422 onto the form — and onto the right TAB.
   *
   * ⚠ `sentLocales` IS THE ORDERING OF THE REQUEST THAT FAILED, and it must be captured before that
   * request is sent. Writes send `translations` as an ARRAY, so the API answers `translations[N].x`
   * where N indexes the array the CLIENT built. With Arabic sent first, `translations[0]` is Arabic;
   * an implementation resolving against a canonical `['en','ar']` would pin an Arabic error to the
   * English tab. The case that actually bites is a SINGLE-locale payload — see
   * `dashboard-translation-errors.ts`, where that failure was reproduced deliberately.
   */
  function applyFieldErrors(
    errors: readonly { field: string, message: string }[],
    sentLocales: readonly L[]
  ): void {
    const formErrors: { name: string, message: string }[] = []
    const summary: { locale: L | null, message: string }[] = []

    for (const item of errors) {
      const name = translationFieldErrorName(item.field, sentLocales)
      const locale = translationFieldErrorLocale(item.field, sentLocales) as L | null
      summary.push({ locale, message: item.message })
      // A path that could not be resolved to a field stays in the summary only — better unattached
      // than confidently pinned to the wrong input.
      if (name) formErrors.push({ name, message: item.message })
    }

    fieldErrorSummary.value = summary
    // Assigned as ONE whole object, AFTER the summary, so the `clearOn` watcher cannot observe a
    // half-populated map and clear it.
    const map: Record<string, string> = {}
    for (const item of formErrors) map[item.name] = item.message
    serverFieldErrors.value = map

    activateFirstOffendingTab(summary)
  }

  /**
   * The client-side (Zod) equivalent.
   *
   * `UForm` reports issue paths in FORM shape (`translations.ar.role`), not the API's array shape,
   * so the locale is read straight off the path rather than through `sentLocales` — there is no
   * request and therefore no ordering to resolve against.
   */
  function onValidationError(event: FormErrorEvent): void {
    // Built from the caller's locale list rather than hard-coded, so a module with a different
    // locale set cannot silently stop matching.
    const pattern = new RegExp(`^translations\\.(${locales.join('|')})\\.`)
    const summary: { locale: L | null, message: string }[] = []
    for (const item of event.errors ?? []) {
      const match = pattern.exec(String(item.name ?? ''))
      summary.push({ locale: (match?.[1] as L | undefined) ?? null, message: item.message ?? '' })
    }
    fieldErrorSummary.value = summary
    activateFirstOffendingTab(summary)
  }

  return {
    serverFieldErrors,
    fieldErrorSummary,
    localesWithErrors,
    reset,
    applyFieldErrors,
    onValidationError
  }
}
