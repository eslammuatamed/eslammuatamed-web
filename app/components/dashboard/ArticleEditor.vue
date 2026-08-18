<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import {
  ARTICLE_LOCALES,
  articleFieldErrorLocale,
  articleFieldErrorName,
  articleFillState,
  articleFormSchema,
  articleIsPubliclyVisible,
  articlePayload,
  articlePayloadLocales,
  articleStatusColor,
  initialArticleForm,
  isArticleFormDirty,
  type ArticleFormState,
  type ArticleLocale
} from '~/composables/admin-article-form'
import { ADMIN_ARTICLE_STATUSES } from '~/composables/admin-articles-query'
import type { ArticleStatus } from '~/composables/admin-article-types'
import { toApiError } from '~/utils/api-error'

/**
 * The Articles authoring surface — create AND edit (plan §14.1, §14.4; §14.9 criteria 3, 4, 5).
 *
 * ONE COMPONENT FOR BOTH, with `id: string | null`, following `ProjectEditor`'s decision and its
 * reason: two components are how two forms come to disagree about what an article is.
 *
 * ONE COHERENT PAGE — sections, translation tabs, persistently reachable primary actions. Not a
 * wizard: §14.4 sets that as the owner's starting hypothesis and requires workflow evidence before
 * departing from it, and nothing about writing an article is sequential.
 *
 * ── THE SHARED / TRANSLATED SPLIT (§14.1) ──────────────────────────────────────────────────────
 * Publication state, schedule, category, tags and the cover image are article-level and appear
 * ONCE, outside the tabs. Only the authored text and its per-locale SEO live inside them. That is
 * the contract's own shape, not a layout preference: `status`, `publishAt`, `categoryId`,
 * `coverImageId` and `tagIds` are article-level fields, while `title`/`slug`/`excerpt`/`body` and
 * the SEO overrides live inside each `translations[locale]`.
 *
 * ── WHY INACTIVE TABS STAY MOUNTED ─────────────────────────────────────────────────────────────
 * `:unmount-on-hide="false"`. Two requirements depend on it and neither is cosmetic: a validation
 * error in a hidden locale must remain DISCOVERABLE rather than being destroyed with its panel
 * (§14.1), and switching tabs must not disturb unsaved work. Form VALUES would survive a remount
 * anyway because they live in `form`, not in the DOM — which is exactly why a test that only
 * retyped and switched would pass against a broken implementation. The error state is the half
 * that would not survive.
 */
const props = defineProps<{ id: string | null }>()

const { t, locale } = useDashboardI18n()
const router = useRouter()
const localePath = useLocalePath()

const editor = useAdminArticle()
const taxonomy = useAdminTaxonomy()
const { article, pending: loading, forbidden, notFound, failed: loadFailed } = editor

const form = ref<ArticleFormState>(initialArticleForm(null))
/** The baseline the dirty check compares against — re-seeded from the server after every save. */
const initial = ref<ArticleFormState>(initialArticleForm(null))

const formRef = useTemplateRef('formRef')
const alertRef = useTemplateRef<HTMLElement>('alertRef')

const saving = ref(false)
const savedAt = ref<number | null>(null)
const saveError = ref<string | null>(null)
const fieldErrorSummary = ref<{ locale: ArticleLocale | null, message: string }[]>([])

/**
 * SERVER field errors, keyed by form path — rendered through `UFormField`'s own `error` prop.
 *
 * `UForm.setErrors()` is not used for these, and that was MEASURED rather than assumed: it attaches
 * correctly under the component test's DOM and does NOT survive in a real browser, where the tab
 * activation that follows it re-renders the panel and the schema-backed store reclaims the field.
 * The observable symptom was an Arabic slug input carrying `aria-invalid="false"` with no error id
 * in `aria-describedby`, while the tab beside it was correctly marked invalid — the error existed in
 * this component's state and had been dropped by the form's.
 *
 * Passing the message explicitly is the library's supported input for an error the form could not
 * have produced itself, and it behaves identically in both environments. This is NOT a second
 * validation architecture (§14.3): validation is still Zod through `UForm`. This is how a 422 that
 * only the API could know about is PRESENTED.
 */
