<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { Envelope } from '~/types/models'

// Public Contact (FR-PUB-050/051/052/053, flow F-P3) — the platform's single conversion point.
//
// ## The things most easily got wrong here
//
// 1. **The receipt is neutral.** The API returns an identical 2xx whether it persisted the message
//    or silently dropped it as spam (D02-1), so this page cannot know which happened and must never
//    claim the message reached an inbox.
// 2. **A fast human must not be discarded.** `elapsedMs` below `MIN_FILL_MS` is dropped-as-success
//    server-side, so dispatch waits out the remainder and reports the REAL elapsed time.
// 3. **Email OR phone, and a bad one is still bad.** At least one is required (D10-16); a value the
//    visitor actually typed is validated on its own merits rather than waved through because the
//    other one happens to be fine.

const { t, locale } = useI18n()
const api = useApi()
const localePath = useLocalePath()

// NOT awaited: `await` in `<script setup>` puts the page behind its own Suspense boundary, which
// shifted Vue's `useId()` prefix between server and client and left every `<label for>` pointing at
// a nonexistent element. Every read below goes through a computed on the reactive ref.
const { data: settings } = useSiteSettings()

// ── validation ────────────────────────────────────────────────────────────────────────────────
// Mirrors the API (D10-15 trimming, D10-16 pair rule). `email` and `phone` are individually optional
// but `superRefine` requires at least one — and a SUPPLIED value is still format-checked, so a
// mistyped address is an error rather than something quietly ignored because a phone is present.
// The form's shape. `zod` is deliberately NOT used on this route — see `validateContactForm`.
interface ContactForm {
  name: string
  email: string
  dialCode: DialCode
  nationalNumber: string
  subject: string
  body: string
}

// Feature-local validation via UForm's `validate` prop instead of a schema library. `USelectMenu`
// — required for the approved control appearance — pushed this route to 281.0 KB gz against the
// frozen 250 KB budget, and the pre-agreed remedy is to drop zod rather than the control or the
// threshold. UFormField, error rendering, focus management and the aria associations are unchanged;
// only the rule engine differs.
const validateForm = (values: ContactForm): ContactFieldError[] =>
  validateContactForm(values, {
    nameRequired: t('contact.errors.nameRequired'),
    nameTooLong: t('contact.errors.nameTooLong'),
    emailInvalid: t('contact.errors.emailInvalid'),
    emailTooLong: t('contact.errors.emailTooLong'),
    phoneInvalid: t('contact.errors.phoneInvalid'),
    subjectRequired: t('contact.errors.subjectRequired'),
    subjectTooLong: t('contact.errors.subjectTooLong'),
    bodyRequired: t('contact.errors.bodyRequired'),
    bodyTooLong: t('contact.errors.bodyTooLong')
  })

const emptyForm = (): ContactForm => ({
  name: '',
  email: '',
  dialCode: DIAL_CODES[0],
  nationalNumber: '',
  subject: '',
  body: ''
})

const state = reactive<ContactForm>(emptyForm())

// The honeypot lives outside `state` and outside the schema. Its DOM name is deliberately not
// `website`; the value maps onto the contract key only when the request body is assembled.
const companyUrl = ref('')

const form = useTemplateRef('form')
const statusRegion = useTemplateRef<HTMLElement>('statusRegion')
const successHeading = useTemplateRef<HTMLElement>('successHeading')
const pending = ref(false)

type Outcome = 'success' | 'validation' | 'rateLimit' | 'server' | 'network'
const outcome = ref<Outcome | null>(null)
const retryAfterLabel = ref<string | null>(null)

// Localized country labels beside each dialing code; "Other country" swaps the national field for a
// single full-international input (D13-6).
const dialOptions = computed(() => [
  ...DIAL_CODES.map(code => ({
    value: code as DialCode,
    label: `${t(`contact.methods.countries.${code}`)} (${code})`
  })),
  { value: OTHER_DIAL_CODE as DialCode, label: t('contact.form.otherCountry') }
])
const isOtherCountry = computed(() => state.dialCode === OTHER_DIAL_CODE)

