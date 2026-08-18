<script setup lang="ts">
import {
  PORTRAIT_LOCALES,
  buildPortraitPayload,
  initialPortraitForm,
  isPortraitFormDirty,
  validatePortraitForm,
  type PortraitFormState
} from '~/utils/portrait-form'

/**
 * Dashboard Profile (design §10). `/dashboard/profile` is the durable Profile-management surface.
 * It implements TWO sections: the About PORTRAIT and the RÉSUMÉ PDF.
 *
 * NO PLACEHOLDERS. Tagline, availability and profile links are still deliberately absent — not
 * stubbed, not disabled, not "coming soon". The broader route was chosen for durability so those
 * sections have somewhere to land later without a second move; an empty promise rendered now would
 * be a surface the owner has to review and a lie about what the dashboard can do.
 *
 * ── TWO SECTIONS, TWO SAVES, AND WHY THEY ARE NOT ONE ───────────────────────────────────────────
 *
 * The Portrait save is GATED on both alt texts being present, and `portrait-alt-missing` is a real
 * reachable state (D18-7) — the API keeps an incomplete draft saveable on purpose. A single shared
 * Save would therefore make an unfinished portrait block a résumé swap, which is an unrelated field
 * the operator can do nothing about from that error. Each section owns its own fields, its own
 * validity and its own `PATCH` (D10-2), so neither can hold the other hostage.
 *
 * The résumé needs no alt text — a PDF is a download, not an image — so it has no alt inputs and no
 * remove confirmation. Clearing it with the picker and saving IS the removal, and it destroys
 * nothing: the file stays in the library and the public page has an honest "no PDF" state already.
 *
 * ── THE ALT-TEXT RULE THIS PAGE MUST NOT GET WRONG (D09-22) ─────────────────────────────────────
 *
 * `settings.portrait.alt` is the ASSET-LEVEL LIBRARY DEFAULT, resolved in the default admin locale.
 * The values that PUBLISH on `/about` and `/ar/about` are `settings.translations[locale].portraitAlt`.
 *
 * The inputs below are seeded ONLY from the translations, through `initialPortraitForm`, which takes
 * the translation map and never sees `portrait.alt`. Prefilling from the asset default would copy an
 * unreviewed library string into the About usage and publish it on the next save — in ONE locale's
 * words, for BOTH locales — which the contract forbids in as many words. The default is still shown,
 * but as a clearly-labelled authoring reference beneath the inputs, never as their value.
 *
 * Both locales are REQUIRED when a portrait is selected. That check lives here, not in the API, by
 * deliberate design: the API must keep an incomplete draft saveable, and publication is already
 * gated by the readiness state (`portrait-alt-missing`, D18-7). This is the authoring surface, so
 * this is where "you have not finished this" belongs.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL. Rationale in `~/utils/dashboard-locale`.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()
const admin = useAdminSettings()
const { settings, pending, forbidden, failed } = admin

useHead({ title: () => `${t('dashboard.profile.title')} · ${t('dashboard.title')}` })

/** The edited state, and the state it was loaded with — the latter is what "dirty" is measured against. */
const form = ref<PortraitFormState>(initialPortraitForm(null))
const initial = ref<PortraitFormState>(initialPortraitForm(null))

const saving = ref(false)
const saveError = ref(false)
const saved = ref(false)
/** Validation messages appear only after a save is ATTEMPTED — not while the operator is still typing. */
const showErrors = ref(false)

/** The résumé section's own state: one asset id, and the baseline it was loaded with. */
const resumeAssetId = ref<string | null>(null)
const resumeInitial = ref<string | null>(null)

const resumeSaving = ref(false)
const resumeSaveError = ref(false)
const resumeSaved = ref(false)

const errors = computed(() => validatePortraitForm(form.value))
const dirty = computed(() => isPortraitFormDirty(form.value, initial.value))
const resumeDirty = computed(() => resumeAssetId.value !== resumeInitial.value)

/**
 * Seed one section's edited state and its baseline from the loaded settings.
 *
 * Driven by a WATCHER on `settings` rather than a top-level `await`: this page is part of the
 * client-only dashboard, and awaiting in setup would suspend the route on a request that needs a
 * session the shell restores asynchronously. It also means a saved response re-seeds through exactly
 * the same path as the first load, so "what is on screen" has one definition rather than two.
 */
function adoptPortrait(): void {
  const next = initialPortraitForm(settings.value)
  form.value = next
  initial.value = next
}

function adoptResume(): void {
  resumeAssetId.value = settings.value?.resumeAssetId ?? null
  resumeInitial.value = resumeAssetId.value
}

function adopt(): void {
  adoptPortrait()
  adoptResume()
}

