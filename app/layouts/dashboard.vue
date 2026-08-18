<script setup lang="ts">
/**
 * Durable dashboard shell (doc 11 §2, owner decision 1): desktop sidebar, mobile drawer, header and
 * content area. Orchestration only — the navigation model lives in `useDashboardNav()` and its
 * rendering in `DashboardNavList`, so adding one of doc 04's remaining IA groups later is a model
 * entry rather than a shell rewrite.
 *
 * BILINGUAL SINCE OD-11 (D02-15 / D11-8). The chrome reads the Dashboard APPLICATION locale, not the
 * route-derived public one.
 *
 * `dir` AND `lang` GO ON THE SHELL ROOT, NOT ON `<html>`. `<html lang dir>` is owned end-to-end by
 * `@nuxtjs/i18n` under strict SEO (D22-7): the module generates them together with the canonical,
 * the alternates and `og:locale`, and two writers competing for those attributes is exactly what
 * produced finding F-3 — an Arabic page left on `dir="ltr"` while `lang` and `hreflang` updated
 * correctly. That cost is already paid once; this does not re-open it.
 *
 * Nothing is lost by scoping them here. The shell fills the viewport, CSS logical properties resolve
 * against the nearest `dir` ancestor, and assistive technology honours a subtree `lang`. The one
 * thing a subtree cannot reach — Nuxt UI overlays, which teleport to `document.body` — is handled at
 * the app-level `<UApp>`, whose Reka `ConfigProvider` takes its direction from this same locale (see
 * `app.vue`). And the dashboard is `ssr: false` and `noindex`, so it has no crawler-visible head for
 * `<html dir>` to matter to.
 */
import { dashboardDrawerSide } from '~/utils/dashboard-locale'

const { t, locale, dir, ensureMessages } = useDashboardI18n()
const auth = useAuthStore()
const route = useRoute()
const localePath = useLocalePath()
const { groups } = useDashboardNav()
const { ensureFresh } = useUnreadCount()

/**
 * AWAITED, and the await is the point.
 *
 * `@nuxtjs/i18n` v10 always code-splits locale messages, so a cookie-`ar` operator's FIRST paint is
 * the exposed case: without this, the shell renders before `ar.json` arrives and every string is its
 * own raw key path — silently, because a missing message is not an error. `/dashboard/**` is
 * `ssr: false` (D06-1), so this is entirely client-side and entirely visible to the operator.
 *
 * Nuxt suspends the layout on this promise, so there is no frame in which the shell exists and its
 * messages do not. A test that only toggles the language after an English load would pass even with
 * this line deleted — which is why the cold-load test exists separately (doc 18 §3).
 */
await ensureMessages()

const drawerOpen = ref(false)

// Badge state is fetched once at authenticated shell initialization (owner decision 7).
// `ensureFresh` deduplicates against the Messages page asking in the same tick, so mounting both
// costs one request rather than two.
onMounted(() => {
  void ensureFresh()
})

// A drawer that survived navigation would cover the page the user just chose.
watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

/**
 * The public site, in the DASHBOARD's language — `/` in English, `/ar` in Arabic.
 *
 * `useLocalePath()` is the module's own resolver, so this stays correct if the routing strategy ever
 * changes. It is fed the dashboard locale explicitly rather than defaulting to the ambient one:
 * defaulting would send an Arabic-working operator to the English homepage, because on an unprefixed
 * dashboard route the ambient locale is always `en` (D04-7).
 */
const publicSiteHref = computed(() => localePath('/', locale.value))

async function signOut(): Promise<void> {
  await auth.logout()
  await navigateTo('/dashboard/login')
}

</script>

