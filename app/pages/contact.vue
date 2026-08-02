<script setup lang="ts">
import * as z from 'zod'
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
const schema = z.object({
  name: z.string().trim().min(1, t('contact.errors.nameRequired')).max(CONTACT_LIMITS.name, t('contact.errors.nameTooLong')),
  email: z.string().trim().max(CONTACT_LIMITS.email, t('contact.errors.emailTooLong')).optional(),
  dialCode: z.string(),
  nationalNumber: z.string().optional(),
  subject: z.string().trim().min(1, t('contact.errors.subjectRequired')).max(CONTACT_LIMITS.subject, t('contact.errors.subjectTooLong')),
  body: z.string().trim().min(1, t('contact.errors.bodyRequired')).max(CONTACT_LIMITS.body, t('contact.errors.bodyTooLong'))
}).superRefine((value, ctx) => {
  const emailGiven = (value.email ?? '').trim() !== ''
  const phoneGiven = (value.nationalNumber ?? '').trim() !== ''

  if (emailGiven && !z.email().safeParse((value.email ?? '').trim()).success) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: t('contact.errors.emailInvalid') })
  }

  if (phoneGiven) {
    const composed = composeE164(value.dialCode as DialCode, value.nationalNumber ?? '')
    if (composed === null || !isPlausibleE164(composed)) {
      ctx.addIssue({ code: 'custom', path: ['nationalNumber'], message: t('contact.errors.phoneInvalid') })
    }
  }

  // The pair rule. Reported on `email` so a blank form yields one clear error against the first
  // field of the pair rather than two competing ones — matching where the API reports it.
  if (!emailGiven && !phoneGiven) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: t('contact.errors.contactMethodRequired') })
  }
})
type Schema = z.output<typeof schema>

// Initialized to EMPTY STRINGS, not `undefined`, and that matters for the error copy: with
// `undefined`, `z.string()` fails on the TYPE before `.min(1, …)` is ever reached, so every blank
// required field rendered zod's generic "Invalid input" instead of the authored message. An empty
// string reaches the length check and produces the real localized text.
const emptyForm = (): Schema => ({
  name: '',
  email: '',
  dialCode: DIAL_CODES[0],
  nationalNumber: '',
  subject: '',
  body: ''
})

const state = reactive<Schema>(emptyForm())

// The honeypot lives outside `state` and outside the schema. Its DOM name is deliberately not
// `website`; the value maps onto the contract key only when the request body is assembled.
const companyUrl = ref('')

const form = useTemplateRef('form')
const statusRegion = useTemplateRef<HTMLElement>('statusRegion')
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

async function onSubmit(event: FormSubmitEvent<Schema>): Promise<void> {
  // One guard covering the anti-spam wait AND the network request.
  if (pending.value) return
  pending.value = true
  outcome.value = null
  retryAfterLabel.value = null

  try {
    await waitOutFillTrap()
    // Measured AFTER the wait: what the clock says, not a number chosen to clear the threshold.
    const elapsedMs = toElapsedMs(performance.now() - filledFrom.value)

    const email = (event.data.email ?? '').trim()
    const phone = composeE164(event.data.dialCode as DialCode, event.data.nationalNumber ?? '')

    await api<Envelope<{ received: boolean }>>('/contact', {
      method: 'POST',
      body: {
        name: event.data.name,
        // Omitted rather than sent empty: the API distinguishes "not supplied" from "supplied and
        // blank", and sending `''` would turn a phone-only submission into a malformed-email 422.
        ...(email === '' ? {} : { email }),
        ...(phone === null ? {} : { phone }),
        subject: event.data.subject,
        body: event.data.body,
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
  await nextTick()
  statusRegion.value?.focus()
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
            :color="outcome === 'success' ? 'success' : 'error'"
            variant="subtle"
            :icon="outcome === 'success' ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
            :title="outcomeTitle ?? ''"
            :description="outcomeBody ?? ''"
          />
        </div>

        <p class="text-body-sm text-muted">
          {{ t('contact.form.requiredHint') }}
        </p>

        <UForm
          ref="form"
          :schema="schema"
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
            <UInput id="contact-name" v-model="state.name" autocomplete="name" :maxlength="CONTACT_LIMITS.name" class="w-full" />
          </UFormField>

          <UFormField name="subject" :label="t('contact.form.subject')" required>
            <UInput id="contact-subject" v-model="state.subject" autocomplete="off" :maxlength="CONTACT_LIMITS.subject" class="w-full" />
          </UFormField>

          <!--
            The email/phone pair, grouped under one hint so the at-least-one rule is stated before
            the visitor can trip it rather than only afterwards as an error.
          -->
          <!--
            `aria-labelledby` on a plain <p> rather than a <legend>: the hint is a full sentence and
            wraps to two lines at narrow widths, where a legend renders THROUGH the fieldset's top
            border. The grouping semantics are preserved without the rendering artefact.
          -->
          <fieldset
            class="space-y-4 rounded-lg border border-default/60 p-4"
            aria-labelledby="contact-method-hint"
          >
            <p id="contact-method-hint" class="text-body-sm text-muted">
              {{ t('contact.form.contactMethodHint') }}
            </p>

            <UFormField name="email" :label="t('contact.form.email')">
              <UInput id="contact-email" v-model="state.email" type="email" autocomplete="email" :maxlength="CONTACT_LIMITS.email" class="w-full" />
            </UFormField>

            <UFormField name="nationalNumber" :label="t('contact.form.phone')">
              <!--
                `min-w-0` on the number wrapper is load-bearing: a flex item defaults to
                `min-width: auto`, so the select's long option text ("United Arab Emirates (+971)")
                won out at 390px and squeezed the input to a few pixels. The select is also capped
                so it can never take more than half the row.
              -->
              <div class="flex flex-wrap gap-2 sm:flex-nowrap">
                <!--
                  A native select over eight options (D13-6): an international-phone-input component
                  plus its country metadata is an order of magnitude larger than this route's
                  remaining budget headroom. It carries its own label because a control the visitor
                  must operate is not adequately described by the number field's label.
                -->
                <label for="contact-dial-code" class="sr-only">{{ t('contact.form.countryCode') }}</label>
                <select
                  id="contact-dial-code"
                  v-model="state.dialCode"
                  class="w-full shrink-0 rounded-md border-0 bg-default px-2.5 py-1.5 text-base/5 text-highlighted ring ring-inset ring-accented focus-visible:outline-3 focus-visible:outline-primary/25 sm:w-auto sm:max-w-[50%] md:text-sm"
                >
                  <option v-for="option in dialOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <UInput
                  id="contact-phone"
                  v-model="state.nationalNumber"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  :dir="isOtherCountry ? 'ltr' : undefined"
                  class="w-full min-w-0 flex-1"
                />
              </div>
            </UFormField>
          </fieldset>

          <UFormField name="body" :label="t('contact.form.body')" required>
            <UTextarea id="contact-body" v-model="state.body" :rows="6" autocomplete="off" :maxlength="CONTACT_LIMITS.body" class="w-full" />
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
      </div>
    </div>
  </UContainer>
</template>
