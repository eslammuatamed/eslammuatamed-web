<script setup lang="ts">
// Global header (FR-PUB-003, doc 04 §3), 007. Identity = the canonical Monolith mark (D03-11) beside the
// display-face wordmark (mark decorative/aria-hidden; the text is the accessible name — AP-9). Four primary
// targets carry a violet active marker; a persistent Résumé link sits beside a violet Contact plate; the
// language toggle + theme toggle round out the chrome. Everything resolves through the current locale, so
// active state and switching hold in both directions. On mobile the nav is a ~70vw trailing-edge drawer
// over a dimmed overlay (the page stays visible beneath), with Reka's dialog focus-trap / Escape /
// scroll-lock; the trigger carries aria-expanded/haspopup.
interface NavLink {
  label: string
  to: string
}

const { t, locale, locales } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const navItems = computed<NavLink[]>(() => [
  { label: t('nav.projects'), to: '/projects' },
  { label: t('nav.blog'), to: '/blog' },
  { label: t('nav.experience'), to: '/experience' },
  { label: t('nav.about'), to: '/about' }
])

// Active when the resolved target is the current path or an ancestor of it (so /blog stays active on a
// post). Compared on localized paths so it holds in both locales.
function isActive(to: string): boolean {
  const target = localePath(to)
  return route.path === target || route.path.startsWith(`${target}/`)
}

// USlideover's `side` is physical; resolve the inline-end per direction so the drawer opens from the
// trailing edge in both LTR and RTL (D15-3, logical direction).
const menuSide = computed<'left' | 'right'>(() =>
  locales.value.find(item => item.code === locale.value)?.dir === 'rtl' ? 'left' : 'right'
)

const mobileOpen = ref(false)

function openMenu(): void {
  mobileOpen.value = true
}

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur-md">
    <UContainer class="flex h-16 items-center justify-between gap-6">
      <AppLink to="/" class="inline-flex items-center gap-2.5">
        <UiBrandMark :size="20" class="text-primary" />
        <span class="font-display text-lg font-semibold tracking-tight text-highlighted">
          {{ t('brand.name') }}
        </span>
      </AppLink>

      <nav :aria-label="t('a11y.primaryNav')" class="hidden items-center gap-8 md:flex">
        <AppLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="relative py-1 text-body-sm transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100"
          :class="isActive(item.to) ? 'text-highlighted after:scale-x-100' : 'text-muted hover:text-default'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </AppLink>
      </nav>

      <div class="flex items-center gap-1.5">
        <AppLink
          to="/resume"
          class="me-1 hidden text-body-sm text-muted transition-colors hover:text-default sm:inline-flex"
        >
          {{ t('nav.resume') }}
        </AppLink>
        <UButton :to="localePath('/contact')" size="sm" class="hidden sm:inline-flex">
          {{ t('nav.contact') }}
        </UButton>
        <LayoutLangToggle class="hidden sm:inline-flex" />
        <LayoutThemeToggle />
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="md:hidden"
          :aria-label="t('a11y.openMenu')"
          aria-haspopup="dialog"
          aria-controls="mobile-nav"
          :aria-expanded="mobileOpen"
          @click="openMenu"
        />
      </div>
    </UContainer>

    <USlideover
      id="mobile-nav"
      v-model:open="mobileOpen"
      :title="t('brand.name')"
      :side="menuSide"
      :ui="{ content: 'w-[70vw] max-w-sm' }"
    >
      <template #title>
        <span class="inline-flex items-center gap-2.5">
          <UiBrandMark :size="18" class="text-primary" />
          <span class="font-display font-semibold tracking-tight text-highlighted">{{ t('brand.name') }}</span>
        </span>
      </template>

      <template #body>
        <nav :aria-label="t('a11y.primaryNav')" class="flex flex-col">
          <AppLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="border-b border-default py-4 font-display text-h3 transition-colors"
            :class="isActive(item.to) ? 'text-primary' : 'text-highlighted hover:text-primary'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </AppLink>
          <AppLink
            to="/resume"
            class="border-b border-default py-4 font-display text-h3 text-highlighted transition-colors hover:text-primary"
          >
            {{ t('nav.resume') }}
          </AppLink>
        </nav>
        <UButton :to="localePath('/contact')" block size="lg" class="mt-8">
          {{ t('nav.contact') }}
        </UButton>
        <div class="mt-8 flex items-center gap-2">
          <LayoutLangToggle />
          <LayoutThemeToggle />
        </div>
      </template>
    </USlideover>
  </header>
</template>
