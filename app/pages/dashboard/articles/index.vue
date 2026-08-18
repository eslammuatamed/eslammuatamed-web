<script setup lang="ts">
import {
  ADMIN_ARTICLES_PER_PAGE,
  ADMIN_ARTICLE_STATUS_FILTER,
  parseAdminArticlesQuery,
  type AdminArticleStatusFilter
} from '~/composables/admin-articles-query'
import {
  ARTICLE_LOCALES,
  articleDisplayTitle,
  articleHasTranslation,
  articleSlug,
  articleStatusColor
} from '~/composables/admin-article-form'
import type { AdminArticle } from '~/composables/admin-article-types'

/**
 * Dashboard Articles — the collection (doc 11; plan §14.9 criteria 1, 2, 6, 7, 8, 9, 10).
 *
 * URL IS THE SINGLE SOURCE OF TRUTH for the page and the status filter, as it is for Projects,
 * Messages and Media. Back, Forward, a reload and a shared link all reproduce the same view because
 * the view is derived from the address and from nothing else.
 *
 * ── THIS IS THE FIRST DASHBOARD LIST TO USE THE 007 REQUEST-STATE CONTRACT, DELIBERATELY ────────
 * `messages.vue` hand-rolls `v-if="pending"` over six skeleton rows, and `projects/index.vue` does
 * the same with its own. Both therefore replace the WHOLE surface on every load — so a filter
 * change or a page step throws away content that is still perfectly usable and makes the operator
 * re-read the page from nothing. Plan §14.9 names that as the anti-pattern this module exists to
 * replace (F-2), and both existing modules are explicitly out of scope to retrofit here.
 *
 * So the four states come from `useRequestState` and render through `UiRequestState`, which
 * guarantees exactly ONE of them is on screen at a time:
 *
 *   initial + no data        → content-shaped skeleton
 *   existing data + refresh  → content stays, restrained updating overlay
 *   error + no data          → error state with retry
 *   loaded + zero rows       → deliberate empty state
 *
 * ── TWO GATINGS THAT LOOK LIKE DETAILS AND ARE NOT ──────────────────────────────────────────────
 * 1. `:error` is gated on `!hasData`. `UiRequestState` tests `error` BEFORE content, so passing a
 *    bare `failed` would blank the list the moment a background refresh failed — destroying usable
 *    content, which is precisely what criterion 2 forbids. A refresh that fails while rows are up
 *    keeps the rows and says so in a notice instead.
 * 2. `forbidden` is handled OUTSIDE this component entirely. A 403 is not a retryable error and it
 *    is not an empty list (D11-2); offering "Try again" for it would be a button that cannot work.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const { items, total, totalPages, pending, forbidden, failed, load } = useAdminArticles()

useHead({ title: () => `${t('dashboard.articles.title')} · ${t('dashboard.title')}` })

/** ONE canonical parse of the route query. Total — it defaults rather than throwing. */
const parsed = computed(() => parseAdminArticlesQuery(route.query))

function setQuery(patch: Record<string, string | undefined>): void {
  const merged = { ...route.query, ...patch }
  const next = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined))
  void router.push({ query: next })
}

/**
 * Changing the filter returns to page 1 in the SAME navigation.
 *
 * Not two pushes: `router.push` does not update `route.query` synchronously, so two pushes in one
 * tick both build their target from the same pre-interaction query and the second silently discards
 * the first — the incident recorded in `utils/media-query.ts`.
 */
function setStatus(value: AdminArticleStatusFilter): void {
  setQuery({ status: value === 'all' ? undefined : value, page: undefined })
}

function goToPage(next: number): void {
  setQuery({ page: next === 1 ? undefined : String(next) })
}

const statusItems = computed(() =>
  ADMIN_ARTICLE_STATUS_FILTER.map(value => ({
    value,
    label: value === 'all' ? t('dashboard.articles.filters.allStatuses') : t(`dashboard.articles.status.${value}`)
  }))
)

/* ── the request-state contract ────────────────────────────────────────────────────────────────── */

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)

/** Error surface ONLY when there is nothing usable underneath it — see the header note. */
const showErrorState = computed(() => failed.value && !hasData.value)

