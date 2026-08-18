<script setup lang="ts">
import {
  OPTIONAL_TRANSLATION_FIELDS,
  REQUIRED_TRANSLATION_FIELDS,
  type ProjectLocale,
  type ProjectTranslationForm,
  type RequiredTranslationField
} from '~/composables/admin-project-form'

/**
 * ONE locale's case study, as a form.
 *
 * Rendered once per content locale, side by side, and it holds NOTHING that could carry across:
 * every value comes from the `modelValue` it is given and every change goes straight back out. That
 * is what makes "no cross-locale fallback" structural rather than a rule someone has to remember —
 * this component has no access to the other locale's state at all, so it cannot borrow from it.
 *
 * `dir` IS PINNED PER FIELD rather than inherited from the chrome. Field direction and chrome
 * direction are independent (doc 11 §6), and it cuts both ways now that the dashboard is bilingual
 * (D02-15): the Arabic case study is Arabic text inside an English dashboard, and the English one is
 * English text inside an Arabic dashboard. An RTL string in an LTR-forced box renders its
 * punctuation in the wrong place — the same reasoning as the Profile alt-text inputs.
 *
 * THE NARRATIVE FIELDS ARE PLAIN TEXTAREAS, deliberately. The contract calls all eleven "Opaque
 * Markdown": the API stores the characters and the public site renders them through the one
 * sanitizing renderer (`ContentProse`). A rich-text editor here would have to round-trip Markdown
 * through a document model and hand back something subtly different from what was typed — and it
 * would drag Tiptap/ProseMirror into a route that has no need of them.
 */
const props = defineProps<{
  modelValue: ProjectTranslationForm
  locale: ProjectLocale
  disabled?: boolean
  /** Validation messages appear only after a save has been ATTEMPTED, not while the operator types. */
  showErrors?: boolean
  missingFields: readonly RequiredTranslationField[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ProjectTranslationForm] }>()

const { t } = useDashboardI18n()

/** The single-line fields; everything else in the required set is long-form Markdown. */
const SHORT_FIELDS = ['title', 'slug'] as const
const LONG_FIELDS = REQUIRED_TRANSLATION_FIELDS.filter(
  (field): field is Exclude<RequiredTranslationField, 'title' | 'slug'> =>
    !(SHORT_FIELDS as readonly string[]).includes(field)
)

const dir = computed(() => (props.locale === 'ar' ? 'rtl' : 'ltr'))

function setField(field: keyof ProjectTranslationForm, value: string | null): void {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const isMissing = (field: RequiredTranslationField): boolean =>
  props.showErrors === true && props.missingFields.includes(field)

const fieldId = (field: string): string => `project-${props.locale}-${field}`
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormField
      v-for="field in SHORT_FIELDS"
      :key="field"
      :label="t(`dashboard.projects.field.${field}`)"
      required
      :error="isMissing(field) ? t('dashboard.projects.editor.localePartial') : undefined"
    >
      <UInput
        :id="fieldId(field)"
        :model-value="modelValue[field]"
        :dir="field === 'slug' ? 'ltr' : dir"
        :disabled="disabled"
        class="w-full"
        :data-project-field="`${locale}.${field}`"
        @update:model-value="setField(field, String($event))"
      />
    </UFormField>

    <UFormField
      v-for="field in LONG_FIELDS"
      :key="field"
      :label="t(`dashboard.projects.field.${field}`)"
      required
      :help="field === 'summary' ? undefined : t('dashboard.projects.editor.markdownHint')"
      :error="isMissing(field) ? t('dashboard.projects.editor.localePartial') : undefined"
    >
      <UTextarea
        :id="fieldId(field)"
        :model-value="modelValue[field]"
        :dir="dir"
        :rows="field === 'summary' ? 3 : 6"
        :disabled="disabled"
        class="w-full"
        :data-project-field="`${locale}.${field}`"
        @update:model-value="setField(field, String($event))"
      />
    </UFormField>

    <!-- ── search and social ────────────────────────────────────────────────────────────────────
         Optional, and per locale: the two languages are two pages with two addresses, so they get
         two descriptions rather than one shared one. -->
    <fieldset class="mt-2 flex flex-col gap-4 rounded-control border border-default p-4">
      <legend class="px-1 text-sm font-medium text-highlighted">{{ t('dashboard.projects.editor.seo') }}</legend>
      <p class="text-xs text-muted">{{ t('dashboard.projects.editor.seoHelp') }}</p>

      <UFormField
        v-for="field in OPTIONAL_TRANSLATION_FIELDS"
        :key="field"
        :label="t(`dashboard.projects.field.${field}`)"
      >
        <UInput
          :id="fieldId(field)"
          :model-value="modelValue[field]"
          :dir="field === 'canonicalUrl' ? 'ltr' : dir"
          :disabled="disabled"
          class="w-full"
          :data-project-field="`${locale}.${field}`"
          @update:model-value="setField(field, String($event))"
        />
      </UFormField>

      <!-- The picker is CONSUMED, not reimplemented: selection, inline upload, search, pagination
           and preview all live in that one component. -->
      <UFormField :label="t('dashboard.projects.field.ogImage')">
        <DashboardMediaPicker
          :model-value="modelValue.ogImageId"
          allowed-kind="IMAGE"
          :field-label="`${t('dashboard.projects.field.ogImage')} (${t(`dashboard.projects.locale.${locale}`)})`"
          :disabled="disabled"
          @update:model-value="setField('ogImageId', $event)"
        />
      </UFormField>
    </fieldset>
  </div>
</template>
