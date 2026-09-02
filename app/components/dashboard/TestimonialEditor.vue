<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'
import { TESTIMONIAL_LOCALES, type TestimonialLocale } from '~/composables/admin-testimonial-fields'
import {
  emptyTestimonialForm,
  initialTestimonialForm,
  isTestimonialFormDirty,
  isTestimonialTranslationComplete,
  testimonialCreatePayload,
  testimonialFormSchema,
  testimonialPayloadLocales,
  testimonialTranslationFill,
  testimonialUpdatePayload,
  type TestimonialFormState
} from '~/composables/admin-testimonial-form'
import { toApiError } from '~/utils/api-error'

/**
 * The Testimonials editor (FE-3 module 3, `T·U3`), on the same architecture as the Skills and
 * Experiences editors: shared translation-error machinery, shared tabs/actions/skeleton, Zod + UForm.
 * What differs is contract-driven — the avatar's omission/clear discrimination, the three required
 * text fields per locale, and an integer order — and each difference is called out where a copied
 * implementation would get it wrong.
 */
const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ saved: [testimonial: AdminTestimonial]; deleted: [] }>()

const { t, locale } = useDashboardI18n()
const editor = useAdminTestimonial()
const { testimonial, pending: loading, forbidden, notFound, failed: loadFailed } = editor

const form = ref<TestimonialFormState>(emptyTestimonialForm())
const initial = ref<TestimonialFormState>(emptyTestimonialForm())
const activeLocale = ref<TestimonialLocale>('en')
const alertRef = useTemplateRef<HTMLElement>('alertRef')
const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const deleting = ref(false)
const confirmingDelete = ref(false)
const deleteError = ref<string | null>(null)

const isCreate = computed(() => props.id === null)
const dirty = computed(() => isTestimonialFormDirty(form.value, initial.value))
const resolving = computed(() => !isCreate.value && loading.value && testimonial.value === null)
const unreadable = computed(() => forbidden.value || notFound.value || loadFailed.value)
const schema = computed(() => testimonialFormSchema(t))

const {
  serverFieldErrors,
  fieldErrorSummary,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors,
  onValidationError
} = useTranslatableForm<TestimonialLocale>({
  locales: TESTIMONIAL_LOCALES,
  activeLocale,
  scope: '[data-testimonial-editor]',
  clearOn: form
})

const tabItems = computed(() => TESTIMONIAL_LOCALES.map(value => ({
  value,
  label: t(`dashboard.testimonials.locale.${value}`),
  fill: testimonialTranslationFill(form.value.translations[value]),
  invalid: localesWithErrors.value.has(value)
})))

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})

function adopt(): void {
  form.value = initialTestimonialForm(testimonial.value)
  initial.value = initialTestimonialForm(testimonial.value)
}

watch(testimonial, () => { if (testimonial.value) adopt() })

onMounted(async () => {
  activeLocale.value = TESTIMONIAL_LOCALES.includes(locale.value as TestimonialLocale)
    ? locale.value as TestimonialLocale
    : 'en'
  if (props.id) await editor.load(props.id)
})

