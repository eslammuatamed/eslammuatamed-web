<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Contact section (FR-PUB-017): a link to the contact form plus a direct-email fallback that survives
// an API outage (D05-4). The email is data-driven — the `mailto:` profile link from settings — so no
// address is hardcoded; when none is configured, only the form link shows. The form page ships in the
// follow-on public-pages feature (may 404 until then); the email path always works.
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const emailLink = computed(
  () => props.settings.profileLinks.find(link => link.url.startsWith('mailto:')) ?? null
)
</script>

<template>
  <section class="py-[var(--space-section)]">
    <UContainer>
      <div class="max-w-2xl">
        <UiSectionHeader :eyebrow="t('home.contact.eyebrow')" :title="t('home.contact.title')" />
        <p class="mt-4 text-body-lg text-muted">{{ t('home.contact.body') }}</p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UButton :to="localePath('/contact')" size="lg">{{ t('home.contact.form') }}</UButton>
          <UButton
            v-if="emailLink"
            :to="emailLink.url"
            size="lg"
            color="neutral"
            variant="subtle"
          >
            {{ emailLink.label }}
          </UButton>
        </div>
      </div>
    </UContainer>
  </section>
</template>