/**
 * THE RE-SEED IS GATED ON DIRTINESS, AND THAT GUARD IS THE WHOLE REASON TWO SECTIONS CAN SHARE ONE
 * `settings` REF.
 *
 * `admin.patch()` replaces the held settings with the full updated entity, so EITHER save fires this
 * watcher. Ungated, saving the résumé would re-seed the portrait form from the response and silently
 * discard alt text the operator had typed but not yet saved — work destroyed by an action taken in a
 * different section, with no error and nothing to undo it. Skipping a dirty section is the fix.
 *
 * The section that just saved re-seeds ITSELF, explicitly, after its own `await`. It cannot go
 * through this watcher: it is dirty by definition at that moment (its form has moved away from a
 * baseline that is still the pre-save one), so the guard that protects the other section would also
 * strand its own baseline and leave Save enabled after a successful save.
 */
watch(settings, () => {
  if (!dirty.value) adoptPortrait()
  if (!resumeDirty.value) adoptResume()
})
onMounted(() => void admin.load())

/**
 * The asset-level default, for DISPLAY ONLY.
 *
 * Held in its own computed with an explicit name so it can never be confused with a form value: it
 * is read in the template beneath the inputs and is not reachable from the form model at all.
 *
 * GATED ON THE SELECTION STILL BEING THE SAVED ONE, which is not a detail. `settings` only changes
 * on load and on save, while `form.assetId` changes the instant the picker returns — so during a
 * REPLACE, the flow this page exists for, the block would go on rendering the OLD portrait's library
 * description under a label that says "this image". Showing nothing is the honest answer: a
 * misattributed reference inside the feature built to prevent misattribution is worse than an
 * absent one, and it is the single string the operator has been invited to read and consider.
 */
const assetDefaultAlt = computed(() =>
  form.value.assetId !== null && form.value.assetId === settings.value?.portraitAssetId
    ? (settings.value?.portrait?.alt ?? null)
    : null
)

/** Removing a portrait is confirmed explicitly — it unpublishes the About page's portrait. */
const confirmingRemove = ref(false)

function onPickerChange(next: string | null): void {
  form.value = { ...form.value, assetId: next }
  saved.value = false
  confirmingRemove.value = false
}

function removePortrait(): void {
  // The alt inputs are cleared WITH the association, mirroring what the payload sends. Leaving the
  // previous portrait's words in the boxes would invite them onto the NEXT portrait, which is a
  // confidently-wrong description — worse for a screen-reader user than a missing one.
  form.value = { assetId: null, alt: { en: '', ar: '' } }
  confirmingRemove.value = false
  saved.value = false
}

// Named rather than inline assignments: an assignment expression evaluates to the assigned value, so
// an inline handler returns a boolean where Nuxt UI's click prop is typed `void` (caught by
// `nuxt typecheck`).
function startRemove(): void {
  confirmingRemove.value = true
}

function cancelRemove(): void {
  confirmingRemove.value = false
}

function setAlt(target: (typeof PORTRAIT_LOCALES)[number], value: string): void {
  form.value = { ...form.value, alt: { ...form.value.alt, [target]: value } }
  saved.value = false
}

async function save(): Promise<void> {
  showErrors.value = true
  if (errors.value.missingAlt.length > 0) return
  saving.value = true
  saveError.value = false
  saved.value = false
  try {
    // The response replaces the held settings, and the form is re-seeded FROM IT — so what is on
    // screen after a save is CONFIRMED server state, not the echo of what was sent.
    await admin.patch(buildPortraitPayload(form.value))
    adoptPortrait()
    saved.value = true
    showErrors.value = false
  } catch {
    // The operator's input is deliberately NOT discarded: a failed save must not also lose the work.
    saveError.value = true
  } finally {
    saving.value = false
  }
}

function onResumeChange(next: string | null): void {
  resumeAssetId.value = next
  resumeSaved.value = false
}

/**
 * The résumé save.
 *
 * The body carries `resumeAssetId` ALONE. The admin DTO is validated with `forbidNonWhitelisted`, so
 * echoing anything read-only back is a 422 — but the narrower reason is the one that matters here:
 * resending a field this section does not own would push a snapshot the Portrait section may have
 * already moved past, quietly reverting an edit this save never showed the operator.
 *
 * `null` is a legitimate value, not an omission. Clearing the picker and saving withdraws the
 * download; omitting the key would mean "leave it alone" and the removal would silently no-op.
 */
