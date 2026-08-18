<script setup lang="ts">
/**
 * The unauthenticated dashboard shell — currently only `/dashboard/login`.
 *
 * BILINGUAL, and it has to carry its own controls (D02-15). Login is reachable before a session
 * exists, so it cannot inherit anything from the authenticated shell; if the language control lived
 * only in `layouts/dashboard.vue`, an Arabic-reading operator would meet an English sign-in page and
 * have no way to change it. The same argument applies to the appearance control and to the route
 * back to the public site — the owner asked for that to stay obvious regardless of locale.
 *
 * `dir`/`lang` sit on the shell root rather than on `<html>`, for the reason set out in full in
 * `layouts/dashboard.vue`: those attributes are solely `@nuxtjs/i18n`'s under strict SEO (D22-7),
 * and a second writer for them is finding F-3.
 */
const { t, locale, dir, ensureMessages } = useDashboardI18n()
const localePath = useLocalePath()

// Awaited for the same reason as the authenticated shell: messages are code-split, and a
// cookie-`ar` operator's FIRST paint is the case that renders raw key paths without this.
// See `layouts/dashboard.vue` for the full reasoning.
await ensureMessages()

// The public site in the DASHBOARD's language. Same-tab here, unlike the authenticated shell's
// `View site`: there is no session and no unsaved work to protect, and "I landed on the admin login
// by mistake" wants the ordinary back-and-forth of a link, not a new tab.
const publicSiteHref = computed(() => localePath('/', locale.value))
</script>

<template>
  <div :dir="dir" :lang="locale" class="flex min-h-screen flex-col px-4">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <header class="flex h-14 shrink-0 items-center justify-between gap-3">
      <!-- The mark, not an outlined lockup, and it doubles as the way back to the portfolio
           (brand AP-9). `aria-label` rather than relying on the mark carrying a name. -->
      <NuxtLink
        :to="publicSiteHref"
        class="inline-flex items-center gap-2 rounded-control text-highlighted"
        :aria-label="t('dashboard.shell.backToSite')"
      >
        <UiBrandMark :size="24" />
        <span class="text-sm font-semibold">{{ t('dashboard.shell.backToSite') }}</span>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <DashboardLangSwitch />
        <LayoutThemeToggle :label="t('dashboard.shell.theme')" />
      </div>
    </header>

    <div class="grid flex-1 place-items-center">
      <main id="main-content" tabindex="-1" class="w-full max-w-sm py-8 outline-none">
        <slot />
      </main>
    </div>
  </div>
</template>
