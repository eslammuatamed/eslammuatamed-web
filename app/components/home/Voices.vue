<script setup lang="ts">
import type { Testimonial } from '~/types/models'

// Endorsements (FR-PUB-016) — testimonials as a row of pull quotes on a lifted surface. Order is honored
// from the API. Empty → omitted; error → inline retry (NFR-DEGRADE). Presentational.
interface Props {
  testimonials: readonly Testimonial[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() => props.testimonials ?? [])
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <UiSpread v-if="show" tone="lift" aria-labelledby="voices-title">
    <UiSectionHead
      :eyebrow="t('home.testimonials.eyebrow')"
      :title="t('home.testimonials.title')"
      title-id="voices-title"
    />

    <UiStateError v-if="error" class="mt-10" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-10" :count="3" />

    <div v-else class="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
      <ContentQuoteBlock v-for="testimonial in items" :key="testimonial.id" :testimonial="testimonial" />
    </div>
  </UiSpread>
</template>
