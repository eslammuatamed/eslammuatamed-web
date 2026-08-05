<script setup lang="ts">
// Public shell: skip link first (D21-1), landmarked header/main/footer (doc 21 §1). On client
// navigation focus moves to <main> so keyboard/AT users land on the new content while the route
// announcer reads the title.
const { t } = useI18n()
const main = useTemplateRef<HTMLElement>('main')
const router = useRouter()
const nuxtApp = useNuxtApp()

// TIER 2 of the metadata hierarchy (utils/metadata.ts): the localized public SiteSettings values
// an operator manages in the CMS. This lives in the PUBLIC layout rather than `app.vue` on
// purpose — `app.vue` wraps the dashboard and auth shells too, and awaiting a public read there
// made authenticated routes block on (and fail with) an endpoint they never consume. Only public
// pages have public settings, so only the public shell reads them.
//
// This shares the `settings:site:{locale}` key with the footer and the pages. MEASURED, because
// the shared key by itself proves nothing: Nuxt's default `getCachedData` reads `static.data` on
// the server, which is empty during a normal SSR render, so before `sharedSettingsCachedData`
// every call site issued its OWN request and this read added a third one to `/about`
// (`evidence/ab-request-count.md`). With that resolver the whole render makes exactly one
// `/settings/site` request, on every public route.
// It IS awaited: an un-awaited `useAsyncData` leaves `data` null while the server
// renders, which would serialize the committed tier and then swap the CMS value in on the client —
// a head hydration mismatch, and a violation of "the initial server-rendered HTML must already
// contain the final metadata".
//
// The tier-3 guarantee is untouched: `useAsyncData` does not throw, so a failed or slow response
// leaves `data` null and every `pickMeta` below falls through to the committed value `app.vue`
// already emitted. A whitespace-only CMS value falls through for the same reason. Pages override
// these afterwards with their own content (tier 1).
const { data: settings } = await useSiteSettings()

const siteName = computed(() => pickMeta(settings.value?.siteName, t('brand.name')) ?? t('brand.name'))

useHead(() => ({
  titleTemplate: title => (title ? `${title} — ${siteName.value}` : siteName.value)
}))

useSeoMeta({
  ogSiteName: () => siteName.value,
  title: () => pickMeta(settings.value?.defaultMetaTitle),
  description: () => pickMeta(settings.value?.defaultMetaDescription),
  ogTitle: () => pickMeta(settings.value?.defaultMetaTitle),
  ogDescription: () => pickMeta(settings.value?.defaultMetaDescription),
  twitterTitle: () => pickMeta(settings.value?.defaultMetaTitle),
  twitterDescription: () => pickMeta(settings.value?.defaultMetaDescription)
})

if (import.meta.client) {
  const initialPath = router.currentRoute.value.fullPath
  let initialPageFinished = false
  const stop = nuxtApp.hooks.hook('page:finish', () => {
    const isInitialRender = !initialPageFinished && router.currentRoute.value.fullPath === initialPath
    initialPageFinished = true
    if (isInitialRender) return
    void nextTick(() => main.value?.focus({ preventScroll: true }))
  })
  onBeforeUnmount(() => {
    stop()
  })
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <LayoutHeader />

    <!-- overflow-x-clip contains the page-spread transition's inline translate so it never spawns a
         transient horizontal scrollbar; clip (not hidden) keeps position:sticky working inside. -->
    <main id="main-content" ref="main" tabindex="-1" class="flex-1 overflow-x-clip outline-none">
      <slot />
    </main>

    <LayoutFooter />
    <UiBackToTop />
  </div>
</template>
