<script setup lang="ts">
import type { Ref } from 'vue'
import {
  TAXONOMY_LOCALES,
  taxonomyDisplayName,
  taxonomyDisplaySlug,
  taxonomyHasTranslation,
  type TaxonomyRowLike
} from '~/composables/admin-taxonomy-fields'
import type { components } from '~/types/api'

type Schemas = components['schemas']

/**
 * The overlay editor targets (`U3b`). `null` means CREATE; a row means EDIT, held BY IDENTITY from
 * the collection list — there is no detail read to fetch a fresher copy with, and none is attempted.
 */
const categoryOverlayOpen = ref(false)
const tagOverlayOpen = ref(false)
const editingCategory = ref<Schemas['AdminCategoryEntity'] | null>(null)
const editingTag = ref<Schemas['AdminTagEntity'] | null>(null)

function openCategoryEditor(row: Schemas['AdminCategoryEntity'] | null): void {
  editingCategory.value = row
  categoryOverlayOpen.value = true
}
function openTagEditor(row: Schemas['AdminTagEntity'] | null): void {
  editingTag.value = row
  tagOverlayOpen.value = true
}

/**
 * Dashboard Taxonomy — ONE destination hosting TWO collections (FE-3 Taxonomy, `U2`).
 *
 * Plan §7.1 groups Categories and Tags under a single Content-group entry ("Taxonomy is grouped as
 * one destination rather than two nav entries"), so this page is that one destination and each
 * collection below is a SECTION of it, not a route of its own.
 *
 * ── WHAT THE CONTRACT LEAVES OUT, THIS PAGE LEAVES OUT ──────────────────────────────────────────
 * Both endpoints declare ZERO query parameters — an unsolicited query string is a 422 — and answer
 * `{ data: [...] }` with NO `meta`. So there is NO URL query state, NO pagination and NO filter:
 * a control for any of them would build a URL contract the API does not honour.
 *
 * ⚠ NEITHER ENTITY HAS A DETAIL READ — `/admin/categories/{id}` and `/admin/tags/{id}` answer PATCH
 * and DELETE only. So this page renders every row entirely from its LIST response and issues no
 * `{id}` GET; editing opens the USlideover ON THIS ROUTE (`U3b`), initialized from the clicked row —
 * there is no editor route to navigate to, by contract.
 *
 * ── ⚠ THE ROWS ARE NOT SORTED HERE, AND THAT IS THE POINT ───────────────────────────────────────
 * The endpoints take no sort parameter, so the server's order IS the contract (`createdAt`
 * ascending). Each `v-for` walks its `items` in the order received — not by name, not by slug, not
 * by anything else. The browser lane pins both sequences against fixtures whose names are
 * deliberately out of alphabetical order.
 *
 * ── INDEPENDENT SECTION STATE ───────────────────────────────────────────────────────────────────
 * Each section owns its composable instance and its own full request-state surface, so one
 * resource failing never blanks or disables the other: Categories can sit in an error state while
 * Tags renders rows, and each retry button reloads ONLY its own list. This is two honest instances
 * of the established module pattern, not a new shared abstraction.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()

/**
 * Destructured at the TOP LEVEL, deliberately: refs nested inside a plain object do NOT
 * auto-unwrap in templates (a `Ref` object is truthy), so keeping these flat is what makes
 * `v-if="categoriesForbidden"` a boolean check rather than an always-true one.
 */
const {
  items: categoryItems,
  pending: categoriesPending,
  forbidden: categoriesForbidden,
  failed: categoriesFailed,
  load: loadCategories
} = useAdminCategories()
const {
  items: tagItems,
  pending: tagsPending,
  forbidden: tagsForbidden,
  failed: tagsFailed,
  load: loadTags
} = useAdminTags()

useHead({ title: () => `${t('dashboard.taxonomy.title')} · ${t('dashboard.title')}` })

/* ── the request-state contract (§10.3 rules 1–3), once per section ────────────────────────────── */

