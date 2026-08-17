<script setup lang="ts">
import type { Experience } from '~/types/models'

// Experience (FR-PUB-013) — the career as a vertical timeline on a lifted surface (the section where a
// real sequence earns an ordered structure). Empty → omitted; error → inline retry (NFR-DEGRADE).
//
// ORDER IS THE API'S, RENDERED VERBATIM (D02-11). This component used to re-sort locally by
// `isCurrent` then `startDate` desc. D02-11 names that exact practice as the rejected alternative —
// and names this component as the defect: "`/experience`, `/resume` and Home must not be able to
// disagree — they did, precisely because Home sorted locally while the others rendered the API order
// verbatim."
//
// The governed order is `isCurrent` DESC → `startDate` DESC → `order` ASC → `id` ASC. The local sort
// implemented only the first two terms, so it silently discarded `order` — the owner's
// dashboard-controlled tie-breaker — whenever it moved a row, and it could not express `id` at all.
// WD-7's "a current role always leads" is preserved: it is the API sort's leading term, not something
// this component has to add.
interface Props {
  experiences: readonly Experience[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() => props.experiences ?? [])
const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing, show } = useRequestState(
  () => props.pending,
  hasData,
  () => props.error
)
</script>

<template>
  <UiSpread v-if="show" tone="lift" aria-labelledby="experience-title">
    <UiSectionHead
      :eyebrow="t('home.experience.eyebrow')"
      :title="t('home.experience.title')"
      title-id="experience-title"
    >
      <template #action>
        <AppLink to="/experience" class="group -my-1 inline-flex items-center gap-2 py-1 text-body-sm text-link">
          {{ t('common.viewAll') }}
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
        </AppLink>
      </template>
    </UiSectionHead>

    <UiRequestState
      class="mt-12 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="error"
      skeleton="timeline"
      @retry="$emit('retry')"
    >
      <ol class="max-w-3xl">
        <ContentTimelineEntry v-for="experience in items" :key="experience.id" :experience="experience" />
      </ol>
    </UiRequestState>
  </UiSpread>
</template>