async function onSubmit(_event: FormSubmitEvent<unknown>): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveError.value = null
  deleteError.value = null
  resetFieldErrors()
  const sentLocales = testimonialPayloadLocales(form.value)

  try {
    const saved = isCreate.value
      ? await editor.create(testimonialCreatePayload(form.value))
      : await editor.update(props.id as string, testimonialUpdatePayload(form.value, initial.value))

    savedAt.value = Date.now()
    adopt()
    emit('saved', saved)
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
  if (!props.id || deleting.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await editor.remove(props.id)
    emit('deleted')
  } catch (error) {
    deleteError.value = toApiError(error).detail ?? t('dashboard.testimonials.editor.deleteFailed')
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

defineExpose({ dirty })
</script>

<template>
  <div data-testimonial-editor>

    <UAlert
      v-if="unreadable"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      data-editor-unreadable
      :title="forbidden
        ? t('dashboard.testimonials.forbiddenTitle')
        : notFound ? t('dashboard.testimonials.editor.notFoundTitle') : t('dashboard.testimonials.errorTitle')"
      :description="forbidden
        ? t('dashboard.testimonials.forbiddenBody')
        : notFound ? t('dashboard.testimonials.editor.notFoundBody') : t('dashboard.testimonials.editor.loadFailedBody')"
    />

    <DashboardEntityEditorSkeleton
      v-else-if="resolving"
      :label="t('dashboard.testimonials.editor.loadingTestimonial')"
    />

    <template v-else>
      <div v-if="saveError" ref="alertRef" tabindex="-1" role="alert" class="mb-6 outline-none" data-editor-save-error-container>
        <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="saveError" data-editor-save-error />
      </div>

      <div
        v-if="fieldErrorSummary.length > 0"
        role="alert"
        data-editor-error-summary
        class="mb-6 rounded-control border border-error/40 bg-error/5 p-4"
      >
        <p class="font-medium text-highlighted">{{ t('dashboard.testimonials.editor.errorSummaryTitle') }}</p>
        <ul class="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li v-for="(entry, index) in fieldErrorSummary" :key="index">
            <span v-if="entry.locale" class="font-medium text-highlighted">
              {{ t(`dashboard.testimonials.locale.${entry.locale}`) }}:
            </span>
            {{ entry.message }}
          </li>
        </ul>
      </div>

      <UForm
        :schema="schema"
        :state="form"
        class="flex flex-col gap-8"
        data-testimonial-editor-ready
        @submit="onSubmit"
        @error="onValidationError"
      >
        <section :aria-label="t('dashboard.testimonials.editor.detailsSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.testimonials.editor.detailsSection') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <!-- Integer ≥ 0 by contract; the schema blocks anything else before a request exists. -->
            <UFormField
              name="order"
              :error="serverFieldErrors.order"
              :label="t('dashboard.testimonials.field.order')"
              :help="t('dashboard.testimonials.editor.orderHelp')"
              required
            >
              <UInputNumber v-model="form.order" :min="0" orientation="vertical" dir="ltr" class="w-full" data-editor-order />
            </UFormField>

            <UFormField name="avatarId" :error="serverFieldErrors.avatarId" :label="t('dashboard.testimonials.field.avatar')">
              <!-- The ONE media picker, reused verbatim: it owns browsing, upload and clearing, and
                   emits only a stable asset id. The omission/clear distinction below lives in the
                   PAYLOAD builder, not in the control. -->
              <DashboardMediaPicker
                v-model="form.avatarId"
                allowed-kind="IMAGE"
                :field-label="t('dashboard.testimonials.field.avatar')"
                :disabled="saving"
                data-editor-avatar
              />
            </UFormField>
          </div>

          <UFormField name="isVisible" :error="serverFieldErrors.isVisible">
            <UCheckbox v-model="form.isVisible" :label="t('dashboard.testimonials.field.visibility')" data-editor-is-visible />
          </UFormField>
        </section>

        <section :aria-label="t('dashboard.testimonials.editor.contentSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.testimonials.editor.contentSection') }}</h2>
          <DashboardTranslationTabs
            v-model="activeLocale"
            :items="tabItems"
            :invalid-label="t('dashboard.testimonials.editor.tabInvalid')"
            :fill-labels="{
              empty: t('dashboard.testimonials.editor.fill.empty'),
              partial: t('dashboard.testimonials.editor.fill.partial'),
              complete: t('dashboard.testimonials.editor.fill.complete')
            }"
          >
            <template #panel="{ locale: fieldLocale, contentDir }">
              <UFormField
                :name="`translations.${fieldLocale}.quote`"
                :error="serverFieldErrors[`translations.${fieldLocale}.quote`]"
                :label="t('dashboard.testimonials.field.quote')"
                :help="t('dashboard.testimonials.editor.quoteHelp')"
              >
                <UTextarea
                  v-model="form.translations[fieldLocale].quote"
                  maxlength="4000"
                  :rows="4"
                  :dir="contentDir"
                  class="w-full"
                  :data-editor-quote="fieldLocale"
                />
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField
                  :name="`translations.${fieldLocale}.authorName`"
                  :error="serverFieldErrors[`translations.${fieldLocale}.authorName`]"
                  :label="t('dashboard.testimonials.field.author')"
                >
                  <UInput
                    v-model="form.translations[fieldLocale].authorName"
                    maxlength="160"
                    :dir="contentDir"
                    class="w-full"
                    :data-editor-author="fieldLocale"
                  />
                </UFormField>
                <UFormField
                  :name="`translations.${fieldLocale}.authorRole`"
                  :error="serverFieldErrors[`translations.${fieldLocale}.authorRole`]"
                  :label="t('dashboard.testimonials.field.role')"
                >
                  <UInput
                    v-model="form.translations[fieldLocale].authorRole"
                    maxlength="160"
                    :dir="contentDir"
                    class="w-full"
                    :data-editor-role="fieldLocale"
                  />
                </UFormField>
              </div>
            </template>
          </DashboardTranslationTabs>
          <p class="text-sm text-muted" data-editor-completeness>
            {{ isTestimonialTranslationComplete(form) ? t('dashboard.testimonials.editor.complete') : t('dashboard.testimonials.editor.incomplete') }}
          </p>
        </section>

        <DashboardEntityFormActions
          v-model:confirming="confirmingDelete"
          :save-state="saveState"
          :save-state-labels="{
            saving: t('dashboard.testimonials.editor.saving'),
            unsaved: t('dashboard.testimonials.editor.unsaved'),
            saved: t('dashboard.testimonials.editor.saved')
          }"
          :save-label="t('dashboard.testimonials.editor.save')"
          :saving="saving"
          :deletable="!isCreate"
          :deleting="deleting"
          :delete-labels="{
            delete: t('dashboard.testimonials.editor.delete'),
            confirm: t('dashboard.testimonials.editor.deleteConfirm'),
            cancel: t('dashboard.testimonials.editor.deleteCancel')
          }"
          @delete="confirmDelete()"
        />
      </UForm>

      <p v-if="deleteError" role="alert" class="mt-4 text-sm text-error" data-editor-delete-error>
        {{ deleteError }}
      </p>
    </template>
  </div>
</template>