function sectionState(
  pending: Ref<boolean>,
  items: Ref<unknown[]>,
  failed: Ref<boolean>,
  forbidden: Ref<boolean>
) {
  const hasData = computed(() => items.value.length > 0)
  const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
  // `reactive` wraps the refs so the template reads UNWRAPPED booleans through the state objects —
  // a bare object of computeds would hand every `v-if` a truthy Ref instead of its value.
  return reactive({
    initialPending,
    refreshing,
    /** Error surface ONLY when there is nothing usable underneath it. */
    showErrorState: computed(() => failed.value && !hasData.value),
    /** A refresh that failed while rows are still on screen. Polite rather than assertive. */
    showStaleNotice: computed(() => failed.value && hasData.value),
    isEmpty: computed(() =>
      !pending.value && !failed.value && !forbidden.value && items.value.length === 0
    )
  })
}

const categoriesState = sectionState(categoriesPending, categoryItems, categoriesFailed, categoriesForbidden)
const tagsState = sectionState(tagsPending, tagItems, tagsFailed, tagsForbidden)

/* ── row presentation ──────────────────────────────────────────────────────────────────────────── */

function rowName(row: TaxonomyRowLike, untitledKey: string): string {
  return taxonomyDisplayName(row, locale.value, t(untitledKey))
}

function rowSlug(row: TaxonomyRowLike): string | null {
  return taxonomyDisplaySlug(row, locale.value)
}

/**
 ONE load per section, called directly — NOT `watch(..., { immediate: true })`: these endpoints take
 no parameters, so nothing could ever require a second request, and a watcher over a constant would
 be a re-request that can never fire dressed up as reactivity. `/dashboard/**` is `ssr: false`, so
 these run on the client's first render; the promises are deliberately not awaited in setup so the
 SKELETONS render while the requests are in flight.
 */
void loadCategories()
void loadTags()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6">
      <h1 class="text-h1 text-highlighted">{{ t('dashboard.taxonomy.title') }}</h1>
      <p class="mt-2 text-muted">{{ t('dashboard.taxonomy.description') }}</p>
    </div>

    <!-- ═══ Categories ═══ -->
    <section :aria-label="t('dashboard.taxonomy.categories.regionLabel')" data-taxonomy-section="categories" class="mb-10">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-medium text-highlighted">{{ t('dashboard.taxonomy.categories.title') }}</h2>
          <p class="mb-4 mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.categories.description') }}</p>
        </div>
        <UButton
size="sm" icon="i-lucide-plus" data-taxonomy-create="categories"
                 @click="openCategoryEditor(null)">
          {{ t('dashboard.taxonomy.overlay.createCategory') }}
        </UButton>
      </div>

      <!-- 403 answered on its own terms: not retryable, not empty (D11-2). -->
      <UAlert
        v-if="categoriesForbidden"
        color="error"
        variant="subtle"
        icon="i-lucide-lock"
        data-categories-forbidden
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.taxonomy.categories.forbiddenTitle')"
        :description="t('dashboard.taxonomy.categories.forbiddenBody')"
      />

      <template v-else>
        <p
          v-if="categoriesState.showStaleNotice"
          role="status"
          data-categories-stale
          class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
        >
          {{ t('dashboard.taxonomy.staleNotice') }}
          <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-categories-stale-retry @click="loadCategories()">
            {{ t('dashboard.taxonomy.retry') }}
          </UButton>
        </p>

        <UiRequestState
          :pending="categoriesState.initialPending"
          :refreshing="categoriesState.refreshing"
          :error="categoriesState.showErrorState"
          :empty="categoriesState.isEmpty"
          skeleton="rows"
          :count="3"
          @retry="loadCategories()"
        >
          <template #error>
            <UiStateError
              data-categories-failed
              :message="t('dashboard.taxonomy.categories.errorTitle')"
              @retry="loadCategories()"
            />
          </template>

          <template #empty>
            <div class="rounded-control border border-default p-10 text-center" data-categories-empty>
              <p class="font-medium text-highlighted">{{ t('dashboard.taxonomy.categories.emptyTitle') }}</p>
              <p class="mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.categories.emptyBody') }}</p>
            </div>
          </template>

          <div data-categories-loaded>
            <p class="mb-3 text-sm text-muted" data-categories-count>
              {{ t('dashboard.taxonomy.categories.resultCount', { total: categoryItems.length }) }}
            </p>

            <!-- ⚠ RENDERED IN THE ORDER RECEIVED. No `.sort()` here, ever — see the header. -->
            <ul class="flex flex-col gap-2">
              <li v-for="category in categoryItems" :key="category.id">
                <UCard as="article" :data-category-row="category.id">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 dir="auto" class="truncate font-medium text-highlighted" :data-taxonomy-name="category.id">
                        {{ rowName(category, 'dashboard.taxonomy.categories.untitled') }}
                      </h3>
                      <code
                        v-if="rowSlug(category)"
                        dir="ltr"
                        class="truncate rounded bg-elevated px-1.5 py-0.5 text-xs text-muted"
                        :data-taxonomy-slug="category.id"
                      >
                        /{{ rowSlug(category) }}
                      </code>
                    </div>
                    <!-- Category-only nullable field, shown as stored data when present. -->
                    <p
                      v-if="category.translations[locale]?.description"
                      dir="auto"
                      class="mt-1 truncate text-sm text-muted"
                      :data-category-description="category.id"
                    >
                      {{ category.translations[locale]?.description }}
                    </p>
                    </div>

                    <div class="flex shrink-0 items-center gap-1.5">
                      <UButton