// Switching country changes what counts as a valid number, so the number's own error is re-judged
// rather than left showing a verdict from the previous plan.
watch(() => state.dialCode, () => {
  if ((state.nationalNumber ?? '').trim() !== '') void form.value?.validate({ silent: true })
})

// ── the email-or-phone invariant (F-6) ────────────────────────────────────────────────────────
//
// DERIVED from current form values, not stored as a form error, and that is the whole fix.
//
// `UForm._validate({ name })` sets `errors.value = filterErrorsByNames(allErrors, names)` — a
// per-field revalidation REPLACES the error list with only that field's errors — and an `input`
// event revalidates a field only once it has been blurred. A cross-field issue keyed to `email`
// therefore never got re-evaluated when `nationalNumber` changed: the stale message stayed on
// screen and the next submit was still blocked (F-6). Any variant that files the shared invariant
// under one field's name inherits that lifecycle.
//
// As a computed over `state`, it re-evaluates the instant either input changes, so it cannot go
// stale in either direction: filling either method clears it, emptying both restores it.
const emailGiven = computed(() => (state.email ?? '').trim() !== '')
const phoneGiven = computed(() => (state.nationalNumber ?? '').trim() !== '')
const contactMethodMissing = computed(() => !emailGiven.value && !phoneGiven.value)

// Shown once the visitor has engaged with the group or attempted a submit — never on first paint.
const contactMethodTouched = ref(false)
const showContactMethodError = computed(() => contactMethodTouched.value && contactMethodMissing.value)
watch([emailGiven, phoneGiven], () => {
  if (!contactMethodMissing.value) contactMethodTouched.value = true
})

// ── time trap ─────────────────────────────────────────────────────────────────────────────────
// `performance.now()`, not `Date.now()`: monotonic, so a clock step mid-fill cannot corrupt it.
const filledFrom = ref(0)
function resetTimingOrigin(): void {
  filledFrom.value = performance.now()
}
onMounted(resetTimingOrigin)

