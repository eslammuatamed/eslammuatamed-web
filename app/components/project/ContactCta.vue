<script setup lang="ts">
// Closing call to action for a case study — the last step of the hiring-manager journey (F-P1 step 4).
//
// It is a DIRECT EMAIL action only (owner decision, 2026-07-27). `/contact` does not exist in this
// slice, and a link to a 404 is worse than no link: the conversion must never dead-end (D05-4 — the
// email path always works). A future Contact slice replaces the destination with the localized
// `/contact` route and keeps direct email as that page's fallback.
//
// The address is read from the API's profile links so the owner controls it in the CMS like every other
// piece of content. `CANONICAL_EMAIL` is the fallback for the case where settings are unreachable or
// carry no mail link — without it an API hiccup would silently remove the only conversion path on the
// page.
//
// THE FALLBACK MUST BE THE PUBLIC-WEBSITE ADDRESS. `owner-profile.md` §8 (approved 2026-07-29) gives
// `contact@eslammuatamed.com` that role explicitly, and marks `eslammuatemed@gmail.com` as the
// internal Contact-form notification destination — "Never rendered publicly". This constant held the
// Gmail, so every project page published it whenever settings were unavailable, against the profile's
// own rule. (The `mu**ate**med` spelling in the Gmail is intentional and not a typo — §8 R5 — which is
// exactly why it reads as a plausible address and survived review this long.)
const CANONICAL_EMAIL = 'mailto:contact@eslammuatamed.com'

const { t } = useI18n()
const { data: settings } = await useSiteSettings()

const mailto = computed(
  () => settings.value?.profileLinks.find(link => link.url.startsWith('mailto:'))?.url ?? CANONICAL_EMAIL
)
</script>

<template>
  <!-- COMPACT, not a landing-page banner. This was a full-bleed `UiSpread tone="ink"` carrying
       `text-h1` type, which put a second display-sized line on a page whose h1 is the project title —
       two competing headlines on one page, and a full section of vertical space spent on four words.
       It is now one bordered card on the page ground: same governed copy, same single conversion,
       a third of the height. (It also removes a real nesting defect — `UiSpread` renders its own
       `UContainer` inside the page's, so the CTA was double-padded.)
       A NAMED aside: the heading is what gives the complementary landmark its accessible name, and
       h2 keeps it directly under the page h1 with no skipped level. -->
  <aside
    aria-labelledby="project-contact-heading"
    class="rounded-card border border-default bg-elevated p-6 sm:p-8"
  >
    <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <div class="max-w-xl">
        <p class="kicker text-dimmed">{{ t('projects.contact.eyebrow') }}</p>
        <h2 id="project-contact-heading" class="mt-3 font-display text-h3 text-highlighted text-balance">
          {{ t('projects.contact.title') }}
        </h2>
        <p class="mt-2 text-body-sm text-muted text-pretty">{{ t('projects.contact.body') }}</p>
      </div>
      <UButton class="shrink-0" :to="mailto" :external="true">
        {{ t('projects.contact.action') }}
      </UButton>
    </div>
  </aside>
</template>
