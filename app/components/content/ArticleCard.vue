<script setup lang="ts">
import type { ArticleListItem } from '~/types/models'

// Article card (doc 13 §9): meta row, title, excerpt. The whole card is clickable through a
// single accessible link — the title link stretches over the card via a pseudo-element, so
// assistive tech announces one link, not a nest (doc 21 §1).
interface Props {
  article: ArticleListItem
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const publishedLabel = computed(() => formatDate(props.article.publishedAt, locale.value))
const readingLabel = computed(() => t('blog.minRead', { count: props.article.readingTimeMin }))
</script>

<template>
  <article
    class="group relative rounded-card border border-default p-6 transition-colors hover:bg-elevated"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
      <span class="font-medium text-default">{{ article.category.name }}</span>
      <span aria-hidden="true">·</span>
      <time :datetime="article.publishedAt">{{ publishedLabel }}</time>
      <span aria-hidden="true">·</span>
      <span>{{ readingLabel }}</span>
    </div>

    <h3 class="mt-3 text-h3 text-highlighted">
      <AppLink
        :to="`/blog/${article.slug}`"
        class="after:absolute after:inset-0 group-hover:text-link"
      >
        {{ article.title }}
      </AppLink>
    </h3>

    <p class="mt-2 line-clamp-2 text-muted">{{ article.excerpt }}</p>
  </article>
</template>
