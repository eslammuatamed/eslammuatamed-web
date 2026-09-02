<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  ADMIN_SKILL_GROUPS,
  SKILL_LOCALES,
  type SkillLocale
} from '~/composables/admin-skill-fields'
import {
  emptySkillForm,
  initialSkillForm,
  isSkillFormDirty,
  isSkillTranslationComplete,
  skillCreatePayload,
  skillFormSchema,
  skillPayloadLocales,
  skillTranslationFill,
  skillUpdatePayload,
  type SkillFormState
} from '~/composables/admin-skill-form'
import type { AdminSkill } from '~/composables/admin-project-types'
import { toApiError } from '~/utils/api-error'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ saved: [skill: AdminSkill], deleted: [] }>()

const { t, locale } = useDashboardI18n()
const editor = useAdminSkill()
const { skill, pending: loading, forbidden, notFound, failed: loadFailed } = editor

const form = ref<SkillFormState>(emptySkillForm())
const initial = ref<SkillFormState>(emptySkillForm())
const activeLocale = ref<SkillLocale>('en')
const formRef = useTemplateRef('formRef')
const alertRef = useTemplateRef<HTMLElement>('alertRef')
const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const deleting = ref(false)
const confirmingDelete = ref(false)
const deleteError = ref<string | null>(null)

const isCreate = computed(() => props.id === null)
const dirty = computed(() => isSkillFormDirty(form.value, initial.value))
const resolving = computed(() => !isCreate.value && loading.value && skill.value === null)
const unreadable = computed(() => forbidden.value || notFound.value || loadFailed.value)
const schema = computed(() => skillFormSchema(t))

const {
  serverFieldErrors,
  fieldErrorSummary,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors,
  onValidationError
} = useTranslatableForm<SkillLocale>({
  locales: SKILL_LOCALES,
  activeLocale,
  scope: '[data-skill-editor]',
  clearOn: form
})

const tabItems = computed(() => SKILL_LOCALES.map(value => ({
  value,
  label: t(`dashboard.skills.locale.${value}`),
  fill: skillTranslationFill(form.value.translations[value]),
  invalid: localesWithErrors.value.has(value)
})))

const groupItems = computed(() => ADMIN_SKILL_GROUPS.map(value => ({
  value,
  label: t(`dashboard.skills.group.${value}`)
})))

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})

function adopt(): void {
  form.value = initialSkillForm(skill.value)
  initial.value = initialSkillForm(skill.value)
}

watch(skill, () => { if (skill.value) adopt() })

onMounted(async () => {
  activeLocale.value = SKILL_LOCALES.includes(locale.value as SkillLocale)
    ? locale.value as SkillLocale
    : 'en'
  if (props.id) await editor.load(props.id)
})

