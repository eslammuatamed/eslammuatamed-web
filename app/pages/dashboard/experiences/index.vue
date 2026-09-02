<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import {
  EXPERIENCE_LOCALES,
  experienceDisplayCompany,
  experienceDisplayRole,
  experienceHasTranslation,
  experienceIsCurrent
} from '~/composables/admin-experience-fields'
import type { AdminExperience } from '~/composables/admin-experience-types'
import {
  ADMIN_EXPERIENCES_PER_PAGE,
  parseAdminExperiencesQuery
} from '~/composables/admin-experiences-query'

/**
 * Dashboard Experience — the collection (FE-3 module 1, `M1·U2`).
 *
 * Built on the request-state contract §10 records, so this page is the SECOND consumer of it rather
 * than a fresh interpretation. What differs from Articles is contract-driven and is called out
 * where it happens, because each difference is a place a copied implementation would be wrong.
 *
 * ── TWO THINGS ARTICLES HAS THAT THIS DELIBERATELY DOES NOT ────────────────────────────────────
 * 1. NO FILTERS. This resource owns only `page` in its route query; the server owns all ordering.
 * 2. NO STATUS. Experiences have no `status` and no `publishAt` — publishing and scheduling are not
 *    concepts in this shape — so there is no status chip and no empty-FILTERED state, because no
 *    filter can produce one.
 *
 * ── ⚠ THE ROWS ARE NOT SORTED HERE, AND THAT IS THE POINT ───────────────────────────────────────
 * The API orders by `isCurrent` DESC first, then `startDate` DESC, then `order`, then `id`. Sorting
 * these rows by `startDate` — the obvious reading of a CV list — is a DEFECT THAT ALREADY SHIPPED:
 * an ended role outranked the current one on the live site. `v-for` walks `items` in the order
 * received and nothing re-orders it.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const { items, total, totalPages, pending, forbidden, failed, load } = useAdminExperiences()

useHead({ title: () => `${t('dashboard.experiences.title')} · ${t('dashboard.title')}` })

/* ── the request-state contract (§10.3 rules 1–3) ──────────────────────────────────────────────── */

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)

/**
 * Error surface ONLY when there is nothing usable underneath it.
 *
 * `UiRequestState` tests `error` BEFORE content, so passing a bare `failed` would blank the list the
 * moment a background refresh failed — destroying usable content. Gated on `!hasData` instead.
 */
const showErrorState = computed(() => failed.value && !hasData.value)

/**
 * A refresh that failed while rows are still on screen. The rows stay; this says the list may be
 * stale. Polite rather than assertive: nothing on screen is broken.
 */
const showStaleNotice = computed(() => failed.value && hasData.value)

const isEmpty = computed(() => !pending.value && !failed.value && !forbidden.value && total.value === 0)

const parsedQuery = computed(() => parseAdminExperiencesQuery(route.query))

function queryWithPage(page: number): Record<string, string | undefined> {
  return { ...route.query, page: page === 1 ? undefined : String(page) }
}

function goToPage(page: number): void {
  void router.push({ query: queryWithPage(page) })
}

async function loadCurrentPage(): Promise<void> {
  const query = parsedQuery.value
  const meta = await load(query)
  if (!meta || query.page !== parsedQuery.value.page || query.page <= meta.totalPages) return
  await router.replace({ query: queryWithPage(meta.totalPages) })
}

/**
 * Experience-specific columns stay with this collection: its server-owned order and
 * translation-aware presentation do not belong in a generic table abstraction.
 */
const columns: TableColumn<AdminExperience>[] = [
  { id: 'role', header: () => t('dashboard.experiences.field.role') },
  { id: 'period', header: () => t('dashboard.experiences.field.period') },
  { id: 'employment', header: () => t('dashboard.experiences.field.employmentType') },
  { id: 'translations', header: () => t('dashboard.experiences.translationState.label') },
  { id: 'skills', header: () => t('dashboard.experiences.field.skills') },
  { id: 'actions', header: () => t('dashboard.experiences.edit') }
]

/* ── row presentation ──────────────────────────────────────────────────────────────────────────── */

function rowRole(experience: AdminExperience): string {
  return experienceDisplayRole(experience, locale.value, t('dashboard.experiences.untitled'))
}

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', {
  year: 'numeric',
  month: 'short'
}))

/**
 * The period a role covers.
 *
 * An open end reads as "Present" rather than as a blank or a dash: the row already carries a
 * "Current" badge, and a period that trailed off into nothing would be the only place on the page
 * where an absence is rendered as punctuation the operator has to interpret.
 */
function periodLabel(experience: AdminExperience): string {
  const start = dateFormatter.value.format(new Date(experience.startDate))
  const end = experience.endDate
    ? dateFormatter.value.format(new Date(experience.endDate))
    : t('dashboard.experiences.present')
  return t('dashboard.experiences.period', { start, end })
}

/**
 * The URL is the page-state source of truth. Page one is omitted, clicks push history entries, and
 * an out-of-range server response is corrected with replace so a delete cannot strand the operator.
 */