const serverFieldErrors = ref<Record<string, string>>({})

/** Clear a stale server error as soon as the operator edits anything — it described the old input. */
watch(form, () => {
  if (Object.keys(serverFieldErrors.value).length > 0) serverFieldErrors.value = {}
}, { deep: true })

const deleting = ref(false)
const confirmingDelete = ref(false)
const deleteError = ref<string | null>(null)

const previewPending = ref(false)
const previewError = ref<string | null>(null)

/**
 * Set immediately before any navigation this component performs itself, so the unsaved-changes
 * guard never challenges a successful save's own redirect.
 */
const bypassGuard = ref(false)

const isCreate = computed(() => props.id === null)
const dirty = computed(() => isArticleFormDirty(form.value, initial.value))

/**
 * §14.9 CRITERION 3 — never render blank editable fields before the entity resolves.
 *
 * An editor that painted an empty form first invites the operator to start typing over content
 * that has not arrived, and then to save nothing over something real. So the fields do not exist
 * until there is either an article or a definite answer that there is none.
 */
const resolving = computed(() => !isCreate.value && loading.value && article.value === null)
const unreadable = computed(() => forbidden.value || notFound.value || loadFailed.value)

/* ── validation ────────────────────────────────────────────────────────────────────────────────
   The schema is a COMPUTED, rebuilt when the dashboard language changes — the defect FE-2a fixed
   in `login.vue`, which OD-11 created by making the language switch state rather than navigation.
   A `const` schema keeps serving messages in the load-time language while everything else changes. */
const schema = computed(() => articleFormSchema(t, article.value))

const activeLocale = ref<ArticleLocale>('en')

/**
 * OD-9 — the DASHBOARD application locale seeds the initial tab, and only the initial one.
 *
 * Seeded once rather than watched: after first paint the operator owns the selection, so changing
 * the dashboard language must not yank an Arabic-reading operator out of the English tab they are
 * deliberately editing. That independence is the decision, not an omission.
 */
onMounted(() => {
  activeLocale.value = ARTICLE_LOCALES.includes(locale.value as ArticleLocale)
    ? (locale.value as ArticleLocale)
    : 'en'
})

const localesWithErrors = computed(() => {
  const found = new Set<ArticleLocale>()
  for (const entry of fieldErrorSummary.value) if (entry.locale) found.add(entry.locale)
  return found
})

const tabItems = computed(() =>
  ARTICLE_LOCALES.map(value => ({
    value,
    label: t(`dashboard.articles.locale.${value}`),
    fill: articleFillState(form.value.translations[value]),
    invalid: localesWithErrors.value.has(value)
  }))
)

const statusItems = computed(() =>
  ADMIN_ARTICLE_STATUSES.map(value => ({ value, label: t(`dashboard.articles.status.${value}`) }))
)

const categoryItems = computed(() =>
  taxonomy.categories.value.map(category => ({
    value: category.id,
    label: category.translations[locale.value]?.name
      ?? category.translations.en?.name
      ?? t('dashboard.articles.untitled')
  }))
)

/* ── the public destination (§14.2) ───────────────────────────────────────────────────────────── */

/**
 * `View on site` is offered only where a REAL public destination exists — and status alone does not
 * establish one. `GET /articles/{slug}` resolves per locale, so a PUBLISHED article with no Arabic
 * 404s in Arabic; offering the action there would link the operator straight to a 404, which §14.2
 * forbids by name. Computed from the SAVED entity, never from the form: an unsaved slug is not
 * public yet.
 */
const publicHref = computed<string | null>(() => {
  const saved = article.value
  if (!saved) return null
  const target: ArticleLocale = activeLocale.value
  if (!articleIsPubliclyVisible(saved, target)) return null
  const slug = saved.translations[target]?.slug
  return slug ? localePath(`/blog/${slug}`, target) : null
})

/** Preview exists precisely where the public link does not — an article that is not published yet. */
const canPreview = computed(() => !isCreate.value && article.value !== null && publicHref.value === null)

