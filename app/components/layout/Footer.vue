<script setup lang="ts">
// Footer (doc 04 §3), rebuilt for 007 as a colophon — fitting for an engineer whose thesis is documenting
// how things are built. It states the wordmark and an honest build line, repeats the nav, and adds the
// settings-driven chrome (FR-PUB-003): availability, social links, and a résumé download. Settings load
// through the shared useSiteSettings (deduped with the hero, D20-7); when the API is down the
// settings-driven rows simply hide (graceful degradation), leaving the nav shell intact. Raw paths go to
// AppLink, which owns locale resolution — pre-localizing here would double-prefix under /ar. Social hrefs
// are scheme-filtered (security review WD-5): Vue does not sanitize `:href`, so a hostile url is dropped.
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

const SAFE_SCHEME = /^(https?:|mailto:)/i
const socialLinks = computed(() =>
  (settings.value?.profileLinks ?? []).filter(link => SAFE_SCHEME.test(link.url))
)
const availability = computed(() => settings.value?.availabilityStatus ?? null)
const resume = computed(() => settings.value?.resumeAsset ?? null)

const isHttp = (url: string) => /^https?:\/\//.test(url)
</script>

<template>
  <footer class="border-t border-default">
    <UContainer class="grid gap-x-12 gap-y-12 py-16 md:grid-cols-[1.5fr_1fr]">
      <div class="max-w-sm">
        <AppLink to="/" class="font-display text-lg font-semibold tracking-tight text-highlighted">
          {{ t('brand.name') }}
        </AppLink>
        <p class="mt-4 text-body-sm text-muted text-pretty">{{ t('footer.colophon') }}</p>

        <p
          v-if="availability"
          class="mt-6 inline-flex items-center gap-2 text-body-sm text-muted"
        >
          <span class="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <bdi>{{ availability }}</bdi>
        </p>

        <ul v-if="socialLinks.length" class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <li v-for="link in socialLinks" :key="link.url">
            <a
              :href="link.url"
              :target="isHttp(link.url) ? '_blank' : undefined"
              :rel="isHttp(link.url) ? 'me noopener noreferrer' : 'me'"
              class="inline-flex items-center gap-2 text-body-sm text-muted transition-colors hover:text-highlighted"
            >
              <UIcon v-if="link.icon" :name="link.icon" class="size-4" aria-hidden="true" />
              {{ link.label }}
            </a>
          </li>
        </ul>

        <div class="mt-8 flex items-center gap-1">
          <LayoutLocaleSwitcher />
          <LayoutThemeToggle />
        </div>
      </div>

      <div class="flex flex-col gap-6 md:items-end">
        <nav :aria-label="t('a11y.footerNav')" class="grid grid-cols-2 gap-x-12 gap-y-3 md:text-end">
          <AppLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="text-body-sm text-muted transition-colors hover:text-highlighted"
          >
            {{ link.label }}
          </AppLink>
        </nav>
        <p v-if="resume">
          <AppLink
            :to="resume.url"
            :external="true"
            class="text-body-sm text-muted transition-colors hover:text-highlighted"
          >
            {{ t('footer.downloadResume') }}
          </AppLink>
        </p>
      </div>
    </UContainer>

    <UContainer class="border-t border-default py-6">
      <p class="text-caption text-dimmed">{{ t('footer.rights', { year, name: t('brand.name') }) }}</p>
    </UContainer>
  </footer>
</template>
