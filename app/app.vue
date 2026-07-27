<script setup lang="ts">
// Global document shell. `useLocaleHead` supplies hreflang/canonical/og:locale; the explicit
// htmlAttrs below guarantee `<html lang dir>` per locale (locale parity, Pillar 3). The brand
// suffix is appended once via titleTemplate so pages set only a short title.
import * as uiLocales from '@nuxt/ui/locale'

const { t, locale, locales, finalizePendingLocaleChange } = useI18n()
const localeHead = useLocaleHead()
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

const activeLocale = computed(() => locales.value.find(item => item.code === locale.value))

// Nuxt UI localizes its built-in strings and mirrors component direction from this locale pack,
// switched with the active i18n locale (ui.nuxt.com/docs/getting-started/i18n/nuxt). The pack keys
// (`en`/`ar`) match our i18n codes; the `<html lang dir>` authority stays with i18n above.
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales])

useHead(localeHead)
useHead(() => ({
  htmlAttrs: {
    lang: activeLocale.value?.language ?? locale.value,
    dir: activeLocale.value?.dir ?? 'ltr'
  },
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
