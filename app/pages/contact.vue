<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { Envelope } from '~/types/models'

// Public Contact (FR-PUB-050/051/052/053, flow F-P3) — the platform's single conversion point, and
// the last mandatory public route to render. Five live components have linked here since 007
// (Header desktop + drawer, Footer, home Contact, home Nameplate); until this page existed they all
// 404'd.
//
// ## The two things most easily got wrong here
//
// 1. **The receipt is neutral.** The API returns an identical 2xx whether it persisted the message
//    or silently dropped it as spam (D02-1). This page therefore CANNOT know which happened and
//    must never claim the message reached an inbox — see the success copy.
// 2. **A fast human must not be discarded.** `elapsedMs` below `MIN_FILL_MS` is dropped-as-success
//    server-side. Rather than let a genuine quick submission vanish behind a success message, the
//    dispatch waits out the remainder and then reports the REAL elapsed time (owner decision).

const { t, locale } = useI18n()
const api = useApi()
const localePath = useLocalePath()

const { data: settings } = await useSiteSettings()

// ── copy-visible contract ─────────────────────────────────────────────────────────────────────
// The direct-email fallback has exactly ONE source (owner decision): `contactEmail`. Never
// `professionalEmail`, never the admin login address, never a value hard-coded here. When the
// setting is null the whole block is omitted rather than degraded — an absent address is a fact to
// respect, not a gap to fill.
const contactEmail = computed(() => settings.value?.contactEmail ?? null)

// The only permitted source of an availability note, rendered verbatim and only when non-null. The
// API localizes it per request (D10-12), so the Web never translates or paraphrases it, and never
// invents a response-time promise the owner has not made.
const availability = computed(() => settings.value?.availabilityStatus ?? null)

// ── validation ────────────────────────────────────────────────────────────────────────────────
// Mirrors CreateContactMessageDto exactly, including D10-15's trim-before-validate: `.trim()` runs
// before `.min(1)`, so a whitespace-only field fails here for the same reason and with the same
// meaning it would fail server-side. A visitor cannot tell which layer rejected them (doc 13 §4).
const schema = z.object({
  name: z.string().trim().min(1, t('contact.errors.nameRequired')).max(CONTACT_LIMITS.name, t('contact.errors.nameTooLong')),
  email: z.string().trim().min(1, t('contact.errors.emailRequired')).max(CONTACT_LIMITS.email, t('contact.errors.emailTooLong')).pipe(z.email(t('contact.errors.emailInvalid'))),
  subject: z.string().trim().min(1, t('contact.errors.subjectRequired')).max(CONTACT_LIMITS.subject, t('contact.errors.subjectTooLong')),
  body: z.string().trim().min(1, t('contact.errors.bodyRequired')).max(CONTACT_LIMITS.body, t('contact.errors.bodyTooLong'))
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ name: undefined, email: undefined, subject: undefined, body: undefined })

// The honeypot lives OUTSIDE `state` and outside the schema. Its DOM field name is deliberately not
// `website` (a bot scraping the markup for that name finds nothing); the value is mapped onto the
// contract's `website` key only when the request body is assembled, below.
const companyUrl = ref('')

const form = useTemplateRef('form')
const status = useTemplateRef<HTMLElement>('status')
const pending = ref(false)

type Outcome = 'success' | 'validation' | 'rateLimit' | 'server' | 'network'
const outcome = ref<Outcome | null>(null)
const retryAfterLabel = ref<string | null>(null)

// ── time trap ─────────────────────────────────────────────────────────────────────────────────
// `performance.now()`, not `Date.now()`: it is monotonic, so a clock adjustment or NTP step during
// a slow fill cannot corrupt the measurement and turn a genuine visitor into a "bot".
const filledFrom = ref(0)
function resetTimingOrigin(): void {
  filledFrom.value = performance.now()
}
onMounted(resetTimingOrigin)

