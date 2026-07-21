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

    <!-- Skeletons cover client-side page changes; SSR first paint is already content-complete
         (D13-2). -->
    <div v-if="status === 'pending'" class="mt-12 flex flex-col gap-6">
      <USkeleton v-for="n in 4" :key="n" class="h-24 w-full rounded-card" />
    </div>

    <div v-else-if="error" class="mt-12 rounded-card border border-default bg-elevated p-8" role="alert">
      <p class="font-display text-h3 text-highlighted">{{ t('blog.errorTitle') }}</p>
      <p class="mt-2 text-muted">{{ t('blog.errorBody') }}</p>
      <UButton class="mt-4" variant="subtle" color="neutral" @click="refresh()">
        {{ t('common.retry') }}
      </UButton>
    </div>

    <div v-else-if="!data || data.data.length === 0" class="mt-12 rounded-card border border-default bg-elevated p-8">
      <p class="font-display text-h3 text-highlighted">{{ t('blog.emptyTitle') }}</p>
      <p class="mt-2 text-muted">{{ t('blog.emptyBody') }}</p>
    </div>

    <template v-else>
      <div class="mt-12">
        <ContentArticleRow v-for="article in data.data" :key="article.id" :article="article" />
      </div>

      <div v-if="data.meta.totalPages > 1" class="mt-12 flex justify-center">
        <UPagination
          :page="page"
          :total="data.meta.total"
          :items-per-page="data.meta.perPage"
          :to="(p: number) => ({ query: { page: p } })"
        />
      </div>
    </template>
  </UContainer>
</template>
