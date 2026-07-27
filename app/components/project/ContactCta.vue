<script setup lang="ts">
// Closing call to action for a case study — the last step of the hiring-manager journey (F-P1 step 4).
//
// It is a DIRECT EMAIL action only (owner decision, 2026-07-27). `/contact` does not exist in this
// slice, and a link to a 404 is worse than no link: the conversion must never dead-end (D05-4 — the
// email path always works). A future Contact slice replaces the destination with the localized
// `/contact` route and keeps direct email as that page's fallback.
//
// The address is read from the API's profile links so the owner controls it in the CMS like every other
// piece of content. `CANONICAL_EMAIL` is the owner-supplied fallback for the case where settings are
// unreachable or carry no mail link — without it an API hiccup would silently remove the only
// conversion path on the page.
const CANONICAL_EMAIL = 'mailto:eslammuatemed@gmail.com'

const { t } = useI18n()
const { data: settings } = await useSiteSettings()

const mailto = computed(
  () => settings.value?.profileLinks.find(link => link.url.startsWith('mailto:'))?.url ?? CANONICAL_EMAIL
)
</script>

<template>
  <UiSpread tone="ink" as="aside">
    <div class="max-w-2xl">
      <!-- text-link, not text-primary: violet does not clear AA on the ink surface. 007's
           acceptance pass made exactly this correction for the Home ink eyebrows. -->
      <p class="kicker text-link">{{ t('projects.contact.eyebrow') }}</p>
      <p class="mt-4 font-display text-h1 text-highlighted text-balance">
        {{ t('projects.contact.title') }}
      </p>
      <p class="mt-5 text-body-lg text-muted text-pretty">{{ t('projects.contact.body') }}</p>
      <UButton class="mt-8" size="lg" :to="mailto" :external="true">
        {{ t('projects.contact.action') }}
      </UButton>
    </div>
  </UiSpread>
</template>
