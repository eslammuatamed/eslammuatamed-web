<script setup lang="ts">
import {
  PAGE_SEO_LOCALES,
  buildPageSeoPatch,
  initialPageSeoForm,
  isPageSeoFormDirty,
  pageSeoFormSchema
} from '~/composables/admin-page-seo-form'
import type { PageSeoFormState } from '~/composables/admin-page-seo-form'
import { useAdminPageSeo } from '~/composables/useAdminPageSeo'
import type { FormErrorEvent } from '@nuxt/ui'
import type { components } from '~/types/api'

type Schemas = components['schemas']
type SeoRow = Schemas['AdminPageSeoEntity']
type PageSeoLocale = (typeof PAGE_SEO_LOCALES)[number]

const props = defineProps<{
  /** The CURRENT server state of this singleton page — always the LIST ROW, never a detail read. */
  row: SeoRow
}>()

const emit = defineEmits<{
  /** The authoritative PATCH response entity, for the owner to swap into its collection. */
  saved: [row: SeoRow]
}>()

/**
 * The Static Page SEO EDITOR (FE4-U1d) — one singleton page's four per-locale override fields.
 * Every semantic decision comes from the U1b layer (`admin-page-seo-form.ts`): initialization from
 * the list row, dirty detection, PATCH construction (changed locales/fields only; explicit null
 * clears; `null` means ZERO requests), canonical validation, and sent-order 422 mapping.
 * Presentation is the shared set — TranslationTabs, SeoPanel, EntityFormActions and the shared
 * translation-error machinery — exactly as in the content-entity editors.
 *
 * ── OPTIONAL OVERRIDE DATA ──────────────────────────────────────────────────────────────────────
 * NO OD-14 authored-locale rule exists here: an all-null page is complete ("use the site
 * defaults"), one field alone is valid, and clearing the FINAL override PATCHes explicit nulls.
 *
 * ── THE ROW PROP IS THE ONLY DATA INPUT ─────────────────────────────────────────────────────────
 * Seeded from the row on mount, and whenever a CLEAN editor receives a NEW row (a background
 * refresh rehydrating clean data, or the authoritative post-save entity arriving). A DIRTY or
 * SAVING editor IGNORES row swaps — uncommitted operator work outranks fresh data underneath it.
 */

const { t, locale } = useDashboardI18n()

/** Own transport instance: the PATCH is the composable's, keyed by the row's page key in the path. */
const { update } = useAdminPageSeo()

/** The dirty flag is shared WITH the owning page: it gates page-switch confirmation there. */
const dirty = defineModel<boolean>('dirty', { default: false })

const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const saveErrorRef = ref<HTMLElement | null>(null)
/** Static pages are singletons — nothing to delete; the actions component requires the model. */
const confirmingDelete = ref(false)

const form = ref<PageSeoFormState>(initialPageSeoForm(null))
const baseline = ref<PageSeoFormState>(initialPageSeoForm(null))

function seedFrom(row: SeoRow): void {
  baseline.value = initialPageSeoForm(row)
  form.value = initialPageSeoForm(row)
}

seedFrom(props.row)

/** The U1b comparison is the ONLY dirty source; it is published to the owning page via the model. */
const isDirty = computed(() => isPageSeoFormDirty(form.value, baseline.value))
watch(isDirty, (value) => { dirty.value = value }, { immediate: true })

watch(() => props.row, (next) => {
  if (saving.value || dirty.value) return
  if (next) seedFrom(next)
})

const activeLocale = ref<PageSeoLocale>('en')

/** OD-9: the dashboard application locale seeds the INITIAL tab; the operator owns it after. */
onMounted(() => {
  if ((PAGE_SEO_LOCALES as readonly string[]).includes(locale.value)) activeLocale.value = locale.value as PageSeoLocale
})

/** Rebuilt with the dashboard language, like every editor's schema (the FE-2a login.vue lesson). */
const schema = computed(() => pageSeoFormSchema(t))

const {
  serverFieldErrors,
  localesWithErrors,
  reset: resetFieldErrors,
  applyFieldErrors
} = useTranslatableForm<PageSeoLocale>({
  locales: PAGE_SEO_LOCALES,
  activeLocale,
  scope: '[data-seo-editor]',
  clearOn: form
})

/**
 * CLIENT-side (Zod) failures. `SeoPanel`'s fields are bound to `serverFieldErrors` and carry no
 * UForm `name` (the panel is entity-blind by pinned source scan), so the shared
 * `onValidationError` — which relies on name-bound fields — cannot surface them. Instead the
 * event's FORM-shaped paths are converted to the API's indexed shape and re-entered through the
 * SAME `applyFieldErrors` machinery, giving identical field + tab behaviour. Client validation has
 * no request, so indexes resolve against the canonical locale list.
 */
function onClientValidationError(event: FormErrorEvent): void {
  const errors = (event.errors ?? []).map((item) => {
    const name = String(item.name ?? '')
    const match = /^translations\.(en|ar)\.(.+)$/.exec(name)
    if (!match) return { field: name, message: item.message ?? '' }
    const index = PAGE_SEO_LOCALES.indexOf(match[1] as PageSeoLocale)
    return { field: `translations[${index}].${match[2]}`, message: item.message ?? '' }
  })
  applyFieldErrors(errors, [...PAGE_SEO_LOCALES])
}