<template>
  <div :dir="dir" :lang="locale" class="min-h-screen bg-default">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <div class="flex min-h-screen">
      <!-- Desktop sidebar; below lg the drawer takes over. One model, two surfaces, one renderer. -->
      <aside class="hidden w-64 shrink-0 border-e border-default lg:block">
        <div class="sticky top-0 flex h-screen flex-col gap-6 p-4">
          <span class="px-3 text-sm font-semibold text-highlighted">{{ t('dashboard.title') }}</span>
          <DashboardNavList :groups="groups" />
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="border-b border-default">
          <div class="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div class="flex min-w-0 items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-menu"
                class="lg:hidden"
                :aria-label="t('dashboard.nav.openMenu')"
                @click="() => { drawerOpen = true }"
              />
              <span class="truncate font-semibold text-highlighted">{{ t('dashboard.title') }}</span>
            </div>

            <div class="flex items-center gap-2">
              <!--
                The owner's "View site" affordance — the fix for having to hand-edit the URL to
                reach the public site.

                A NEW TAB, as a product decision rather than a default. The dashboard holds an
                in-memory access token (D11-1) and, on an editor route, unsaved work; navigating away
                in place costs a refresh round trip at best and unsaved edits at worst. A tab
                satisfies "one click to see the site" without making it a destructive operation.
                `rel="noopener"` because a new tab inherits `window.opener` otherwise, and the new-tab
                behaviour is ANNOUNCED rather than left to be inferred from an icon.

                Label hidden below `sm` so the four header controls still fit at 380px; the icon
                keeps an accessible name either way.
              -->
              <UButton
                :to="publicSiteHref"
                target="_blank"
                rel="noopener"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-external-link"
                :aria-label="t('dashboard.shell.viewSite')"
              >
                <span class="hidden sm:inline">{{ t('dashboard.shell.viewSite') }}</span>
                <span class="sr-only">{{ t('a11y.opensInNewTab') }}</span>
              </UButton>

              <DashboardLangSwitch />
              <LayoutThemeToggle :label="t('dashboard.shell.theme')" />

              <!--
                OPERATOR IDENTITY AS PLAIN TEXT, NOT A DROPDOWN — and the reason is measured, not
                aesthetic. Wrapping these two in a `UDropdownMenu` put Reka's whole menu subsystem
                (and its floating-ui dependency) into the dashboard LAYOUT chunk, which every
                dashboard route loads: the shared dashboard floor went 259,900 → 288,523 B gz,
                **+28.0 KB**, breaching D20-32 by 20 KB. D20-32 is INTERIM and must not be
                recalibrated before FE-5 (plan §7.3, risk R3), so the control was rebuilt to cost
                nothing instead.

                No requirement is dropped: the owner asked for "operator identity / session actions",
                and both are here. The e-mail is `title`-bearing so a truncated address is still
                readable, and it is hidden below `sm` only because the four header controls cannot
                all fit at 380px — the sign-out action, which is the actionable half, survives at
                every width. Revisit the presentation in the FE-5 coherence pass, with this number in
                hand.
              -->
              <span
                v-if="auth.user"
                class="hidden max-w-48 truncate text-sm text-muted sm:inline"
                :title="auth.user.email"
              >{{ auth.user.email }}</span>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-log-out"
                :aria-label="t('dashboard.signOut')"
                @click="signOut"
              >
                <span class="hidden md:inline">{{ t('dashboard.signOut') }}</span>
              </UButton>
            </div>
          </div>
        </header>

        <main id="main-content" tabindex="-1" class="flex-1 outline-none">
          <slot />
        </main>
      </div>
    </div>

    <!--
      Mobile drawer. `side` is DERIVED from the dashboard direction, not fixed.

      It used to be a hard-coded physical `left`, justified in a comment by the dashboard being
      "English-only LTR by owner decision 10". That decision is superseded (D02-15 / D11-8): logical
      layout semantics now govern dashboard chrome exactly as they govern public chrome, and a drawer
      sliding in from the inline-END of an RTL page is the defect that rule exists to catch.

      `side` is one of the few APIs with no logical form — its values are literally `left`/`right` —
      so the mapping is made explicitly, in a tested pure function, rather than inline here.
    -->
    <USlideover
      v-model:open="drawerOpen"
      :side="dashboardDrawerSide(locale)"
      :title="t('dashboard.nav.primary')"
      :description="t('dashboard.title')"
    >
      <template #body>
        <DashboardNavList :groups="groups" :on-navigate="() => (drawerOpen = false)" />
      </template>
    </USlideover>
  </div>
</template>