async function saveResume(): Promise<void> {
  resumeSaving.value = true
  resumeSaveError.value = false
  resumeSaved.value = false
  try {
    await admin.patch({ resumeAssetId: resumeAssetId.value })
    adoptResume()
    resumeSaved.value = true
  } catch {
    resumeSaveError.value = true
  } finally {
    resumeSaving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6">
      <h1 class="text-h1 text-highlighted">{{ t('dashboard.profile.title') }}</h1>
      <p class="mt-2 text-muted">{{ t('dashboard.profile.description') }}</p>
    </div>

    <div v-if="pending" class="flex flex-col gap-3" aria-busy="true" :aria-label="t('dashboard.profile.loading')">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-10 w-full" />
    </div>

    <UAlert
      v-else-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.profile.forbiddenTitle')"
      :description="t('dashboard.profile.forbiddenBody')"
    />

    <div v-else-if="failed" class="rounded-control border border-default p-6 text-center">
      <p class="font-medium text-highlighted">{{ t('dashboard.profile.errorTitle') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('dashboard.profile.errorBody') }}</p>
      <UButton class="mt-4" color="neutral" variant="subtle" @click="admin.load().then(adopt)">
        {{ t('dashboard.profile.retry') }}
      </UButton>
    </div>

    <div v-else class="flex max-w-2xl flex-col gap-5">
      <section :aria-labelledby="'portrait-heading'" class="flex flex-col gap-5" data-portrait-section>
        <div>
          <h2 id="portrait-heading" class="text-h2 text-highlighted">{{ t('dashboard.profile.portrait.heading') }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t('dashboard.profile.portrait.help') }}</p>
        </div>

        <!-- The picker is CONSUMED, not reimplemented. Selection, inline upload, search, pagination
             and preview all live in that one component so the next consumer inherits them. -->
        <DashboardMediaPicker
          :model-value="form.assetId"
          allowed-kind="IMAGE"
          :field-label="t('dashboard.profile.portrait.heading')"
          :disabled="saving"
          @update:model-value="onPickerChange"
        />

        <div v-if="form.assetId" class="flex flex-wrap gap-2">
          <template v-if="confirmingRemove">
            <UButton color="error" data-portrait-remove-confirm @click="removePortrait()">
              {{ t('dashboard.profile.portrait.removeConfirm') }}
            </UButton>
            <UButton color="neutral" variant="ghost" @click="cancelRemove()">
              {{ t('dashboard.profile.portrait.removeCancel') }}
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            variant="subtle"
            icon="i-lucide-trash-2"
            data-portrait-remove
            :ui="{ base: 'text-error-700 dark:text-error-300' }"
            @click="startRemove()"
          >
            {{ t('dashboard.profile.portrait.remove') }}
          </UButton>
        </div>
        <p v-if="confirmingRemove" class="text-xs text-muted">
          {{ t('dashboard.profile.portrait.removeWarning') }}
        </p>

        <!-- ── per-usage alt ──────────────────────────────────────────────────────────────────────
             Rendered only when a portrait is SELECTED: alt text describes an image, and asking for it
             with nothing selected would make the empty state unsaveable. -->
        <fieldset v-if="form.assetId" class="flex flex-col gap-4">
          <legend class="text-sm font-medium text-highlighted">
            {{ t('dashboard.profile.portrait.altHeading') }}
          </legend>
          <p class="text-sm text-muted">{{ t('dashboard.profile.portrait.altHelp') }}</p>

          <div v-for="altLocale in PORTRAIT_LOCALES" :key="altLocale" class="flex flex-col gap-1">
            <label :for="`portrait-alt-${altLocale}`" class="text-sm font-medium text-highlighted">
              {{ t(`dashboard.profile.portrait.altLabel.${altLocale}`) }}
            </label>
            <!-- `dir` is pinned PER FIELD, not inherited from the chrome: the Arabic alt is Arabic
                 text inside an English dashboard, and the English alt is English text inside an
                 Arabic one (doc 11 §6). An RTL string in an LTR-forced box renders its punctuation
                 in the wrong place. -->
            <UInput
              :id="`portrait-alt-${altLocale}`"
              :model-value="form.alt[altLocale]"
              :dir="altLocale === 'ar' ? 'rtl' : 'ltr'"
              :data-portrait-alt="altLocale"
              :aria-invalid="showErrors && errors.missingAlt.includes(altLocale) ? 'true' : undefined"
              :aria-describedby="showErrors && errors.missingAlt.includes(altLocale) ? `portrait-alt-${altLocale}-error` : undefined"
              :disabled="saving"
              @update:model-value="setAlt(altLocale, String($event))"
            />
            <p
              v-if="showErrors && errors.missingAlt.includes(altLocale)"
              :id="`portrait-alt-${altLocale}-error`"
              :data-portrait-alt-error="altLocale"
              class="text-xs text-error-700 dark:text-error-300"
            >
              {{ t('dashboard.profile.portrait.altRequired') }}
            </p>
          </div>

          <!-- THE ASSET-LEVEL DEFAULT, AS A LABELLED REFERENCE — never a value (D09-22).
               It is the library's description of the picture, resolved in the default admin locale.
               Copying it into the inputs is exactly what the contract forbids, so it is presented as
               something to read and consider, and the operator retypes what this usage needs. -->
          <div v-if="assetDefaultAlt" class="rounded-control border border-default p-3">
            <p class="text-xs font-medium text-muted">{{ t('dashboard.profile.portrait.libraryDefaultLabel') }}</p>
            <p dir="auto" data-portrait-library-default class="mt-1 text-sm text-default">{{ assetDefaultAlt }}</p>
            <p class="mt-1 text-xs text-muted">{{ t('dashboard.profile.portrait.libraryDefaultHint') }}</p>
          </div>
        </fieldset>

        <div aria-live="polite" class="empty:hidden">
          <UAlert
            v-if="saveError"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
            :title="t('dashboard.profile.saveErrorTitle')"
            :description="t('dashboard.profile.saveErrorBody')"
          />
          <UAlert
            v-else-if="saved"
            color="neutral"
            variant="subtle"
            icon="i-lucide-check"
            data-profile-saved
            :description="t('dashboard.profile.saved')"
          />
        </div>

        <div class="flex items-center gap-3">
          <UButton
            :loading="saving"
            :disabled="!dirty || saving"
            data-profile-save
            :aria-label="t('dashboard.profile.saveFor', { section: t('dashboard.profile.portrait.heading') })"
            @click="save()"
          >
            {{ t('dashboard.profile.save') }}
          </UButton>
          <p v-if="!dirty && !saving" class="text-xs text-muted">{{ t('dashboard.profile.noChanges') }}</p>
        </div>

        <!-- A note about what the public page does with this, so the operator is not guessing whether
             saving publishes. Readiness (D18-7) governs that, and it is not this page's decision. -->
        <p class="text-xs text-muted">{{ t('dashboard.profile.portrait.publishNote') }}</p>
      </section>

      <!-- ── résumé PDF ─────────────────────────────────────────────────────────────────────────
           AFTER the portrait in the DOM, and that ordering is load-bearing for the tests: the
           existing suite reaches the portrait picker with `findComponent`, which returns the FIRST
           match. A résumé section placed first would silently retarget those assertions at the
           wrong picker and still pass. -->
      <section :aria-labelledby="'resume-heading'" class="mt-6 flex flex-col gap-5" data-resume-section>
        <div>
          <h2 id="resume-heading" class="text-h2 text-highlighted">{{ t('dashboard.profile.resume.heading') }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t('dashboard.profile.resume.help') }}</p>
        </div>

        <!-- THE SAME PICKER, RESTRICTED TO PDF — not a second uploader and not a fork.
             `allowed-kind` is the component's existing mechanism: it reaches `MediaBrowser`, which
             hands it to `useMediaLibrary.load({ kind })` as `?kind=PDF`, so IMAGE assets are
             excluded by THE API QUERY rather than by a client-side filter over a mixed page — a
             filtered page would also break pagination counts. The same prop narrows the inline
             upload dialog to `application/pdf`. Nothing new was built for this. -->
        <DashboardMediaPicker
          :model-value="resumeAssetId"
          allowed-kind="PDF"
          :field-label="t('dashboard.profile.resume.heading')"
          :disabled="resumeSaving"
          @update:model-value="onResumeChange"
        />

        <div aria-live="polite" class="empty:hidden">
          <UAlert
            v-if="resumeSaveError"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
            :title="t('dashboard.profile.saveErrorTitle')"
            :description="t('dashboard.profile.saveErrorBody')"
          />
          <UAlert
            v-else-if="resumeSaved"
            color="neutral"
            variant="subtle"
            icon="i-lucide-check"
            data-resume-saved
            :description="t('dashboard.profile.saved')"
          />
        </div>

        <div class="flex items-center gap-3">
          <!-- Both Save buttons read "Save", so each carries an explicit accessible name. Two
               controls with the identical name on one page is precisely the ambiguity WCAG 2.4.6
               asks authors to resolve, and it appeared the moment this page grew a second section. -->
          <UButton
            :loading="resumeSaving"
            :disabled="!resumeDirty || resumeSaving"
            data-resume-save
            :aria-label="t('dashboard.profile.saveFor', { section: t('dashboard.profile.resume.heading') })"
            @click="saveResume()"
          >
            {{ t('dashboard.profile.save') }}
          </UButton>
          <p v-if="!resumeDirty && !resumeSaving" class="text-xs text-muted">{{ t('dashboard.profile.noChanges') }}</p>
        </div>

        <p class="text-xs text-muted">{{ t('dashboard.profile.resume.publishNote') }}</p>
      </section>
    </div>
  </UContainer>
</template>
