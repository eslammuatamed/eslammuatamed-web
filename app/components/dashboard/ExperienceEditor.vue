<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import {
  EXPERIENCE_EMPLOYMENT_TYPES,
  EXPERIENCE_LOCALES,
  type ExperienceLocale
} from '~/composables/admin-experience-fields'
import {
  experienceFieldErrorLocale,
  experienceFieldErrorName,
  experienceFillState,
  experienceFormSchema,
  experiencePayload,
  experiencePayloadLocales,
  initialExperienceForm,
  isExperienceFormDirty,
  type ExperienceFormState
} from '~/composables/admin-experience-form'
import { toApiError } from '~/utils/api-error'

/**
 * The Experiences authoring surface — create AND edit (FE-3 module 1, `M1·U3`).
 *
 * ONE COMPONENT FOR BOTH, with `id: string | null`, following `ArticleEditor` and `ProjectEditor`
 * and their reason: two components are how two forms come to disagree about what an entity is.
 *
 * ── WHAT THIS IS A SECOND CONSUMER OF, AND WHAT IT IS NOT ──────────────────────────────────────
 * This is the module ledger §10.2 exists to test: the second real consumer of the Articles editor's
 * architecture. What it REUSES unchanged is named at each site — the shared 422 mapping, the
 * request-state contract, the unsaved guard, the skill picker. What DIFFERS is contract-driven and
 * is called out where it happens, because each difference is a place a copied implementation would
 * be quietly wrong.
 *
 * Four differences from Articles, all of them from the contract:
 *
 * 1. NO STATUS, NO SCHEDULE, NO PREVIEW. An experience is not published — it has no `status`, no
 *    `publishAt` and no preview token. There is no publish shortcut and no draft.
 * 2. NO PUBLIC PER-ENTITY DESTINATION. `/experience` is ONE public page listing every role; there
 *    is no `/experience/{slug}`. So there is no "View on site" action here, and §10.3 rule 10
 *    (`usePublicEntityLink`) stays unsatisfiable — the §5.2 prediction, met by construction rather
 *    than by argument.
 * 3. NO OPTIONAL TRANSLATION FIELD. All four per-locale fields are required by the DTO, so there is
 *    no SEO subsection and no `''`→`null` clearing inside a translation.
 * 4. THREE CLEARING SEMANTICS IN ONE SAVE, which Articles does not have. `translations` upsert and
 *    never delete; `endDate` clears on explicit `null`; `technologyIds` REPLACES wholesale and `[]`
 *    clears. The last one is the silent hazard and is handled in `admin-experience-form.ts`.
 *
 * ── WHY INACTIVE TABS STAY MOUNTED ─────────────────────────────────────────────────────────────
 * `:unmount-on-hide="false"`, for the reason Articles records: a validation error in a hidden locale
 * must stay DISCOVERABLE rather than being destroyed with its panel, and switching tabs must not
 * disturb unsaved work. Form VALUES would survive a remount anyway because they live in `form` — the
 * error state is the half that would not.
 */
const props = defineProps<{ id: string | null }>()

const { t, locale } = useDashboardI18n()
const router = useRouter()

const editor = useAdminExperience()
const { experience, pending: loading, forbidden, notFound, failed: loadFailed } = editor

const form = ref<ExperienceFormState>(initialExperienceForm(null))
/** The baseline the dirty check compares against — re-seeded from the server after every save. */
const initial = ref<ExperienceFormState>(initialExperienceForm(null))

const formRef = useTemplateRef('formRef')
const alertRef = useTemplateRef<HTMLElement>('alertRef')

const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const fieldErrorSummary = ref<{ locale: ExperienceLocale | null, message: string }[]>([])

/**
 * SERVER field errors, keyed by form path — rendered through `UFormField`'s own `error` prop.
 *
 * `UForm.setErrors()` is deliberately not used, and that was MEASURED during FE-2c rather than
 * assumed: it attaches correctly under a component test's DOM and does NOT survive in a real
 * browser, where the tab activation that follows it re-renders the panel and the schema-backed store
 * reclaims the field. Passing the message explicitly behaves identically in both environments.
 *
 * This is NOT a second validation architecture (§14.3): validation is still Zod through `UForm`.
 * This is how a 422 that only the API could know about is PRESENTED.
 */
