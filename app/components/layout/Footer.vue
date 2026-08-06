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

// WhatsApp as site-wide chrome (018). Derived by the shared `buildWhatsappUrl` so the Footer can
// never offer a number `/contact` withholds — one gate, one URL shape, three surfaces. It is a
// FIELD READ on the settings call already made above, not a second reader: adding a reader is the
// regression BLK-2 removed, and the settings-dedupe lane is the gate that proves it.
// `null` here means the row does not render at all: no placeholder, no disabled control.
const whatsappUrl = computed(() => buildWhatsappUrl(settings.value?.whatsappPhone, t('contact.whatsappMessage')))

const isHttp = (url: string) => /^https?:\/\//.test(url)
</script>

<template>
  <footer class="border-t border-default">
    <UContainer class="grid gap-x-12 gap-y-12 py-16 md:grid-cols-[1.5fr_1fr]">
      <div class="max-w-sm">
        <AppLink to="/" class="inline-flex items-center gap-2.5">
          <UiBrandMark :size="20" class="text-primary" />
          <span class="nameplate font-display text-lg font-semibold tracking-tight text-highlighted">
            {{ t('brand.name') }}
          </span>
        </AppLink>
        <p class="mt-4 text-body-sm text-muted text-pretty">{{ t('footer.colophon') }}</p>

        <p
          v-if="availability"
          class="mt-6 inline-flex items-center gap-2 text-body-sm text-muted"
        >
          <span class="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <bdi>{{ availability }}</bdi>
        </p>

        <!-- Icon-only social (007): the platform icon is the affordance; the visible name is dropped but
             the accessible name is carried on the link via aria-label. Padded icon buttons keep a
             comfortable target even without visible text.

             WhatsApp is the LAST chip in this same row, not a row of its own. The earlier treatment
             gave it a visible label on the reasoning that one unfamiliar affordance needs its name
             to carry it; in practice it read as a stray full-width link under a tidy icon row, so
             the owner moved it in. Order is GitHub → LinkedIn → Email → WhatsApp: the governed
             `profileLinks` order supplies the first three and WhatsApp is appended, so it stays last
             without this component sorting anything.

             `wrap` is on the row, so a narrow viewport reflows all four as ONE group — WhatsApp must
             never fall back to a standalone full-width row. -->
        <ul
          v-if="socialLinks.length || whatsappUrl"
          class="mt-6 flex flex-wrap items-center gap-3"
        >
          <li v-for="link in socialLinks" :key="link.url">
            <a
              :href="link.url"
              :aria-label="link.label"
              :target="isHttp(link.url) ? '_blank' : undefined"
              :rel="isHttp(link.url) ? 'me noopener noreferrer' : 'me'"
              class="grid size-10 place-items-center rounded-full border border-default text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <UIcon :name="link.icon || 'i-lucide-link'" class="size-5" aria-hidden="true" />
            </a>
          </li>

          <!-- The number itself is NOT printed here (018): /contact is where the number is shown, the
               Footer is an action. The class list is copied verbatim from the sibling above — same
               size, border, hover, focus and theme behaviour — because "matches the other buttons"
               has to be true structurally, not approximately. `rel` omits `me`: wa.me is a message
               endpoint, not a profile the owner claims. -->
          <li v-if="whatsappUrl">
            <a
              :href="whatsappUrl"
              :aria-label="t('footer.whatsappLabel')"
              target="_blank"
              rel="noopener noreferrer"
              class="grid size-10 place-items-center rounded-full border border-default text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <UIcon name="i-simple-icons-whatsapp" class="size-5" aria-hidden="true" />
            </a>
          </li>
        </ul>

        <div class="mt-8 flex items-center gap-2">
          <LayoutLangToggle />
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
