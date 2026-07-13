<script setup lang="ts">
// Footer navigation repeats the header targets (doc 04 §3). Social links and availability
// arrive with the settings wiring, and the RSS link returns with the feed (FR-PUB-006,
// feature 003); the shell keeps its place here without them.
interface FooterLink {
  label: string
  to: string
  external?: boolean
}

const { t } = useI18n()
const localePath = useLocalePath()

const year = new Date().getFullYear()

const links = computed<FooterLink[]>(() => [
  { label: t('nav.projects'), to: localePath('/projects') },
  { label: t('nav.blog'), to: localePath('/blog') },
  { label: t('nav.experience'), to: localePath('/experience') },
  { label: t('nav.about'), to: localePath('/about') },
  { label: t('nav.resume'), to: localePath('/resume') },
  { label: t('nav.contact'), to: localePath('/contact') }
  // RSS returns with the feed (FR-PUB-006) in feature 003; the /rss.xml route 404s until then.
])
</script>

<template>
  <footer class="mt-24 border-t border-default">
    <UContainer class="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-xs">
        <p class="text-base font-semibold text-highlighted">{{ t('brand.name') }}</p>
        <p class="mt-2 text-sm text-muted">{{ t('footer.builtWith') }}</p>
        <div class="mt-4 flex items-center gap-1">
          <LayoutLocaleSwitcher />
          <LayoutThemeToggle />
        </div>
      </div>

      <nav :aria-label="t('a11y.footerNav')" class="grid grid-cols-2 gap-x-12 gap-y-2">
        <AppLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :external="link.external"
          class="text-sm text-muted transition-colors hover:text-default"
        >
          {{ link.label }}
        </AppLink>
      </nav>
    </UContainer>

    <UContainer class="border-t border-default py-6">
      <p class="text-sm text-muted">{{ t('footer.rights', { year, name: t('brand.name') }) }}</p>
    </UContainer>
  </footer>
</template>
