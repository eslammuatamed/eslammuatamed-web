<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Hero (FR-PUB-010): name, role positioning, availability, primary + secondary CTA. Name and tagline
// are API-localized content (D10-6); both are nullable in the contract, so they fall back to the brand
// i18n strings rather than rendering empty. Availability renders text + a dot (never colour alone,
// doc 21 §5). This is the LCP surface — text only, no hero image, so first paint is instant (doc 20 §4).
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const name = computed(() => props.settings.siteName ?? t('brand.name'))
const tagline = computed(() => props.settings.tagline ?? t('brand.role'))
</script>

<template>
  <section class="py-[var(--space-section)]">
    <UContainer>
      <div class="max-w-3xl">
        <p
          v-if="settings.availabilityStatus"
          class="inline-flex items-center gap-2 rounded-full border border-default bg-elevated px-3 py-1 text-body-sm text-muted"
        >
          <span class="size-2 shrink-0 rounded-full bg-[var(--ui-primary)]" aria-hidden="true" />
          {{ settings.availabilityStatus }}
        </p>

        <h1 class="mt-6 text-display text-highlighted">{{ name }}</h1>
        <p class="mt-4 text-h2 text-muted">{{ tagline }}</p>

        <div class="mt-10 flex flex-wrap items-center gap-3">
          <UButton :to="localePath('/projects')" size="lg">
            <span>{{ t('home.hero.viewWork') }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-4 rtl:-scale-x-100" />
          </UButton>
          <UButton :to="localePath('/contact')" size="lg" color="neutral" variant="subtle">
            {{ t('home.hero.contact') }}
          </UButton>
        </div>
      </div>
    </UContainer>
  </section>
</template>
