<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Contact (FR-PUB-017) — the closing ink spread, composed as the verso of the paper hero: the page opens
// on the name and closes on the invitation. A form link plus a direct-email fallback that survives an API
// outage (D05-4); the email is the data-driven `mailto:` profile link, so no address is hardcoded, and it
// only shows when configured. Social hrefs are scheme-filtered (security review WD-5) — Vue does not
// sanitize `:href`, so a hostile url is dropped rather than rendered. The form page ships in web-005 and
// may 404 until then; the email and social paths always work.
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const SAFE_SCHEME = /^(https?:|mailto:)/i
const emailLink = computed(
  () => props.settings.profileLinks.find(link => link.url.startsWith('mailto:')) ?? null
)
const socialLinks = computed(() =>
  (props.settings.profileLinks ?? []).filter(link => SAFE_SCHEME.test(link.url) && !link.url.startsWith('mailto:'))
)
const isHttp = (url: string) => /^https?:\/\//.test(url)
</script>

<template>
  <UiSpread tone="glass-strong" aria-labelledby="contact-title">
    <div class="flex flex-col gap-x-16 gap-y-12 lg:flex-row lg:items-end lg:justify-between">
      <div class="max-w-2xl">
        <p class="kicker text-link">{{ t('home.contact.eyebrow') }}</p>
        <h2 id="contact-title" class="mt-4 font-display text-display text-highlighted text-balance">
          {{ t('home.contact.title') }}
        </h2>
        <p class="mt-5 text-body-lg text-muted text-pretty">{{ t('home.contact.body') }}</p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <UButton :to="localePath('/contact')" size="lg" class="font-medium text-white">
            <span>{{ t('home.contact.form') }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-4 rtl:-scale-x-100" />
          </UButton>
          <UButton
            v-if="emailLink"
            :to="emailLink.url"
            size="lg"
            color="neutral"
            variant="outline"
          >
            {{ emailLink.label }}
          </UButton>
        </div>
      </div>

      <!-- Coordinates: availability echo + social — the closing colophon of the invitation. -->
      <div class="flex flex-col gap-5">
        <p
          v-if="settings.availabilityStatus"
          class="inline-flex items-center gap-2 text-body-sm text-muted"
        >
          <span class="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <bdi>{{ settings.availabilityStatus }}</bdi>
        </p>
        <ul v-if="socialLinks.length" class="flex flex-wrap items-center gap-3">
          <li v-for="link in socialLinks" :key="link.url">
            <a
              :href="link.url"
              :aria-label="link.label"
              :target="isHttp(link.url) ? '_blank' : undefined"
              :rel="isHttp(link.url) ? 'me noopener noreferrer' : 'me'"
              class="grid size-10 place-items-center rounded-full border border-default text-muted transition-colors hover:border-primary hover:text-highlighted"
            >
              <UIcon :name="link.icon || 'i-lucide-link'" class="size-5" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </div>
    </div>
  </UiSpread>
</template>
