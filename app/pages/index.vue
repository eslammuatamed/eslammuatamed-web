<script setup lang="ts">
// Home page (F-P1) — the routing hub. `settings` is the single hard dependency: its failure shows the
// designed API-unavailable state (D13-1), because the page identity (hero) depends on it. Every other
// section is fetched in parallel via useHomeData and isolates its own error, so a dead endpoint degrades
// only its section without blanking the page (NFR-DEGRADE). Person + WebSite structured data (doc 22 §4)
// and the standalone home title (D22-4) are derived from the API data.
const { t } = useI18n()

const { data: settings, error: settingsError, refresh: refreshSettings } = await useSiteSettings()
const { projects, skills, experiences, articles, testimonials } = useHomeData()

// Static Page SEO override (FR-DSH-051 consumption) — awaited so SSR renders the FINAL head.
// The read is optional: a failure leaves `data` null and the resolver falls through (below).
const { data: homePageSeo } = await usePublicPageSeo('home')

useSiteSchema(settings, skills.data)

// Home is the title exception (D22-4): a standalone brand-first title with role, not the sitewide
// "%s — Eslam Muatamed" template — leading with the brand serves branded search (D22-1). This page
// keeps `titleTemplate: null`, and the Page SEO override (when authored) arrives VERBATIM through
// the resolver — no brand suffix is appended here for any tier.
useHead({ titleTemplate: null })

// Effective metadata: authored `home` override → Home's governed i18n copy → localized Settings
// defaults → committed floor (doc 22 §3 F-D4, resolved by utils/page-seo-metadata). One text pair
// feeds title + og + twitter; the social image overrides ONLY when Page SEO carries a descriptor
// the existing shareable-format helper accepts — otherwise the keys are not registered at all and
// the committed card in `app.vue` stays effective (an undefined-valued getter would DELETE it).
const siteConfig = useSiteConfig()
const effectiveHomeMeta = resolvePageSeoMetadata({
  pageSeo: homePageSeo.value,
  pageTitle: t('seo.home.titleFull'),
  pageDescription: t('seo.home.description'),
  settingsDefaultTitle: settings.value?.defaultMetaTitle ?? null,
  settingsDefaultDescription: settings.value?.defaultMetaDescription ?? null,
  fallbackTitle: t('seo.defaultTitle'),
  fallbackDescription: t('seo.siteDescription'),
  siteUrl: siteConfig.url
})

// The Twitter pair travels WITH the OG pair from the SAME effective values — one source, no
// disagreement between previews of one URL. (History: this route once shipped og:* describing the
// home while twitter:* carried the CMS defaults; see git history for the measured defect.)
const homeImage = effectiveHomeMeta.socialImageOverride
useSeoMeta({
  title: () => effectiveHomeMeta.title,
  description: () => effectiveHomeMeta.description,
  ogTitle: () => effectiveHomeMeta.title,
  ogDescription: () => effectiveHomeMeta.description,
  twitterTitle: () => effectiveHomeMeta.title,
  twitterDescription: () => effectiveHomeMeta.description,
  ...(homeImage
    ? {
        ogImage: () => homeImage.url,
        ogImageWidth: () => homeImage.width,
        ogImageHeight: () => homeImage.height,
        ogImageAlt: () => homeImage.alt,
        twitterImage: () => homeImage.url,
        twitterImageAlt: () => homeImage.alt
      }
    : {})
})
</script>

<template>
  <div v-if="settings">
    <!-- The home reads as one edition: a paper hero, an ink capability spread, the work index, the
         experience timeline, the writing list, endorsements, and a closing ink invitation. The surface
         alternates paper / ink / lift so hierarchy comes from ground changes and varied composition, not a
         flat stack. Every section is authored in logical properties, so the whole page mirrors in RTL. -->
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

  <section v-else-if="settingsError" class="py-[var(--space-section)]">
    <!-- Designed API-unavailable state (D13-1): the shell renders sensibly without the API. -->
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
