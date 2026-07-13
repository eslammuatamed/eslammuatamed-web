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
  <UContainer class="py-16">
    <UiSectionHeader as="h1" :eyebrow="t('nav.blog')" :title="t('blog.title')" />
    <p class="mt-3 max-w-2xl text-muted">{{ t('blog.description') }}</p>

    <!-- Skeletons cover client-side page changes; SSR first paint is already content-complete
         (D13-2). -->
    <div v-if="status === 'pending'" class="mt-10 grid gap-4 sm:grid-cols-2">
      <USkeleton v-for="n in 4" :key="n" class="h-40 w-full rounded-card" />
    </div>

    <div v-else-if="error" class="mt-10 rounded-card border border-default p-8 text-center">
      <p class="text-h3 text-highlighted">{{ t('blog.errorTitle') }}</p>
      <p class="mt-2 text-muted">{{ t('blog.errorBody') }}</p>
      <UButton class="mt-4" variant="subtle" color="neutral" @click="refresh()">
        {{ t('common.retry') }}
      </UButton>
    </div>

    <div v-else-if="!data || data.data.length === 0" class="mt-10 rounded-card border border-default p-8 text-center">
      <p class="text-h3 text-highlighted">{{ t('blog.emptyTitle') }}</p>
      <p class="mt-2 text-muted">{{ t('blog.emptyBody') }}</p>
    </div>

    <template v-else>
      <div class="mt-10 grid gap-4 sm:grid-cols-2">
        <ContentArticleCard v-for="article in data.data" :key="article.id" :article="article" />
      </div>

      <div v-if="data.meta.totalPages > 1" class="mt-10 flex justify-center">
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
