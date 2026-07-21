<script setup lang="ts">
import type { ArticleListItem, Paginated } from '~/types/models'

// Paginated blog index (FR-PUB-040). Page state lives in the URL query (linkable, SEO-legible —
// D13-4); the list is keyed by locale + page so each combination caches on its own.
const { t, locale } = useI18n()
const route = useRoute()
const api = useApi()

const page = computed(() => Number(route.query.page) || 1)

const { data, status, error, refresh } = await useAsyncData(
  () => `articles:${locale.value}:${page.value}`,
  () => api<Paginated<ArticleListItem>>('/articles', { query: { page: page.value } }),
  { watch: [page] }
)

// Split pending into initial-load (skeleton) vs a page change with content already on screen
// (branded overlay, not a skeleton) — useAsyncData keeps the previous `data` while refetching.
const hasData = computed(() => !!data.value)
const initialPending = computed(() => status.value === 'pending' && !hasData.value)
const refreshing = computed(() => status.value === 'pending' && hasData.value)
// A list page shows a real empty state (unlike optional home sections, which omit — doc 13 §9.1).
const isEmpty = computed(() => !!data.value && data.value.data.length === 0)

useSeoMeta({
  title: () => t('seo.blog.title'),
  description: () => t('seo.blog.description'),
  ogTitle: () => `${t('seo.blog.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.blog.description')
})
</script>

<template>
  <UContainer class="py-[var(--space-section)]">
    <header class="max-w-2xl">
      <p class="kicker text-dimmed">{{ t('nav.blog') }}</p>
      <h1 class="mt-4 font-display text-display text-highlighted text-balance">{{ t('blog.title') }}</h1>
      <p class="mt-5 text-body-lg text-muted text-pretty">{{ t('blog.description') }}</p>
    </header>

    <!-- The list consumes the shared data-state contract (doc 13 §9.1): initial → skeleton, error →
         localized retry, empty → localized copy, loaded → list with a branded overlay during a page
         change (SSR first paint is already content-complete — D13-2). -->
    <UiRequestState
      class="mt-12 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="Boolean(error)"
      :empty="isEmpty"
      skeleton="articles"
      :count="6"
      @retry="refresh()"
    >
      <template #error>
        <div class="rounded-card border border-default bg-elevated p-8" role="alert">
          <p class="font-display text-h3 text-highlighted">{{ t('blog.errorTitle') }}</p>
          <p class="mt-2 text-muted">{{ t('blog.errorBody') }}</p>
          <UButton class="mt-4" variant="subtle" color="neutral" @click="refresh()">
            {{ t('common.retry') }}
          </UButton>
        </div>
      </template>

      <template #empty>
        <div class="rounded-card border border-default bg-elevated p-8">
          <p class="font-display text-h3 text-highlighted">{{ t('blog.emptyTitle') }}</p>
          <p class="mt-2 text-muted">{{ t('blog.emptyBody') }}</p>
        </div>
      </template>

      <ContentArticleRow v-for="article in (data?.data ?? [])" :key="article.id" :article="article" />
    </UiRequestState>

    <div v-if="data && data.data.length && data.meta.totalPages > 1" class="mt-12 flex justify-center">
      <UPagination
        :page="page"
        :total="data.meta.total"
        :items-per-page="data.meta.perPage"
        :to="(p: number) => ({ query: { page: p } })"
      />
    </div>
  </UContainer>
</template>
