<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Hero (FR-PUB-010) — the identity composition and LCP surface (text + inline SVG only, no raster, so
// first paint is instant — doc 20 §4). It answers "who, what level, available?" in one viewport (F-P1):
// the Monolith mark anchors the identity, the display name and role carry it, an authored value line
// states the level, the availability pill states the status, and the primary/secondary CTAs set the
// hierarchy. Name/tagline are API-localized (D10-6) and nullable in the contract, so they fall back to
// the brand i18n strings rather than rendering empty. The six-technology strip is the owner-profile §8
// identity stack, expressed monochrome in the brand "Mirror" language (never tech colours here — those
// are the tech-stack section's accents). Entrance motion is one CSS rise, reduced-motion-safe (doc 03 §5).
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const name = computed(() => props.settings.siteName ?? t('brand.name'))
const tagline = computed(() => props.settings.tagline ?? t('brand.role'))

// The identity stack (owner-profile §8) — Latin proper nouns, kept LTR inside Arabic via `bdi`.
const stack = ['JavaScript', 'TypeScript', 'Vue', 'Nuxt', 'Node.js', 'Nest.js']
</script>

<template>
  <section class="relative overflow-hidden border-b border-default">
    <UContainer class="py-[clamp(4rem,3rem+7vw,7.5rem)]">
      <div class="grid items-center gap-x-12 gap-y-14 lg:grid-cols-[1.5fr_1fr]">
        <div class="animate-rise max-w-2xl">
          <div class="flex items-center gap-3">
            <UiBrandMark :size="30" class="text-highlighted" />
            <p
              v-if="settings.availabilityStatus"
              class="inline-flex items-center gap-2 rounded-full border border-default bg-elevated py-1 pe-3 ps-2.5 text-caption text-muted"
            >
              <span class="size-1.5 shrink-0 rounded-full bg-[var(--ui-primary)]" aria-hidden="true" />
              {{ settings.availabilityStatus }}
            </p>
          </div>

          <h1 class="mt-7 text-display text-highlighted text-balance">{{ name }}</h1>
          <p class="mt-3 text-h2 font-normal text-muted">{{ tagline }}</p>
          <p class="mt-6 max-w-xl text-body-lg text-default">{{ t('home.hero.valueProp') }}</p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            <UButton :to="localePath('/projects')" size="lg">
              <span>{{ t('home.hero.viewWork') }}</span>
              <UIcon name="i-lucide-arrow-right" class="size-4 rtl:-scale-x-100" />
            </UButton>
            <UButton :to="localePath('/contact')" size="lg" color="neutral" variant="subtle">
              {{ t('home.hero.contact') }}
            </UButton>
          </div>
        </div>

        <!-- Identity plate: the mark framed as a drawing plate (Datum grid language). Decorative — the
             accessible identity is the h1 above (AP-9). Trailing column on desktop, below the text on
             mobile; mirrors with the grid in RTL. -->
        <div class="justify-self-center lg:justify-self-end">
          <div
            class="relative grid aspect-square w-44 place-items-center rounded-card border border-default bg-elevated sm:w-52 lg:w-64"
          >
            <UiBrandMark :size="150" class="text-muted" />
            <!-- Datum crop marks — the drawing-plate register (brand §5), hairline, neutral. -->
            <span class="absolute start-4 top-4 size-3 border-s border-t border-default" aria-hidden="true" />
            <span class="absolute bottom-4 end-4 size-3 border-e border-b border-default" aria-hidden="true" />
          </div>
        </div>
      </div>

      <!-- Identity stack — monochrome, mono for the Latin names (honest code register), hairline-led. -->
      <div class="animate-rise mt-16 border-t border-default pt-6 [animation-delay:80ms]">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p class="text-caption text-muted">{{ t('home.hero.stackLabel') }}</p>
          <ul class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li v-for="tech in stack" :key="tech" class="font-mono text-body-sm text-default">
              <bdi>{{ tech }}</bdi>
            </li>
          </ul>
        </div>
      </div>
    </UContainer>
  </section>
</template>
