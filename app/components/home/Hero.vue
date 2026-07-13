<script setup lang="ts">
import type { AvailabilityStatus, SiteSettings } from '~/types/models'

// Hero (FR-PUB-010): name, role, availability, primary + secondary CTA. Name and role are
// API-localized content (D10-6), not translation keys. Availability communicates with a dot and
// text — never colour alone (doc 21 §5).
interface Props {
  settings: SiteSettings
}

defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const availabilityColor: Record<AvailabilityStatus, 'success' | 'primary' | 'neutral'> = {
  available: 'success',
  open: 'primary',
  unavailable: 'neutral'
}
</script>

<template>
  <section class="py-[var(--space-section)]">
    <UContainer>
      <UBadge
        :color="availabilityColor[settings.availability]"
        variant="subtle"
        size="lg"
        icon="i-lucide-circle"
      >
        {{ t(`availability.${settings.availability}`) }}
      </UBadge>

      <h1 class="mt-6 text-display text-highlighted">{{ settings.name }}</h1>
      <p class="mt-3 text-h2 text-muted">{{ settings.role }}</p>
      <p v-if="settings.headline" class="mt-6 max-w-2xl text-body-lg text-muted">
        {{ settings.headline }}
      </p>

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
