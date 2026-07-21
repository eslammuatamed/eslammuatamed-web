<script setup lang="ts">
// Footer (doc 04 §3): repeats the header nav and adds the settings-driven chrome (FR-PUB-003) —
// availability, social links, and a résumé download. Settings load through the shared useSiteSettings,
// deduped by key with the home hero (one request per locale render). When the API is down the
// settings-driven rows simply hide (graceful degradation), leaving the nav shell intact. Raw paths go
// to AppLink, which owns locale resolution — pre-localizing here would double-prefix under /ar.
const { t } = useI18n()
const { data: settings } = await useSiteSettings()

const year = new Date().getFullYear()

const links = computed(() => [
  { label: t('nav.projects'), to: '/projects' },
  { label: t('nav.blog'), to: '/blog' },
  { label: t('nav.experience'), to: '/experience' },
  { label: t('nav.about'), to: '/about' },
  { label: t('nav.resume'), to: '/resume' },
  { label: t('nav.contact'), to: '/contact' }
])

// Scheme allowlist on the settings-driven social `href` (security review WD-5): Vue does not sanitize
// `:href`, so a hostile `profileLinks[].url` like `javascript:…` (only writable via the admin surface)
// would render a live sink. Filtering the list drops unsafe entries rather than rendering them.
const SAFE_SCHEME = /^(https?:|mailto:)/i
const socialLinks = computed(() =>
  (settings.value?.profileLinks ?? []).filter(link => SAFE_SCHEME.test(link.url))
)
const availability = computed(() => settings.value?.availabilityStatus ?? null)
const resume = computed(() => settings.value?.resumeAsset ?? null)

const isHttp = (url: string) => /^https?:\/\//.test(url)
</script>

<template>
  <footer class="mt-24 border-t border-default">
    <UContainer class="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-xs">
        <p class="text-base font-semibold text-highlighted">{{ t('brand.name') }}</p>
        <p class="mt-2 text-sm text-muted">{{ t('footer.builtWith') }}</p>

        <p
          v-if="availability"
          class="mt-4 inline-flex items-center gap-2 text-sm text-muted"
        >
          <span class="size-2 shrink-0 rounded-full bg-[var(--ui-primary)]" aria-hidden="true" />
          {{ availability }}
        </p>

        <ul v-if="socialLinks.length" class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <li v-for="link in socialLinks" :key="link.url">
            <a
              :href="link.url"
              :target="isHttp(link.url) ? '_blank' : undefined"
              :rel="isHttp(link.url) ? 'me noopener noreferrer' : 'me'"
              class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
            >
              <UIcon v-if="link.icon" :name="link.icon" class="size-4" aria-hidden="true" />
              {{ link.label }}
            </a>
          </li>
        </ul>

        <p v-if="resume" class="mt-4">
          <AppLink
            :to="resume.url"
            :external="true"
            class="text-sm text-muted transition-colors hover:text-default"
          >
            {{ t('footer.downloadResume') }}
          </AppLink>
        </p>

        <div class="mt-6 flex items-center gap-1">
          <LayoutLocaleSwitcher />
          <LayoutThemeToggle />
        </div>
      </div>

      <nav :aria-label="t('a11y.footerNav')" class="grid grid-cols-2 gap-x-12 gap-y-2">
        <AppLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
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
