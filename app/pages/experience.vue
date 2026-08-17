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
const { initialPending, refreshing } = useRequestState(() => status.value === 'pending', hasData)
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
// One computed per NODE — see `useSiteSchema` for why neither a whole-list getter nor a whole-list
// `computed()` is correct under the unhead-v3 vendor.
//
// The computed wrapper preserves the node's existing reactive behaviour EXACTLY; it does not add
// any. Measured, because the obvious claim here would be wrong: a CLIENT-SIDE locale switch does
// NOT re-resolve these breadcrumb names — the graph keeps the outgoing locale's labels. That is
// PRE-EXISTING and predates the Nuxt upgrade (identical on nuxt 4.4.8 with the old whole-list
// getter, on 4.5.2 with it, and on 4.5.2 with this form), so it is recorded as its own finding
// rather than fixed here. A fresh SSR load of the localized route is correct in both locales.
useSchemaOrg([
  computed(() => defineBreadcrumb({
    itemListElement: crumbs.value.map(crumb => ({
      name: crumb.label,
      item: crumb.to ? `${siteConfig.url}${localePath(crumb.to)}` : undefined
    }))
  }))
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
        <!-- `show-technologies`: FR-PUB-021 puts the stack on THIS page. The home summary
             (FR-PUB-013) was approved without it and keeps the component default. -->
        <ContentTimelineEntry
          v-for="experience in (data ?? [])"
          :key="experience.id"
          :experience="experience"
          heading-level="h2"
          show-technologies
        />
      </ol>
    </UiRequestState>
  </UContainer>
</template>
