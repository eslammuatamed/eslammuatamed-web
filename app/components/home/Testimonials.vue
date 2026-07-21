<script setup lang="ts">
import type { Testimonial } from '~/types/models'

// Testimonials (FR-PUB-016): curated social proof, ordered by the dashboard `order`. Linear layout,
// never a carousel (D13-10). Empty → omitted; error → inline retry (NFR-DEGRADE).
interface Props {
  testimonials: readonly Testimonial[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

// The owner curates which testimonials are visible (dashboard); the home page shows the top few by
// `order` and bounds the count so the section stays restrained even if many are marked visible
// (code-review WD-8). Deeper curation lives on a future dedicated surface, not here.
const MAX_TESTIMONIALS = 6
const items = computed(() =>
  (props.testimonials ?? []).slice().sort((a, b) => a.order - b.order).slice(0, MAX_TESTIMONIALS)
)
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <section v-if="show" class="py-[var(--space-section)]">
    <UContainer>
      <UiSectionHeader :eyebrow="t('home.testimonials.eyebrow')" :title="t('home.testimonials.title')" />

      <UiStateError v-if="error" class="mt-8" @retry="$emit('retry')" />
      <UiSectionSkeleton v-else-if="pending" class="mt-8" :count="2" />

      <div v-else class="mt-8 grid gap-6 md:grid-cols-2">
        <ContentTestimonialCard v-for="testimonial in items" :key="testimonial.id" :testimonial="testimonial" />
      </div>
    </UContainer>
  </section>
</template>
