<script setup lang="ts">
import type { ArticleListItem } from '~/types/models'

// Article row (FR-PUB-015 writing slice) — an article as a reading-list entry: a meta line (category /
// date / reading time), the title, and the excerpt. The whole row is one accessible link (stretched
// title pseudo-element — doc 21 §1) to `/blog/{slug}`, which is live. Reusable on the blog index. No
// cover in the list contract, so the row is typographic; digits stay Western via Intl (D03-4).
interface Props {
  article: ArticleListItem
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const publishedLabel = computed(() =>
  props.article.publishAt ? formatDate(props.article.publishAt, locale.value) : ''
)
const readingLabel = computed(() => t('blog.minRead', { count: props.article.readingTimeMin }))
</script>

<template>
  <!-- Same shared `row-glass` affordance as the project index row (024, D03-15) — one class, so the
       two repeated public row types cannot drift apart. -->
  <article
    class="group row-glass relative grid gap-x-10 gap-y-3 rounded-control border-t border-default py-7 transition first:border-t-0 md:grid-cols-[1fr_auto] md:items-baseline"
  >
    <div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-dimmed">
        <span class="font-medium text-muted">{{ article.category.name }}</span>
        <span aria-hidden="true">·</span>
        <time :datetime="article.publishAt ?? undefined">{{ publishedLabel }}</time>
        <span aria-hidden="true">·</span>
        <span>{{ readingLabel }}</span>
      </div>

      <h3 class="mt-3 font-display text-h3 text-highlighted transition-colors group-hover:text-link">
        <AppLink :to="`/blog/${article.slug}`" class="after:absolute after:inset-0">
          {{ article.title }}
        </AppLink>
      </h3>

      <p class="mt-2 max-w-2xl text-body-sm text-muted line-clamp-2 text-pretty">{{ article.excerpt }}</p>
    </div>

    <UIcon
      name="i-lucide-arrow-up-right"
      class="hidden size-5 shrink-0 text-dimmed transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-link md:block rtl:-scale-x-100"
      aria-hidden="true"
    />
  </article>
</template>
