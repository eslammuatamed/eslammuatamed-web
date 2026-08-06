<script setup lang="ts">
// About (FR-PUB-020) — the primary ProfilePage route (D22-8).
//
// The page shell mirrors `/experience` and `/projects` — breadcrumbs, kicker + h1 + description, then
// a `UiRequestState` around the body — so About reads as the same product rather than a third
// template (doc 13).
//
// ## Publication readiness
//
// The approved Profile contract gates publication on complete localized About content AND a real
// portrait carrying localized alt text (D18-7: "A green API suite with portraitAssetId = null proves
// the contract, not the page"). The portrait has not been uploaded, so the live response is
// `portrait: null` and this route renders its READINESS state rather than the published page.
//
// That state is deliberate, not a placeholder: it keeps the route valid and localized, says plainly
// that the profile page is still being completed, and preserves navigation — but it does NOT render
// the governed About prose behind a notice, because doing so would publish an incomplete About page
// while claiming it is unfinished. The full layout below is proven by the populated scenario, and
// switches on automatically the moment the API serves a portrait with localized alt. Nothing here
// invents a portrait, and no technical concept (`portraitAssetId`) reaches the copy.
const { t } = useI18n()

const { data, status, error, refresh } = await useAboutContent()

// The locale the CONTENT was fetched in (D06-6) — deliberately not the reactive UI locale. It keys
// the Markdown render cache below, and the two must agree: during the D03-13 deferred locale commit
// the UI locale still holds the outgoing language, so keying on it would file the incoming locale's
// rendered HTML under the outgoing locale's key and serve it back on the next visit.
const contentLocale = useRouteLocale()

// Initial load (skeleton) vs a refetch with content already on screen (branded overlay):
// `useAsyncData` keeps the previous `data` while refetching (doc 13 §9.1).
const hasData = computed(() => !!data.value)
const initialPending = computed(() => status.value === 'pending' && !hasData.value)
const refreshing = computed(() => status.value === 'pending' && hasData.value)

const readiness = computed(() => (data.value ? resolveAboutReadiness(data.value) : null))
const isPublished = computed(() => readiness.value !== null && isAboutPublishable(readiness.value))

// One readiness notice, one localized reason. `content-missing` is the defensive branch for nullable
// contract fields — it states that the section is not published rather than inventing copy for it.
const readinessBody = computed(() => {
  switch (readiness.value) {
    case 'content-missing':
      return t('about.readiness.contentBody')
    case 'portrait-alt-missing':
      return t('about.readiness.portraitBody')
    default:
      return t('about.readiness.portraitBody')
  }
})

// A visible trail the BreadcrumbList mirrors — structured data that is not also on the page is a
// penalty, not a signal (doc 22 §4).
const crumbs = computed(() => [{ label: t('nav.home'), to: '/' }, { label: t('nav.about') }])

const localePath = useLocalePath()

useAboutSchema(data, crumbs)

