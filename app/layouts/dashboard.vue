<script setup lang="ts">
// Minimal dashboard shell (doc 11 §2). The sidebar and command palette arrive in feature 002;
// M1 establishes the isolated client-only world with a topbar and sign-out.
const { t } = useI18n()
const auth = useAuthStore()

async function signOut(): Promise<void> {
  await auth.logout()
  await navigateTo('/dashboard/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <header class="border-b border-default">
      <div class="flex h-14 items-center justify-between px-6">
        <span class="font-semibold text-highlighted">{{ t('dashboard.title') }}</span>
        <div class="flex items-center gap-2">
          <span v-if="auth.user" class="hidden text-sm text-muted sm:inline">{{ auth.user.email }}</span>
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
</template>
