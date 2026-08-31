<script setup lang="ts">
import {
  PROJECT_LOCALES,
  buildProjectPayload,
  changedSlugLocales,
  hasBlockingError,
  initialProjectForm,
  isProjectFormDirty,
  translationFillState,
  validateProjectForm,
  type ProjectFormState,
  type ProjectLocale
} from '~/composables/admin-project-form'
import { toApiError } from '~/utils/api-error'
import type { ApiError } from '~/utils/api-error'

/**
 * The Projects editor — create and edit, one implementation.
 *
 * `id === null` is the create form and `id` is the edit form; everything between them (validation,
 * the payload, the publication rules, the error surface) is identical, and splitting it across two
 * pages is how two forms come to disagree about what a project is.
 *
 * ── THE THREE THINGS THIS SURFACE MUST NOT GET WRONG ────────────────────────────────────────────
 *
 * 1. EDITING NEVER SILENTLY CHANGES PUBLICATION. `isPublished` lives in the form, is seeded from the
 *    server, and moves only when the operator moves its switch. It is always sent — see
 *    `buildProjectPayload` for why the payload states it rather than omitting it — and what the
 *    save will do to publication is stated on screen before the operator commits to it.
 *
 * 2. NO CROSS-LOCALE FALLBACK, ANYWHERE. A locale with no translation renders as empty boxes and is
 *    labelled "Not written". Nothing is ever prefilled from the other language.
 *
 * 3. A FAILED SAVE KEEPS THE OPERATOR'S WORK. Every write throws rather than swallowing, the form is
 *    never cleared on failure, and the API's RFC 7807 problem — including its per-field errors — is
 *    rendered instead of a generic apology.
 */
const props = defineProps<{
  /** `null` creates; a project id edits that project. */
  id: string | null
}>()

const { t, locale } = useDashboardI18n()
const router = useRouter()
const editor = useAdminProject()
const { project, pending, forbidden, notFound, failed } = editor

/** The edited state, and the state it was loaded with — the latter is what "dirty" is measured against. */
const form = ref<ProjectFormState>(initialProjectForm(null))
const initial = ref<ProjectFormState>(initialProjectForm(null))

const saving = ref(false)
const saved = ref(false)
/** The API's own answer to a rejected save, kept whole so its field errors can be shown. */
const saveError = ref<ApiError | null>(null)
/** Validation messages appear only after a save is ATTEMPTED — not while the operator is still typing. */
const showErrors = ref(false)

const confirmingDelete = ref(false)
const deleting = ref(false)
const deleteError = ref(false)

/**
 * Set by the navigations this component performs ITSELF after a successful write.
 *
 * Without it the unsaved-change guard would challenge the operator on the way out of a save that
 * just succeeded: a create leaves for the new project's address while the form still differs from
 * the blank baseline, and a delete leaves for a project that no longer exists.
 */
const bypassGuard = ref(false)

const activeLocale = ref<ProjectLocale>('en')

/**
 * Seed the tab from the Dashboard locale once. From then on it belongs to this entity editor: a
 * chrome-language change must never throw an operator out of the locale they deliberately edit.
 */
onMounted(() => {
  activeLocale.value = PROJECT_LOCALES.includes(locale.value as ProjectLocale)
    ? (locale.value as ProjectLocale)
    : 'en'
})

/**
 * Seed both the edited state and the baseline from the loaded project.
 *
 * Driven by a WATCHER rather than a top-level `await`: this is part of the client-only dashboard, and
 * awaiting in setup would suspend the route on a request that needs a session the shell restores
 * asynchronously. It also means a saved response re-seeds through exactly the same path as the first
 * load, so "what is on screen" has one definition rather than two — and a save therefore leaves the
 * form clean, showing confirmed server state rather than the echo of what was sent.
 */
function adopt(): void {
  // Two independent seeds, not one object shared by both refs: `initial` is the baseline `dirty` is
  // measured against, and a shared graph would make every edit mutate the thing it is compared to.
  form.value = initialProjectForm(project.value)
  initial.value = initialProjectForm(project.value)
}

watch(project, () => adopt())

