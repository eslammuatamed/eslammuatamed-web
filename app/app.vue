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
 * KNOWN DEFECT — finding F-3, OPEN, mechanism NOT established. Observed, and only this:
 *   - `dir` does not follow a CLIENT-SIDE locale switch on routes that call `setI18nParams()`
 *     (Projects and Blog detail); `lang` does. Index routes are unaffected — the blog index flips to
 *     `rtl` correctly, so `setI18nParams` is the differentiator between affected and unaffected.
 *   - the same staleness hits `og:locale` (stays `en_US`) and `canonical` (keeps the AR slug but
 *     loses its `/ar` prefix) after that switch.
 *   - reproduced on the `contract` lane with unmodified data code, so it predates web-005 and is
 *     unrelated to D06-6.
 *   - `localeProperties` (used below, and correct — it reports `dir: 'rtl'` at the moment the page is
 *     wrong) and `tagPriority: 'high'` were each tried and neither changed the outcome.
 *
 * SERVER-RENDERED OUTPUT IS CORRECT in both locales — every direct visit and every crawl. The defect
 * is confined to the in-page switch, so it is a visible RTL bug for a visitor who uses the toggle,
 * not an indexing problem.
 *
 * The block below is kept because it is right, it is what `error.vue` relies on (where app.vue does
 * not render, and where `dir` demonstrably works), and it costs nothing.
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