watch(parsedQuery, () => { void loadCurrentPage() }, { immediate: true, deep: true })
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.experiences.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.experiences.description') }}</p>
      </div>
      <UButton to="/dashboard/experiences/new" icon="i-lucide-plus" data-experiences-create>
        {{ t('dashboard.experiences.create') }}
      </UButton>
    </div>

    <!-- No filter section: the endpoint declares no query parameters, so there is nothing to filter
         BY. An invented control would build a URL contract the API does not honour. -->

    <!-- 403 is answered on its own terms: not retryable, not empty (D11-2). -->
    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-experiences-forbidden
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.experiences.forbiddenTitle')"
      :description="t('dashboard.experiences.forbiddenBody')"
    />

    <section v-else :aria-label="t('dashboard.experiences.listRegionLabel')">
      <!-- Polite, not an alert: the rows below are still usable and still shown. -->
      <p
        v-if="showStaleNotice"
        role="status"
        data-experiences-stale
        class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
      >
        {{ t('dashboard.experiences.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-experiences-stale-retry @click="loadCurrentPage()">
          {{ t('dashboard.experiences.retry') }}
        </UButton>
      </p>

      <UiRequestState
        :pending="initialPending"
        :refreshing="refreshing"
        :error="showErrorState"
        :empty="isEmpty"
        skeleton="rows"
        :count="5"
        @retry="loadCurrentPage()"
      >
        <!-- The SHARED error component, reused rather than re-implemented. Only its MESSAGE is
             supplied; its retry LABEL is deliberately NOT overridden, because that string resolves
             through `useSurfaceI18n()` inside the component and is the live F-1 surface. Passing a
             translated label in here would make the F-1 assertions vacuous — measured on Articles. -->
        <template #error>
          <UiStateError
            data-experiences-failed
            :message="t('dashboard.experiences.errorTitle')"
            @retry="loadCurrentPage()"
          />
        </template>

        <!-- ONE empty state, not two. Articles distinguishes an empty LIBRARY from an empty FILTERED
             result; with no filter, only the library case can occur. -->
        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-experiences-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.experiences.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.experiences.emptyBody') }}</p>
            <UButton class="mt-4" to="/dashboard/experiences/new" icon="i-lucide-plus" data-experiences-empty-create>
              {{ t('dashboard.experiences.create') }}
            </UButton>
          </div>
        </template>

        <div>
          <p class="mb-3 text-sm text-muted" data-experiences-count>
            {{ t('dashboard.experiences.resultCount', { total }) }}
          </p>

          <!-- ⚠ `items` reaches the table in API order. No client-side `.sort()` or slicing occurs. -->
          <div class="overflow-x-auto">
            <UTable
              :data="items"
              :columns="columns"
              :loading="refreshing"
              :aria-label="t('dashboard.experiences.listRegionLabel')"
              data-experiences-table
            >
              <template #role-cell="{ row }">
                <div :data-experience-row="row.original.id" class="min-w-56 max-w-md">
                  <!-- Authored content owns its own direction, independent of Dashboard chrome. -->
                  <p dir="auto" class="break-words font-medium text-highlighted" :data-experience-role="row.original.id">
                    {{ rowRole(row.original) }}
                  </p>
                  <p
                    v-if="experienceDisplayCompany(row.original, locale)"
                    dir="auto"
                    class="mt-1 break-words text-sm text-muted"
                    :data-experience-company="row.original.id"
                  >
                    {{ experienceDisplayCompany(row.original, locale) }}
                  </p>
                </div>
              </template>

              <template #period-cell="{ row }">
                <div class="whitespace-nowrap text-xs" :data-experience-period="row.original.id">
                  <!-- Read the stored flag directly; it is intentionally not inferred from endDate. -->
                  <UBadge
                    v-if="experienceIsCurrent(row.original)"
                    color="success"
                    variant="subtle"
                    size="sm"
                    class="me-1.5"
                    :data-experience-current="row.original.id"
                  >
                    {{ t('dashboard.experiences.current') }}
                  </UBadge>
                  <span dir="auto">{{ periodLabel(row.original) }}</span>
                </div>
              </template>

              <template #employment-cell="{ row }">
                <UBadge color="neutral" variant="subtle" size="sm" :data-experience-employment="row.original.employmentType">
                  {{ t(`dashboard.experiences.employmentType.${row.original.employmentType}`) }}
                </UBadge>
              </template>

              <template #translations-cell="{ row }">
                <!-- Completeness comes from the map; it never substitutes the other locale. -->
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="target in EXPERIENCE_LOCALES"
                    :key="target"
                    :color="experienceHasTranslation(row.original, target) ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                    :icon="experienceHasTranslation(row.original, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                    :data-experience-translation="`${target}:${experienceHasTranslation(row.original, target) ? 'present' : 'missing'}`"
                  >
                    {{ t(
                      experienceHasTranslation(row.original, target)
                        ? 'dashboard.experiences.translationState.present'
                        : 'dashboard.experiences.translationState.missing',
                      { locale: t(`dashboard.experiences.locale.${target}`) }
                    ) }}
                  </UBadge>
                </div>
              </template>

              <template #skills-cell="{ row }">
                <!-- A count describes the replace-wholesale relation without implying inline edits. -->
                <span :data-experience-skills="row.original.technologyIds.length">
                  {{ t('dashboard.experiences.skillCount', { count: row.original.technologyIds.length }) }}
                </span>
              </template>

              <template #actions-cell="{ row }">
                <UButton
                  :to="`/dashboard/experiences/${row.original.id}`"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-pencil"
                  :data-experience-edit="row.original.id"
                  :aria-label="t('dashboard.experiences.editFor', { role: rowRole(row.original) })"
                >
                  {{ t('dashboard.experiences.edit') }}
                </UButton>
              </template>
            </UTable>
          </div>
          <div v-if="totalPages > 1" class="mt-4 flex justify-end" data-experiences-pagination>
            <UPagination
              :page="parsedQuery.page"
              :total="total"
              :items-per-page="ADMIN_EXPERIENCES_PER_PAGE"
              @update:page="goToPage"
            />
          </div>
        </div>
      </UiRequestState>
    </section>
  </UContainer>
</template>