const serverFieldErrors = ref<Record<string, string>>({})

/** Clear a stale server error as soon as the operator edits anything — it described the old input. */
watch(form, () => {
  if (Object.keys(serverFieldErrors.value).length > 0) serverFieldErrors.value = {}
}, { deep: true })

const deleting = ref(false)
const confirmingDelete = ref(false)
const deleteError = ref<string | null>(null)

/**
 * Set immediately before any navigation this component performs itself, so the unsaved-changes
 * guard never challenges a successful save's own redirect.
 */
const bypassGuard = ref(false)

const isCreate = computed(() => props.id === null)
const dirty = computed(() => isExperienceFormDirty(form.value, initial.value))

/**
 * §14.9 CRITERION 3 — never render blank editable fields before the entity resolves.
 *
 * ⚠ ON THIS MODULE THIS IS NOT ONLY AN INTERACTION RULE, IT GUARDS THE SKILL RELATION. A form
 * rendered before the GET resolves holds `technologyIds: []`; submitting it REPLACES a real
 * relation with nothing — 200 OK, no 422, every gate green, and the skills gone. The form model
 * seeds from the entity and this gate makes the un-seeded state unreachable. Both halves are
 * required; either alone leaves the window open.
 */
const resolving = computed(() => !isCreate.value && loading.value && experience.value === null)
const unreadable = computed(() => forbidden.value || notFound.value || loadFailed.value)

/* ── validation ────────────────────────────────────────────────────────────────────────────────
   The schema is a COMPUTED, rebuilt when the dashboard language changes — the defect FE-2a fixed in
   `login.vue`, which OD-11 created by making the language switch state rather than navigation. A
   `const` schema keeps serving messages in the load-time language while everything else changes. */
const schema = computed(() => experienceFormSchema(t, experience.value))

const activeLocale = ref<ExperienceLocale>('en')

/**
 * OD-9 — the DASHBOARD application locale seeds the initial tab, and only the initial one.
 *
 * Seeded once rather than watched: after first paint the operator owns the selection, so changing
 * the dashboard language must not yank an Arabic-reading operator out of the English tab they are
 * deliberately editing.
 */
onMounted(() => {
  activeLocale.value = EXPERIENCE_LOCALES.includes(locale.value as ExperienceLocale)
    ? (locale.value as ExperienceLocale)
    : 'en'
})

const localesWithErrors = computed(() => {
  const found = new Set<ExperienceLocale>()
  for (const entry of fieldErrorSummary.value) if (entry.locale) found.add(entry.locale)
  return found
})

const tabItems = computed(() =>
  EXPERIENCE_LOCALES.map(value => ({
    value,
    label: t(`dashboard.experiences.locale.${value}`),
    fill: experienceFillState(form.value.translations[value]),
    invalid: localesWithErrors.value.has(value)
  }))
)

const employmentItems = computed(() =>
  EXPERIENCE_EMPLOYMENT_TYPES.map(value => ({
    value,
    label: t(`dashboard.experiences.employmentType.${value}`)
  }))
)

/** The picker holds no copy of its own — see `SkillPicker.vue`. */
const skillLabels = computed(() => ({
  legend: t('dashboard.experiences.field.skills'),
  help: t('dashboard.experiences.editor.skillsHelp'),
  filter: t('dashboard.experiences.editor.skillsFilter'),
  empty: t('dashboard.experiences.editor.skillsEmpty'),
  error: t('dashboard.experiences.editor.skillsError'),
  unknown: t('dashboard.experiences.editor.skillsUnknown'),
  selected: t('dashboard.experiences.editor.skillsSelected', { count: form.value.technologyIds.length })
}))

/* ── loading ───────────────────────────────────────────────────────────────────────────────────── */

function adopt(): void {
  form.value = initialExperienceForm(experience.value)
  initial.value = initialExperienceForm(experience.value)
}

watch(experience, () => { if (experience.value) adopt() })

onMounted(async () => {
  if (props.id) await editor.load(props.id)
})

/* ── save ──────────────────────────────────────────────────────────────────────────────────────── */

