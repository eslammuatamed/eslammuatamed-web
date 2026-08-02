<script setup lang="ts">
// The left column's direct-contact list (FR-PUB-053). A compact grouped list rather than the
// oversized standalone card the first revision shipped: these are the fallback paths beside the
// form, not a competing call to action.
//
// Every row is independently gated on ITS OWN setting. `contactPhone` and `whatsappPhone` are
// separate fields precisely because not every telephone number has WhatsApp (D10-16), so nothing
// here infers one from the other, and nothing is hard-coded — withdrawing a number is a data edit.
import type { SiteSettings } from '~/types/models'

const props = defineProps<{ settings: SiteSettings | null | undefined }>()

const { t, locale } = useI18n()

const email = computed(() => props.settings?.contactEmail ?? null)
const phone = computed(() => props.settings?.contactPhone ?? null)
const whatsapp = computed(() => props.settings?.whatsappPhone ?? null)

// The contract carries E.164; grouping is a rendering concern (D10-16). Formatting is applied ONLY
// when the number starts with a dialing code this app actually knows (D13-6's list), because E.164
// country codes are one to three digits and cannot be split by pattern alone — a greedy `\d{1,3}`
// reads `+201002785408` as country code `201`, not `20`, and prints a number that looks plausible
// and is wrong. Anything unrecognized renders in its canonical form rather than being guessed at.
// Formatted INDEPENDENTLY per field. `contactPhone` and `whatsappPhone` are separate settings and
// may legitimately differ, so deriving the WhatsApp row's display text from the call number would
// print one number while linking another — the exact inference D10-16 forbids.
const displayPhone = computed(() => (phone.value ? formatE164(phone.value) : null))
const displayWhatsapp = computed(() => (whatsapp.value ? formatE164(whatsapp.value) : null))

function formatE164(value: string): string {
  const code = DIAL_CODES.find(candidate => value.startsWith(candidate))
  if (!code) return value

  const rest = value.slice(code.length)
  if (!/^\d{7,12}$/.test(rest)) return value

  // 3-3-4 for a 10-digit national part (the Egyptian mobile shape), 3-3-rest otherwise.
  const groups = rest.length === 10 ? [3, 3, 4] : [3, 3]
  const parts: string[] = []
  let index = 0
  for (const size of groups) {
    parts.push(rest.slice(index, index + size))
    index += size
  }
  if (index < rest.length) parts.push(rest.slice(index))
  return `${code} ${parts.filter(Boolean).join(' ')}`
}

// wa.me takes the number WITHOUT the leading plus. The prefilled text is localized and URL-encoded;
// it lives in the locale files rather than here so it stays reviewable copy.
const whatsappUrl = computed(() => {
  if (!whatsapp.value) return null
  const digits = whatsapp.value.replace(/^\+/, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(t('contact.whatsappMessage'))}`
})

// Are the two numbers the same LINE, regardless of how each was written? Compared on the canonical
// E.164 form, so `+20 100 278 5408` and `+201002785408` are recognised as one number.
//
// The settings stay two independent fields (D10-16) — nothing here collapses the contract. This is
// purely a rendering decision: showing the same number twice under two headings reads like two ways
// to reach someone when it is one, so the two are merged into a single item carrying BOTH actions.
const sameLine = computed(() => {
  if (!phone.value || !whatsapp.value) return false
  const a = normalizePhone(OTHER_DIAL_CODE, phone.value)
  const b = normalizePhone(OTHER_DIAL_CODE, whatsapp.value)
  return a !== null && a === b
})

const availability = computed(() => props.settings?.availabilityStatus ?? null)

// `dir="ltr"` on the rendered numbers only: a phone number is a left-to-right sequence even inside
// an RTL paragraph, and without this the `+` lands on the wrong end on /ar.
const numberDir = computed(() => (locale.value === 'ar' ? 'ltr' : undefined))
</script>

<template>
  <section v-if="email || phone || whatsapp || availability" class="mt-10">
    <h2 class="text-body-sm font-medium uppercase tracking-wide text-muted">
      {{ t('contact.methods.heading') }}
    </h2>

    <ul class="mt-4 space-y-1">
      <li v-if="email">
        <UButton
          :to="`mailto:${email}`"
          :external="true"
          color="neutral"
          variant="ghost"
          icon="i-lucide-mail"
          class="w-full justify-start gap-3 px-3 py-2"
        >
          <span class="flex flex-col items-start text-start">
            <span class="text-body-sm text-muted">{{ t('contact.methods.email') }}</span>
            <span class="text-highlighted">{{ email }}</span>
          </span>
        </UButton>
      </li>

      <!--
        One line, two actions. The number is printed ONCE and each action is a separate, explicitly
        labelled control — the number itself is not a link, because a single tappable number would
        have to pick one of the two behaviours and silently drop the other. Labels are visible text
        rather than icon-only, so the choice is legible without relying on icon literacy.
      -->
      <li v-if="sameLine" class="px-3 py-2">
        <p class="text-body-sm text-muted">
          {{ t('contact.methods.combined') }}
        </p>
        <p :dir="numberDir" class="mt-0.5 text-highlighted">
          {{ displayPhone }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UButton
            :to="`tel:${phone}`"
            :external="true"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-phone"
            :label="t('contact.methods.call')"
            :aria-label="`${t('contact.methods.call')}: ${displayPhone}`"
          />
          <UButton
            v-if="whatsappUrl"
            :to="whatsappUrl"
            :external="true"
            target="_blank"
            rel="noopener"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-simple-icons-whatsapp"
            :label="t('contact.methods.whatsapp')"
            :aria-label="`${t('contact.methods.whatsapp')}: ${displayPhone}`"
          />
        </div>
      </li>

      <li v-if="phone && !sameLine">
        <UButton
          :to="`tel:${phone}`"
          :external="true"
          color="neutral"
          variant="ghost"
          icon="i-lucide-phone"
          class="w-full justify-start gap-3 px-3 py-2"
        >
          <span class="flex flex-col items-start text-start">
            <span class="text-body-sm text-muted">{{ t('contact.methods.phone') }}</span>
            <span :dir="numberDir" class="text-highlighted">{{ displayPhone }}</span>
          </span>
        </UButton>
      </li>

      <li v-if="whatsappUrl && !sameLine">
        <UButton
          :to="whatsappUrl"
          :external="true"
          target="_blank"
          rel="noopener"
          color="neutral"
          variant="ghost"
          icon="i-simple-icons-whatsapp"
          class="w-full justify-start gap-3 px-3 py-2"
        >
          <span class="flex flex-col items-start text-start">
            <span class="text-body-sm text-muted">{{ t('contact.methods.whatsapp') }}</span>
            <span :dir="numberDir" class="text-highlighted">{{ displayWhatsapp }}</span>
          </span>
        </UButton>
      </li>

    </ul>

    <!--
      The ONLY permitted availability source, rendered verbatim and only when the API supplies it.
      No response-time promise is invented when it is null.
    -->
    <p v-if="availability" class="mt-6 flex items-center gap-2 text-body-sm text-muted">
      <span class="size-2 rounded-full bg-primary" aria-hidden="true" />
      {{ availability }}
    </p>
  </section>
</template>
