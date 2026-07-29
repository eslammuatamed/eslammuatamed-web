<script setup lang="ts">
// Experience (FR-PUB-021) — the reverse-chronological role timeline. Ordering, technology ordering
// and locale resolution are all the API's (D02-9, D10-6); this page owns only the presentation.
//
// The page shell deliberately mirrors `/projects` — breadcrumbs, kicker + h1 + description, then a
// `UiRequestState` around the entries — so Experience reads as the same product rather than a second
// template (doc 13).
const { t } = useI18n()

const { data, status, error, refresh } = await useExperiences()

// Initial load (skeleton) vs a refetch with content already on screen (branded overlay):
// `useAsyncData` keeps the previous `data` while refetching (doc 13 §9.1).
const hasData = computed(() => !!data.value)
const initialPending = computed(() => status.value === 'pending' && !hasData.value)
const refreshing = computed(() => status.value === 'pending' && hasData.value)
// A dedicated page shows real empty copy; optional home sections omit themselves instead.
const isEmpty = computed(() => !!data.value && data.value.length === 0)

// A visible trail the BreadcrumbList below mirrors — structured data that is not also on the page is
// a penalty, not a signal (doc 22 §4).
const crumbs = computed(() => [{ label: t('nav.home'), to: '/' }, { label: t('nav.experience') }])

const siteConfig = useSiteConfig()
const localePath = useLocalePath()

// BreadcrumbList ONLY. `ProfilePage` wrapping the site-wide `Person` belongs to `/about` (D22-8):
// "/experience and /resume do not duplicate the full ProfilePage identity unless a later Web
// specification identifies a standards-supported need." This slice identifies none, and a second
// Person here would be the contradictory duplicate identity D22-8 forbids.
useSchemaOrg(() => [
  defineBreadcrumb({
    itemListElement: crumbs.value.map(crumb => ({
      name: crumb.label,
      item: crumb.to ? `${siteConfig.url}${localePath(crumb.to)}` : undefined
    }))
  })
])

// Title, description and OG title/description only. Canonical, hreflang/x-default, og:locale,
// og:url and <html lang/dir> are owned by @nuxtjs/i18n under strict SEO (D22-7) — writing them here
// would duplicate the tags and fight the global owner, which is how finding F-3 happened.
// No `ogImage`: the repository has no branded social-image fallback (`ogImage` is disabled in
// nuxt.config and `public/` holds only favicons), and emitting a URL that does not resolve is worse
// than inheriting nothing. Recorded as a later Web SEO/launch requirement, not silently patched.
useSeoMeta({
  title: () => t('seo.experience.title'),
  description: () => t('seo.experience.description'),
  ogTitle: () => `${t('seo.experience.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.experience.description')
})
</script>

<template>
  <UContainer class="py-[var(--space-section)]">
    <UiBreadcrumbs :items="crumbs" :label="t('experience.breadcrumbLabel')" />

    <header class="mt-10 max-w-2xl">
      <p class="kicker text-dimmed">{{ t('nav.experience') }}</p>
      <h1 class="mt-4 font-display text-display text-highlighted text-balance">
        {{ t('experience.title') }}
      </h1>
      <p class="mt-5 text-body-lg text-muted text-pretty">{{ t('experience.description') }}</p>
    </header>

    <UiRequestState
      class="mt-14 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="Boolean(error)"
      :empty="isEmpty"
      skeleton="work"
      :count="3"
      @retry="refresh()"
    >
      <template #error>
        <div class="rounded-card border border-default bg-elevated p-8" role="alert">
          <p class="font-display text-h3 text-highlighted">{{ t('experience.errorTitle') }}</p>
          <p class="mt-2 text-muted">{{ t('experience.errorBody') }}</p>
          <UButton class="mt-4" variant="subtle" color="neutral" @click="refresh()">
            {{ t('common.retry') }}
          </UButton>
        </div>
      </template>

      <template #empty>
        <div class="rounded-card border border-default bg-elevated p-8">
          <p class="font-display text-h3 text-highlighted">{{ t('experience.emptyTitle') }}</p>
          <p class="mt-2 text-muted">{{ t('experience.emptyBody') }}</p>
          <!-- Projects, not Contact: Contact is a later slice and its route does not exist yet. -->
          <UButton class="mt-4" variant="subtle" color="neutral" :to="localePath('/projects')">
            {{ t('experience.emptyAction') }}
          </UButton>
        </div>
      </template>

      <!-- An ORDERED list: reverse-chronological order is meaningful, so the sequence must survive
           with CSS off rather than living only in the visual rail. Order is the API's (D02-9) and is
           rendered verbatim — no client-side sort. -->
      <ol :aria-label="t('experience.timelineLabel')" class="max-w-3xl">
        <!-- h2: entries sit directly under the page h1 with no intervening section heading, so the
             component default h3 would skip a level (WCAG heading order). -->
        <ContentTimelineEntry
          v-for="experience in (data ?? [])"
          :key="experience.id"
          :experience="experience"
          heading-level="h2"
        />
      </ol>
    </UiRequestState>
  </UContainer>
</template>
