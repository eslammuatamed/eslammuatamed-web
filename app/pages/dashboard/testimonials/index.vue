<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { TESTIMONIAL_LOCALES, testimonialDisplayAuthor, testimonialDisplayQuote, testimonialHasTranslation } from '~/composables/admin-testimonial-fields'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'

defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const { items, pending, forbidden, failed, load } = useAdminTestimonials()
useHead({ title: () => `${t('dashboard.testimonials.title')} · ${t('dashboard.title')}` })

const editingId = ref<string | null>(null)
const overlayOpen = ref(false)
const lastTrigger = ref<HTMLElement | null>(null)
const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
const showErrorState = computed(() => failed.value && !hasData.value)
const showStaleNotice = computed(() => failed.value && hasData.value)
const isEmpty = computed(() => !pending.value && !failed.value && !forbidden.value && !hasData.value)
const columns = computed<TableColumn<AdminTestimonial>[]>(() => [
  { id: 'author', header: () => t('dashboard.testimonials.field.author') },
  { id: 'quote', header: () => t('dashboard.testimonials.field.quote') },
  { id: 'role', header: () => t('dashboard.testimonials.field.role') },
  { id: 'order', header: () => t('dashboard.testimonials.field.order') },
  { id: 'avatar', header: () => t('dashboard.testimonials.field.avatar') },
  { id: 'visibility', header: () => t('dashboard.testimonials.field.visibility') },
  { id: 'actions', header: () => t('dashboard.testimonials.field.actions') }
])
const rowAuthor = (item: AdminTestimonial) => testimonialDisplayAuthor(item, locale.value, t('dashboard.testimonials.untitled'))
const rowQuote = (item: AdminTestimonial) => testimonialDisplayQuote(item, locale.value)
function setIntent(query: Record<string, string | undefined>): void { void router.replace({ query: { ...route.query, ...query } }) }
function openCreate(event: Event): void { lastTrigger.value = event.currentTarget as HTMLElement; setIntent({ create: '1', edit: undefined }) }
function openEdit(id: string, event: Event): void { lastTrigger.value = event.currentTarget as HTMLElement; setIntent({ edit: id, create: undefined }) }
async function closeOverlay(): Promise<void> {
  const query = { ...route.query }
  if (editingId.value === null) delete query.create
  else delete query.edit
  await router.replace({ query })
  await nextTick()
  lastTrigger.value?.focus()
}
async function refreshAfterMutation(): Promise<void> { await load() }
watch(() => route.query, query => {
  editingId.value = typeof query.edit === 'string' ? query.edit : null
  overlayOpen.value = editingId.value !== null || query.create === '1'
}, { immediate: true })
void load()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><h1 class="text-h1 text-highlighted">{{ t('dashboard.testimonials.title') }}</h1><p class="mt-2 text-muted">{{ t('dashboard.testimonials.description') }}</p></div>
      <UButton icon="i-lucide-plus" data-testimonials-create @click="openCreate">{{ t('dashboard.testimonials.create') }}</UButton>
    </div>
    <UAlert v-if="forbidden" color="error" variant="subtle" icon="i-lucide-lock" data-testimonials-forbidden :title="t('dashboard.testimonials.forbiddenTitle')" :description="t('dashboard.testimonials.forbiddenBody')" />
    <section v-else :aria-label="t('dashboard.testimonials.listRegionLabel')">
      <p v-if="showStaleNotice" role="status" data-testimonials-stale class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted">
        {{ t('dashboard.testimonials.staleNotice') }} <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-testimonials-stale-retry @click="load()">{{ t('dashboard.testimonials.retry') }}</UButton>
      </p>
      <UiRequestState :pending="initialPending" :refreshing="refreshing" :error="showErrorState" :empty="isEmpty" skeleton="rows" :count="5" @retry="load()">
        <template #error><UiStateError data-testimonials-failed :message="t('dashboard.testimonials.errorTitle')" @retry="load()" /></template>
        <template #empty><div class="rounded-control border border-default p-10 text-center" data-testimonials-empty><p class="font-medium text-highlighted">{{ t('dashboard.testimonials.emptyTitle') }}</p><p class="mt-1 text-sm text-muted">{{ t('dashboard.testimonials.emptyBody') }}</p><UButton class="mt-4" icon="i-lucide-plus" data-testimonials-empty-create @click="openCreate">{{ t('dashboard.testimonials.create') }}</UButton></div></template>
        <div data-testimonials-loaded>
          <p class="mb-3 text-sm text-muted" data-testimonials-count>{{ t('dashboard.testimonials.resultCount', { total: items.length }) }}</p>
          <div class="overflow-x-auto"><UTable :data="items" :columns="columns" :loading="refreshing" :aria-label="t('dashboard.testimonials.listRegionLabel')" data-testimonials-table>
            <template #author-cell="{ row }"><div :data-testimonial-row="row.original.id" class="min-w-44 max-w-xs"><p dir="auto" class="break-words font-medium text-highlighted" :data-testimonial-author="row.original.id">{{ rowAuthor(row.original) }}</p><div class="mt-1 flex flex-wrap gap-1"><UBadge v-for="target in TESTIMONIAL_LOCALES" :key="target" :color="testimonialHasTranslation(row.original, target) ? 'success' : 'warning'" variant="subtle" size="sm" :data-testimonial-translation="`${target}:${testimonialHasTranslation(row.original, target) ? 'present' : 'missing'}`">{{ t(testimonialHasTranslation(row.original, target) ? 'dashboard.testimonials.translationState.present' : 'dashboard.testimonials.translationState.missing', { locale: t(`dashboard.testimonials.locale.${target}`) }) }}</UBadge></div></div></template>
            <template #quote-cell="{ row }"><p dir="auto" class="max-w-md truncate text-sm text-muted" :data-testimonial-quote="row.original.id">{{ rowQuote(row.original) }}</p></template>
            <template #role-cell="{ row }"><span dir="auto" class="max-w-48 break-words" :data-testimonial-role="row.original.id">{{ row.original.translations[locale]?.authorRole ?? '—' }}</span></template>
            <template #order-cell="{ row }"><span dir="ltr" :data-testimonial-order="row.original.id">{{ row.original.order }}</span></template>
            <template #avatar-cell="{ row }"><UBadge color="neutral" variant="subtle" :data-testimonial-avatar="row.original.avatarId ?? 'none'">{{ t(row.original.avatarId ? 'dashboard.testimonials.avatarLinked' : 'dashboard.testimonials.noAvatar') }}</UBadge></template>
            <template #visibility-cell="{ row }"><UBadge :color="row.original.isVisible ? 'success' : 'neutral'" variant="subtle" :data-testimonial-visible="String(row.original.isVisible)">{{ t(row.original.isVisible ? 'dashboard.testimonials.visible' : 'dashboard.testimonials.hidden') }}</UBadge></template>
            <template #actions-cell="{ row }"><UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-pencil" :data-testimonial-edit="row.original.id" :aria-label="t('dashboard.testimonials.editFor', { author: rowAuthor(row.original) })" @click="openEdit(row.original.id, $event)">{{ t('dashboard.testimonials.edit') }}</UButton></template>
          </UTable></div>
        </div>
      </UiRequestState>
    </section>
    <LazyDashboardTestimonialOverlay :id="editingId" v-model:open="overlayOpen" @saved="refreshAfterMutation" @deleted="refreshAfterMutation" @close="closeOverlay" />
  </UContainer>
</template>
