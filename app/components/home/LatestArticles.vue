<script setup lang="ts">
import type { ArticleListItem } from '~/types/models'

// Latest articles (FR-PUB-014): up to 3 recent posts. Cards link to `/blog/{slug}`, which is already
// built (M1) — real, non-404 depth from the home page. Empty → omitted; error → inline retry.
interface Props {
  articles: readonly ArticleListItem[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const items = computed(() => (props.articles ?? []).slice(0, 3))
const show = computed(() => props.pending || props.error || items.value.length > 0)
</script>

<template>
  <section v-if="show" class="py-[var(--space-section)]">
    <UContainer>
      <UiSectionHeader :eyebrow="t('home.articles.eyebrow')" :title="t('home.articles.title')">
        <template #action>
          <AppLink to="/blog" class="text-body-sm text-link">{{ t('common.viewAll') }}</AppLink>
        </template>
      </UiSectionHeader>

      <UiStateError v-if="error" class="mt-8" @retry="$emit('retry')" />
      <UiSectionSkeleton v-else-if="pending" class="mt-8" :count="3" />

      <div v-else class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ContentArticleCard v-for="article in items" :key="article.id" :article="article" />
      </div>
    </UContainer>
  </section>
</template>
