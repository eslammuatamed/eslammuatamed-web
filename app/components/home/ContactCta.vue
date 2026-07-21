<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Contact section (FR-PUB-017): a link to the contact form plus a direct-email fallback that survives
// an API outage (D05-4). The email is data-driven — the `mailto:` profile link from settings — so no
// address is hardcoded; when none is configured, only the form link shows. The form page ships in the
// follow-on public-pages feature (may 404 until then); the email path always works.
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t, locale } = useI18n()
const localePath = useLocalePath()

// Tracked small-caps read as a technical label in Latin; disabled for Arabic (letter-spacing breaks
// connected script — doc 03 §3), matching UiDatumLabel.
const eyebrowClass = computed(() =>
  locale.value === 'ar' ? 'font-medium' : 'font-medium uppercase tracking-[0.16em]'
)

const emailLink = computed(
  () => props.settings.profileLinks.find(link => link.url.startsWith('mailto:')) ?? null
)
</script>

<template>
  <UiSection>
    <!-- Closing plate: a bordered panel with the mark echo — the page ends on a deliberate invitation,
         not another flat block. Depth from border + surface step (D03-3), no shadow. -->
    <div class="relative overflow-hidden rounded-card border border-default bg-elevated p-8 sm:p-12">
      <UiBrandMark
        :size="160"
        class="pointer-events-none absolute -bottom-8 -end-6 text-default opacity-[0.06]"
        aria-hidden="true"
      />
      <div class="relative max-w-2xl">
        <p class="text-caption text-muted" :class="eyebrowClass">
          {{ t('home.contact.eyebrow') }}
        </p>
        <h2 class="mt-2 text-h2 text-highlighted text-balance">{{ t('home.contact.title') }}</h2>
        <p class="mt-4 text-body-lg text-muted">{{ t('home.contact.body') }}</p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UButton :to="localePath('/contact')" size="lg">{{ t('home.contact.form') }}</UButton>
          <UButton
            v-if="emailLink"
            :to="emailLink.url"
            size="lg"
            color="neutral"
            variant="subtle"
          >
            {{ emailLink.label }}
          </UButton>
        </div>
      </div>
    </div>
  </UiSection>
</template>