function reload(): void {
  if (props.id !== null) void editor.load(props.id)
}

onMounted(() => reload())

const errors = computed(() => validateProjectForm(form.value, project.value))
const dirty = computed(() => isProjectFormDirty(form.value, initial.value))

/** Per-locale fill state, for the heading badge beside each language's fields. */
const fillStates = computed(() => ({
  en: translationFillState(form.value.translations.en),
  ar: translationFillState(form.value.translations.ar)
}))

const {
  serverFieldErrors,
  fieldErrorSummary,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors
} = useTranslatableForm<ProjectLocale>({
  locales: PROJECT_LOCALES,
  activeLocale,
  scope: '[data-project-editor]',
  clearOn: form
})

const tabItems = computed(() =>
  PROJECT_LOCALES.map(value => ({
    value,
    label: t(`dashboard.projects.locale.${value}`),
    fill: fillStates.value[value],
    invalid: localesWithErrors.value.has(value)
  }))
)

/**
 * What this save will do to publication, in words, BEFORE it is made.
 *
 * Read from the baseline rather than from the server entity so it stays honest after a save: once
 * the response has re-seeded the form, "will publish" must become "stays published" without a
 * reload.
 */
const publicationNotice = computed<'publish' | 'unpublish' | 'stays-unpublished' | null>(() => {
  if (form.value.isPublished && !initial.value.isPublished) return 'publish'
  if (!form.value.isPublished && initial.value.isPublished) return 'unpublish'
  if (!form.value.isPublished) return 'stays-unpublished'
  return null
})

/**
 * Slug changes that will retire a LIVE address (D04-6).
 *
 * Gated on the SERVER's publication state, not the form's: whether the API records a redirect
 * follows what the site is serving right now, so unpublishing and renaming in one save is still a
 * rename of a published URL. The API creates the redirect record itself — nothing here writes one,
 * and nothing here should.
 */
const slugWarnings = computed(() => {
  if (!project.value?.isPublished) return []
  return changedSlugLocales(form.value, project.value).map(locale => ({
    locale,
    from: project.value?.translations[locale]?.slug ?? '',
    to: form.value.translations[locale].slug.trim()
  }))
})

const fieldErrors = computed(() =>
  saveError.value ? Object.entries(saveError.value.fieldErrorMap()) : []
)

/**
 * The ONE way the form changes.
 *
 * Every control routes through here, so "the operator edited something" has a single definition and
 * the saved-confirmation cannot survive an edit made after it — a green "Saved." sitting above a
 * changed field is a claim about state that is no longer true.
 */
function patchForm(patch: Partial<ProjectFormState>): void {
  form.value = { ...form.value, ...patch }
  saved.value = false
}

function setTranslation(locale: ProjectLocale, value: ProjectFormState['translations']['en']): void {
  patchForm({ translations: { ...form.value.translations, [locale]: value } })
}

function setOrder(raw: string): void {
  // An empty box is NOT zero. `NaN` keeps it invalid until a number is typed, which the validator
  // reports — silently substituting 0 would reorder the whole list behind the operator's back.
  patchForm({ order: raw.trim() === '' ? Number.NaN : Number(raw) })
}

async function save(): Promise<void> {
  if (saving.value) return
  showErrors.value = true
  if (hasBlockingError(errors.value)) return
  saving.value = true
  saveError.value = null
  resetFieldErrors()
  saved.value = false
  let sentLocales: ProjectLocale[] = []
  try {
    // The seeded form is the baseline the payload measures SEO changes against: a field held then
    // blanked must travel as an explicit `null` (D10-23), which only an original-vs-current
    // comparison can distinguish from "never had one". Create has no stored values, so it passes
    // no baseline and keeps its omission-on-blank shape.
    const payload = props.id === null
      ? buildProjectPayload(form.value)
      : buildProjectPayload(form.value, initial.value)
    // Captured before the request: a 422 index addresses this precise payload ordering, never the
    // canonical locale order or whichever tab happens to be open when the response arrives.
    sentLocales = payload.translations.map((translation): ProjectLocale => translation.locale as ProjectLocale)
    if (props.id === null) {
      const created = await editor.create(payload)
      // Land on the created project's own address, so a reload shows the saved project rather than
      // a blank create form. `replace`, not `push`: the empty form is not a place to go Back to.
      bypassGuard.value = true
      await router.replace(`/dashboard/projects/${created.id}`)
      return
    }
    await editor.update(props.id, payload)
    saved.value = true
    showErrors.value = false
  } catch (error) {
    // The operator's input is deliberately NOT discarded: a failed save must not also lose the work.
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      applyFieldErrors(apiError.fieldErrors, sentLocales)
      // Keep non-translation errors in the existing form-level surface. Translation errors belong
      // on their named field and activate its locale tab through the shared mapper.
      if (apiError.fieldErrors.some(({ field }) => !/^translations\[\d+\]\./.test(field))) {
        saveError.value = apiError
      }
    } else {
      saveError.value = apiError
    }
  } finally {
    saving.value = false
  }
}

