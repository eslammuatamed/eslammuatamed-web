<script setup lang="ts">
// Global header (FR-PUB-003, doc 04 §3): four primary targets plus a persistent Résumé link
// and a visually distinct Contact CTA. Nav labels are i18n chrome; `to` is locale-resolved so
// the active state and switcher stay correct in both directions.
interface NavLink {
  label: string
  to: string
}

const { t, locale, locales } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const navItems = computed<NavLink[]>(() => [
  { label: t('nav.projects'), to: localePath('/projects') },
  { label: t('nav.blog'), to: localePath('/blog') },
  { label: t('nav.experience'), to: localePath('/experience') },
  { label: t('nav.about'), to: localePath('/about') }
])

// USlideover's `side` is physical (left|right|top|bottom); resolve the inline-end per direction so
// the mobile menu opens from the trailing edge in both LTR and RTL (D15-3, logical direction).
const menuSide = computed<'left' | 'right'>(() =>
  locales.value.find(item => item.code === locale.value)?.dir === 'rtl' ? 'left' : 'right'
)

const mobileOpen = ref(false)

// Close the mobile menu whenever navigation completes.
watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur">
    <UContainer class="flex h-16 items-center justify-between gap-4">
      <AppLink to="/" class="text-lg font-semibold text-highlighted" :aria-label="t('a11y.homeLink')">
        {{ t('brand.name') }}
      </AppLink>

      <UNavigationMenu
        :items="navItems"
        :aria-label="t('a11y.primaryNav')"
        class="hidden md:flex"
      />

      <div class="flex items-center gap-1">
        <AppLink
          to="/resume"
          class="hidden text-sm font-medium text-muted transition-colors hover:text-default sm:inline-flex"
        >
          {{ t('nav.resume') }}
        </AppLink>
        <UButton :to="localePath('/contact')" size="sm" class="hidden sm:inline-flex">
          {{ t('nav.contact') }}
        </UButton>
        <LayoutLocaleSwitcher />
        <LayoutThemeToggle />
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="md:hidden"
          :aria-label="t('a11y.openMenu')"
          @click="mobileOpen = true"
        />
      </div>
    </UContainer>

    <USlideover v-model:open="mobileOpen" :title="t('brand.name')" :side="menuSide">
      <template #body>
        <nav :aria-label="t('a11y.primaryNav')" class="flex flex-col gap-1">
          <AppLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-control px-3 py-2 text-base text-default hover:bg-elevated"
          >
            {{ item.label }}
          </AppLink>
          <AppLink
            to="/resume"
            class="rounded-control px-3 py-2 text-base text-default hover:bg-elevated"
          >
            {{ t('nav.resume') }}
          </AppLink>
          <UButton :to="localePath('/contact')" block class="mt-2">
            {{ t('nav.contact') }}
          </UButton>
        </nav>
      </template>
    </USlideover>
  </header>
</template>
