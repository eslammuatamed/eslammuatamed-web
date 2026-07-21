<script setup lang="ts">
// Home page (F-P1) — the routing hub. `settings` is the single hard dependency: its failure shows the
// designed API-unavailable state (D13-1), because the page identity (hero) depends on it. Every other
// section is fetched in parallel via useHomeData and isolates its own error, so a dead endpoint degrades
// only its section without blanking the page (NFR-DEGRADE). Person + WebSite structured data (doc 22 §4)
// and the standalone home title (D22-4) are derived from the API data.
const { t } = useI18n()

const { data: settings, error: settingsError, refresh: refreshSettings } = await useSiteSettings()
const { projects, skills, experiences, articles, testimonials } = useHomeData()

useSiteSchema(settings, skills.data)

// Home is the title exception (D22-4): a standalone brand-first title with role, not the sitewide
// "%s — Eslam Muatamed" template — leading with the brand serves branded search (D22-1).
useHead({ titleTemplate: null })
useSeoMeta({
  title: () => t('seo.home.titleFull'),
  description: () => t('seo.home.description'),
  ogTitle: () => t('seo.home.titleFull'),
  ogDescription: () => t('seo.home.description')
})
</script>

<template>
  <div v-if="settings">
    <HomeHero :settings="settings" />

    <HomeTechStack
      :skills="skills.data.value ?? null"
      :pending="skills.status.value === 'pending'"
      :error="Boolean(skills.error.value)"
      @retry="skills.refresh()"
    />

    <HomeFeaturedProjects
      :projects="projects.data.value ?? null"
      :pending="projects.status.value === 'pending'"
      :error="Boolean(projects.error.value)"
      @retry="projects.refresh()"
    />

    <HomeExperienceSummary
      :experiences="experiences.data.value ?? null"
      :pending="experiences.status.value === 'pending'"
      :error="Boolean(experiences.error.value)"
      @retry="experiences.refresh()"
    />

    <HomeLatestArticles
      :articles="articles.data.value ?? null"
      :pending="articles.status.value === 'pending'"
      :error="Boolean(articles.error.value)"
      @retry="articles.refresh()"
    />

    <HomeTestimonials
      :testimonials="testimonials.data.value ?? null"
      :pending="testimonials.status.value === 'pending'"
      :error="Boolean(testimonials.error.value)"
      @retry="testimonials.refresh()"
    />

    <HomeContactCta :settings="settings" />
  </div>

  <!-- Designed API-unavailable state (D13-1): the shell renders sensibly without the API. -->
  <section v-else-if="settingsError" class="py-[var(--space-section)]">
    <UContainer>
      <UiBrandMark :size="40" class="text-muted" />
      <h1 class="mt-6 text-h1 text-highlighted">{{ t('home.hero.unavailableTitle') }}</h1>
      <p class="mt-3 max-w-md text-muted">{{ t('home.hero.unavailableBody') }}</p>
      <UButton class="mt-6" variant="subtle" color="neutral" @click="refreshSettings()">
        {{ t('common.retry') }}
      </UButton>
    </UContainer>
  </section>
</template>
