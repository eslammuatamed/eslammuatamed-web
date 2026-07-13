<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Hero (FR-PUB-010): site name, tagline, availability, primary + secondary CTA. Name and tagline are
// API-localized content (D10-6), not translation keys. The contract exposes `availabilityStatus` as
// free text (PublicSiteSettingsEntity), so it renders verbatim with a status dot in a neutral badge —
// it communicates with text + a dot, never colour alone (doc 21 §5).
interface Props {
  settings: SiteSettings
}

defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="py-[var(--space-section)]">
    <UContainer>
      <UBadge
        v-if="settings.availabilityStatus"
        color="neutral"
        variant="subtle"
        size="lg"
        icon="i-lucide-circle"
      >
        {{ settings.availabilityStatus }}
      </UBadge>

      <h1 class="mt-6 text-display text-highlighted">{{ settings.siteName }}</h1>
      <p v-if="settings.tagline" class="mt-3 text-h2 text-muted">{{ settings.tagline }}</p>

      <div class="mt-10 flex flex-wrap items-center gap-3">
        <UButton :to="localePath('/projects')" size="lg" trailing-icon="i-lucide-arrow-right">
          {{ t('home.hero.viewWork') }}
        </UButton>
        <UButton :to="localePath('/contact')" size="lg" color="neutral" variant="subtle">
          {{ t('home.hero.contact') }}
        </UButton>
      </div>
    </UContainer>
  </section>
</template>