// Title, description and OG title/description only. Canonical, hreflang/x-default, og:locale, og:url
// and <html lang/dir> are owned by @nuxtjs/i18n under strict SEO (D22-7) — writing them here would
// duplicate the tags and fight the global owner, which is how finding F-3 happened.
// No `ogImage` HERE, but the page is no longer imageless: web-013 CLOSED finding F-1 by committing
// a branded 1200×630 PNG that `app.vue` emits as the site-wide floor, so this route inherits one
// absolute, resolvable image. This page still sets none of its own — the portrait is NOT substituted
// for one, because it is unpublished and emitting a URL that does not resolve is worse than
// inheriting the branded card.
// The Twitter pair is set ALONGSIDE the OG pair, not left to the lower tiers. Omitting it here never
// produced an EMPTY tag — it produced a WRONG one, because the pair is always filled from below:
// `layouts/default.vue` supplies the CMS `defaultMetaTitle`/`defaultMetaDescription` (tier 2) and
// `app.vue` the committed defaults (tier 3). So `/about` shipped two DISAGREEING previews of one
// URL: `og:*` describing About, `twitter:*` describing the site. Measured against the built server in
// both states, not assumed. `/resume` already set both for this reason, and `/` now does too — see
// the sharper case documented there. The image pair still comes from the floor: this page has none.
useSeoMeta({
  title: () => t('seo.about.title'),
  description: () => t('seo.about.description'),
  ogTitle: () => `${t('seo.about.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.about.description'),
  twitterTitle: () => `${t('seo.about.title')} — ${t('brand.name')}`,
  twitterDescription: () => t('seo.about.description')
})
</script>

<template>
  <UContainer class="py-[var(--space-section)]">
    <UiBreadcrumbs :items="crumbs" :label="t('about.breadcrumbLabel')" />

    <header class="mt-10 max-w-2xl">
      <p class="kicker text-dimmed">{{ t('nav.about') }}</p>
      <h1 class="mt-4 font-display text-display text-highlighted text-balance">
        {{ t('about.title') }}
      </h1>
      <p class="mt-5 text-body-lg text-muted text-pretty">{{ t('about.description') }}</p>
    </header>

    <UiRequestState
      class="mt-14 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="Boolean(error)"
      skeleton="rows"
      :count="3"
      @retry="refresh()"
    >
      <template #error>
        <div class="rounded-card border border-default bg-elevated p-8" role="alert">
          <p class="font-display text-h3 text-highlighted">{{ t('about.errorTitle') }}</p>
          <p class="mt-2 text-muted">{{ t('about.errorBody') }}</p>
          <UButton class="mt-4" variant="subtle" color="neutral" @click="refresh()">
            {{ t('common.retry') }}
          </UButton>
        </div>
      </template>

      <!-- READINESS STATE — the live behaviour until the portrait is uploaded. Not an error: no
           `role="alert"`, no retry, no technical vocabulary. Navigation is preserved so the route is
           a useful destination rather than a dead end, and Contact is absent because that route does
           not exist yet (same rule the Experience empty state follows). -->
      <div v-if="!isPublished" class="max-w-2xl rounded-card border border-default bg-elevated p-8">
        <p class="font-display text-h3 text-highlighted">{{ t('about.readiness.title') }}</p>
        <p class="mt-2 text-pretty text-muted">{{ readinessBody }}</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <UButton variant="subtle" color="neutral" :to="localePath('/experience')">
            {{ t('about.readiness.experienceAction') }}
          </UButton>
          <UButton variant="ghost" color="neutral" :to="localePath('/projects')">
            {{ t('about.readiness.projectsAction') }}
          </UButton>
        </div>
      </div>

      <!-- PUBLISHED PAGE — renders only when the contract carries complete prose and a portrait with
           localized alt. Section order is fixed by FR-PUB-020: bio, philosophy, current focus. -->
      <div v-else-if="data" class="grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div class="max-w-2xl">
          <!-- h2 throughout: these sit directly under the page h1 with no intervening heading, so
               starting at h3 would skip a level (WCAG heading order). -->
          <section aria-labelledby="about-bio-heading">
            <h2 id="about-bio-heading" class="font-display text-h2 text-highlighted">
              {{ t('about.bioHeading') }}
            </h2>
            <ContentProse
              v-if="data.aboutBio"
              class="mt-6"
              :source="data.aboutBio"
              :cache-key="`about:bio:${contentLocale}`"
            />
          </section>

          <section class="mt-14" aria-labelledby="about-philosophy-heading">
            <h2 id="about-philosophy-heading" class="font-display text-h2 text-highlighted">
              {{ t('about.philosophyHeading') }}
            </h2>
            <ContentProse
              v-if="data.engineeringPhilosophy"
              class="mt-6"
              :source="data.engineeringPhilosophy"
              :cache-key="`about:philosophy:${contentLocale}`"
            />
          </section>

          <!-- currentFocus is PLAIN TEXT in the contract, not Markdown: rendered as a paragraph, never
               through the Markdown pipeline, so a stray character in it can never become markup. -->
          <section class="mt-14" aria-labelledby="about-focus-heading">
            <h2 id="about-focus-heading" class="font-display text-h2 text-highlighted">
              {{ t('about.focusHeading') }}
            </h2>
            <p class="mt-6 text-body-lg text-pretty text-muted">{{ data.currentFocus }}</p>
          </section>

          <nav class="mt-14 flex flex-wrap gap-3" :aria-label="t('about.moreLabel')">
            <UButton variant="subtle" color="neutral" :to="localePath('/experience')">
              {{ t('about.experienceAction') }}
            </UButton>
            <UButton variant="ghost" color="neutral" :to="localePath('/projects')">
              {{ t('about.projectsAction') }}
            </UButton>
            <!-- No Contact CTA: the route does not exist until the Contact slice ships. -->
          </nav>
        </div>

        <!-- The portrait leads on narrow viewports and sits beside the prose from `lg`. `order` keeps
             the DOM order (prose first) meaningful for assistive tech at every width. -->
        <aside class="lg:order-last lg:sticky lg:top-24 lg:self-start">
          <AboutPortrait v-if="data.portrait" :portrait="data.portrait" priority />
        </aside>
      </div>
    </UiRequestState>
  </UContainer>
</template>