async function onSubmit(_event: FormSubmitEvent<unknown>): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveError.value = null
  deleteError.value = null
  resetFieldErrors()
  const sentLocales = skillPayloadLocales(form.value)

  try {
    const saved = isCreate.value
      ? await editor.create(skillCreatePayload(form.value))
      : await editor.update(props.id as string, skillUpdatePayload(form.value, initial.value))

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
    deleteError.value = toApiError(error).detail ?? t('dashboard.skills.editor.deleteFailed')
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

/** The owning overlay decides whether a dirty form is allowed to close. */
defineExpose({ dirty })
</script>

<template>
  <div data-skill-editor>
    <UAlert
      v-if="unreadable"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      data-editor-unreadable
      :title="forbidden
        ? t('dashboard.skills.forbiddenTitle')
        : notFound ? t('dashboard.skills.editor.notFoundTitle') : t('dashboard.skills.errorTitle')"
      :description="forbidden
        ? t('dashboard.skills.forbiddenBody')
        : notFound ? t('dashboard.skills.editor.notFoundBody') : t('dashboard.skills.editor.loadFailedBody')"
    />

    <DashboardEntityEditorSkeleton
      v-else-if="resolving"
      :label="t('dashboard.skills.editor.loadingSkill')"
    />

    <template v-else>
      <div
        v-if="saveError"
        ref="alertRef"
        tabindex="-1"
        role="alert"
        class="mb-6 outline-none"
        data-editor-save-error-container
      >
        <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="saveError" data-editor-save-error />
      </div>

      <div
        v-if="fieldErrorSummary.length > 0"
        role="alert"
        data-editor-error-summary
        class="mb-6 rounded-control border border-error/40 bg-error/5 p-4"
      >
        <p class="font-medium text-highlighted">{{ t('dashboard.skills.editor.errorSummaryTitle') }}</p>
        <ul class="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li v-for="(entry, index) in fieldErrorSummary" :key="index">
            <span v-if="entry.locale" class="font-medium text-highlighted">
              {{ t(`dashboard.skills.locale.${entry.locale}`) }}:
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
        data-skill-editor-ready
        @submit="onSubmit"
        @error="onValidationError"
      >
        <section :aria-label="t('dashboard.skills.editor.detailsSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.skills.editor.detailsSection') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              name="slug"
              :error="serverFieldErrors.slug"
              :label="t('dashboard.skills.field.slug')"
              :help="t('dashboard.skills.editor.slugHelp')"
              required
            >
              <UInput v-model="form.slug" :disabled="!isCreate" dir="ltr" class="w-full" data-editor-slug />
            </UFormField>

            <UFormField name="group" :error="serverFieldErrors.group" :label="t('dashboard.skills.field.group')" required>
              <USelect v-model="form.group" :items="groupItems" class="w-full" data-editor-group />
            </UFormField>

            <UFormField
              name="order"
              :error="serverFieldErrors.order"
              :label="t('dashboard.skills.field.order')"
              :help="t('dashboard.skills.editor.orderHelp')"
              required
            >
              <UInputNumber v-model="form.order" orientation="vertical" dir="ltr" class="w-full" data-editor-order />
            </UFormField>

            <UFormField
              name="brandColor"
              :error="serverFieldErrors.brandColor"
              :label="t('dashboard.skills.field.brandColor')"
              :help="t('dashboard.skills.editor.brandColorHelp')"
            >
              <div class="flex gap-2">
                <UInput v-model="form.brandColor" dir="ltr" class="min-w-0 flex-1" data-editor-brand-color />
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  :disabled="form.brandColor === ''"
                  data-editor-brand-color-clear
                  @click="form.brandColor = ''"
                >
                  {{ t('dashboard.skills.editor.clearBrandColor') }}
                </UButton>
              </div>
            </UFormField>
          </div>

          <UFormField name="isPublic" :error="serverFieldErrors.isPublic">
            <UCheckbox v-model="form.isPublic" :label="t('dashboard.skills.field.visibility')" data-editor-is-public />
          </UFormField>
        </section>

        <section :aria-label="t('dashboard.skills.editor.contentSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.skills.editor.contentSection') }}</h2>
          <DashboardTranslationTabs
            v-model="activeLocale"
            :items="tabItems"
            :invalid-label="t('dashboard.skills.editor.tabInvalid')"
            :fill-labels="{
              empty: t('dashboard.skills.editor.fill.empty'),
              partial: t('dashboard.skills.editor.fill.partial'),
              complete: t('dashboard.skills.editor.fill.complete')
            }"
          >
            <template #panel="{ locale: fieldLocale, contentDir }">
              <UFormField
                :name="`translations.${fieldLocale}.label`"
                :error="serverFieldErrors[`translations.${fieldLocale}.label`]"
                :label="t('dashboard.skills.field.label')"
                :help="t('dashboard.skills.editor.labelHelp')"
              >
                <UInput
                  v-model="form.translations[fieldLocale].label"
                  :dir="contentDir"
                  maxlength="120"
                  class="w-full"
                  :data-editor-label="fieldLocale"
                />
              </UFormField>
            </template>
          </DashboardTranslationTabs>
          <p class="text-sm text-muted" data-editor-completeness>
            {{ isSkillTranslationComplete(form) ? t('dashboard.skills.editor.complete') : t('dashboard.skills.editor.incomplete') }}
          </p>
        </section>

        <DashboardEntityFormActions
          v-model:confirming="confirmingDelete"
          :save-state="saveState"
          :save-state-labels="{
            saving: t('dashboard.skills.editor.saving'),
            unsaved: t('dashboard.skills.editor.unsaved'),
            saved: t('dashboard.skills.editor.saved')
          }"
          :save-label="t('dashboard.skills.editor.save')"
          :saving="saving"
          :deletable="!isCreate"
          :deleting="deleting"
          :delete-labels="{
            delete: t('dashboard.skills.editor.delete'),
            confirm: t('dashboard.skills.editor.deleteConfirm'),
            cancel: t('dashboard.skills.editor.deleteCancel')
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
