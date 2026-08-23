<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { components } from '~/types/api'
import { TAXONOMY_LOCALES, type TaxonomyLocale } from '~/composables/admin-taxonomy-fields'
import {
  categoryAuthoredLocales,
  categoryChangedLocales,
  categoryCreatePayload,
  categoryFormSchema,
  categoryUpdatePayload,
  emptyCategoryForm,
  initialCategoryForm,
  isCategoryFormDirty,
  type CategoryFormState
} from '~/composables/admin-category-form'
import { toApiError } from '~/utils/api-error'

/**
 * The CATEGORY half of the Taxonomy editor (`U3b`) — a `USlideover` on the collection page, because
 * there is NO detail route to navigate to. Everything below the open boundary reuses the established
 * editor architecture verbatim: shared tabs/actions/translation-error machinery, Zod + UForm, and the
 * U3a payload modules unchanged.
 *
 * ⚠ INITIALIZATION IS THE ROW THE OPERATOR CLICKED. No GET exists for this entity; the component
 * never fetches. `initial` is the stable snapshot the PATCH builder diffs against.
 */
type Schemas = components['schemas']

const props = defineProps<{
  kind: 'categories'
  /** The clicked collection row, or `null` for create. */
  row: Schemas['AdminCategoryEntity'] | null
}>()

const emit = defineEmits<{ close: [], saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const { t, locale } = useDashboardI18n()
const writes = useAdminCategoryWrites()

const form = ref<CategoryFormState>(emptyCategoryForm())
const initial = ref<CategoryFormState>(emptyCategoryForm())
const activeLocale = ref<TaxonomyLocale>('en')
const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const deleting = ref(false)
const confirmingDelete = ref(false)
const deleteError = ref<string | null>(null)

const isCreate = computed(() => props.row === null)
const dirty = computed(() => isCategoryFormDirty(form.value, initial.value))
const schema = computed(() => categoryFormSchema(t))
const alertRef = useTemplateRef<HTMLElement>('alertRef')

const {
  serverFieldErrors,
  fieldErrorSummary,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors,
  onValidationError
} = useTranslatableForm<TaxonomyLocale>({
  locales: TAXONOMY_LOCALES,
  activeLocale,
  scope: '[data-taxonomy-overlay]',
  clearOn: form
})

function blank(value: string): boolean { return value.trim().length === 0 }

const tabItems = computed(() => TAXONOMY_LOCALES.map(value => ({
  value,
  label: t(`dashboard.taxonomy.locale.${value}`),
  fill: categoryAuthoredLocales(form.value).includes(value)
    ? (blank(form.value.translations[value].name) || blank(form.value.translations[value].slug) ? 'partial' as const : 'complete' as const)
    : 'empty' as const,
  invalid: localesWithErrors.value.has(value)
})))

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})

/**
 * Adopt a fresh editing target whenever the overlay opens. Create starts from the EMPTY form; edit
 * starts from the CLICKED ROW — the same object identity the list rendered, no network involved.
 */
/**
 * Seed EXACTLY ONCE per closed->open transition, keyed on `open` alone. A combined
 * `[open, row]` source re-fires when the parent hands us a NEW row object after a collection
 * refresh — silently reseeding the form AND the active tab while the operator is mid-edit.
 */
watch(open, (isOpen) => {
  if (!isOpen) return
  form.value = initialCategoryForm(props.row)
  initial.value = initialCategoryForm(props.row)
  savedAt.value = null
  saveError.value = null
  deleteError.value = null
  confirmingDelete.value = false
  resetFieldErrors()
  activeLocale.value = TAXONOMY_LOCALES.includes(locale.value as TaxonomyLocale)
    ? locale.value as TaxonomyLocale
    : 'en'
})

/** The established unsaved-change contract, applied to the slideover's one exit: closing. */
function requestClose(): void {
  if (dirty.value && !window.confirm(t('dashboard.taxonomy.overlay.unsavedConfirm'))) return
  open.value = false
  emit('close')
}

async function onSubmit(_event: FormSubmitEvent<unknown>): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveError.value = null
  resetFieldErrors()
  // The SENT order, captured before the request — indexed errors resolve against it.
  const sentLocales = isCreate.value
    ? categoryAuthoredLocales(form.value)
    : categoryChangedLocales(form.value, initial.value)

  try {
    if (isCreate.value) await writes.create(categoryCreatePayload(form.value))
    else await writes.update(props.row!.id, categoryUpdatePayload(form.value, initial.value))
    savedAt.value = Date.now()
    emit('saved')
    open.value = false
  } catch (error) {
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      applyFieldErrors(apiError.fieldErrors, sentLocales)
    } else {
      saveError.value = apiError.detail ?? apiError.message
      await nextTick()
      alertRef.value?.focus()
    }
  } finally {
    saving.value = false
  }
}