const tabItems = computed(() =>
  PAGE_SEO_LOCALES.map((value) => {
    const fields = form.value.translations[value]
    const authored = fields.metaTitle.trim() !== '' || fields.metaDescription.trim() !== ''
      || fields.canonicalUrl.trim() !== '' || fields.ogImageId !== null
    return {
      value,
      label: t(`dashboard.seo.locale.${value}`),
      // OPTIONAL OVERRIDE DATA: authored → COMPLETE (nothing more is required); untouched → empty.
      fill: authored ? 'complete' as const : 'empty' as const,
      invalid: localesWithErrors.value.has(value)
    }
  })
)

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})

async function onSubmit(): Promise<void> {
  // §14.9 CRITERION 4 — duplicate submission prevented at the source.
  if (saving.value) return
  resetFieldErrors()
  saveError.value = null

  // UNCHANGED FORM → ZERO REQUESTS. The builder's `null` is the no-mutation sentinel; turning it
  // into a body would produce the rejected `{ translations: [] }`.
  const patch = buildPageSeoPatch(form.value, baseline.value)
  if (patch === null) return

  // The ordering of THIS request, captured before it is sent — a 422's translations[N] indexes it.
  const sentLocales = patch.translations.map(entry => entry.locale as PageSeoLocale)

  saving.value = true
  try {
    const updated = await update(props.row.pageKey, patch)
    savedAt.value = Date.now()
    seedFrom(updated)
    emit('saved', updated)
  } catch (error) {
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      applyFieldErrors(apiError.fieldErrors, sentLocales)
    } else {
      saveError.value = apiError.detail ?? apiError.message
      await nextTick()
      saveErrorRef.value?.focus()
    }
  } finally {
    saving.value = false
  }
}

useUnsavedChangesGuard({
  dirty,
  bypass: computed(() => false),
  message: () => t('dashboard.seo.editor.unsavedWarning')
})
</script>

<template>
  <UForm
    :schema="schema"
    :state="form"
    data-seo-editor
    class="flex flex-col gap-6"
    @submit="onSubmit"
    @error="onClientValidationError"
  >
    <div aria-live="polite" class="empty:hidden">
      <UAlert
        v-if="saveError"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        data-seo-save-error
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.seo.editor.saveFailedTitle')"
        :description="saveError"
      />
    </div>

    <DashboardTranslationTabs
      v-model="activeLocale"
      :items="tabItems"
      :invalid-label="t('dashboard.seo.editor.tabInvalid')"
      :fill-labels="{
        empty: t('dashboard.seo.editor.fill.empty'),
        partial: t('dashboard.seo.editor.fill.partial'),
        complete: t('dashboard.seo.editor.fill.complete')
      }"
    >
      <template #panel="{ locale: fieldLocale }">
        <!-- All four fields are OPTIONAL overrides: no required marks, no minimum-authored rule. -->
        <DashboardSeoPanel
          bare
          :meta-title="form.translations[fieldLocale].metaTitle"
          :meta-description="form.translations[fieldLocale].metaDescription"
          :canonical-url="form.translations[fieldLocale].canonicalUrl"
          :og-image-id="form.translations[fieldLocale].ogImageId"
          :content-dir="fieldLocale === 'ar' ? 'rtl' : 'ltr'"
          :disabled="saving"
          :meta-title-error="serverFieldErrors[`translations.${fieldLocale}.metaTitle`]"
          :meta-description-error="serverFieldErrors[`translations.${fieldLocale}.metaDescription`]"
          :canonical-url-error="serverFieldErrors[`translations.${fieldLocale}.canonicalUrl`]"
          :og-image-error="serverFieldErrors[`translations.${fieldLocale}.ogImageId`]"
          @update:meta-title="form.translations[fieldLocale].metaTitle = $event"
          @update:meta-description="form.translations[fieldLocale].metaDescription = $event"
          @update:canonical-url="form.translations[fieldLocale].canonicalUrl = $event"
          @update:og-image-id="form.translations[fieldLocale].ogImageId = $event"
        />
      </template>
    </DashboardTranslationTabs>

    <DashboardEntityFormActions
      v-model:confirming="confirmingDelete"
      :save-state="saveState"
      :save-state-labels="{
        saving: t('dashboard.seo.editor.saving'),
        unsaved: t('dashboard.seo.editor.unsaved'),
        saved: t('dashboard.seo.editor.saved')
      }"
      :save-label="t('dashboard.seo.editor.save')"
      :saving="saving"
      :deletable="false"
      :deleting="false"
      :delete-labels="{
        delete: t('dashboard.seo.editor.delete'),
        confirm: t('dashboard.seo.editor.deleteConfirm'),
        cancel: t('dashboard.seo.editor.deleteCancel')
      }"
    >
      <template #leading>
        <p class="text-sm text-muted" data-seo-editor-page>{{ t(`dashboard.seo.pages.${row.pageKey}`) }}</p>
      </template>
    </DashboardEntityFormActions>
  </UForm>
</template>
