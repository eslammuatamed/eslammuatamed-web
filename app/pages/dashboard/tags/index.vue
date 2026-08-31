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

type Tag = components['schemas']['AdminTagEntity']

defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const overlayOpen = ref(false)
const editing = ref<Tag | null>(null)
const { items, pending, forbidden, failed, load } = useAdminTags()
const hasData = computed(() => items.value.length > 0)
const request = useRequestState(pending as Ref<boolean>, hasData, failed as Ref<boolean>)
const state = reactive({
  initialPending: request.initialPending,
  refreshing: request.refreshing,
  error: computed(() => failed.value && !hasData.value),
  stale: computed(() => failed.value && hasData.value),
  empty: computed(() => !pending.value && !failed.value && !forbidden.value && !hasData.value)
})

const columns: TableColumn<Tag>[] = [
  { accessorKey: 'id', header: () => t('dashboard.taxonomy.tags.title') },
  { id: 'slug', header: () => t('dashboard.taxonomy.slug') },
  { id: 'translations', header: () => t('dashboard.taxonomy.translationState.label') },
  { id: 'actions', header: () => t('dashboard.taxonomy.actions') }
]

function name(row: TaxonomyRowLike) {
  return taxonomyDisplayName(row, locale.value, t('dashboard.taxonomy.tags.untitled'))
}
function slug(row: TaxonomyRowLike) {
  return taxonomyDisplaySlug(row, locale.value)
}
function openEditor(row: Tag | null) {
  editing.value = row
  overlayOpen.value = true
}

useHead({ title: () => `${t('dashboard.taxonomy.tags.title')} · ${t('dashboard.title')}` })
void load()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.taxonomy.tags.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.taxonomy.tags.description') }}</p>
      </div>
      <UButton size="sm" icon="i-lucide-plus" data-taxonomy-create="tags" @click="openEditor(null)">{{ t('dashboard.taxonomy.overlay.createTag') }}</UButton>
    </div>

    <UAlert v-if="forbidden" color="error" variant="subtle" icon="i-lucide-lock" data-tags-forbidden :title="t('dashboard.taxonomy.tags.forbiddenTitle')" :description="t('dashboard.taxonomy.tags.forbiddenBody')" />
    <template v-else>
      <p v-if="state.stale" role="status" data-tags-stale class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted">
        {{ t('dashboard.taxonomy.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-tags-stale-retry @click="load()">{{ t('dashboard.taxonomy.retry') }}</UButton>
      </p>
      <UiRequestState :pending="state.initialPending" :refreshing="state.refreshing" :error="state.error" :empty="state.empty" skeleton="rows" :count="3" @retry="load()">
        <template #error><UiStateError data-tags-failed :message="t('dashboard.taxonomy.tags.errorTitle')" @retry="load()" /></template>
        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-tags-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.taxonomy.tags.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.taxonomy.tags.emptyBody') }}</p>
          </div>
        </template>
        <div data-tags-loaded>
          <p class="mb-3 text-sm text-muted" data-tags-count>{{ t('dashboard.taxonomy.tags.resultCount', { total: items.length }) }}</p>
          <div class="overflow-x-auto">
            <UTable :data="items" :columns="columns" :aria-label="t('dashboard.taxonomy.tags.regionLabel')" data-tags-table>
              <template #id-cell="{ row }"><p dir="auto" class="font-medium text-highlighted" :data-tag-row="row.original.id" :data-taxonomy-name="row.original.id">{{ name(row.original) }}</p></template>
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
        </div>
      </UiRequestState>
    </template>
    <DashboardTaxonomyTagOverlay v-model:open="overlayOpen" kind="tags" :row="editing" @saved="load()" />
  </UContainer>
</template>
