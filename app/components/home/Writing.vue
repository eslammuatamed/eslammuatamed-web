<script setup lang="ts">
import type { ArticleListItem } from '~/types/models'

// Writing (FR-PUB-015 slice) — the three latest published articles as a reading list on paper. The page
// requests perPage 3 already ordered by the API. Empty → omitted; error → inline retry (NFR-DEGRADE).
interface Props {
  articles: readonly ArticleListItem[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() => (props.articles ?? []).slice(0, 3))
const hasData = computed(() => items.value.length > 0)
// Split pending into initial-load (skeleton) vs revalidation with content on screen (overlay).
const initialPending = computed(() => props.pending && !hasData.value)
const refreshing = computed(() => props.pending && hasData.value)
const show = computed(() => props.pending || props.error || hasData.value)
</script>

<template>
  <UiSpread v-if="show" aria-labelledby="writing-title">
    <UiSectionHead :eyebrow="t('home.articles.eyebrow')" :title="t('home.articles.title')" title-id="writing-title">
      <template #action>
        <AppLink to="/blog" class="group inline-flex items-center gap-2 text-body-sm text-link">
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
      skeleton="articles"
      @retry="$emit('retry')"
    >
      <ContentArticleRow v-for="article in items" :key="article.id" :article="article" />
    </UiRequestState>
  </UiSpread>
</template>
