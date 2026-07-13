<script setup lang="ts">
import type { Article, Envelope } from '~/types/models'

// Article page (FR-PUB-042): body rendered through the single ContentProse surface. Nuxt captures a
// useAsyncData handler throw into `error` (it does NOT re-throw from the awaited call), so we map it
// explicitly after the await: a genuine 404 stays a 404; any other failure keeps its real status
// (review MAJOR-1 — never mask a 5xx/transport error as a deindexable 404).
const { t, locale } = useI18n()
const route = useRoute()
const api = useApi()

const slug = computed(() => String(route.params.slug))

const { data: article, error } = await useAsyncData(`article:${slug.value}:${locale.value}`, () =>
  api<Envelope<Article>>(`/articles/${slug.value}`).then(res => res.data)
)

if (error.value) {
  throw createError({ ...articleErrorParams(error.value), fatal: true })
}

if (!article.value) {
  throw createError({ status: 404, statusText: 'Article not found', fatal: true })
}

const publishedLabel = computed(() =>
  article.value?.publishAt ? formatDate(article.value.publishAt, locale.value) : ''
)

useSeoMeta({
  title: () => article.value?.title,
  description: () => article.value?.excerpt,
  ogTitle: () => article.value?.title,
  ogDescription: () => article.value?.excerpt,
  ogType: 'article'
})
</script>

<template>
  <UContainer v-if="article" class="py-16">
    <AppLink to="/blog" class="inline-flex items-center gap-1 text-sm text-link">
      <UIcon name="i-lucide-arrow-left" class="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {{ t('article.back') }}
    </AppLink>

    <article class="mt-8">
      <header class="mb-8">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span class="font-medium text-default">{{ article.category.name }}</span>
          <span aria-hidden="true">·</span>
          <time :datetime="article.publishAt ?? undefined">{{ publishedLabel }}</time>
          <span aria-hidden="true">·</span>
          <span>{{ t('blog.minRead', { count: article.readingTimeMin }) }}</span>
        </div>
        <h1 class="mt-4 text-h1 text-highlighted">{{ article.title }}</h1>
      </header>

      <ContentProse :source="article.body" :cache-key="`${article.id}:${locale}`" />
    </article>
  </UContainer>
</template>