color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                               :data-taxonomy-edit="category.id"
                               :aria-label="t('dashboard.taxonomy.overlay.edit')"
                               @click="openCategoryEditor(category)">
                        {{ t('dashboard.taxonomy.overlay.edit') }}
                      </UButton>
                      <UButton
color="neutral" variant="ghost" size="xs" icon="i-lucide-trash-2"
                               :data-taxonomy-delete="category.id"
                               :aria-label="t('dashboard.taxonomy.overlay.delete')"
                               @click="openCategoryEditor(category)" />
                    </div>
                  </div>

                  <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <div class="flex items-center gap-1.5">
                      <dt class="text-muted">{{ t('dashboard.taxonomy.translationState.label') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <UBadge
                          v-for="target in TAXONOMY_LOCALES"
                          :key="target"
                          :color="taxonomyHasTranslation(category, target) ? 'success' : 'warning'"
                          variant="subtle"
                          size="sm"
                          :icon="taxonomyHasTranslation(category, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                          :data-taxonomy-translation="`${target}:${taxonomyHasTranslation(category, target) ? 'present' : 'missing'}`"
                        >
                          {{ t(
                            taxonomyHasTranslation(category, target)
                              ? 'dashboard.taxonomy.translationState.present'
                              : 'dashboard.taxonomy.translationState.missing',
                            { locale: t(`dashboard.taxonomy.locale.${target}`) }
                          ) }}
                        </UBadge>
                      </dd>
                    </div>
                  </dl>
                </UCard>
              </li>
            </ul>
          </div>
        </UiRequestState>
      </template>
    </section>

    <!-- ═══ Tags ═══ -->
    <section :aria-label="t('dashboard.taxonomy.tags.regionLabel')" data-taxonomy-section="tags">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-medium text-highlighted">{{ t('dashboard.taxonomy.tags.title') }}</h2>
          <p class="mb-4 mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.tags.description') }}</p>
        </div>
        <UButton
size="sm" icon="i-lucide-plus" data-taxonomy-create="tags"
                 @click="openTagEditor(null)">
          {{ t('dashboard.taxonomy.overlay.createTag') }}
        </UButton>
      </div>

      <UAlert
        v-if="tagsForbidden"
        color="error"
        variant="subtle"
        icon="i-lucide-lock"
        data-tags-forbidden
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.taxonomy.tags.forbiddenTitle')"
        :description="t('dashboard.taxonomy.tags.forbiddenBody')"
      />

      <template v-else>
        <p
          v-if="tagsState.showStaleNotice"
          role="status"
          data-tags-stale
          class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
        >
          {{ t('dashboard.taxonomy.staleNotice') }}
          <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-tags-stale-retry @click="loadTags()">
            {{ t('dashboard.taxonomy.retry') }}
          </UButton>
        </p>

        <UiRequestState
          :pending="tagsState.initialPending"
          :refreshing="tagsState.refreshing"
          :error="tagsState.showErrorState"
          :empty="tagsState.isEmpty"
          skeleton="rows"
          :count="3"
          @retry="loadTags()"
        >
          <template #error>
            <UiStateError
              data-tags-failed
              :message="t('dashboard.taxonomy.tags.errorTitle')"
              @retry="loadTags()"
            />
          </template>

          <template #empty>
            <div class="rounded-control border border-default p-10 text-center" data-tags-empty>
              <p class="font-medium text-highlighted">{{ t('dashboard.taxonomy.tags.emptyTitle') }}</p>
              <p class="mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.tags.emptyBody') }}</p>
            </div>
          </template>

          <div data-tags-loaded>
            <p class="mb-3 text-sm text-muted" data-tags-count>
              {{ t('dashboard.taxonomy.tags.resultCount', { total: tagItems.length }) }}
            </p>

            <!-- ⚠ RENDERED IN THE ORDER RECEIVED. No `.sort()` here, ever — see the header. -->
            <ul class="flex flex-col gap-2">
              <li v-for="tag in tagItems" :key="tag.id">
                <UCard as="article" :data-tag-row="tag.id">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 dir="auto" class="truncate font-medium text-highlighted" :data-taxonomy-name="tag.id">
                        {{ rowName(tag, 'dashboard.taxonomy.tags.untitled') }}
                      </h3>
                      <code
                        v-if="rowSlug(tag)"
                        dir="ltr"
                        class="truncate rounded bg-elevated px-1.5 py-0.5 text-xs text-muted"
                        :data-taxonomy-slug="tag.id"
                      >
                        /{{ rowSlug(tag) }}
                      </code>
                    </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-1.5">
                      <UButton
color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                               :data-taxonomy-edit="tag.id"
                               :aria-label="t('dashboard.taxonomy.overlay.edit')"
                               @click="openTagEditor(tag)">
                        {{ t('dashboard.taxonomy.overlay.edit') }}
                      </UButton>
                      <UButton
color="neutral" variant="ghost" size="xs" icon="i-lucide-trash-2"
                               :data-taxonomy-delete="tag.id"
                               :aria-label="t('dashboard.taxonomy.overlay.delete')"
                               @click="openTagEditor(tag)" />
                    </div>
                  </div>

                  <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <div class="flex items-center gap-1.5">
                      <dt class="text-muted">{{ t('dashboard.taxonomy.translationState.label') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <UBadge
                          v-for="target in TAXONOMY_LOCALES"
                          :key="target"
                          :color="taxonomyHasTranslation(tag, target) ? 'success' : 'warning'"
                          variant="subtle"
                          size="sm"
                          :icon="taxonomyHasTranslation(tag, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                          :data-taxonomy-translation="`${target}:${taxonomyHasTranslation(tag, target) ? 'present' : 'missing'}`"
                        >
                          {{ t(
                            taxonomyHasTranslation(tag, target)
                              ? 'dashboard.taxonomy.translationState.present'
                              : 'dashboard.taxonomy.translationState.missing',
                            { locale: t(`dashboard.taxonomy.locale.${target}`) }
                          ) }}
                        </UBadge>
                      </dd>
                    </div>
                  </dl>
                </UCard>
              </li>
            </ul>
          </div>
        </UiRequestState>
      </template>
    </section>

    <!-- ═══ Overlays (`U3b`) — one per entity type, editing IN PLACE on this route ═══ -->
    <DashboardTaxonomyCategoryOverlay
v-model:open="categoryOverlayOpen" kind="categories" :row="editingCategory"
                             @saved="loadCategories()" />
    <DashboardTaxonomyTagOverlay
v-model:open="tagOverlayOpen" kind="tags" :row="editingTag"
                        @saved="loadTags()" />
  </UContainer>
</template>
