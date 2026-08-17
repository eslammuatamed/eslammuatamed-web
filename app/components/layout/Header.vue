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

/**
 * Active when the resolved target is the current path or an ancestor of it (so /blog stays active on
 * a post). Compared on localized paths so it holds in both locales.
 *
 * ALSO GATES PREFETCH. The active item points at the page being viewed, so `<NuxtLink>`'s
 * default prefetch fetches that route's payload for nothing — measured on the built preview as one
 * self-payload request per cache-ruled route, on every public page view. It remains a LINK with
 * `aria-current="page"`, which is the conventional accessible pattern for a current nav item; only
 * the wasted fetch is removed.
 */
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

// Glass is applied only once content is actually behind the header (D03-14 — the header is flat at
// rest and glassy only after the page scrolls beneath it).
// At the very top there is nothing to see through, so a blurred strip there is cost with no signal —
// and it puts a seam across the top of the hero. Starting `false` also matches SSR, so hydration
// finds the same classes it rendered.
//
// Only background/border/shadow change: no size, position or layout property is touched, so the
// state flip cannot shift layout (CLS stays 0).
const scrolled = ref(false)

onMounted(() => {
  let ticking = false
  const read = () => {
    // 8px, not 0: a rubber-band or anchor-restore jitter at the very top must not flicker the state.
    scrolled.value = window.scrollY > 8
    ticking = false
  }
  const onScroll = () => {
    if (ticking) return
    ticking = true
    // Coalesce to one read per frame — the listener is passive and never writes layout during scroll.
    requestAnimationFrame(read)
  }
  read()
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
})

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b transition-colors duration-200"
    :class="scrolled ? 'glass border-default bg-[var(--glass-surface)]' : 'border-transparent bg-transparent'"
  >
    <UContainer class="flex h-16 items-center justify-between gap-2 md:gap-6">
      <!--
        The lockup — mark, gap, register and the load-bearing `whitespace-nowrap` — belongs to
        `UiWordmark` (019), so the bar and the drawer below set one identity instead of two hand-matched
        class strings. The link keeps only its own layout role.
      -->
      <AppLink to="/" class="shrink-0">
        <UiWordmark />
      </AppLink>

      <nav :aria-label="t('a11y.primaryNav')" class="hidden items-center gap-8 md:flex">
        <AppLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="relative py-1 text-body-sm transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100"
          :class="isActive(item.to) ? 'text-highlighted after:scale-x-100' : 'text-muted hover:text-default'"
          :prefetch="!isActive(item.to)"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </AppLink>
      </nav>

      <div class="flex shrink-0 items-center gap-1 md:gap-1.5">
        <AppLink
          to="/resume"
          class="me-1 hidden text-body-sm text-muted transition-colors hover:text-default sm:inline-flex"
        >
          {{ t('nav.resume') }}
        </AppLink>
        <UButton :to="localePath('/contact')" size="sm" class="hidden sm:inline-flex">
          {{ t('nav.contact') }}
        </UButton>
        <!--
          Wrapped rather than given `hidden sm:inline-flex` directly: LangToggle's own root is
          `inline-flex`, and a merged `hidden` loses to it on source order — which is why the
          segmented control was still rendering at 390px despite the utility. The wrapper owns the
          visibility so there is nothing to lose against.
        -->
        <span class="hidden sm:inline-flex">
          <LayoutLangToggle />
        </span>
        <LayoutLangSwitchButton class="sm:hidden" />
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
      :ui="{ content: 'w-[70vw] max-w-sm glass bg-[var(--glass-surface-elevated)]' }"
    >
      <template #title>
        <UiWordmark size="md" />
      </template>

      <template #body>
        <nav :aria-label="t('a11y.primaryNav')" class="flex flex-col">
          <AppLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="border-b border-default py-4 font-display text-h3 transition-colors"
            :class="isActive(item.to) ? 'text-primary' : 'text-highlighted hover:text-primary'"
            :prefetch="!isActive(item.to)"
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