function discard(): void {
  adopt()
  showErrors.value = false
  saveError.value = null
  saved.value = false
}

/* ── delete ────────────────────────────────────────────────────────────────────────────────────── */

async function confirmDelete(): Promise<void> {
  if (props.id === null) return
  deleting.value = true
  deleteError.value = false
  try {
    await editor.remove(props.id)
    bypassGuard.value = true
    await router.replace('/dashboard/projects')
  } catch {
    deleteError.value = true
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

useUnsavedChangesGuard({
  dirty,
  bypass: bypassGuard,
  message: () => t('dashboard.projects.editor.unsavedWarning')
})

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (saved.value) return 'saved'
  return 'idle'
})
</script>

<template>
  <UContainer class="py-8" data-project-editor>
    <UButton to="/dashboard/projects" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" class="mb-4" data-editor-back>
      {{ t('dashboard.projects.back') }}
    </UButton>

    <h1 v-if="id !== null && pending && project === null" class="sr-only">
      {{ t('dashboard.projects.title') }}
    </h1>

    <DashboardEntityEditorSkeleton
      v-if="id !== null && pending && project === null"
      :label="t('dashboard.projects.editor.loading')"
    />

    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-project-forbidden
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.projects.forbiddenTitle')"
      :description="t('dashboard.projects.forbiddenBody')"
    />

    <UAlert
      v-else-if="notFound"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      data-project-not-found
      :title="t('dashboard.projects.editor.notFoundTitle')"
      :description="t('dashboard.projects.editor.notFoundBody')"
    />

    <div v-else-if="failed" class="rounded-control border border-default p-6 text-center" data-project-failed>
      <p class="font-medium text-highlighted">{{ t('dashboard.projects.errorTitle') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('dashboard.projects.errorBody') }}</p>
      <UButton class="mt-4" color="neutral" variant="subtle" @click="reload()">
        {{ t('dashboard.projects.retry') }}
      </UButton>
    </div>

    <form v-else class="flex max-w-4xl flex-col gap-8" novalidate @submit.prevent="save()">
      <div>
        <h1 class="text-h1 text-highlighted">
          {{ id === null ? t('dashboard.projects.editor.createTitle') : t('dashboard.projects.title') }}
        </h1>
        <p class="mt-2 text-muted">
          {{ id === null ? t('dashboard.projects.editor.createDescription') : t('dashboard.projects.editor.editDescription') }}
        </p>
      </div>

      <!-- ── publication ──────────────────────────────────────────────────────────────────────────
           ITS OWN SECTION, above the content, because it is its own decision. Saving the case study
           does not touch it; this switch is the only thing that does, and the notice underneath says
           what the next save will do before it is made. -->
      <section :aria-labelledby="'publication-heading'" class="flex flex-col gap-3 rounded-control border border-default p-4">
        <h2 id="publication-heading" class="text-h2 text-highlighted">{{ t('dashboard.projects.editor.publication') }}</h2>
        <p class="text-sm text-muted">{{ t('dashboard.projects.editor.publicationHelp') }}</p>

        <USwitch
          :model-value="form.isPublished"
          :label="t('dashboard.projects.editor.isPublished')"
          :disabled="saving"
          data-project-published-switch
          @update:model-value="patchForm({ isPublished: $event === true })"
        />
        <USwitch
          :model-value="form.featured"
          :label="t('dashboard.projects.editor.featured')"
          :disabled="saving"
          data-project-featured-switch
          @update:model-value="patchForm({ featured: $event === true })"
        />

        <p
          v-if="publicationNotice"
          class="text-sm"
          :class="publicationNotice === 'stays-unpublished' ? 'text-muted' : 'font-medium text-highlighted'"
          :data-publication-notice="publicationNotice"
        >
          {{ t(
            publicationNotice === 'publish'
              ? 'dashboard.projects.editor.willPublish'
              : publicationNotice === 'unpublish'
                ? 'dashboard.projects.editor.willUnpublish'
                : 'dashboard.projects.editor.staysUnpublished'
          ) }}
        </p>
      </section>

      <!-- ── slug change on a published project (D04-6) ───────────────────────────────────────── -->
      <UAlert
        v-if="slugWarnings.length > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-link"
        data-slug-warning
        :title="t('dashboard.projects.editor.slugWarningTitle')"
      >
        <template #description>
          <p>{{ t('dashboard.projects.editor.slugWarningBody') }}</p>
          <ul class="mt-2 flex flex-col gap-1">
            <li v-for="warning in slugWarnings" :key="warning.locale" class="break-all text-xs" :data-slug-warning-locale="warning.locale">
              {{ t('dashboard.projects.editor.slugWarningLocale', {
                locale: t(`dashboard.projects.locale.${warning.locale}`),
                from: warning.from,
                to: warning.to
              }) }}
            </li>
          </ul>
        </template>
      </UAlert>

      <!-- ── basics ───────────────────────────────────────────────────────────────────────────── -->
      <section :aria-labelledby="'basics-heading'" class="flex flex-col gap-4">
        <h2 id="basics-heading" class="text-h2 text-highlighted">{{ t('dashboard.projects.editor.basics') }}</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('dashboard.projects.field.order')"
            :help="t('dashboard.projects.editor.orderHelp')"
            :error="showErrors && errors.invalidOrder ? t('dashboard.projects.editor.errorOrder') : undefined"
          >
            <UInput
              :model-value="Number.isNaN(form.order) ? '' : String(form.order)"
              type="number"
              step="1"
              class="w-full"
              data-project-order
              :disabled="saving"
              @update:model-value="setOrder(String($event))"
            />
          </UFormField>

          <UFormField
            :label="t('dashboard.projects.field.year')"
            :help="t('dashboard.projects.editor.yearHelp')"
            :error="showErrors && errors.invalidYear ? t('dashboard.projects.editor.errorYear') : undefined"
          >
            <UInput
              :model-value="form.year"
              type="number"
              step="1"
              class="w-full"
              data-project-year
              :disabled="saving"
              @update:model-value="patchForm({ year: String($event) })"
            />
          </UFormField>

          <!-- Nullable by contract: an empty box means "there is none", which is sent as `null`
               rather than omitted. -->
          <UFormField :label="t('dashboard.projects.field.liveUrl')" :help="t('dashboard.projects.field.urlHint')">
            <UInput
              :model-value="form.liveUrl"
              type="url"
              dir="ltr"
              class="w-full"
              data-project-live-url
              :disabled="saving"
              @update:model-value="patchForm({ liveUrl: String($event) })"
            />
          </UFormField>

          <UFormField :label="t('dashboard.projects.field.repoUrl')" :help="t('dashboard.projects.field.urlHint')">
            <UInput
              :model-value="form.repoUrl"
              type="url"
              dir="ltr"
              class="w-full"
              data-project-repo-url
              :disabled="saving"
              @update:model-value="patchForm({ repoUrl: String($event) })"
            />
          </UFormField>
        </div>
      </section>

      <!-- ── technologies ─────────────────────────────────────────────────────────────────────── -->
      <section :aria-labelledby="'technologies-heading'" class="flex flex-col gap-3">
        <h2 id="technologies-heading" class="text-h2 text-highlighted">{{ t('dashboard.projects.editor.technologies') }}</h2>
        <DashboardSkillPicker
          :model-value="form.technologyIds"
          :disabled="saving"
          :labels="{
            legend: t('dashboard.projects.editor.technologies'),
            help: t('dashboard.projects.editor.technologiesHelp'),
            filter: t('dashboard.projects.editor.technologyFilter'),
            empty: t('dashboard.projects.editor.technologiesEmpty'),
            error: t('dashboard.projects.editor.technologiesError'),
            unknown: t('dashboard.projects.editor.technologiesUnknown'),
            selected: t('dashboard.projects.editor.technologiesSelected', { count: form.technologyIds.length })
          }"
          @update:model-value="patchForm({ technologyIds: $event })"
        />
      </section>

      <!-- ── gallery ──────────────────────────────────────────────────────────────────────────── -->
      <section :aria-labelledby="'gallery-heading'" class="flex flex-col gap-3">
        <h2 id="gallery-heading" class="text-h2 text-highlighted">{{ t('dashboard.projects.editor.gallery') }}</h2>
        <p class="text-sm text-muted">{{ t('dashboard.projects.editor.galleryHelp') }}</p>
        <DashboardProjectGalleryEditor
          :model-value="form.gallery"
          :disabled="saving"
          :show-errors="showErrors"
          :missing-asset="errors.galleryWithoutAsset"
          @update:model-value="patchForm({ gallery: $event })"
        />
      </section>

      <!-- ── the case study, per locale ───────────────────────────────────────────────────────── -->
      <section :aria-labelledby="'content-heading'" class="flex flex-col gap-4">
        <h2 id="content-heading" class="text-h2 text-highlighted">{{ t('dashboard.projects.editor.content') }}</h2>
        <p class="text-sm text-muted">{{ t('dashboard.projects.editor.contentHelp') }}</p>

        <DashboardTranslationTabs
          v-model="activeLocale"
          :items="tabItems"
          :invalid-label="t('dashboard.projects.editor.tabInvalid')"
          :fill-labels="{
            empty: t('dashboard.projects.editor.localeEmpty'),
            partial: t('dashboard.projects.editor.localePartial'),
            complete: t('dashboard.projects.editor.localeComplete')
          }"
        >
          <template #panel="{ locale: contentLocale }">
            <div class="rounded-control border border-default p-4" :data-locale-section="contentLocale">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <h3 class="text-h3 text-highlighted">{{ t(`dashboard.projects.locale.${contentLocale}`) }}</h3>
                <!-- Never colour-only: the state is a word. "Not written" is a legitimate resting state,
                     not an error — the project may deliberately exist in one language only. -->
                <UBadge
                  :color="fillStates[contentLocale] === 'complete' ? 'success' : fillStates[contentLocale] === 'partial' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="sm"
                  :data-locale-state="`${contentLocale}:${fillStates[contentLocale]}`"
                >
                  {{ t(
                    fillStates[contentLocale] === 'complete'
                      ? 'dashboard.projects.editor.localeComplete'
                      : fillStates[contentLocale] === 'partial'
                        ? 'dashboard.projects.editor.localePartial'
                        : 'dashboard.projects.editor.localeEmpty'
                  ) }}
                </UBadge>
              </div>

              <DashboardProjectTranslationFields
                :model-value="form.translations[contentLocale]"
                :locale="contentLocale"
                :disabled="saving"
                :show-errors="showErrors"
                :missing-fields="errors.missingFields[contentLocale]"
                :server-field-errors="serverFieldErrors"
                @update:model-value="setTranslation(contentLocale, $event)"
              />
            </div>
          </template>
        </DashboardTranslationTabs>
      </section>

      <!-- ── validation, save state and the API's own answer ──────────────────────────────────── -->
      <div aria-live="polite" class="flex flex-col gap-3 empty:hidden">
        <UAlert
          v-if="fieldErrorSummary.length > 0"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-editor-error-summary
          :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.fieldErrorsHeading')"
        >
          <template #description>
            <ul class="flex flex-col gap-1">
              <li v-for="(entry, index) in fieldErrorSummary" :key="index" class="text-xs">
                <span v-if="entry.locale" class="font-medium">{{ t(`dashboard.projects.locale.${entry.locale}`) }}:</span>
                {{ entry.message }}
              </li>
            </ul>
          </template>
        </UAlert>

        <UAlert
          v-if="showErrors && errors.noTranslation"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-error-no-translation
          :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.errorNoTranslationTitle')"
          :description="t('dashboard.projects.editor.errorNoTranslationBody')"
        />

        <UAlert
          v-if="showErrors && errors.partialLocales.length > 0"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-error-partial
          :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.errorPartialTitle')"
        >
          <template #description>
            <p>
              {{ t('dashboard.projects.editor.errorPartialBody', {
                locale: errors.partialLocales.map(l => t(`dashboard.projects.locale.${l}`)).join(', ')
              }) }}
            </p>
            <ul class="mt-2 flex flex-col gap-1">
              <li v-for="partial in errors.partialLocales" :key="partial" class="text-xs" :data-error-partial-locale="partial">
                {{ t('dashboard.projects.editor.errorMissingFields', {
                  locale: t(`dashboard.projects.locale.${partial}`),
                  fields: errors.missingFields[partial].map(f => t(`dashboard.projects.field.${f}`)).join(', ')
                }) }}
              </li>
            </ul>
          </template>
        </UAlert>

        <UAlert
          v-if="showErrors && errors.clearedLocales.length > 0"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-error-cleared
          :ui="{ title: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.errorClearedTitle')"
          :description="t('dashboard.projects.editor.errorClearedBody', {
            locale: errors.clearedLocales.map(l => t(`dashboard.projects.locale.${l}`)).join(', ')
          })"
        />

        <!-- The API's own answer, rendered rather than replaced by a generic apology. `fieldErrors`
             is the 422 mapped onto its fields, which is the only thing that tells the operator WHICH
             box the server rejected. -->
        <UAlert
          v-if="saveError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-save-error
          :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.saveErrorTitle')"
        >
          <template #description>
            <p>{{ saveError.detail ?? saveError.message ?? t('dashboard.projects.editor.saveErrorBody') }}</p>
            <template v-if="fieldErrors.length > 0">
              <p class="mt-2 font-medium">{{ t('dashboard.projects.editor.fieldErrorsHeading') }}</p>
              <ul class="mt-1 flex flex-col gap-1">
                <li v-for="[field, message] in fieldErrors" :key="field" class="text-xs" :data-save-field-error="field">
                  <span class="font-medium">{{ field }}</span>: {{ message }}
                </li>
              </ul>
            </template>
          </template>
        </UAlert>

        <UAlert
          v-if="saved"
          color="neutral"
          variant="subtle"
          icon="i-lucide-check"
          data-project-saved
          :description="t('dashboard.projects.editor.saved')"
        />

        <UAlert
          v-if="deleteError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          data-delete-error
          :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
          :title="t('dashboard.projects.editor.deleteErrorTitle')"
          :description="t('dashboard.projects.editor.deleteErrorBody')"
        />
      </div>

      <DashboardEntityFormActions
        v-model:confirming="confirmingDelete"
        :save-state="saveState"
        :save-state-labels="{
          saving: t('dashboard.projects.editor.saving'),
          unsaved: t('dashboard.projects.editor.unsaved'),
          saved: t('dashboard.projects.editor.saved')
        }"
        :save-label="t('dashboard.projects.editor.save')"
        :saving="saving"
        :deletable="id !== null"
        :deleting="deleting"
        :delete-labels="{
          delete: t('dashboard.projects.editor.delete'),
          confirm: t('dashboard.projects.editor.deleteConfirm'),
          cancel: t('dashboard.projects.editor.deleteCancel')
        }"
        @delete="confirmDelete()"
      >
        <template #leading>
          <p v-if="confirmingDelete" class="text-xs text-muted">{{ t('dashboard.projects.editor.deleteWarning') }}</p>
        </template>
        <template #actions>
          <UButton
            v-if="dirty"
            type="button"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            data-project-discard
            @click="discard()"
          >
            {{ t('dashboard.projects.editor.discard') }}
          </UButton>
        </template>
      </DashboardEntityFormActions>
    </form>
  </UContainer>
</template>
