<script setup lang="ts">
// Compact single-button locale switch for the MOBILE header only (the full segmented
// `LayoutLangToggle` stays on desktop and in the drawer).
//
// Why a button and not the segmented control: with two locales the segmented control renders both
// codes plus its pill chrome, which at 320px took enough inline space to push the brand name onto a
// second line. One button showing the CURRENT locale, which switches to the other, halves that.
//
// The visible label is the current locale — the same convention the segmented control uses for its
// active segment — while the accessible name states the ACTION, because "EN" alone tells a screen
// reader nothing about what activating it does.
//
// `SwitchLocalePathLink` rather than a pre-resolved `switchLocalePath()`: on a per-locale-slug route
// (D04-2) the counterpart slug only exists once the page has called `setI18nParams()`, and the header
// server-renders BEFORE the page does. Resolving here would emit a stale `href` — correct on click,
// wrong for a crawler, a middle-click or a no-JS visitor. Same reasoning as LangToggle.
const { t, locale, locales } = useI18n()

const other = computed(() => locales.value.find(item => item.code !== locale.value))
const currentShort = computed(() => locale.value.toUpperCase())
</script>

<template>
  <SwitchLocalePathLink
    v-if="other"
    :locale="other.code"
    :aria-label="t('a11y.switchToOtherLocale')"
    :title="t('a11y.switchToOtherLocale')"
    class="inline-flex size-9 items-center justify-center rounded-full border border-default bg-elevated text-caption font-semibold leading-none text-highlighted transition-colors hover:bg-accented"
  >
    {{ currentShort }}
  </SwitchLocalePathLink>
</template>
