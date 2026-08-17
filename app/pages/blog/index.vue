<script setup lang="ts">
// Paginated blog index (FR-PUB-040). Filter and page state live in the URL query (linkable, survives
// reload and back/forward, legible to crawlers — D13-4); the list is keyed by locale + page + filter so
// each combination caches on its own. The locale is the ROUTE's (D06-6), and the key uses the same
// value the request sends.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Query rules live in `~/utils/blog-query` as pure functions so each one is unit-tested; every one of
// them is invisible in the rendered output until it is wrong.
const page = computed(() => readPage(route.query))
const category = computed(() => readCategory(route.query))

const { data, status, error, refresh } = await useArticlesList({
  page: () => page.value,
  category: () => category.value
})
const { data: categories } = await useArticleCategories()

// Split pending into initial-load (skeleton) vs a page change with content already on screen
// (branded overlay, not a skeleton) — useAsyncData keeps the previous `data` while refetching.
const hasData = computed(() => !!data.value)
const { initialPending, refreshing } = useRequestState(() => status.value === 'pending', hasData)
// A list page shows a real empty state (unlike optional home sections, which omit — doc 13 §9.1).
const isEmpty = computed(() => !!data.value && data.value.data.length === 0)
// "No articles at all" and "no articles in this category" are different situations and read differently.
const isFilteredEmpty = computed(() => isEmpty.value && category.value !== undefined)

/**
 * CATEGORY SLUGS ARE PER-LOCALE (D04-2) — the load-bearing difference from the projects filter, whose
 * Skill slugs are locale-independent.
 *
 * `SwitchLocalePathLink` carries the query string across a locale switch, so `/blog?category=engineering`
 * becomes `/ar/blog?category=engineering` — and `engineering` is not an Arabic category slug. The API
 * answers an unknown category with a well-formed EMPTY page (200), so without this the Arabic index
 * would render "no articles yet" and look broken, while the real cause is a filter that cannot exist
 * in this language.
 *
 * The categories list for the CURRENT locale is exactly the set of selectable values, so an active
 * filter that is not in it is not selectable here. That case gets its own copy and a recovery action
 * rather than being silently folded into the generic empty state. It is deliberately NOT auto-cleared:
 * rewriting the visitor's URL would hide that the link they followed does not carry over.
 */
const isUnknownCategory = computed(() =>
  category.value !== undefined
  && !!categories.value
  && !categories.value.some(item => item.slug === category.value)
)

/**
 * Writing the filter to the URL resets `page`: keeping page 3 while switching categories would land on
 * an out-of-range page and render an empty list that looks like a broken filter.
 *
 * `push`, so Back undoes a filter — the chips have no intermediate states and `UiChipFilter` refuses to
 * emit when the already-pressed chip is pressed again, so an identical URL is never pushed.
 */
function onCategoryChange(value: string | undefined): void {
  router.push({ path: route.path, query: buildCategoryQuery(value) })
}

/**
 * Pagination must carry the active filter, or paging silently widens the result set.
 *
 * RETURNS `undefined` FOR THE PAGE THE VISITOR IS ALREADY ON. Nuxt UI passes `:to` to every item
 * unconditionally (`Pagination.vue`), so the current page renders as a link to itself: `<NuxtLink>`
 * prefetches it, and on a cache-ruled route that prefetch costs a second server render of a page the
 * visitor already has. It is also a redundant tab stop. With no `to`, Nuxt UI renders that one item
 * as a plain button — which is the conventional accessible pagination shape anyway — and the active
 * colour/variant still mark it. Fixed in OUR callback, so no Nuxt UI component is replaced or patched.
 */
function pageLink(target: number) {
  if (target === page.value) return undefined
  return { query: buildBlogPageQuery(category.value, target) }
}

const categoryOptions = computed(() =>
  (categories.value ?? []).map(item => ({ value: item.slug, label: item.name }))
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

    <div class="mt-10">
      <UiChipFilter
        id="blog-filter"
        :label="t('blog.filter.label')"
        :all-label="t('blog.filter.all')"
        :options="categoryOptions"
        :model-value="category"
        :disabled="Boolean(error)"
        @update:model-value="onCategoryChange"
      />
    </div>

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
          <!-- Three distinct situations, three distinct messages. Folding the unknown-category case
               into "no articles yet" would state something false about the blog. -->
          <p class="font-display text-h3 text-highlighted">
            {{ isUnknownCategory
              ? t('blog.emptyUnknownCategoryTitle')
              : isFilteredEmpty ? t('blog.emptyFilteredTitle') : t('blog.emptyTitle') }}
          </p>
          <p class="mt-2 text-muted">
            {{ isUnknownCategory
              ? t('blog.emptyUnknownCategoryBody')
              : isFilteredEmpty ? t('blog.emptyFilteredBody') : t('blog.emptyBody') }}
          </p>
          <!--
            A LINK, not a `@click` button. This action does exactly one thing — go to the unfiltered
            index — so a link is what it is, and a link WORKS BEFORE HYDRATION. A button's handler does
            not exist until Vue attaches it, so a visitor who lands on this server-rendered page and
            clicks immediately gets nothing; that race is real, and it is what made this test fail
            intermittently rather than the test being wrong. It also restores middle-click and
            open-in-new-tab, which a button silently removes.

            `query: {}` drops `category` and `page` together, which is the same rule
            `buildCategoryQuery(undefined)` encodes for the chips.
          -->
          <UButton
            v-if="isFilteredEmpty"
            class="mt-4"
            variant="subtle"
            color="neutral"
            :to="{ path: route.path, query: {} }"
          >
            {{ t('blog.filter.clear') }}
          </UButton>
        </div>
      </template>

      <ContentArticleRow v-for="article in (data?.data ?? [])" :key="article.id" :article="article" />
    </UiRequestState>

    <div v-if="data && data.data.length && data.meta.totalPages > 1" class="mt-12 flex justify-center">
      <UPagination
        :page="page"
        :total="data.meta.total"
        :items-per-page="data.meta.perPage"
        :to="pageLink"
      />
    </div>
  </UContainer>
</template>
