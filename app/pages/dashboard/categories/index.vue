<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Ref } from 'vue'
import {
  TAXONOMY_LOCALES,
  taxonomyDisplayName,
  taxonomyDisplaySlug,
  taxonomyHasTranslation,
  type TaxonomyRowLike
} from '~/composables/admin-taxonomy-fields'
import type { components } from '~/types/api'
import {
  ADMIN_CATEGORIES_PER_PAGE,
  parseAdminCategoriesQuery
} from '~/composables/admin-categories-query'

type Category = components['schemas']['AdminCategoryEntity']

defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const overlayOpen = ref(false)
const editing = ref<Category | null>(null)
const { items, total, totalPages, pending, forbidden, failed, load } = useAdminCategories()
const hasData = computed(() => items.value.length > 0)
const request = useRequestState(pending as Ref<boolean>, hasData, failed as Ref<boolean>)
const state = reactive({
  initialPending: request.initialPending,
  refreshing: request.refreshing,
  error: computed(() => failed.value && !hasData.value),
  stale: computed(() => failed.value && hasData.value),
  empty: computed(() => !pending.value && !failed.value && !forbidden.value && total.value === 0)
})
const parsedQuery = computed(() => parseAdminCategoriesQuery(route.query))

const columns: TableColumn<Category>[] = [
  { accessorKey: 'id', header: () => t('dashboard.taxonomy.categories.title') },
  { id: 'slug', header: () => t('dashboard.taxonomy.slug') },
  { id: 'translations', header: () => t('dashboard.taxonomy.translationState.label') },
  { id: 'actions', header: () => t('dashboard.taxonomy.actions') }
]

function name(row: TaxonomyRowLike) {
  return taxonomyDisplayName(row, locale.value, t('dashboard.taxonomy.categories.untitled'))
}
function slug(row: TaxonomyRowLike) {
  return taxonomyDisplaySlug(row, locale.value)
}
function openEditor(row: Category | null) {
  editing.value = row
  overlayOpen.value = true
}

function queryWithPage(page: number): Record<string, string | undefined> {
  return { ...route.query, page: page === 1 ? undefined : String(page) }
}
function goToPage(page: number): void { void router.push({ query: queryWithPage(page) }) }
async function loadCurrentPage(): Promise<void> {
  const query = parsedQuery.value
  const meta = await load(query)
  if (!meta || query.page !== parsedQuery.value.page || query.page <= meta.totalPages) return
  await router.replace({ query: queryWithPage(meta.totalPages) })
}

useHead({ title: () => `${t('dashboard.taxonomy.categories.title')} · ${t('dashboard.title')}` })
watch(parsedQuery, () => { void loadCurrentPage() }, { immediate: true, deep: true })
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.taxonomy.categories.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.taxonomy.categories.description') }}</p>
      </div>
      <UButton size="sm" icon="i-lucide-plus" data-taxonomy-create="categories" @click="openEditor(null)">
        {{ t('dashboard.taxonomy.overlay.createCategory') }}
      </UButton>
    </div>

    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-categories-forbidden
      :title="t('dashboard.taxonomy.categories.forbiddenTitle')"
      :description="t('dashboard.taxonomy.categories.forbiddenBody')"
    />
    <template v-else>
      <p v-if="state.stale" role="status" data-categories-stale class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted">
        {{ t('dashboard.taxonomy.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-categories-stale-retry @click="loadCurrentPage()">{{ t('dashboard.taxonomy.retry') }}</UButton>
      </p>
      <UiRequestState :pending="state.initialPending" :refreshing="state.refreshing" :error="state.error" :empty="state.empty" skeleton="rows" :count="3" @retry="loadCurrentPage()">
        <template #error><UiStateError data-categories-failed :message="t('dashboard.taxonomy.categories.errorTitle')" @retry="loadCurrentPage()" /></template>
        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-categories-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.taxonomy.categories.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.categories.emptyBody') }}</p>
          </div>
        </template>
        <div data-categories-loaded>
          <p class="mb-3 text-sm text-muted" data-categories-count>{{ t('dashboard.taxonomy.categories.resultCount', { total }) }}</p>
          <div class="overflow-x-auto">
            <UTable :data="items" :columns="columns" :aria-label="t('dashboard.taxonomy.categories.regionLabel')" data-categories-table>
              <template #id-cell="{ row }">
                <div :data-category-row="row.original.id">
                  <p dir="auto" class="font-medium text-highlighted" :data-taxonomy-name="row.original.id">{{ name(row.original) }}</p>
                  <p v-if="row.original.translations[locale]?.description" dir="auto" class="mt-1 text-sm text-muted" :data-category-description="row.original.id">{{ row.original.translations[locale]?.description }}</p>
                </div>
              </template>
              <template #slug-cell="{ row }"><code v-if="slug(row.original)" dir="ltr" class="text-xs text-muted" :data-taxonomy-slug="row.original.id">/{{ slug(row.original) }}</code></template>
              <template #translations-cell="{ row }">
                <div class="flex flex-wrap gap-1">
                  <UBadge v-for="target in TAXONOMY_LOCALES" :key="target" size="sm" variant="subtle" :color="taxonomyHasTranslation(row.original, target) ? 'success' : 'warning'" :data-taxonomy-translation="`${target}:${taxonomyHasTranslation(row.original, target) ? 'present' : 'missing'}`">
                    {{ t(taxonomyHasTranslation(row.original, target) ? 'dashboard.taxonomy.translationState.present' : 'dashboard.taxonomy.translationState.missing', { locale: t(`dashboard.taxonomy.locale.${target}`) }) }}
                  </UBadge>
                </div>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex justify-end gap-1">
                  <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil" :data-taxonomy-edit="row.original.id" :aria-label="t('dashboard.taxonomy.overlay.edit')" @click="openEditor(row.original)">{{ t('dashboard.taxonomy.overlay.edit') }}</UButton>
                  <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-trash-2" :data-taxonomy-delete="row.original.id" :aria-label="t('dashboard.taxonomy.overlay.delete')" @click="openEditor(row.original)" />
                </div>
              </template>
            </UTable>
          </div>
          <div v-if="totalPages > 1" class="mt-4 flex justify-end" data-categories-pagination>
            <UPagination :page="parsedQuery.page" :total="total" :items-per-page="ADMIN_CATEGORIES_PER_PAGE" @update:page="goToPage" />
          </div>
        </div>
      </UiRequestState>
    </template>
    <DashboardTaxonomyCategoryOverlay v-model:open="overlayOpen" kind="categories" :row="editing" @saved="loadCurrentPage()" />
  </UContainer>
</template>
