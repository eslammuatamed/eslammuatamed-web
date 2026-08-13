<script setup lang="ts">
import type { Article } from '~/types/models'

// Draft-preview of an article (D10-11). Renders the DRAFT through the same header + `ContentProse`
// markup as the live blog page (blog/[slug].vue), so a reviewer sees exactly what will publish.
// All security (noindex, no-referrer, no token leak, opaque failure) lives in `usePreview`.
definePageMeta({ layout: 'preview', middleware: 'preview-locale' })

const { t, locale } = useI18n()
const { document: article, unavailable } = await usePreview<Article>('articles')

const publishedLabel = computed(() =>
  article.value?.publishAt ? formatDate(article.value.publishAt, locale.value) : ''
)
</script>

<template>
  <PreviewUnavailable v-if="unavailable" />

  <UContainer v-else-if="article" class="py-16">
    <article>
      <header class="mb-8">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <!-- Null when the category has no translation in this locale (D10-20). Separators here
               precede their item, so each one is guarded on something actually preceding it. -->
          <span v-if="article.category" class="font-medium text-default">{{ article.category.name }}</span>
          <template v-if="publishedLabel">
            <span v-if="article.category" aria-hidden="true">·</span>
            <time :datetime="article.publishAt ?? undefined">{{ publishedLabel }}</time>
          </template>
          <span v-if="article.category || publishedLabel" aria-hidden="true">·</span>
          <span>{{ t('blog.minRead', { count: article.readingTimeMin }) }}</span>
        </div>
        <h1 class="mt-4 text-h1 text-highlighted">{{ article.title }}</h1>
      </header>

      <ContentProse :source="article.body" :cache-key="`preview:article:${article.id}:${locale}`" />
    </article>
  </UContainer>
</template>
