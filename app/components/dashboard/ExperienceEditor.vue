<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  EXPERIENCE_EMPLOYMENT_TYPES,
  EXPERIENCE_LOCALES,
  type ExperienceLocale
} from '~/composables/admin-experience-fields'
import {
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

/**
 * The 422 / error-summary / tab-activation machinery, shared with `ArticleEditor` (`M1·U4b`).
 *
 * It knows about locales and field paths and nothing about what an experience is — the form model,
 * the schema, the payload and the three clearing semantics all stay in `admin-experience-form.ts`.
 * `activeLocale` is passed in rather than owned there because OD-9 makes the initial tab this
 * editor's policy; the composable only ever moves it toward an error the operator must see.
 */
const {
  serverFieldErrors,
  fieldErrorSummary,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors,
  onValidationError
} = useTranslatableForm<ExperienceLocale>({
  locales: EXPERIENCE_LOCALES,
  activeLocale,
  scope: '[data-experience-editor]',
  clearOn: form
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
  resetFieldErrors()
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
    <!-- ⚠ THE HEADING LIVES ABOVE THE THREE STATES, NOT INSIDE THE READY ONE.
         A page must carry a level-one heading in EVERY state it can be observed in. While the
         entity resolves, the editor renders only a skeleton, and an `<h1>` nested in the ready
         branch does not exist yet — axe reports `page-has-heading-one`, and a screen-reader user
         landing mid-load has nothing telling them what page they are on. The title is knowable
         before the entity arrives (it depends only on create-vs-edit), so there is no reason to
         withhold it. Found by scanning the LOADING state, which is a state most a11y suites never
         reach because it is gone by the time they run. -->
    <h1 class="text-h1 text-highlighted">
      {{ isCreate ? t('dashboard.experiences.editor.createTitle') : t('dashboard.experiences.editor.editTitle') }}
    </h1>

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
    <DashboardEntityEditorSkeleton
      v-else-if="resolving"
      :label="t('dashboard.experiences.editor.loadingRole')"
    />

    <template v-else>
      <div class="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <p class="min-w-0 text-muted">{{ t('dashboard.experiences.editor.description') }}</p>

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

          <DashboardTranslationTabs
            v-model="activeLocale"
            :items="tabItems"
            :invalid-label="t('dashboard.experiences.editor.tabInvalid')"
            :fill-labels="{
              empty: t('dashboard.experiences.editor.fill.empty'),
              partial: t('dashboard.experiences.editor.fill.partial'),
              complete: t('dashboard.experiences.editor.fill.complete')
            }"
          >
            <template #panel="{ locale: fieldLocale }">
            <UFormField
              :name="`translations.${fieldLocale}.role`"
              :error="serverFieldErrors[`translations.${fieldLocale}.role`]"
              :label="t('dashboard.experiences.field.role')"
              required
            >
              <UInput
                v-model="form.translations[fieldLocale].role"
                class="w-full"
                :data-editor-role="fieldLocale"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                :name="`translations.${fieldLocale}.company`"
                :error="serverFieldErrors[`translations.${fieldLocale}.company`]"
                :label="t('dashboard.experiences.field.company')"
                required
              >
                <UInput
                  v-model="form.translations[fieldLocale].company"
                  class="w-full"
                  :data-editor-company="fieldLocale"
                />
              </UFormField>

              <UFormField
                :name="`translations.${fieldLocale}.location`"
                :error="serverFieldErrors[`translations.${fieldLocale}.location`]"
                :label="t('dashboard.experiences.field.location')"
                required
              >
                <UInput
                  v-model="form.translations[fieldLocale].location"
                  class="w-full"
                  :data-editor-location="fieldLocale"
                />
              </UFormField>
            </div>

            <UFormField
              :name="`translations.${fieldLocale}.impact`"
              :error="serverFieldErrors[`translations.${fieldLocale}.impact`]"
              :label="t('dashboard.experiences.field.impact')"
              :help="t('dashboard.experiences.editor.impactHelp')"
              required
            >
              <UTextarea
                v-model="form.translations[fieldLocale].impact"
                :rows="8"
                class="w-full font-mono"
                :data-editor-impact="fieldLocale"
              />
            </UFormField>
            </template>
          </DashboardTranslationTabs>
        </section>

        <!-- ── PRIMARY ACTIONS — persistently reachable (§14.4) ───────────────────────────────
             No `#leading` and no `#actions` here: an experience has no status badge and no publish
             shortcut, because it has no `status` and no `publishAt`. That absence is the evidence
             §5.2 predicted and `M1·U4` confirmed — the publication region is Articles-specific. -->
        <DashboardEntityFormActions
          v-model:confirming="confirmingDelete"
          :save-state="saveState"
          :save-state-labels="{
            saving: t('dashboard.experiences.editor.saving'),
            unsaved: t('dashboard.experiences.editor.unsaved'),
            saved: t('dashboard.experiences.editor.saved')
          }"
          :save-label="t('dashboard.experiences.editor.save')"
          :saving="saving"
          :deletable="!isCreate"
          :deleting="deleting"
          :delete-labels="{
            delete: t('dashboard.experiences.editor.delete'),
            confirm: t('dashboard.experiences.editor.deleteConfirm'),
            cancel: t('dashboard.experiences.editor.deleteCancel')
          }"
          @delete="confirmDelete()"
        />
      </UForm>

      <p v-if="deleteError" role="alert" class="mt-4 text-sm text-error" data-editor-delete-error>
        {{ deleteError }}
      </p>
    </template>
  </UContainer>
</template>
