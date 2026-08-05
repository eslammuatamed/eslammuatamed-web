<script setup lang="ts">
import type { SiteSettings } from '~/types/models'

// Nameplate (FR-PUB-010) — the hero, rebuilt for 007 as type-as-thesis. There are no hero images in
// the data, so the name itself is the graphic: set monumentally in the display face (Space Grotesk /
// Cairo), it answers "who" before anything else. Below it a tight editorial cluster answers "what level"
// (role + value prop) and "available?" (a filled violet availability plane — the one saturated accent,
// used as a plane not a tick). The baseline states one true datum (years shipping, derived from
// careerStartYear — never a fabricated metric) opposite the technology identity line. Name/tagline are
// API-localized and nullable, so they fall back to the brand i18n strings. Entrance is one CSS rise,
// reduced-motion-safe (doc 03 §5). The whole composition is authored in logical properties, so EN and
// AR are mirror compositions rather than one layout translated (the redesign's thesis).
interface Props {
  settings: SiteSettings
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

const name = computed(() => props.settings.siteName ?? t('brand.name'))
const tagline = computed(() => props.settings.tagline ?? t('brand.role'))
const sinceYear = computed(() => props.settings.careerStartYear ?? null)

// The identity stack (owner-profile §8) — Latin proper nouns, kept LTR inside Arabic via `bdi`.
const stack = ['JavaScript', 'TypeScript', 'Vue', 'Nuxt', 'Node.js', 'Nest.js']
</script>

<template>
  <section class="relative overflow-hidden py-[clamp(4rem,3rem+8vw,8rem)]">
    <UContainer>
      <div class="animate-rise">
        <p
          v-if="settings.availabilityStatus"
          class="inline-flex items-center gap-2 rounded-full bg-primary py-1.5 pe-4 ps-3 text-caption font-medium text-white"
        >
          <span class="relative flex size-2 shrink-0" aria-hidden="true">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span class="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          <bdi>{{ settings.availabilityStatus }}</bdi>
        </p>

        <!-- Two classes, two jobs (019): `font-nameplate` selects the FACE per script (Reem Kufi under
             the Arabic root, D03-12); `.nameplate` carries the Latin SETTING and is script-scoped, so the
             Arabic hero is byte-for-byte what it was. No `UiWordmark` here on purpose — the mark already
             sits ~100px above in the sticky header, and this hero's thesis is that the name itself is the
             graphic, so a second Monolith would compete with it rather than identify it. -->
        <h1 class="mt-8 font-nameplate nameplate text-mega text-highlighted text-balance">{{ name }}</h1>

        <!-- Deliberate block gap below the name (bigger in Arabic, where the Reem Kufi name has taller
             verticals): responsive margin only — no spacer element / <br> / nbsp / locale hack.
             `whitespace-pre-line` honours the line break the governed title carries: the approved
             professional title is a two-line composition, and the break travels with the value
             rather than being re-invented here (no <br>, no per-locale split, no second string). -->
        <p class="mt-7 kicker whitespace-pre-line text-muted sm:mt-9">
          <bdi>{{ tagline }}</bdi>
        </p>
        <p class="mt-6 max-w-2xl text-body-lg text-default text-pretty">{{ t('home.hero.valueProp') }}</p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <UButton :to="localePath('/projects')" size="lg" class="font-medium text-white">
            <span>{{ t('home.hero.viewWork') }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-4 rtl:-scale-x-100" />
          </UButton>
          <UButton :to="localePath('/contact')" size="lg" color="neutral" variant="ghost">
            {{ t('home.hero.contact') }}
          </UButton>
        </div>
      </div>

      <!-- Baseline register: one true datum (years shipping) opposite the technology identity line,
           justified start/end so it reads as a deliberate measure rather than a loose strip. The stack
           is Latin proper nouns, kept LTR inside Arabic via `bdi`; it mirrors edge with the grid in RTL. -->
      <div
        class="animate-rise mt-14 flex flex-col gap-y-4 border-t border-default pt-6 text-body-sm md:flex-row md:items-center md:justify-between [animation-delay:90ms]"
      >
        <p v-if="sinceYear" class="text-muted">{{ t('home.hero.since', { year: sinceYear }) }}</p>
        <ul class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <li
            v-for="(tech, i) in stack"
            :key="tech"
            class="flex items-center gap-x-3 font-mono text-body-sm text-default"
          >
            <span v-if="i" class="text-dimmed" aria-hidden="true">·</span>
            <bdi>{{ tech }}</bdi>
          </li>
        </ul>
      </div>
    </UContainer>
  </section>
</template>