// A re-checking wait, never one trusted `setTimeout`: a throttled tab defers timers, so looping
// until the measured elapsed time truly clears the threshold is what keeps `elapsedMs` honest.
async function waitOutFillTrap(): Promise<void> {
  for (;;) {
    const remaining = remainingFillWaitMs(performance.now() - filledFrom.value)
    if (remaining <= 0) return
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
}

function clearForm(): void {
  Object.assign(state, emptyForm())
  contactMethodTouched.value = false
  companyUrl.value = ''
  form.value?.clear()
  resetTimingOrigin()
}

// Explicit, because it is not free: under `prefix_except_default`, `/contact` → `/ar/contact` is a
// route change rather than a remount, so without this a half-written message would survive it.
watch(locale, () => {
  clearForm()
  outcome.value = null
  retryAfterLabel.value = null
})

async function onSubmit(event: FormSubmitEvent<ContactForm>): Promise<void> {
  // One guard covering the anti-spam wait AND the network request.
  if (pending.value) return

  // The group invariant is checked here rather than in the schema. Focus moves to the first field
  // of the pair so a keyboard user lands on something they can act on.
  contactMethodTouched.value = true
  if (contactMethodMissing.value) {
    await nextTick()
    document.getElementById('contact-email')?.focus()
    return
  }
  pending.value = true
  outcome.value = null
  retryAfterLabel.value = null

  try {
    await waitOutFillTrap()
    // Measured AFTER the wait: what the clock says, not a number chosen to clear the threshold.
    const elapsedMs = toElapsedMs(performance.now() - filledFrom.value)

    const email = (event.data.email ?? '').trim()
    const phone = normalizePhone(event.data.dialCode as DialCode, event.data.nationalNumber ?? '')

    await api<Envelope<{ received: boolean }>>('/contact', {
      method: 'POST',
      body: {
        // Trimmed explicitly. zod's `.trim()` used to transform the validated output; the
        // feature-local validator only INSPECTS values, so the payload has to do it itself or the
        // API would receive the padding the visitor typed.
        name: event.data.name.trim(),
        // Omitted rather than sent empty: the API distinguishes "not supplied" from "supplied and
        // blank", and sending `''` would turn a phone-only submission into a malformed-email 422.
        ...(email === '' ? {} : { email }),
        ...(phone === null ? {} : { phone }),
        subject: event.data.subject.trim(),
        body: event.data.body.trim(),
        website: companyUrl.value,
        elapsedMs
      }
    })

    outcome.value = 'success'
    clearForm()
  }
  catch (error) {
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      // The API reports the phone against `phone`; this form's input is `nationalNumber`, so the
      // error is re-pointed rather than dropped on the floor.
      const errors: FormError[] = apiError.fieldErrors.map(item => ({
        name: item.field === 'phone' ? 'nationalNumber' : item.field,
        message: item.message
      }))
      form.value?.setErrors(errors)
      outcome.value = 'validation'
    }
    else if (apiError.status === 429) {
      // Readable only because `Retry-After` is CORS-exposed (D10-15). Missing or malformed yields
      // null and the static message — the copy never states a duration it did not measure.
      const seconds = parseRetryAfterSeconds(apiError.retryAfter)
      retryAfterLabel.value = seconds === null ? null : formatRetryAfter(seconds, locale.value)
      outcome.value = 'rateLimit'
    }
    else if (apiError.status === 0) {
      outcome.value = 'network'
    }
    else {
      outcome.value = 'server'
    }
  }
  finally {
    pending.value = false
  }

  // Focus follows the outcome so a keyboard or screen-reader user is told what happened instead of
  // being left on a button whose label just changed back. The success state replaces the form, so
  // its heading is the correct landing point; every other outcome keeps the form and lands on the
  // inline message above it.
  await nextTick()
  if (outcome.value === 'success') {
    successHeading.value?.focus()
  }
  else {
    statusRegion.value?.focus()
  }
}

// Returns to a fresh form. The success state is dismissed by an explicit action rather than a timer,
// so nothing critical depends on a transient notification.
async function startAnother(): Promise<void> {
  outcome.value = null
  retryAfterLabel.value = null
  clearForm()
  await nextTick()
  document.getElementById('contact-name')?.focus()
}

const outcomeTitle = computed(() => {
  switch (outcome.value) {
    case 'success': return t('contact.success.title')
    case 'validation': return t('contact.error.validationTitle')
    case 'rateLimit': return t('contact.error.rateLimitTitle')
    case 'network': return t('contact.error.networkTitle')
    case 'server': return t('contact.error.serverTitle')
    default: return null
  }
})

const outcomeBody = computed(() => {
  switch (outcome.value) {
    case 'success': return t('contact.success.body')
    case 'validation': return t('contact.error.validationBody')
    case 'rateLimit': return retryAfterLabel.value
      ? t('contact.error.rateLimitBodyWithRetryAfter', { retryAfter: retryAfterLabel.value })
      : t('contact.error.rateLimitBody')
    case 'network': return t('contact.error.networkBody')
    case 'server': return t('contact.error.serverBody')
    default: return null
  }
})

// ── SEO ───────────────────────────────────────────────────────────────────────────────────────
const crumbs = computed(() => [{ label: t('nav.home'), to: '/' }, { label: t('nav.contact') }])
const siteConfig = useSiteConfig()
const absolute = (path: string) => `${siteConfig.url}${localePath(path)}`

// `WebPage` + `BreadcrumbList` only — doc 22 §4's governed table has no ContactPage entry, and the
// site-wide `Person` identity node already exists (D22-8), so no second one is emitted.
useSchemaOrg(() => [
  defineWebPage({ name: t('contact.title'), description: t('seo.contact.description') }),
  defineBreadcrumb({
    itemListElement: crumbs.value.map(crumb => ({
      name: crumb.label,
      item: crumb.to ? absolute(crumb.to) : undefined
    }))
  })
])