async function onSubmit(_event: FormSubmitEvent<unknown>): Promise<void> {
  // §14.9 CRITERION 4 — duplicate submission prevented at the source. The guard is the same flag
  // that disables the control, so a keyboard Enter cannot outrun a disabled button.
  if (saving.value) return
  saving.value = true
  saveError.value = null
  fieldErrorSummary.value = []
  serverFieldErrors.value = {}
  deleteError.value = null

  // The ordering of THIS request, captured before it is sent — a 422's `translations[N]` indexes
  // this array and nothing else.
  const sentLocales = experiencePayloadLocales(form.value)

  try {
    const payload = experiencePayload(form.value)
    const saved = props.id
      ? await editor.update(props.id, payload)
      : await editor.create(payload)

    savedAt.value = Date.now()

    if (props.id) {
      // Re-seed from the CONFIRMED server entity, not from what was sent — which is what clears
      // `dirty` honestly and shows the skill set the role actually has.
      adopt()
    } else {
      bypassGuard.value = true
      // `replace`, not `push` — an empty create form is not a place to go Back to.
      await router.replace(`/dashboard/experiences/${saved.id}`)
    }
  } catch (error) {
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      applyFieldErrors(apiError.fieldErrors, sentLocales)
    } else {
      // ⚠ A 422 WITH NO FIELD ARRAY LANDS HERE, AND THAT IS THE POINT. The service rejects duplicate
      // and unknown skill ids with `UnprocessableEntityException` — a MESSAGE and no `errors[]`,
      // unlike the class-validator failures above. An editor that only rendered `errors[]` would
      // swallow the skills failure entirely and show a save that silently did nothing.
      saveError.value = apiError.detail ?? apiError.message
      await nextTick()
      alertRef.value?.focus()
    }
  } finally {
    saving.value = false
  }
}

/**
 * Map a 422 onto the form — and onto the right TAB.
 *
 * Writes send `translations` as an ARRAY, so the API answers `translations[N].role` where N indexes
 * the array this client just built. Resolving it needs that ordering, which is why `sentLocales` is
 * threaded through from the request rather than assumed: with Arabic sent first, `translations[0]`
 * is Arabic, and a fixed assumption would put an Arabic error on the English tab.
 *
 * The offending tab is then ACTIVATED, because an error the operator cannot see is one they cannot
 * fix — §14.1's "a hidden tab must never swallow an error".
 */
function applyFieldErrors(
  errors: readonly { field: string, message: string }[],
  sentLocales: readonly ExperienceLocale[]
): void {
  const formErrors: { name: string, message: string }[] = []
  const summary: { locale: ExperienceLocale | null, message: string }[] = []

  for (const item of errors) {
    const name = experienceFieldErrorName(item.field, sentLocales)
    const errorLocale = experienceFieldErrorLocale(item.field, sentLocales)
    summary.push({ locale: errorLocale, message: item.message })
    // A path that could not be resolved to a field stays in the summary only — better unattached
    // than confidently pinned to the wrong input.
    if (name) formErrors.push({ name, message: item.message })
  }

  fieldErrorSummary.value = summary
  // Assigned as ONE whole object, after the summary, so the `form` watcher cannot observe a
  // half-populated map and clear it.
  const map: Record<string, string> = {}
  for (const item of formErrors) map[item.name] = item.message
  serverFieldErrors.value = map

  const firstLocale = summary.find(entry => entry.locale)?.locale
  if (firstLocale) activeLocale.value = firstLocale
  void nextTick(() => focusFirstError())
}

/**
 * §14.4 — send the operator to the first problem rather than leaving them to hunt for it.
 *
 * Runs after the tab switch, so the target is on screen when it is focused; `UForm`'s own scroll
 * cannot reach a field inside a panel that was hidden when validation ran.
 */
