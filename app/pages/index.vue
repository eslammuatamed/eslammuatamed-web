<script setup lang="ts">
import type { Envelope, SiteSettings } from '~/types/models'

// Home hero fed by GET /settings/site (FR-PUB-010). Keyed by locale so each locale render caches
// distinctly (D10-6); a locale switch is a route change that remounts this page with a fresh key.
const { t, locale } = useI18n()
const api = useApi()

const { data: settings, error, refresh } = await useAsyncData(
  `settings:site:${locale.value}`,
  () => api<Envelope<SiteSettings>>('/settings/site').then(res => res.data)
)

useSeoMeta({
  title: () => t('seo.home.title'),
  description: () => t('seo.home.description'),
  ogTitle: () => `${t('seo.home.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.home.description')
})
</script>

<template>
  <HomeHero v-if="settings" :settings="settings" />

  <!-- Designed API-unavailable state (D13-1): the shell renders sensibly without the API. -->
  <section v-else-if="error" class="py-[var(--space-section)]">
    <UContainer>
      <h1 class="text-h1 text-highlighted">{{ t('home.hero.unavailableTitle') }}</h1>
      <p class="mt-3 max-w-md text-muted">{{ t('home.hero.unavailableBody') }}</p>
      <UButton class="mt-6" variant="subtle" color="neutral" @click="refresh()">
        {{ t('common.retry') }}
      </UButton>
    </UContainer>
  </section>
</template>