// A re-checking wait, never a single trusted `setTimeout`. A backgrounded or throttled tab defers
// timers, so a one-shot sleep can return early relative to the clock we actually report; looping
// until the measured elapsed time truly clears the threshold is what keeps `elapsedMs` honest.
async function waitOutFillTrap(): Promise<void> {
  for (;;) {
    const remaining = remainingFillWaitMs(performance.now() - filledFrom.value)
    if (remaining <= 0) return
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
}

// ── locale switching ──────────────────────────────────────────────────────────────────────────
// Explicit, because it is not free: under `prefix_except_default`, `/contact` → `/ar/contact` is a
// route change rather than a component remount, so without this the visitor's half-written message
// would survive the switch. Clearing it keeps contact PII out of any cross-locale carry-over, and
// resetting the timing origin keeps the trap measuring the form the visitor is actually looking at.
watch(locale, () => {
  state.name = undefined
  state.email = undefined
  state.subject = undefined
  state.body = undefined
  companyUrl.value = ''
  outcome.value = null
  retryAfterLabel.value = null
  form.value?.clear()
  resetTimingOrigin()
})

function resetAfterSuccess(): void {
  state.name = undefined
  state.email = undefined
  state.subject = undefined
  state.body = undefined
  companyUrl.value = ''
  form.value?.clear()
  resetTimingOrigin()
}

async function announce(): Promise<void> {
  await nextTick()
  status.value?.focus()
}

async function onSubmit(event: FormSubmitEvent<Schema>): Promise<void> {
  // The single double-submit guard. It covers the anti-spam wait AND the network request, so the
  // window in which a second submission could start is closed for the whole operation, not just
  // the fetch.
  if (pending.value) return
  pending.value = true
  outcome.value = null
  retryAfterLabel.value = null

  try {
    await waitOutFillTrap()
    // Measured AFTER the wait: the value sent is what the clock says, not a number chosen to clear
    // the threshold. A genuine 8.2 s fill reports 8200; a fast one reports whatever it really took.
    const elapsedMs = toElapsedMs(performance.now() - filledFrom.value)

    await api<Envelope<{ received: boolean }>>('/contact', {
      method: 'POST',
      body: {
        // Trimmed here as well as in the schema: the schema validates a trimmed value but leaves
        // `state` as the visitor typed it, and the payload must carry what was validated.
        name: event.data.name,
        email: event.data.email,
        subject: event.data.subject,
        body: event.data.body,
        website: companyUrl.value,
        elapsedMs
      }
    })

    // Deliberately not "your message reached my inbox": the receipt is identical for a stored
    // message and a silently dropped one, so any stronger claim would be unverifiable.
    outcome.value = 'success'
    resetAfterSuccess()
  }
  catch (error) {
    const apiError = toApiError(error)
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      // Server field errors land on the same inputs as client ones (doc 13 §4).
      const errors: FormError[] = apiError.fieldErrors.map(item => ({ name: item.field, message: item.message }))
      form.value?.setErrors(errors)
      outcome.value = 'validation'
    }
    else if (apiError.status === 429) {
      // Readable only because `Retry-After` is CORS-exposed (D10-15). A missing or malformed value
      // yields null and the static message — the copy never states a duration it did not measure.
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
  await announce()
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

// `WebPage` + `BreadcrumbList` only. doc 22 §4's governed type table has no ContactPage entry, so
// inventing one would be an ungoverned schema decision; and no second `Person` is emitted — the
// site-wide identity node already exists (D22-8).
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
// belong to @nuxtjs/i18n under strict SEO (D22-7) — a second writer is how finding F-3 happened.
// No `ogImage`: the repository still has no branded social-image fallback (finding F-1).
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

    <header class="mt-10 max-w-2xl">
      <h1 class="text-h1 text-highlighted">
        {{ t('contact.title') }}
      </h1>
      <p class="mt-4 text-body-lg text-muted">
        {{ t('contact.description') }}
      </p>
    </header>

    <!--
      Rendered BEFORE the form and outside every submission state, so the conversion survives an API
      outage (FR-PUB-053): whatever happens to the request, the address is already on the page.
      Omitted entirely when the setting is null — there is no substitute source.
    -->
    <section v-if="contactEmail" class="mt-10 max-w-2xl rounded-lg border border-default p-6">
      <h2 class="text-h3 text-highlighted">
        {{ t('contact.fallback.heading') }}
      </h2>
      <p class="mt-2 text-muted">
        {{ t('contact.fallback.body') }}
      </p>
      <UButton
        class="mt-4"
        variant="subtle"
        icon="i-lucide-mail"
        :to="`mailto:${contactEmail}`"
        :label="t('contact.fallback.action')"
        :aria-label="`${t('contact.fallback.action')}: ${contactEmail}`"
      />
    </section>

    <section class="mt-12 max-w-2xl">
      <h2 class="text-h2 text-highlighted">
        {{ t('contact.form.legend') }}
      </h2>
      <p class="mt-2 text-body-sm text-muted">
        {{ t('contact.form.requiredHint') }}
      </p>

      <!--
        One status region owns every outcome. `tabindex="-1"` lets us move focus here after a
        submission so a keyboard or screen-reader user is told what happened rather than being left
        on a button whose label just changed back (doc 21 §5).
      -->
      <div
        v-if="outcome"
        ref="status"
        tabindex="-1"
        role="status"
        aria-live="polite"
        :aria-label="t('contact.a11y.statusLabel')"
        class="mt-6 outline-none"
      >
        <UAlert
          :color="outcome === 'success' ? 'success' : 'error'"
          variant="subtle"
          :icon="outcome === 'success' ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
          :title="outcomeTitle ?? ''"
          :description="outcomeBody ?? ''"
        />
        <!--
          Only source of an availability note, verbatim, and only when the API supplies one. No
          response-time promise is invented when it is null.
        -->
        <p v-if="outcome === 'success' && availability" class="mt-3 text-body-sm text-muted">
          {{ availability }}
        </p>
      </div>

      <UForm
        ref="form"
        :schema="schema"
        :state="state"
        :aria-label="t('contact.a11y.formLabel')"
        class="mt-6 space-y-5"
        @submit="onSubmit"
      >
        <UFormField name="name" :label="t('contact.form.name')" required>
          <UInput v-model="state.name" autocomplete="name" :maxlength="CONTACT_LIMITS.name" class="w-full" />
        </UFormField>

        <UFormField name="email" :label="t('contact.form.email')" required>
          <UInput v-model="state.email" type="email" autocomplete="email" :maxlength="CONTACT_LIMITS.email" class="w-full" />
        </UFormField>

        <UFormField name="subject" :label="t('contact.form.subject')" required>
          <UInput v-model="state.subject" autocomplete="off" :maxlength="CONTACT_LIMITS.subject" class="w-full" />
        </UFormField>

        <UFormField name="body" :label="t('contact.form.body')" required>
          <UTextarea v-model="state.body" :rows="8" autocomplete="off" :maxlength="CONTACT_LIMITS.body" class="w-full" />
        </UFormField>

        <!--
          Honeypot (D02-1). `sr-only` is clip-based with zero layout footprint — deliberately NOT
          `display:none`, which some autofill implementations skip and some bots specifically detect.
          The utility normally EXPOSES content to assistive technology; `aria-hidden` on the wrapper
          plus `tabindex="-1"` is what takes it back out of the accessibility tree and the tab order,
          while the label keeps the input well-formed markup. Never trimmed: the API's emptiness test
          is length 0, so whitespace here is a bot signal that must survive to the server.
        -->
        <div aria-hidden="true" class="sr-only">
          <label for="contact-company-url">{{ t('contact.form.websiteLabel') }}</label>
          <input
            id="contact-company-url"
            v-model="companyUrl"
            name="company-url"
            type="text"
            tabindex="-1"
            autocomplete="off"
          >
        </div>

        <UButton
          type="submit"
          size="lg"
          :loading="pending"
          :disabled="pending"
          :label="pending ? t('contact.form.submitting') : t('contact.form.submit')"
        />
      </UForm>
    </section>
  </UContainer>
</template>