async function confirmDelete(): Promise<void> {
  if (!props.row || deleting.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await writes.remove(props.row.id)
    emit('saved')
    open.value = false
  } catch (error) {
    const apiError = toApiError(error)
    // The DOCUMENTED article-reference 409 is surfaced as copy, not swallowed; nothing else is
    // invented around it.
    deleteError.value = apiError.status === 409
      ? t('dashboard.taxonomy.categories.deleteConflict')
      : apiError.detail ?? apiError.message
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :dismissible="false"
    :close="false"
    :title="isCreate ? t('dashboard.taxonomy.overlay.createCategory') : t('dashboard.taxonomy.overlay.editCategory')"
    :description="t('dashboard.taxonomy.categories.description')"
    :ui="{ content: 'max-w-md' }"
    @close:prevent="requestClose"
  >
    <template #content>
      <header class="border-b border-default p-4" data-taxonomy-overlay-kind="categories">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-medium text-highlighted" data-taxonomy-overlay-title>
              {{ isCreate ? t('dashboard.taxonomy.overlay.createCategory') : t('dashboard.taxonomy.overlay.editCategory') }}
            </h2>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.categories.description') }}</p>
          </div>
          <UButton
color="neutral" variant="ghost" size="sm" icon="i-lucide-x" data-taxonomy-overlay-close
                   :aria-label="t('dashboard.taxonomy.overlay.close')" @click="requestClose()" />
        </div>
      </header>

      <div class="flex-1 p-4">
        <UAlert
          v-if="saveError"
          ref="alertRef"
          role="alert"
          tabindex="-1"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          data-taxonomy-overlay-error
          :title="saveError"
        />


        <div
          v-if="fieldErrorSummary.length > 0"
          role="alert"
          data-taxonomy-overlay-error-summary
          class="mb-6 rounded-control border border-error/40 bg-error/5 p-4"
        >
          <ul class="flex flex-col gap-1 text-sm text-muted">
            <li v-for="(entry, index) in fieldErrorSummary" :key="index">
              {{ entry.message }}
            </li>
          </ul>
        </div>

        <UForm :schema="schema" :state="form" @submit="onSubmit" @error="onValidationError">
          <DashboardTranslationTabs
            v-model="activeLocale"
            :items="tabItems"
            :fill-labels="{
              empty: t('dashboard.taxonomy.overlay.fill.empty'),
              partial: t('dashboard.taxonomy.overlay.fill.partial'),
              complete: t('dashboard.taxonomy.overlay.fill.complete')
            }"
            :invalid-label="t('dashboard.taxonomy.overlay.invalid')"
          >
            <template #panel="{ locale: fieldLocale }">
              <UFormField
:label="t('dashboard.taxonomy.overlay.field.name')" :name="`translations.${fieldLocale}.name`"
                          :error="serverFieldErrors[`translations.${fieldLocale}.name`]">
                <UInput
v-model="form.translations[fieldLocale as TaxonomyLocale].name" dir="auto" class="w-full"
                        :data-taxonomy-field="`name:${fieldLocale}`" />
              </UFormField>
              <UFormField
:label="t('dashboard.taxonomy.overlay.field.slug')" :name="`translations.${fieldLocale}.slug`"
                          :error="serverFieldErrors[`translations.${fieldLocale}.slug`]">
                <UInput
v-model="form.translations[fieldLocale as TaxonomyLocale].slug" dir="ltr" class="w-full font-mono"
                        :data-taxonomy-field="`slug:${fieldLocale}`" />
              </UFormField>
              <UFormField
:label="t('dashboard.taxonomy.overlay.field.description')"
                          :name="`translations.${fieldLocale}.description`"
                          :error="serverFieldErrors[`translations.${fieldLocale}.description`]"
                          :help="t('dashboard.taxonomy.overlay.field.descriptionHelp')">
                <!-- An EMPTY input IS the clear gesture for this nullable field: '' never reaches
                     the payload — the binding normalizes it to `null`, which is what travels. -->
                <UTextarea
                  :model-value="form.translations[fieldLocale as TaxonomyLocale].description ?? ''"
                  dir="auto"
                  class="w-full"
                  :rows="3"
                  :data-taxonomy-field="`description:${fieldLocale}`"
                  @update:model-value="(value: string) => { form.translations[fieldLocale as TaxonomyLocale].description = value === '' ? null : value }"
                />
              </UFormField>
            </template>
          </DashboardTranslationTabs>

          <DashboardEntityFormActions
            v-model:confirming="confirmingDelete"
            :save-state="saveState"
            :save-state-labels="{
              saving: t('dashboard.taxonomy.overlay.saving'),
              unsaved: t('dashboard.taxonomy.overlay.unsaved'),
              saved: t('dashboard.taxonomy.overlay.saved')
            }"
            :save-label="isCreate ? t('dashboard.taxonomy.overlay.create') : t('dashboard.taxonomy.overlay.save')"
            :saving="saving"
            :deletable="!isCreate"
            :deleting="deleting"
            :delete-labels="{
              delete: t('dashboard.taxonomy.overlay.delete'),
              confirm: t('dashboard.taxonomy.overlay.confirmDelete'),
              cancel: t('dashboard.taxonomy.overlay.cancel')
            }"
            @delete="confirmDelete"
          >
            <template #leading>
              <p v-if="deleteError" role="alert" data-taxonomy-overlay-delete-error class="text-sm text-error">
                {{ deleteError }}
              </p>
            </template>
          </DashboardEntityFormActions>
        </UForm>
      </div>
    </template>
  </USlideover>
</template>
