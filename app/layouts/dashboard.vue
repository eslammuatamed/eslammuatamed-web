<script setup lang="ts">
/**
 * Durable dashboard shell (doc 11 §2, owner decision 1): desktop sidebar, mobile drawer, header and
 * content area. Orchestration only — the navigation model lives in `useDashboardNav()` and its
 * rendering in `DashboardNavList`, so adding one of doc 04's remaining IA groups later is a model
 * entry rather than a shell rewrite.
 */
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const { groups } = useDashboardNav()
const { ensureFresh } = useUnreadCount()

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

async function signOut(): Promise<void> {
  await auth.logout()
  await navigateTo('/dashboard/login')
}
</script>

<template>
  <div class="min-h-screen bg-default">
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
              <span v-if="auth.user" class="hidden max-w-64 truncate text-sm text-muted sm:inline">
                {{ auth.user.email }}
              </span>
              <LayoutThemeToggle />
              <UButton color="neutral" variant="ghost" size="sm" @click="signOut">
                {{ t('dashboard.signOut') }}
              </UButton>
            </div>
          </div>
        </header>

        <main id="main-content" tabindex="-1" class="flex-1 outline-none">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile drawer. Physical `left` rather than a logical property: the dashboard is English-only
         LTR by owner decision 10, and the RTL logical-properties gate governs the public chrome. -->
    <USlideover
      v-model:open="drawerOpen"
      side="left"
      :title="t('dashboard.nav.primary')"
      :description="t('dashboard.title')"
    >
      <template #body>
        <DashboardNavList :groups="groups" :on-navigate="() => (drawerOpen = false)" />
      </template>
    </USlideover>
  </div>
</template>