// Title and description only. Canonical, hreflang/x-default, og:locale, og:url and <html lang/dir>
// belong to @nuxtjs/i18n under strict SEO (D22-7). No `ogImage` (finding F-1).
useSeoMeta({
  title: () => t('seo.contact.title'),
  description: () => t('seo.contact.description'),
  ogTitle: () => `${t('seo.contact.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.contact.description')
})
</script>

<template>
  <UContainer class="py-[var(--space-section)]">
    <UiBreadcrumbs :items="crumbs" :label="t('contact.breadcrumbLabel')" />

    <!--
      Two columns from `lg` up, one below. The identity and direct methods establish context on the
      left and balance the form's visual weight on the right; stacked, the form still starts high
      because the left column is deliberately short.
    -->
    <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div class="lg:pt-2">
        <h1 class="text-h1 text-balance text-highlighted">
          {{ t('contact.title') }}
        </h1>
        <p class="mt-4 max-w-prose text-body-lg text-muted">
          {{ t('contact.description') }}
        </p>

        <ContactDirectMethods :settings="settings" />
      </div>

      <!-- The primary action, in a restrained panel rather than bare full-width inputs. -->
      <div class="rounded-xl border border-default bg-elevated/40 p-6 sm:p-8">
        <!--
          Success REPLACES the form rather than sitting above it as a banner, and it is dismissed by
          an explicit action rather than a timer — nothing critical depends on a transient
          notification. The direct-contact methods stay visible in the left column throughout.
        -->
        <div
          v-if="outcome === 'success'"
          role="status"
          aria-live="polite"
          class="py-6 text-center"
        >
          <UIcon name="i-lucide-circle-check" class="size-10 text-success" aria-hidden="true" />
          <!-- `tabindex="-1"` so focus can land here; it is the correct destination now that the
               form it replaced is gone. -->
          <h2
            ref="successHeading"
            tabindex="-1"
            class="mt-4 text-h3 text-highlighted outline-none"
          >
            {{ t('contact.success.title') }}
          </h2>
          <p class="mt-2 text-muted">
            {{ t('contact.success.body') }}
          </p>
          <UButton
            class="mt-6"
            color="neutral"
            variant="outline"
            :label="t('contact.success.again')"
            @click="startAnother"
          />
        </div>

        <template v-else>
        <!-- Field, rate-limit, server and network problems stay INLINE above the form the visitor
             still needs to correct. -->
        <div
          v-if="outcome"
          ref="statusRegion"
          tabindex="-1"
          role="status"
          aria-live="polite"
          :aria-label="t('contact.a11y.statusLabel')"
          class="mb-6 outline-none"
        >
          <UAlert
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="outcomeTitle ?? ''"
            :description="outcomeBody ?? ''"
          />
        </div>

        <p class="text-body-sm text-muted">
          {{ t('contact.form.requiredHint') }}
        </p>

        <UForm
          ref="form"
          :validate="validateForm"
          :state="state"
          :aria-label="t('contact.a11y.formLabel')"
          class="mt-5 space-y-5"
          @submit="onSubmit"
        >
          <!--
            Every control carries an EXPLICIT id. `useFormField` writes a control's `id` prop into
            the same ref `UFormField` renders as `<label :for>`, so both resolve from one stable
            value. Left to generated ids, SSR produced `v-0-1-*` and hydration `v-0-0-*` for the
            controls only, so every label pointed at an element that no longer existed — with no Vue
            hydration warning, because only the id VALUES disagreed.
          -->
          <UFormField name="name" :label="t('contact.form.name')" required>
            <UInput id="contact-name" v-model="state.name" size="lg" autocomplete="name" :maxlength="CONTACT_LIMITS.name" class="w-full" />
          </UFormField>

          <UFormField name="subject" :label="t('contact.form.subject')" required>
            <UInput id="contact-subject" v-model="state.subject" size="lg" autocomplete="off" :maxlength="CONTACT_LIMITS.subject" class="w-full" />
          </UFormField>

          <!--
            The email/phone pair. A hint plus two fields — deliberately NOT a bordered card: a
            second card inside the form panel competes with the panel itself, and the grouping is
            already carried by the hint, the spacing and the `aria-labelledby` association.
          -->
          <div class="space-y-4" role="group" aria-labelledby="contact-method-hint">
            <p id="contact-method-hint" class="text-body-sm text-muted">
              {{ t('contact.form.contactMethodHint') }}
            </p>

            <UFormField name="email" :label="t('contact.form.email')">
              <UInput
                id="contact-email"
                v-model="state.email"
                type="email"
                size="lg"
                autocomplete="email"
                :maxlength="CONTACT_LIMITS.email"
                :aria-describedby="showContactMethodError ? 'contact-method-error' : undefined"
                class="w-full"
              />
            </UFormField>

            <UFormField
              name="nationalNumber"
              :label="t('contact.form.phone')"
              :description="isOtherCountry ? t('contact.form.otherCountryHint') : undefined"
            >
              <!--
                Stacked below `sm`, one row above it. `min-w-0` on the number wrapper is
                load-bearing: a flex item defaults to `min-width: auto`, so the selector's longest
                label ("United Arab Emirates (+971)") would otherwise win the row and crush the
                input. The selector is given a fixed basis wide enough for name + code + indicator.
              -->
              <div class="flex flex-col gap-2 sm:flex-row">
                <label for="contact-dial-code" class="sr-only">{{ t('contact.form.countryCode') }}</label>
                <!--
                  `USelect`, not `USelectMenu`: both are non-native reka-ui primitives with the same
                  visual language, but SelectMenu also ships combobox/search machinery this field has
                  no use for, and it cost ~17 KB gz that the 250 KB route budget does not have.
                -->
                <USelect
                  id="contact-dial-code"
                  v-model="state.dialCode"
                  :items="dialOptions"
                  value-key="value"
                  size="lg"
                  :aria-label="t('contact.form.countryCode')"
                  class="w-full sm:w-[15rem] sm:shrink-0"
                />
                <UInput
                  id="contact-phone"
                  v-model="state.nationalNumber"
                  type="tel"
                  size="lg"
                  inputmode="tel"
                  autocomplete="tel"
                  dir="ltr"
                  class="w-full min-w-0 sm:flex-1"
                />
              </div>
            </UFormField>

            <!--
              The shared invariant's message, driven by a computed over current form values (F-6)
              rather than by UForm's name-keyed error array — so it clears the instant either method
              is filled and returns if both are emptied, with no stale state possible.
            -->
            <p
              v-if="showContactMethodError"
              id="contact-method-error"
              role="alert"
              class="text-body-sm text-error-700 dark:text-error"
            >
              {{ t('contact.errors.contactMethodRequired') }}
            </p>
          </div>

          <UFormField name="body" :label="t('contact.form.body')" required>
            <UTextarea id="contact-body" v-model="state.body" size="lg" :rows="5" autoresize :maxrows="12" autocomplete="off" :maxlength="CONTACT_LIMITS.body" class="w-full" />
          </UFormField>

          <!--
            Honeypot (D02-1). `sr-only` is clip-based with zero layout footprint — deliberately NOT
            `display:none`, which some autofill implementations skip and some bots detect.
            `aria-hidden` + `tabindex="-1"` keep it out of the accessibility tree and the tab order.
            Never trimmed: the API's emptiness test is length 0.
          -->
          <div aria-hidden="true" class="sr-only">
            <label for="contact-company-url">{{ t('contact.form.websiteLabel') }}</label>
            <input id="contact-company-url" v-model="companyUrl" name="company-url" type="text" tabindex="-1" autocomplete="off">
          </div>

          <UButton
            type="submit"
            size="lg"
            block
            :loading="pending"
            :disabled="pending"
            :label="pending ? t('contact.form.submitting') : t('contact.form.submit')"
          />
        </UForm>
        </template>
      </div>
    </div>
  </UContainer>
</template>
