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
// The Twitter pair is set here too, and for a sharper reason than on `/about`. It is NOT about an
// empty tag: `layouts/default.vue` already fills `twitter:title`/`twitter:description` from the CMS
// `defaultMetaTitle`/`defaultMetaDescription` (TIER 2), so this route shipped two DISAGREEING
// previews of one URL — `og:*` carrying the governed home title and hero description, `twitter:*`
// carrying the site-wide CMS defaults. Measured against the built server with a live backend.
//
// That matters more here than anywhere else, because the CMS `defaultMetaDescription` is the surface
// still carrying the SUPERSEDED positioning (positioning-strategy v2.0.0 §8's outstanding backlog):
// until the canonical dataset is corrected, the home page's Twitter card is where the retired
// wording actually reaches a public consumer. Tier 1 wins over tier 2, so stating the governed
// values here is what makes the page correct regardless of what the CMS holds. It does not replace
// fixing the CMS value; it stops this route from publishing whatever that value happens to be.
//
// The image pair is deliberately left to the floor — this page has no image of its own.
useSeoMeta({
  title: () => t('seo.home.titleFull'),
  description: () => t('seo.home.description'),
  ogTitle: () => t('seo.home.titleFull'),
  ogDescription: () => t('seo.home.description'),
  twitterTitle: () => t('seo.home.titleFull'),
  twitterDescription: () => t('seo.home.description')
})
</script>

<template>
  <!-- The home reads as one edition: a paper hero, an ink capability spread, the work index, the
       experience timeline, the writing list, endorsements, and a closing ink invitation. The surface
       alternates paper / ink / lift so hierarchy comes from ground changes and varied composition, not a
       flat stack. Every section is authored in logical properties, so the whole page mirrors in RTL. -->
  <div v-if="settings">
    <HomeNameplate :settings="settings" />

    <HomeCapabilities
      :skills="skills.data.value ?? null"
      :pending="skills.status.value === 'pending'"
      :error="Boolean(skills.error.value)"
      @retry="skills.refresh()"
    />

    <HomeSelectedWork
      :projects="projects.data.value ?? null"
      :pending="projects.status.value === 'pending'"
      :error="Boolean(projects.error.value)"
      @retry="projects.refresh()"
    />

    <HomeTimeline
      :experiences="experiences.data.value ?? null"
      :pending="experiences.status.value === 'pending'"
      :error="Boolean(experiences.error.value)"
      @retry="experiences.refresh()"
    />

    <HomeWriting
      :articles="articles.data.value ?? null"
      :pending="articles.status.value === 'pending'"
      :error="Boolean(articles.error.value)"
      @retry="articles.refresh()"
    />

    <HomeVoices
      :testimonials="testimonials.data.value ?? null"
      :pending="testimonials.status.value === 'pending'"
      :error="Boolean(testimonials.error.value)"
      @retry="testimonials.refresh()"
    />

    <HomeContact :settings="settings" />
  </div>

  <!-- Designed API-unavailable state (D13-1): the shell renders sensibly without the API. -->
  <section v-else-if="settingsError" class="py-[var(--space-section)]">
    <UContainer>
      <p class="kicker text-dimmed">{{ t('brand.role') }}</p>
      <h1 class="mt-4 font-display text-display text-highlighted">{{ t('home.hero.unavailableTitle') }}</h1>
      <p class="mt-4 max-w-md text-body-lg text-muted">{{ t('home.hero.unavailableBody') }}</p>
      <UButton class="mt-8" variant="subtle" color="neutral" @click="refreshSettings()">
        {{ t('common.retry') }}
      </UButton>
    </UContainer>
  </section>
</template>