/* ── loading ───────────────────────────────────────────────────────────────────────────────────── */

function adopt(): void {
  form.value = initialArticleForm(article.value)
  initial.value = initialArticleForm(article.value)
}

watch(article, () => { if (article.value) adopt() })

onMounted(async () => {
  void taxonomy.load()
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
  const sentLocales = articlePayloadLocales(form.value)

  try {
    const payload = articlePayload(form.value)
    const saved = props.id
      ? await editor.update(props.id, payload)
      : await editor.create(payload)

    savedAt.value = Date.now()

    if (props.id) {
      // Re-seed from the CONFIRMED server entity, not from what was sent: `readingTimeMin` and the
      // resolved status come back computed, and re-seeding is what clears `dirty` honestly.
      adopt()
    } else {
      bypassGuard.value = true
      // `replace`, not `push` — an empty create form is not a place to go Back to.
      await router.replace(`/dashboard/articles/${saved.id}`)
    }
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

/**
 * Map a 422 onto the form — and onto the right TAB.
 *
 * Writes send `translations` as an ARRAY, so the API answers `translations[N].slug` where N indexes
 * the array this client just built. Resolving it needs that ordering, which is why `sentLocales` is
 * threaded through from the request rather than assumed: with Arabic sent first, `translations[0]`
 * is Arabic, and a fixed assumption would put an Arabic slug collision on the English tab.
 *
 * The offending tab is then ACTIVATED, because an error the operator cannot see is one they cannot
 * fix — §14.1's "a hidden tab must never swallow an error".
 */
function applyFieldErrors(
  errors: readonly { field: string, message: string }[],
  sentLocales: readonly ArticleLocale[]
): void {
  const formErrors: { name: string, message: string }[] = []
  const summary: { locale: ArticleLocale | null, message: string }[] = []

  for (const item of errors) {
    const name = articleFieldErrorName(item.field, sentLocales)
    const errorLocale = articleFieldErrorLocale(item.field, sentLocales)
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
  const target = document.querySelector<HTMLElement>('[data-article-editor] [aria-invalid="true"]')
  if (!target) return
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** Client-side validation failures get the same treatment: switch to the offending tab, then focus. */
function onValidationError(event: FormErrorEvent): void {
  const errors = event.errors ?? []
  const summary: { locale: ArticleLocale | null, message: string }[] = []
  for (const item of errors) {
    const match = /^translations\.(en|ar)\./.exec(String(item.name ?? ''))
    summary.push({ locale: (match?.[1] as ArticleLocale | undefined) ?? null, message: item.message ?? '' })
  }
  fieldErrorSummary.value = summary
  const firstLocale = summary.find(entry => entry.locale)?.locale
  if (firstLocale) activeLocale.value = firstLocale
  void nextTick(() => focusFirstError())
}

/* ── status shortcut ───────────────────────────────────────────────────────────────────────────── */

/**
 * Publish is the SAME submit with the status set — not a second write path.
 *
 * A separate endpoint call would be a second place for the publish rules to be enforced, and the
 * API has no publish route: status transitions happen through `PATCH`, which is why one form and
 * one submit is also the contract's shape.
 */
async function saveWithStatus(status: ArticleStatus): Promise<void> {
  form.value.status = status
  await nextTick()
  formRef.value?.submit()
}

/* ── delete ────────────────────────────────────────────────────────────────────────────────────── */

async function confirmDelete(): Promise<void> {
  if (!props.id || deleting.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await editor.remove(props.id)
    bypassGuard.value = true
    await router.replace('/dashboard/articles')
  } catch (error) {
    deleteError.value = toApiError(error).detail ?? t('dashboard.articles.editor.deleteFailed')
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

/* ── preview ───────────────────────────────────────────────────────────────────────────────────── */

async function openPreview(): Promise<void> {
  if (!props.id || previewPending.value) return
  previewPending.value = true
  previewError.value = null
  try {
    // Minted on demand because it expires in 30 minutes — a token fetched when the editor opened
    // would be stale by the time a long authoring session used it.
    const token = await editor.mintPreviewToken(props.id)
    window.open(token.url, '_blank', 'noopener')
  } catch {
    previewError.value = t('dashboard.articles.editor.previewFailed')
  } finally {
    previewPending.value = false
  }
}

/* ── unsaved-changes guard (OD-8) ──────────────────────────────────────────────────────────────── */

onBeforeRouteLeave(() => {
  if (bypassGuard.value || !dirty.value) return true
  return window.confirm(t('dashboard.articles.editor.unsavedWarning'))
})

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (bypassGuard.value || !dirty.value) return
  event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

/* ── save-state presentation (§14.4) ───────────────────────────────────────────────────────────── */

const saveState = computed<'saving' | 'unsaved' | 'saved' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'unsaved'
  if (savedAt.value !== null) return 'saved'
  return 'idle'
})
</script>

<template>
  <UContainer class="py-8" data-article-editor>
    <!-- ── the entity could not be read: one answer per cause (D11-2) ───────────────────────── -->
    <UAlert
      v-if="unreadable"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      data-editor-unreadable
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="forbidden
        ? t('dashboard.articles.forbiddenTitle')
        : notFound ? t('dashboard.articles.editor.notFoundTitle') : t('dashboard.articles.errorTitle')"
      :description="forbidden
        ? t('dashboard.articles.forbiddenBody')
        : notFound ? t('dashboard.articles.editor.notFoundBody') : t('dashboard.articles.editor.loadFailedBody')"
    />

    <!-- §14.9 CRITERION 3 — an editor-shaped loading state. No blank fields before the data lands. -->
    <div
      v-else-if="resolving"
      role="status"
      :aria-busy="true"
      :aria-label="t('dashboard.articles.editor.loadingArticle')"
      data-editor-loading
      class="flex flex-col gap-6"
    >
      <span class="sr-only">{{ t('dashboard.articles.editor.loadingArticle') }}</span>
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
            {{ isCreate ? t('dashboard.articles.editor.createTitle') : t('dashboard.articles.editor.editTitle') }}
          </h1>
          <p class="mt-2 text-muted">{{ t('dashboard.articles.editor.description') }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            to="/dashboard/articles"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            class="rtl:[--icon-rotate:180deg]"
            data-editor-back
          >
            {{ t('dashboard.articles.editor.back') }}
          </UButton>

          <!-- Offered ONLY where a real public destination exists for the active language. -->
          <UButton
            v-if="publicHref"
            :to="publicHref"
            target="_blank"
            rel="noopener"
            color="neutral"
            variant="subtle"
            icon="i-lucide-external-link"
            data-editor-view-public
          >
            {{ t('dashboard.articles.editor.viewOnSite') }}
          </UButton>

          <UButton
            v-else-if="canPreview"
            color="neutral"
            variant="subtle"
            icon="i-lucide-eye"
            :loading="previewPending"
            :disabled="previewPending"
            data-editor-preview
            @click="openPreview()"
          >
            {{ t('dashboard.articles.editor.preview') }}
          </UButton>
        </div>
      </div>

      <p v-if="previewError" role="alert" class="mb-4 text-sm text-error" data-editor-preview-error>
        {{ previewError }}
      </p>

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
        <p class="font-medium text-highlighted">{{ t('dashboard.articles.editor.errorSummaryTitle') }}</p>
        <ul class="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li v-for="(entry, index) in fieldErrorSummary" :key="index">
            <span v-if="entry.locale" class="font-medium text-highlighted">
              {{ t(`dashboard.articles.locale.${entry.locale}`) }}:
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
        <section :aria-label="t('dashboard.articles.editor.publicationSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.articles.editor.publicationSection') }}</h2>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField name="status" :label="t('dashboard.articles.field.status')">
              <USelect v-model="form.status" :items="statusItems" class="w-full" data-editor-status />
            </UFormField>

            <UFormField
              name="publishAtLocal"
              :error="serverFieldErrors.publishAt"
              :label="t('dashboard.articles.field.publishAt')"
              :help="t('dashboard.articles.editor.publishAtHelp')"
            >
              <UInput v-model="form.publishAtLocal" type="datetime-local" class="w-full" data-editor-publish-at />
            </UFormField>
          </div>
        </section>

        <section :aria-label="t('dashboard.articles.editor.classificationSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.articles.editor.classificationSection') }}</h2>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              name="categoryId"
              :error="serverFieldErrors.categoryId"
              :label="t('dashboard.articles.field.category')"
              required
            >
              <USelect
                v-model="form.categoryId"
                :items="categoryItems"
                :loading="taxonomy.pending.value"
                class="w-full"
                data-editor-category
              />
            </UFormField>

            <UFormField :label="t('dashboard.articles.field.tags')">
              <div class="flex flex-wrap gap-2" data-editor-tags>
                <UCheckbox
                  v-for="tag in taxonomy.tags.value"
                  :key="tag.id"
                  :model-value="form.tagIds.includes(tag.id)"
                  :label="tag.translations[locale]?.name ?? tag.translations.en?.name ?? tag.id"
                  :data-editor-tag="tag.id"
                  @update:model-value="form.tagIds = $event
                    ? [...form.tagIds, tag.id]
                    : form.tagIds.filter(id => id !== tag.id)"
                />
              </div>
            </UFormField>
          </div>

          <UFormField :label="t('dashboard.articles.field.coverImage')">
            <LazyDashboardMediaPicker
              v-model="form.coverImageId"
              allowed-kind="IMAGE"
              :field-label="t('dashboard.articles.field.coverImage')"
            />
          </UFormField>
        </section>

        <!-- ── TRANSLATED CONTENT — locale tabs (§14.1) ─────────────────────────────────────── -->
        <section :aria-label="t('dashboard.articles.editor.contentSection')" class="flex flex-col gap-4">
          <h2 class="text-h3 text-highlighted">{{ t('dashboard.articles.editor.contentSection') }}</h2>

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
                  {{ t('dashboard.articles.editor.tabInvalid') }}
                </UBadge>
                <UBadge
                  v-else
                  :color="item.fill === 'complete' ? 'success' : item.fill === 'partial' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="sm"
                  :data-editor-tab-fill="`${item.value}:${item.fill}`"
                >
                  {{ t(`dashboard.articles.editor.fill.${item.fill}`) }}
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
:name="`translations.${item.value}.title`"
                  :error="serverFieldErrors[`translations.${item.value}.title`]" :label="t('dashboard.articles.field.title')" required>
                  <UInput v-model="form.translations[item.value as ArticleLocale].title" class="w-full" :data-editor-title="item.value" />
                </UFormField>

                <UFormField
                  :name="`translations.${item.value}.slug`"
                  :error="serverFieldErrors[`translations.${item.value}.slug`]"
                  :label="t('dashboard.articles.field.slug')"
                  :help="t('dashboard.articles.editor.slugHelp')"
                  required
                >
                  <UInput v-model="form.translations[item.value as ArticleLocale].slug" class="w-full" :data-editor-slug="item.value" />
                </UFormField>

                <UFormField
:name="`translations.${item.value}.excerpt`"
                  :error="serverFieldErrors[`translations.${item.value}.excerpt`]" :label="t('dashboard.articles.field.excerpt')" required>
                  <UTextarea v-model="form.translations[item.value as ArticleLocale].excerpt" :rows="3" class="w-full" :data-editor-excerpt="item.value" />
                </UFormField>

                <!-- OD-3 — a plain Markdown textarea. The contract calls this field "Opaque
                     Markdown (D01-5)": the API stores the characters and the public site renders
                     them through the one sanitizing renderer. A rich editor would round-trip
                     through a document model and hand back something subtly different from what was
                     typed, and would pull Tiptap/ProseMirror into a dashboard chunk that D06-5
                     currently forbids. Recorded as its own governed unit, not dropped. -->
                <UFormField
                  :name="`translations.${item.value}.body`"
                  :error="serverFieldErrors[`translations.${item.value}.body`]"
                  :label="t('dashboard.articles.field.body')"
                  :help="t('dashboard.articles.editor.bodyHelp')"
                  required
                >
                  <UTextarea
                    v-model="form.translations[item.value as ArticleLocale].body"
                    :rows="16"
                    class="w-full font-mono"
                    :data-editor-body="item.value"
                  />
                </UFormField>

                <details class="rounded-control border border-default p-4">
                  <summary class="cursor-pointer font-medium text-highlighted">
                    {{ t('dashboard.articles.editor.seoSection') }}
                  </summary>
                  <div class="mt-4 flex flex-col gap-4">
                    <UFormField
:name="`translations.${item.value}.metaTitle`"
                  :error="serverFieldErrors[`translations.${item.value}.metaTitle`]" :label="t('dashboard.articles.field.metaTitle')">
                      <UInput v-model="form.translations[item.value as ArticleLocale].metaTitle" class="w-full" :data-editor-meta-title="item.value" />
                    </UFormField>
                    <UFormField
:name="`translations.${item.value}.metaDescription`"
                  :error="serverFieldErrors[`translations.${item.value}.metaDescription`]" :label="t('dashboard.articles.field.metaDescription')">
                      <UTextarea v-model="form.translations[item.value as ArticleLocale].metaDescription" :rows="2" class="w-full" />
                    </UFormField>
                    <UFormField
:name="`translations.${item.value}.canonicalUrl`"
                  :error="serverFieldErrors[`translations.${item.value}.canonicalUrl`]" :label="t('dashboard.articles.field.canonicalUrl')">
                      <UInput v-model="form.translations[item.value as ArticleLocale].canonicalUrl" dir="ltr" class="w-full" />
                    </UFormField>
                    <UFormField :label="t('dashboard.articles.field.ogImage')">
                      <LazyDashboardMediaPicker
                        v-model="form.translations[item.value as ArticleLocale].ogImageId"
                        allowed-kind="IMAGE"
                        :field-label="t('dashboard.articles.field.ogImage')"
                      />
                    </UFormField>
                  </div>
                </details>
              </div>
            </template>
          </UTabs>
        </section>

        <!-- ── PRIMARY ACTIONS — persistently reachable (§14.4) ─────────────────────────────────
             Sticky to the bottom of the viewport so Save is in reach from anywhere in a long
             article, rather than only after scrolling past a 16-row body field. -->
        <div
          class="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-default bg-default/95 px-4 py-3 backdrop-blur"
          data-editor-actions
        >
          <div class="flex items-center gap-3">
            <!-- saved / saving / unsaved, announced politely rather than asserted on every keystroke. -->
            <p role="status" class="text-sm text-muted" :data-editor-save-state="saveState">
              <span v-if="saveState === 'saving'">{{ t('dashboard.articles.editor.saving') }}</span>
              <span v-else-if="saveState === 'unsaved'">{{ t('dashboard.articles.editor.unsaved') }}</span>
              <span v-else-if="saveState === 'saved'">{{ t('dashboard.articles.editor.saved') }}</span>
            </p>
            <UBadge :color="articleStatusColor(form.status)" variant="subtle" size="sm" :data-editor-current-status="form.status">
              {{ t(`dashboard.articles.status.${form.status}`) }}
            </UBadge>
          </div>

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
                  {{ t('dashboard.articles.editor.deleteConfirm') }}
                </UButton>
                <UButton color="neutral" variant="ghost" size="sm" :disabled="deleting" data-editor-delete-cancel @click="confirmingDelete = false">
                  {{ t('dashboard.articles.editor.deleteCancel') }}
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
                {{ t('dashboard.articles.editor.delete') }}
              </UButton>
            </template>

            <UButton
              v-if="form.status !== 'PUBLISHED'"
              color="neutral"
              variant="subtle"
              :disabled="saving"
              data-editor-publish
              @click="saveWithStatus('PUBLISHED')"
            >
              {{ t('dashboard.articles.editor.publish') }}
            </UButton>

            <!-- Loading belongs to THIS action, never to a page-blocking screen (§14.9 criterion 4). -->
            <UButton type="submit" :loading="saving" :disabled="saving" data-editor-save>
              {{ t('dashboard.articles.editor.save') }}
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
