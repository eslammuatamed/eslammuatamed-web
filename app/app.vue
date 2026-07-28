<script setup lang="ts">
// Global document shell. `useLocaleHead` supplies hreflang/canonical/og:locale; the explicit
// htmlAttrs below guarantee `<html lang dir>` per locale (locale parity, Pillar 3). The brand
// suffix is appended once via titleTemplate so pages set only a short title.
import * as uiLocales from '@nuxt/ui/locale'

const { t, locale, localeProperties, finalizePendingLocaleChange } = useI18n()
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

/**
 * The ACTIVE locale's properties, from `@nuxtjs/i18n`'s documented `localeProperties` composable.
 *
 * This replaced a hand-rolled `locales.value.find(item => item.code === locale.value)`, which
 * silently resolved to `undefined` after a client-side locale switch on a detail route: `<html>` then
 * kept `dir="ltr"` while `lang` fell through to the raw code, so the Arabic page laid out
 * left-to-right (verified in the browser, both lanes). `localeProperties` resolves against the
 * module's own normalized locale config rather than a reactive list that is not stable across the
 * D03-13 deferred commit — the documented API doing what the hand-rolled lookup only appeared to do
 * (principle 16).
 */
const activeLocale = computed(() => localeProperties.value)

// Nuxt UI localizes its built-in strings and mirrors component direction from this locale pack,
// switched with the active i18n locale (ui.nuxt.com/docs/getting-started/i18n/nuxt). The pack keys
// (`en`/`ar`) match our i18n codes; the `<html lang dir>` authority stays with i18n above.
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales])

useHead(localeHead)

/**
 * `<html lang dir>` per locale (locale parity, Pillar 3).
 *
 * KNOWN LIMITATION — finding F-3, open. This block is currently INERT for `dir`: `useLocaleHead()`
 * above also writes `htmlAttrs` and wins the merge, verified by hard-coding a value here and seeing
 * no change in the rendered `<html>`. Raising this entry to `tagPriority: 'high'` was tried and did
 * not change the outcome either, so the ownership sits inside `@nuxtjs/i18n`'s head handling rather
 * than in merge order, and is not fixable from here without a decision.
 *
 * The consequence is confined to a CLIENT-SIDE locale switch on a per-locale-slug route, where i18n
 * updates `lang` but leaves `dir` on the outgoing value. Server-rendered loads — every direct visit,
 * every crawl — are correct in both locales. Reproduced on the `contract` lane with unmodified data
 * code, so it predates web-005 and is unrelated to D06-6.
 */
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