function focusFirstError(): void {
  const target = document.querySelector<HTMLElement>('[data-experience-editor] [aria-invalid="true"]')
  if (!target) return
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** Client-side validation failures get the same treatment: switch to the offending tab, then focus. */
function onValidationError(event: FormErrorEvent): void {
  const errors = event.errors ?? []
  const summary: { locale: ExperienceLocale | null, message: string }[] = []
  for (const item of errors) {
    const match = /^translations\.(en|ar)\./.exec(String(item.name ?? ''))
    summary.push({ locale: (match?.[1] as ExperienceLocale | undefined) ?? null, message: item.message ?? '' })
  }
  fieldErrorSummary.value = summary
  const firstLocale = summary.find(entry => entry.locale)?.locale
  if (firstLocale) activeLocale.value = firstLocale
  void nextTick(() => focusFirstError())
}

/* ── delete ────────────────────────────────────────────────────────────────────────────────────── */

async function confirmDelete(): Promise<void> {
  if (!props.id || deleting.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await editor.remove(props.id)
    bypassGuard.value = true
    await router.replace('/dashboard/experiences')
  } catch (error) {
    deleteError.value = toApiError(error).detail ?? t('dashboard.experiences.editor.deleteFailed')
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

/* ── unsaved-changes guard (OD-8) ───────────────────────────────────────────────────────────────
   Both exits — in-app navigation and reload/close — come from the shared composable. Experiences is
   its THIRD consumer, after `ProjectEditor` and `ArticleEditor`. */
useUnsavedChangesGuard({
  dirty,
  bypass: bypassGuard,
  message: () => t('dashboard.experiences.editor.unsavedWarning')
})

/* ── save-state presentation (§14.4) ───────────────────────────────────────────────────────────── */

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})
</script>

<template>
  <UContainer class="py-8" data-experience-editor>
    <!-- ── the entity could not be read: one answer per cause (D11-2) ───────────────────────── -->
    <UAlert
      v-if="unreadable"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      data-editor-unreadable
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="forbidden
        ? t('dashboard.experiences.forbiddenTitle')
        : notFound ? t('dashboard.experiences.editor.notFoundTitle') : t('dashboard.experiences.errorTitle')"
      :description="forbidden
        ? t('dashboard.experiences.forbiddenBody')
        : notFound ? t('dashboard.experiences.editor.notFoundBody') : t('dashboard.experiences.editor.loadFailedBody')"
    />

    <!-- §14.9 CRITERION 3 — an editor-shaped loading state. No blank fields before the data lands,
         and on this module no empty skill relation an operator could submit over a real one. -->
    <div
      v-else-if="resolving"
      role="status"
      :aria-busy="true"
      :aria-label="t('dashboard.experiences.editor.loadingRole')"
      data-editor-loading
      class="flex flex-col gap-6"
    >
      <span class="sr-only">{{ t('dashboard.experiences.editor.loadingRole') }}</span>
      <div aria-hidden="true" class="flex flex-col gap-4">
        <div class="skeleton h-9 w-2/3" />
        <div class="skeleton h-32 w-full" />
        <div class="skeleton h-64 w-full" />
      </div>
    </div>

    <template v-else>
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-h1 text-highlighted">
            {{ isCreate ? t('dashboard.experiences.editor.createTitle') : t('dashboard.experiences.editor.editTitle') }}
          </h1>
          <p class="mt-2 text-muted">{{ t('dashboard.experiences.editor.description') }}</p>
        </div>

        <!-- No "View on site" here, and its absence is deliberate: `/experience` is one page for
             every role, so no per-entity public destination exists to link to (§14.2 forbids
             offering an action that would land on a 404 or on the wrong thing). -->
        <UButton
          to="/dashboard/experiences"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          class="rtl:[--icon-rotate:180deg]"
          data-editor-back
        >
          {{ t('dashboard.experiences.editor.back') }}
        </UButton>
      </div>

      <div v-if="saveError" ref="alertRef" tabindex="-1" role="alert" class="mb-6 outline-none">
        <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="saveError" data-editor-save-error />
      </div>

      <!-- A validation summary that names the LANGUAGE each problem belongs to, so a problem inside
           a tab the operator is not looking at is still discoverable (§14.1). -->
      <div
        v-if="fieldErrorSummary.length > 0"
        role="alert"
        data-editor-error-summary
        class="mb-6 rounded-control border border-error/40 bg-error/5 p-4"
      >
        <p class="font-medium text-highlighted">{{ t('dashboard.experiences.editor.errorSummaryTitle') }}</p>
        <ul class="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li v-for="(entry, index) in fieldErrorSummary" :key="index">
            <span v-if="entry.locale" class="font-medium text-highlighted">
              {{ t(`dashboard.experiences.locale.${entry.locale}`) }}:
            </span>
            {{ entry.message }}
          </li>
        </ul>
      </div>

      <UForm
        ref="formRef"
        :schema="schema"
        :state="form"
        class="flex flex-col gap-8"
        @submit="onSubmit"
        @error="onValidationError"
      >
        <!-- ── SHARED FIELDS — shown ONCE, outside the tabs (§14.1) ─────────────────────────── -->
        <section :aria-label="t('dashboard.experiences.editor.detailsSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.experiences.editor.detailsSection') }}</h2>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              name="startDate"
              :error="serverFieldErrors.startDate"
              :label="t('dashboard.experiences.field.startDate')"
              required
            >
              <!-- `dir="ltr"` on every date and number control: the value is a fixed-format
                   machine string, and an RTL context would reorder its parts on screen. -->
              <UInput v-model="form.startDate" type="date" dir="ltr" class="w-full" data-editor-start-date />
            </UFormField>

            <UFormField
              name="endDate"
              :error="serverFieldErrors.endDate"
              :label="t('dashboard.experiences.field.endDate')"
              :help="t('dashboard.experiences.editor.endDateHelp')"
            >
              <UInput v-model="form.endDate" type="date" dir="ltr" class="w-full" data-editor-end-date />
            </UFormField>
          </div>

          <!-- The cross-field rule this control participates in is CLIENT-ONLY — the API accepts a
               current role that also has an end date. The error is raised against `endDate` above,
               never here, so it renders beside the value the operator has to change. -->
          <UFormField name="isCurrent" :help="t('dashboard.experiences.editor.isCurrentHelp')">
            <UCheckbox
              v-model="form.isCurrent"
              :label="t('dashboard.experiences.field.isCurrent')"
              data-editor-is-current
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              name="employmentType"
              :error="serverFieldErrors.employmentType"
              :label="t('dashboard.experiences.field.employmentType')"
              required
            >
              <USelect
                v-model="form.employmentType"
                :items="employmentItems"
                class="w-full"
                data-editor-employment-type
              />
            </UFormField>

            <UFormField
              name="order"
              :error="serverFieldErrors.order"
              :label="t('dashboard.experiences.field.order')"
              :help="t('dashboard.experiences.editor.orderHelp')"
            >
              <UInputNumber v-model="form.order" :min="0" orientation="vertical" dir="ltr" class="w-full" data-editor-order />
            </UFormField>
          </div>
        </section>

        <!-- ── SKILLS — the shared picker, second consumer ──────────────────────────────────── -->
        <section :aria-label="t('dashboard.experiences.editor.skillsSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.experiences.editor.skillsSection') }}</h2>
          <DashboardSkillPicker
            v-model="form.technologyIds"
            :labels="skillLabels"
            :disabled="saving"
          />
        </section>

        <!-- ── TRANSLATED CONTENT — locale tabs (§14.1) ─────────────────────────────────────── -->
        <section :aria-label="t('dashboard.experiences.editor.contentSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.experiences.editor.contentSection') }}</h2>

          <UTabs
            v-model="activeLocale"
            :items="tabItems"
            :unmount-on-hide="false"
            variant="link"
            data-editor-tabs
          >
            <template #default="{ item }">
              <span class="flex items-center gap-2">
                {{ item.label }}
                <!-- The completeness indicator (FR-DSH-011), and the invalid marker. Both carry a
                     word or an accessible name — never colour alone. -->
                <UBadge
                  v-if="item.invalid"
                  color="error"
                  variant="subtle"
                  size="sm"
                  :data-editor-tab-invalid="item.value"
                >
                  {{ t('dashboard.experiences.editor.tabInvalid') }}
                </UBadge>
                <UBadge
                  v-else
                  :color="item.fill === 'complete' ? 'success' : item.fill === 'partial' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="sm"
                  :data-editor-tab-fill="`${item.value}:${item.fill}`"
                >
                  {{ t(`dashboard.experiences.editor.fill.${item.fill}`) }}
                </UBadge>
              </span>
            </template>

            <template #content="{ item }">
              <!-- Field content direction is INDEPENDENT of chrome direction (OD-11): an Arabic
                   field is RTL inside an English dashboard and an English field is LTR inside an
                   Arabic one. Set per panel, never inherited from the shell. -->
              <div
                class="flex flex-col gap-4 pt-4"
                :dir="item.value === 'ar' ? 'rtl' : 'ltr'"
                :data-editor-panel="item.value"
              >
                <UFormField
                  :name="`translations.${item.value}.role`"
                  :error="serverFieldErrors[`translations.${item.value}.role`]"
                  :label="t('dashboard.experiences.field.role')"
                  required
                >
                  <UInput
                    v-model="form.translations[item.value as ExperienceLocale].role"
                    class="w-full"
                    :data-editor-role="item.value"
                  />
                </UFormField>

                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField
                    :name="`translations.${item.value}.company`"
                    :error="serverFieldErrors[`translations.${item.value}.company`]"
                    :label="t('dashboard.experiences.field.company')"
                    required
                  >
                    <UInput
                      v-model="form.translations[item.value as ExperienceLocale].company"
                      class="w-full"
                      :data-editor-company="item.value"
                    />
                  </UFormField>

                  <UFormField
                    :name="`translations.${item.value}.location`"
                    :error="serverFieldErrors[`translations.${item.value}.location`]"
                    :label="t('dashboard.experiences.field.location')"
                    required
                  >
                    <UInput
                      v-model="form.translations[item.value as ExperienceLocale].location"
                      class="w-full"
                      :data-editor-location="item.value"
                    />
                  </UFormField>
                </div>

                <UFormField
                  :name="`translations.${item.value}.impact`"
                  :error="serverFieldErrors[`translations.${item.value}.impact`]"
                  :label="t('dashboard.experiences.field.impact')"
                  :help="t('dashboard.experiences.editor.impactHelp')"
                  required
                >
                  <UTextarea
                    v-model="form.translations[item.value as ExperienceLocale].impact"
                    :rows="8"
                    class="w-full font-mono"
                    :data-editor-impact="item.value"
                  />
                </UFormField>
              </div>
            </template>
          </UTabs>
        </section>

        <!-- ── PRIMARY ACTIONS — persistently reachable (§14.4) ─────────────────────────────── -->
        <div
          class="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-default bg-default/95 px-4 py-3 backdrop-blur"
          data-editor-actions
        >
          <!-- saved / saving / unsaved, announced politely rather than asserted on every keystroke. -->
          <p role="status" class="text-sm text-muted" :data-editor-save-state="saveState">
            <span v-if="saveState === 'saving'">{{ t('dashboard.experiences.editor.saving') }}</span>
            <span v-else-if="saveState === 'unsaved'">{{ t('dashboard.experiences.editor.unsaved') }}</span>
            <span v-else-if="saveState === 'saved'">{{ t('dashboard.experiences.editor.saved') }}</span>
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Destructive action placed AWAY from the primary, and two-step (§14.4). -->
            <template v-if="!isCreate">
              <template v-if="confirmingDelete">
                <UButton
                  color="error"
                  variant="solid"
                  size="sm"
                  :loading="deleting"
                  :disabled="deleting"
                  data-editor-delete-confirm
                  @click="confirmDelete()"
                >
                  {{ t('dashboard.experiences.editor.deleteConfirm') }}
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="deleting"
                  data-editor-delete-cancel
                  @click="confirmingDelete = false"
                >
                  {{ t('dashboard.experiences.editor.deleteCancel') }}
                </UButton>
              </template>
              <UButton
                v-else
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                data-editor-delete
                @click="confirmingDelete = true"
              >
                {{ t('dashboard.experiences.editor.delete') }}
              </UButton>
            </template>

            <!-- Loading belongs to THIS action, never to a page-blocking screen (§14.9 criterion 4). -->
            <UButton type="submit" :loading="saving" :disabled="saving" data-editor-save>
              {{ t('dashboard.experiences.editor.save') }}
            </UButton>
          </div>
        </div>
      </UForm>

      <p v-if="deleteError" role="alert" class="mt-4 text-sm text-error" data-editor-delete-error>
        {{ deleteError }}
      </p>
    </template>
  </UContainer>
</template>