/**
 * A refresh that failed while rows are still on screen. The rows stay; this says the list may be
 * stale. Announced politely rather than as an alert: nothing is broken on screen, and an assertive
 * interruption for a background failure is the "noisy announcement" criterion 8 rules out.
 */
const showStaleNotice = computed(() => failed.value && hasData.value)

const isEmpty = computed(() =>
  !pending.value && !failed.value && !forbidden.value && items.value.length === 0
)

const isFiltered = computed(() => parsed.value.status !== 'all')

/* ── row presentation ──────────────────────────────────────────────────────────────────────────── */

function rowTitle(article: AdminArticle): string {
  return articleDisplayTitle(article, locale.value, t('dashboard.articles.untitled'))
}

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', {
  dateStyle: 'medium'
}))

function publishLabel(article: AdminArticle): string | null {
  if (!article.publishAt) return null
  return dateFormatter.value.format(new Date(article.publishAt))
}

watch(parsed, value => void load(value), { immediate: true, deep: true })
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.articles.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.articles.description') }}</p>
      </div>
      <UButton to="/dashboard/articles/new" icon="i-lucide-plus" data-articles-create>
        {{ t('dashboard.articles.create') }}
      </UButton>
    </div>

    <!-- A real <section> with a name, so the control is a landmark rather than a stray select.
         ONE filter, because the admin list endpoint takes exactly one — see admin-articles-query.ts
         for why no search box is invented here. -->
    <section :aria-label="t('dashboard.articles.filters.heading')" class="mb-6">
      <div class="grid gap-3 sm:max-w-xs">
        <UFormField :label="t('dashboard.articles.filters.status')">
          <USelect
            :model-value="parsed.status"
            :items="statusItems"
            data-articles-status
            class="w-full"
            @update:model-value="setStatus($event as AdminArticleStatusFilter)"
          />
        </UFormField>
      </div>
    </section>

    <!-- 403 is answered on its own terms: not retryable, not empty (D11-2). -->
    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-articles-forbidden
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.articles.forbiddenTitle')"
      :description="t('dashboard.articles.forbiddenBody')"
    />

    <section v-else :aria-label="t('dashboard.articles.listRegionLabel')">
      <!-- Polite, not an alert: the rows below are still usable and still shown. -->
      <p
        v-if="showStaleNotice"
        role="status"
        data-articles-stale
        class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
      >
        {{ t('dashboard.articles.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-articles-stale-retry @click="load(parsed)">
          {{ t('dashboard.articles.retry') }}
        </UButton>
      </p>

      <UiRequestState
        :pending="initialPending"
        :refreshing="refreshing"
        :error="showErrorState"
        :empty="isEmpty"
        skeleton="rows"
        :count="6"
        @retry="load(parsed)"
      >
        <!-- ── THE SHARED ERROR COMPONENT, NOT A BESPOKE ONE ─────────────────────────────────────
             `UiStateError` is reused rather than re-implemented, which is criterion 7 ("ONE
             coherent contract") taken literally. Only its MESSAGE is supplied: its default is
             `home.sectionError`, public-homepage phrasing that reads oddly in a Dashboard (the
             observation F-1 recorded and deliberately did not act on).

             Its retry LABEL is deliberately NOT overridden. That string resolves through
             `useSurfaceI18n()` inside the component, so it is the live F-1 surface — the thing that
             renders English inside an Arabic dashboard if the ownership boundary ever regresses.
             An earlier revision of this page passed its own translated label here and to the
             updating overlay; a negative control showed that made three of the four F-1 browser
             assertions VACUOUS, because the page was supplying exactly what the component was
             supposed to resolve. Passing strings down is also the alternative F-1's own commit
             rejected, for the same reason: it makes correctness opt-in at every call site. -->
        <template #error>
          <UiStateError
            data-articles-failed
            :message="t('dashboard.articles.errorTitle')"
            @retry="load(parsed)"
          />
        </template>

        <!-- An empty FILTERED result is a different answer from an empty library: one says "change
             the filter", the other says "write your first article". -->
        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-articles-empty>
            <p class="font-medium text-highlighted">
              {{ isFiltered ? t('dashboard.articles.emptyFilteredTitle') : t('dashboard.articles.emptyTitle') }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ isFiltered ? t('dashboard.articles.emptyFilteredBody') : t('dashboard.articles.emptyBody') }}
            </p>
            <UButton v-if="!isFiltered" class="mt-4" to="/dashboard/articles/new" icon="i-lucide-plus" data-articles-empty-create>
              {{ t('dashboard.articles.create') }}
            </UButton>
          </div>
        </template>

        <div>
          <p class="mb-3 text-sm text-muted" data-articles-count>
            {{ t('dashboard.articles.resultCount', { total, page: parsed.page, pages: totalPages }) }}
          </p>

          <ul class="flex flex-col gap-2">
            <li v-for="article in items" :key="article.id">
              <UCard as="article" :data-article-row="article.id">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <!-- `dir="auto"` so an Arabic title reads correctly inside an English shell and
                         the reverse — field content direction is independent of chrome direction. -->
                    <h2 dir="auto" class="truncate font-medium text-highlighted" :data-article-title="article.id">
                      {{ rowTitle(article) }}
                    </h2>

                    <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span v-for="slugLocale in ARTICLE_LOCALES" :key="slugLocale" class="break-all">
                        <span class="uppercase">{{ slugLocale }}</span>
                        <span aria-hidden="true">&nbsp;/&nbsp;</span>
                        <span :dir="slugLocale === 'ar' ? 'rtl' : 'ltr'">{{ articleSlug(article, slugLocale) ?? '—' }}</span>
                      </span>
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/articles/${article.id}`"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-pencil"
                    :data-article-edit="article.id"
                    :aria-label="t('dashboard.articles.editFor', { title: rowTitle(article) })"
                  >
                    {{ t('dashboard.articles.edit') }}
                  </UButton>
                </div>

                <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.articles.field.status') }}</dt>
                    <!-- Status is never colour-only: the chip carries its own translated word. -->
                    <dd>
                      <UBadge
                        :color="articleStatusColor(article.status)"
                        variant="subtle"
                        size="sm"
                        :data-article-status="article.status"
                      >
                        {{ t(`dashboard.articles.status.${article.status}`) }}
                      </UBadge>
                    </dd>
                  </div>

                  <!-- Completeness, derived from which locales the translation MAP actually holds
                       (FR-DSH-011). Nothing substitutes one language for the other. -->
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.articles.translationState.label') }}</dt>
                    <dd class="flex items-center gap-1.5">
                      <UBadge
                        v-for="target in ARTICLE_LOCALES"
                        :key="target"
                        :color="articleHasTranslation(article, target) ? 'success' : 'warning'"
                        variant="subtle"
                        size="sm"
                        :icon="articleHasTranslation(article, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                        :data-article-translation="`${target}:${articleHasTranslation(article, target) ? 'present' : 'missing'}`"
                      >
                        {{ t(
                          articleHasTranslation(article, target)
                            ? 'dashboard.articles.translationState.present'
                            : 'dashboard.articles.translationState.missing',
                          { locale: t(`dashboard.articles.locale.${target}`) }
                        ) }}
                      </UBadge>
                    </dd>
                  </div>

                  <div v-if="publishLabel(article)" class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.articles.field.publishAt') }}</dt>
                    <dd>
                      <time :datetime="article.publishAt ?? undefined">{{ publishLabel(article) }}</time>
                    </dd>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.articles.field.updated') }}</dt>
                    <dd>
                      <time :datetime="article.updatedAt">{{ dateFormatter.format(new Date(article.updatedAt)) }}</time>
                    </dd>
                  </div>
                </dl>
              </UCard>
            </li>
          </ul>

          <div v-if="totalPages > 1" class="mt-4 flex justify-center">
            <UPagination
              data-articles-pagination
              :page="parsed.page"
              :total="total"
              :items-per-page="ADMIN_ARTICLES_PER_PAGE"
              @update:page="goToPage"
            />
          </div>
        </div>
      </UiRequestState>
    </section>
  </UContainer>
</template>
