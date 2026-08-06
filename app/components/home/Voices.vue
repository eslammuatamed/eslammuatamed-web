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
const hasData = computed(() => items.value.length > 0)
// Split pending into initial-load (skeleton) vs revalidation with content on screen (overlay).
const initialPending = computed(() => props.pending && !hasData.value)
const refreshing = computed(() => props.pending && hasData.value)
const show = computed(() => props.pending || props.error || hasData.value)
</script>

<template>
  <UiSpread v-if="show" tone="glass" aria-labelledby="voices-title">
    <UiSectionHead
      :eyebrow="t('home.testimonials.eyebrow')"
      :title="t('home.testimonials.title')"
      title-id="voices-title"
    />

    <UiRequestState
      class="mt-12 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="error"
      skeleton="quotes"
      @retry="$emit('retry')"
    >
      <div class="grid gap-x-10 gap-y-10 md:grid-cols-3">
        <ContentQuoteBlock v-for="testimonial in items" :key="testimonial.id" :testimonial="testimonial" />
      </div>
    </UiRequestState>
  </UiSpread>
</template>
