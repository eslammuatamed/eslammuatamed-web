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
  // `siteName` is the resolved site title: the CMS value when set, the committed brand otherwise.
  // Read inside the callback, which head evaluates lazily, so the resolution below is in place.
  titleTemplate: title => (title ? `${title} — ${siteName.value}` : siteName.value)
}))

// TIER 3 of the metadata hierarchy (utils/metadata.ts): the committed-default FLOOR.
// Tier 2 (localized public SiteSettings) is layered on by `layouts/default.vue`; tier 1 (a page's
// own content) by the pages. Later `useSeoMeta` calls win, which is the precedence `description`
// has always used here — so floor -> public settings -> page content resolves in that order.
//
// The read is AWAITED so the resolution happens during SSR: `useAsyncData` that is not awaited
// leaves `data` null while the server renders, which would serialize tier 3 into the HTML and
// then swap in tier 2 on the client — both a head hydration mismatch and a violation of "the
// initial server-rendered HTML must already contain the final metadata". It shares the
// `settings:site:{locale}` key with the footer and the pages, so this adds no extra request on
// public routes.
//
// THE FAILURE GUARANTEE SURVIVES THE READ, and that is the point of doing it through `pickMeta`
// rather than a conditional: `useAsyncData` does not throw, so a failed or slow Settings response
// leaves `data` null, and every value below falls through to its committed tier. A whitespace-only
// CMS value falls through too. So "a temporary Settings API failure must not remove the title,
// description or image" holds because the committed tier is always the last candidate — not
// because the API is avoided.
// NO API READ HERE, DELIBERATELY. `app.vue` wraps EVERY route, including `/dashboard/*` (its own
// `dashboard`/`auth` layouts, authenticated, English-only chrome, noindex). Awaiting the PUBLIC
// `/settings/site` read here made every dashboard navigation block on a public endpoint it has no
// use for, and made an authenticated surface fail to render when the public API was down — a
// breach of the dashboard's isolation from public reads. Tier 2 therefore belongs to the PUBLIC
// layout (`layouts/default.vue`), which is the surface that actually has public settings.
//
// What stays here is the committed tier, which needs no network and is what guarantees that no
// route — public, dashboard or error — can ever render an empty title, description or image.
const siteName = computed(() => brand.value)
const defaultTitle = computed(() => t('seo.defaultTitle'))
const defaultDescription = computed(() => t('seo.siteDescription'))
//
// This stays the SINGLE owner of the social tags, for the same reason `useLocaleHead()` is not
// called for locale tags (D22-7): two owners competing for one tag is how finding F-3 happened.
// Pages set `ogImage`/`twitterImage` only when they have a real image of their own.
//
// The image is emitted as an ABSOLUTE URL — Open Graph and Twitter both drop relative ones — and
// `absoluteSocialUrl` returns undefined rather than a broken relative value if the governed site
// URL is somehow blank, so the tag is omitted instead of emitted empty. The site URL is baked at
// build time (config/site-url.ts), so this resolves during SSR with no client involvement.
const siteConfig = useSiteConfig()
const socialImage = computed(() => absoluteSocialUrl(SOCIAL_IMAGE_PATH, siteConfig.url))

useSeoMeta({
  description: () => defaultDescription.value,
  ogType: 'website',
  ogSiteName: () => siteName.value,
  ogTitle: () => defaultTitle.value,
  ogDescription: () => defaultDescription.value,
  ogImage: () => socialImage.value,
  ogImageWidth: SOCIAL_IMAGE_WIDTH,
  ogImageHeight: SOCIAL_IMAGE_HEIGHT,
  ogImageAlt: () => t('seo.socialImageAlt'),
  twitterCard: 'summary_large_image',
  twitterTitle: () => defaultTitle.value,
  twitterDescription: () => defaultDescription.value,
  twitterImage: () => socialImage.value,
  twitterImageAlt: () => t('seo.socialImageAlt')
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
