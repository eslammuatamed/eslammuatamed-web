<script setup lang="ts">
// Section datum label — the one section-intro pattern across the home (doc 13 §9), rebuilt as the
// brand's Datum device (brand-identity.md §5): an eyebrow + heading over a hairline rule led by a short
// violet tick — "one accent occurrence per composition (a datum point or a rule)". The eyebrow is a
// word, not a mono coordinate: JetBrains Mono has no Arabic glyphs, so mono is reserved for numeric meta
// (years, dates) and never carries a localized word (HR-3). Latin eyebrows get tracked small-caps; Arabic
// keeps normal casing and zero tracking (letter-spacing breaks connected script — doc 03 §3). Heading
// level is caller-controlled so the document outline never skips (doc 21 §1).
interface Props {
  title: string
  eyebrow?: string
  as?: 'h1' | 'h2' | 'h3'
}

withDefaults(defineProps<Props>(), { as: 'h2', eyebrow: undefined })

const { locale } = useI18n()
// Latin-only refinement: tracked uppercase reads as a technical label; disabled for Arabic.
const eyebrowClass = computed(() =>
  locale.value === 'ar' ? 'font-medium' : 'font-medium uppercase tracking-[0.16em]'
)
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p v-if="eyebrow" :class="eyebrowClass" class="text-caption text-muted">{{ eyebrow }}</p>
        <component :is="as" class="mt-2 text-balance text-h2 text-highlighted">{{ title }}</component>
      </div>
      <div v-if="$slots.action" class="shrink-0 pb-1">
        <slot name="action" />
      </div>
    </div>

    <!-- Datum rule: a short violet tick (the single accent occurrence) then a hairline across the
         column. Logical flow mirrors in RTL — the tick sits at the inline-start edge in both directions. -->
    <div class="mt-5 flex items-center" aria-hidden="true">
      <span class="h-px w-10 bg-[var(--ui-primary)]" />
      <span class="h-px flex-1 bg-[var(--ui-border)]" />
    </div>
  </div>
</template>
