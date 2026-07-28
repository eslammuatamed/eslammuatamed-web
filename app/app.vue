<script setup lang="ts">
// Global document shell. EVERY locale-derived head tag — `<html lang dir>`, the locale alternates,
// the canonical, `og:locale`/`og:locale:alternate`/`og:url` — is owned by `@nuxtjs/i18n` under strict
// SEO (D22-7, `nuxt.config` `i18n.experimental.strictSeo`), so nothing here writes them. `useLocaleHead()`
// is not called: the module throws on it in strict mode, because the two would compete for the same
// tags — which is exactly how finding F-3 happened. The brand suffix is appended once via
// titleTemplate so pages set only a short title.
import * as uiLocales from '@nuxt/ui/locale'

const { t, locale, finalizePendingLocaleChange } = useI18n()
const brand = computed(() => t('brand.name'))

// Branded public route transition (007): a "spread" turn — the page leaves toward the inline-start
// and the next arrives from the inline-end (direction mirrors in RTL via CSS). `out-in` so only one
// page is ever in flow (no overlap jump / cumulative layout shift); compositor-only
// opacity+transform; the CSS collapses it to a ≤120ms opacity fade under prefers-reduced-motion
// (main.css). SSR-safe.
//
// It lives here rather than in `nuxt.config`'s `app.pageTransition` because of `onBeforeEnter`:
// `skipSettingLocaleOnNavigate` (nuxt.config) suspends the locale switch, and THIS is where it is
// released — after the outgoing page has left and before the incoming one is revealed. A locale
// change therefore reaches the DOM exactly once, while nothing of the old page is on screen, so
// `<html lang/dir>`, the chrome copy and the Nuxt UI locale pack all flip inside the same frame that
// presents the new page. Same-locale navigations are unaffected: nothing is pending, and
// `finalizePendingLocaleChange()` returns immediately.
//
// No page overrides `pageTransition` via `definePageMeta` (verified), so binding it on `<NuxtPage>`
// takes nothing away. The definition itself lives in `~/utils/page-transition` so the ordering
// contract can be unit-tested rather than only observed in a browser.
const pageTransition = createPageTransition(finalizePendingLocaleChange)

// Nuxt UI localizes its built-in strings and mirrors component direction from this locale pack,
// switched with the active i18n locale (ui.nuxt.com/docs/getting-started/i18n/nuxt). The pack keys
// (`en`/`ar`) match our i18n codes; the `<html lang dir>` authority is i18n's, per D22-7.
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales])

// Title only. Locale-derived tags are the module's (D22-7); description, OG image, structured data
// and the D22-6 global metas remain page/entity concerns, below and in the pages themselves.
useHead(() => ({
  titleTemplate: title => (title ? `${title} — ${brand.value}` : brand.value)
}))

useSeoMeta({
  description: () => t('seo.siteDescription'),
  ogType: 'website',
  ogSiteName: () => brand.value,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :transition="pageTransition" />
    </NuxtLayout>
  </UApp>
</template>
