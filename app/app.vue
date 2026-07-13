<script setup lang="ts">
// Global document shell. `useLocaleHead` supplies hreflang/canonical/og:locale; the explicit
// htmlAttrs below guarantee `<html lang dir>` per locale (locale parity, Pillar 3). The brand
// suffix is appended once via titleTemplate so pages set only a short title.
import * as uiLocales from '@nuxt/ui/locale'

const { t, locale, locales } = useI18n()
const localeHead = useLocaleHead()
const brand = computed(() => t('brand.name'))

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
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
