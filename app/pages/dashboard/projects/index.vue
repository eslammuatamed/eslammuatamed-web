<script setup lang="ts">
import {
  ADMIN_PROJECTS_PER_PAGE,
  ADMIN_PROJECT_SORT_COLUMNS,
  parseAdminProjectsQuery,
  type AdminProjectTristate
} from '~/composables/admin-projects-query'
import { PROJECT_LOCALES, hasTranslation, type ProjectLocale } from '~/composables/admin-project-form'
import type { AdminProject } from '~/composables/admin-project-types'

/**
 * Dashboard Projects — the list (doc 11, flow F-D5's shape applied to the Projects module).
 *
 * URL IS THE SINGLE SOURCE OF TRUTH for the page, the search, both filters and the sort. Back and
 * Forward, a reload and a shared link all reproduce the same view because the view is derived from
 * the address and from nothing else — there is no second copy of "what is being shown" to fall out
 * of step with it.
 *
 * EVERY NARROWING IS A QUERY PARAMETER. Nothing is fetched wholesale and filtered in the browser.
 * `meta.total` and `meta.totalPages` describe the SERVER's result set under the SERVER's ordering,
 * so a client-side filter would print a page count that does not describe the rows under it — and
 * would only get worse as the library grows.
 *
 * ONE PRESENTATION AT EVERY WIDTH, unlike the Inbox. That page renders a table and a card list with
 * one hidden by CSS, which cost it a long and delicate argument about focus landing on the hidden
 * counterpart. A project row is not tabular content — it carries two slugs, two state chips and a
 * translation summary — so a single list of rows reads correctly from 320px up and there is exactly
 * one node per project in the DOM, which makes that entire class of bug impossible here.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL. Rationale in `~/utils/dashboard-locale`.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const { items, total, totalPages, pending, forbidden, failed, load } = useAdminProjects()

useHead({ title: () => `${t('dashboard.projects.title')} · ${t('dashboard.title')}` })

/**
 * ONE canonical parse of the route query (Zod-first Dashboard validation policy). Every read below
 * derives from it, so a filter cannot be normalised one way in a computed and another way in a
 * handler. The schema is total — it defaults rather than throwing — and never rewrites the URL,
 * which is what keeps normalisation from re-triggering the watcher that reads it.
 */
const parsed = computed(() => parseAdminProjectsQuery(route.query))

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
const showErrorState = computed(() => failed.value && !hasData.value)
const showStaleNotice = computed(() => failed.value && hasData.value)
const isEmpty = computed(() => !pending.value && !failed.value && !forbidden.value && !hasData.value)

function setQuery(patch: Record<string, string | undefined>): void {
  // Build the next query by filtering rather than deleting: `undefined` means "drop this parameter",
  // and a rebuilt object states that without mutating the route's own query object.
  const merged = { ...route.query, ...patch }
  const next = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined))
  void router.push({ query: next })
}

/**
 * Any change to a FILTER resets to page 1, in the same navigation.
 *
 * Not a separate push: `router.push` does not update `route.query` synchronously, so two pushes in
 * one tick both build their target from the same pre-interaction query and the second silently
 * discards the first (the incident recorded in `utils/media-query.ts`). Changing a filter and
 * returning to the first page is ONE interaction, so it is one navigation.
 */
function setFilter(patch: Record<string, string | undefined>): void {
  setQuery({ ...patch, page: undefined })
}

/* ── search ────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The box holds its own value while the operator types, and the URL is written on a pause.
 *
 * A navigation per keystroke would put one history entry per character between the operator and the
 * page they came from. The debounce is what makes the URL the source of truth affordable; the
 * composable's request token is what keeps the responses honest when several are in flight.
 */
const searchInput = ref(parsed.value.q ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(() => parsed.value.q, (q) => {
  // Adopt the URL's value when the URL changed WITHOUT the box — Back/Forward, or "Clear all". While
  // a keystroke is waiting to be pushed the box is ahead of the URL on purpose, and overwriting it
  // here would delete what is being typed.
  if (searchTimer !== undefined) return
  searchInput.value = q ?? ''
})

function onSearchInput(value: string): void {
  searchInput.value = value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = undefined
    const trimmed = value.trim()
    setFilter({ q: trimmed === '' ? undefined : trimmed })
  }, 300)
}

onUnmounted(() => clearTimeout(searchTimer))

/* ── filters and sort ──────────────────────────────────────────────────────────────────────────── */

const tristateItems = computed(() => [
  { value: 'all', label: t('dashboard.projects.filters.all') },
  { value: 'yes', label: t('dashboard.projects.filters.yes') },
  { value: 'no', label: t('dashboard.projects.filters.no') }
])

function setTristate(key: 'published' | 'featured', value: AdminProjectTristate): void {
  // `all` is the DEFAULT and is never emitted, so one view keeps one URL.
  setFilter({ [key]: value === 'all' ? undefined : value })
}

/**
 * The sort is TWO controls — the column, and its direction — which is exactly the shape of the two
 * parameters the API takes.
 *
 * Collapsing them into one list of curated pairs was tried and abandoned: `?sortBy=featured&
 * sortOrder=asc` is a perfectly reachable address, and a curated list has no entry for it, so the
 * control would have shown a different sort from the one being applied. A control that misreports
 * the state it governs is worse than one extra select. `sortOrder` is documented as ignored without
 * `sortBy`, so the direction control only exists once a column is chosen.
 */
const SORT_COLUMN_DEFAULT = 'default'

const sortColumnItems = computed(() => [
  { value: SORT_COLUMN_DEFAULT, label: t('dashboard.projects.sort.default') },
  ...ADMIN_PROJECT_SORT_COLUMNS.map(column => ({ value: column, label: t(`dashboard.projects.sort.${column}`) }))
])

const sortDirectionItems = computed(() => [
  { value: 'asc', label: t('dashboard.projects.direction.asc') },
  { value: 'desc', label: t('dashboard.projects.direction.desc') }
])

function setSortColumn(value: string): void {
  // Dropping the column drops the direction with it, so no `sortOrder` is left in the URL for a
  // sort that no longer exists.
  if (value === SORT_COLUMN_DEFAULT) {
    setFilter({ sortBy: undefined, sortOrder: undefined })
    return
  }
  setFilter({ sortBy: value, sortOrder: parsed.value.sortOrder })
}

const filtered = computed(() =>
  parsed.value.q !== undefined
  || parsed.value.published !== 'all'
  || parsed.value.featured !== 'all'
  || parsed.value.sortBy !== undefined
)

function clearFilters(): void {
  searchInput.value = ''
  clearTimeout(searchTimer)
  searchTimer = undefined
  setQuery({ q: undefined, published: undefined, featured: undefined, sortBy: undefined, sortOrder: undefined, page: undefined })
}

function goToPage(next: number): void {
  setQuery({ page: next === 1 ? undefined : String(next) })
}

/* ── row presentation ──────────────────────────────────────────────────────────────────────────── */

/**
 * The row's heading.
 *
 * Prefers the title in the DASHBOARD's language and falls back to the other one, then to a neutral
 * placeholder — never to the slug alone and never to an empty row. This is the ONE place a
 * cross-locale read is correct: it is a way to identify a row, not authored content, and the
 * translation column right beside it states plainly which languages actually exist. The editor
 * itself does no such thing.
 *
 * The preferred locale used to be hard-coded `en`, because the chrome was English-only. OD-11
 * (D02-15) makes the chrome bilingual, so an Arabic-working operator now sees Arabic titles first —
 * with the same fallback shape, only the preference order follows the operator.
 */
function rowTitle(project: AdminProject): string {
  const preferred = project.translations[locale.value]?.title
  if (preferred && preferred.trim().length > 0) return preferred
  const arabic = project.translations[locale.value === 'ar' ? 'en' : 'ar']?.title
  if (arabic && arabic.trim().length > 0) return arabic
  return t('dashboard.projects.untitled')
}

function rowSlug(project: AdminProject, target: ProjectLocale): string | null {
  const slug = project.translations[target]?.slug
  return slug && slug.trim().length > 0 ? slug : null
}

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', {
  dateStyle: 'medium'
}))

watch(parsed, value => void load(value), { immediate: true, deep: true })
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.projects.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.projects.description') }}</p>
      </div>
      <UButton to="/dashboard/projects/new" icon="i-lucide-plus" data-projects-create>
        {{ t('dashboard.projects.create') }}
      </UButton>
    </div>

    <!-- ── search and filters ───────────────────────────────────────────────────────────────────
         A real <section> with a name, so the controls are a landmark a screen-reader user can jump
         to rather than an unlabelled row of inputs above a list. -->
    <section :aria-label="t('dashboard.projects.filters.heading')" class="mb-6 flex flex-col gap-3">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField :label="t('dashboard.projects.filters.search')" :help="t('dashboard.projects.filters.searchHint')">
          <UInput
            :model-value="searchInput"
            icon="i-lucide-search"
            type="search"
            data-projects-search
            class="w-full"
            :placeholder="t('dashboard.projects.filters.searchPlaceholder')"
            @update:model-value="onSearchInput(String($event))"
          />
        </UFormField>

        <UFormField :label="t('dashboard.projects.filters.published')">
          <USelect
            :model-value="parsed.published"
            :items="tristateItems"
            data-projects-published
            class="w-full"
            @update:model-value="setTristate('published', $event as AdminProjectTristate)"
          />
        </UFormField>

        <UFormField :label="t('dashboard.projects.filters.featured')">
          <USelect
            :model-value="parsed.featured"
            :items="tristateItems"
            data-projects-featured
            class="w-full"
            @update:model-value="setTristate('featured', $event as AdminProjectTristate)"
          />
        </UFormField>

        <UFormField :label="t('dashboard.projects.filters.sort')">
          <USelect
            :model-value="parsed.sortBy ?? SORT_COLUMN_DEFAULT"
            :items="sortColumnItems"
            data-projects-sort
            class="w-full"
            @update:model-value="setSortColumn(String($event))"
          />
        </UFormField>

        <!-- Only meaningful once a column is chosen: the API documents `sortOrder` as ignored
             without `sortBy`, and a control whose value does nothing is a control that lies. -->
        <UFormField v-if="parsed.sortBy" :label="t('dashboard.projects.filters.direction')">
          <USelect
            :model-value="parsed.sortOrder"
            :items="sortDirectionItems"
            data-projects-direction
            class="w-full"
            @update:model-value="setFilter({ sortOrder: String($event) })"
          />
        </UFormField>
      </div>

      <div v-if="filtered" class="flex">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" data-projects-clear @click="clearFilters()">
          {{ t('dashboard.projects.filters.clear') }}
        </UButton>
      </div>
    </section>

    <section :aria-label="t('dashboard.projects.listRegionLabel')">
      <!-- The subtle error title defaults to the 500 red, which measures 3.15:1 on its own tinted
           background — under the 4.5:1 AA minimum. The 700 shade is 5.32:1, matching the Inbox. -->
      <UAlert
        v-if="forbidden"
        color="error"
        variant="subtle"
        icon="i-lucide-lock"
        data-projects-forbidden
        :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
        :title="t('dashboard.projects.forbiddenTitle')"
        :description="t('dashboard.projects.forbiddenBody')"
      />

      <template v-else>
        <p
          v-if="showStaleNotice"
          role="status"
          data-projects-stale
          class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
        >
          {{ t('dashboard.projects.staleNotice') }}
          <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-projects-stale-retry @click="load(parsed)">
            {{ t('dashboard.projects.retry') }}
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
          <template #error>
            <UiStateError data-projects-failed :message="t('dashboard.projects.errorTitle')" @retry="load(parsed)" />
          </template>

          <!-- An empty FILTERED result is a different answer from an empty library, and saying so is the
               difference between "change your filters" and "create your first project". -->
          <template #empty>
            <div class="rounded-control border border-default p-10 text-center" data-projects-empty>
              <p class="font-medium text-highlighted">
                {{ filtered ? t('dashboard.projects.emptyFilteredTitle') : t('dashboard.projects.emptyTitle') }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ filtered ? t('dashboard.projects.emptyFilteredBody') : t('dashboard.projects.emptyBody') }}
              </p>
            </div>
          </template>

          <div>
        <p class="mb-3 text-sm text-muted" data-projects-count>
          {{ t('dashboard.projects.resultCount', { total, page: parsed.page, pages: totalPages }) }}
        </p>

        <ul class="flex flex-col gap-2">
          <li v-for="project in items" :key="project.id">
            <UCard as="article" :data-project-row="project.id">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h2 dir="auto" class="truncate font-medium text-highlighted">{{ rowTitle(project) }}</h2>

                  <!-- Both slugs, each in its own direction: an Arabic slug in an LTR-forced box
                       renders its punctuation in the wrong place. -->
                  <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span v-for="slugLocale in PROJECT_LOCALES" :key="slugLocale" class="break-all">
                      <span class="uppercase">{{ slugLocale }}</span>
                      <span aria-hidden="true">&nbsp;/&nbsp;</span>
                      <span :dir="slugLocale === 'ar' ? 'rtl' : 'ltr'">{{ rowSlug(project, slugLocale) ?? '—' }}</span>
                    </span>
                  </p>
                </div>

                <UButton
                  :to="`/dashboard/projects/${project.id}`"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-pencil"
                  :data-project-edit="project.id"
                  :aria-label="t('dashboard.projects.editFor', { title: rowTitle(project) })"
                >
                  {{ t('dashboard.projects.edit') }}
                </UButton>
              </div>

              <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <div class="flex items-center gap-1.5">
                  <dt class="text-muted">{{ t('dashboard.projects.field.state') }}</dt>
                  <!-- State is never colour-only: each chip carries its own word. -->
                  <dd class="flex items-center gap-1.5">
                    <UBadge
                      :color="project.isPublished ? 'success' : 'neutral'"
                      variant="subtle"
                      size="sm"
                      :data-project-published="project.isPublished"
                    >
                      {{ project.isPublished ? t('dashboard.projects.state.published') : t('dashboard.projects.state.draft') }}
                    </UBadge>
                    <UBadge
                      v-if="project.featured"
                      color="primary"
                      variant="subtle"
                      size="sm"
                      icon="i-lucide-star"
                      data-project-featured
                    >
                      {{ t('dashboard.projects.state.featured') }}
                    </UBadge>
                  </dd>
                </div>

                <!-- ── translation completeness ────────────────────────────────────────────────
                     Derived from which locales the translation MAP actually holds. A locale the
                     project does not have reads as missing, in words as well as in colour, and
                     nothing anywhere substitutes the other language for it. -->
                <div class="flex items-center gap-1.5">
                  <dt class="text-muted">{{ t('dashboard.projects.translationState.label') }}</dt>
                  <dd class="flex items-center gap-1.5">
                    <UBadge
                      v-for="target in PROJECT_LOCALES"
                      :key="target"
                      :color="hasTranslation(project, target) ? 'success' : 'warning'"
                      variant="subtle"
                      size="sm"
                      :icon="hasTranslation(project, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                      :data-project-translation="`${target}:${hasTranslation(project, target) ? 'present' : 'missing'}`"
                    >
                      {{ t(
                        hasTranslation(project, target)
                          ? 'dashboard.projects.translationState.present'
                          : 'dashboard.projects.translationState.missing',
                        { locale: t(`dashboard.projects.locale.${target}`) }
                      ) }}
                    </UBadge>
                  </dd>
                </div>

                <div class="flex items-center gap-1.5">
                  <dt class="text-muted">{{ t('dashboard.projects.field.order') }}</dt>
                  <dd class="font-medium text-highlighted" :data-project-order="project.id">{{ project.order }}</dd>
                </div>

                <div v-if="project.year !== null" class="flex items-center gap-1.5">
                  <dt class="text-muted">{{ t('dashboard.projects.field.year') }}</dt>
                  <dd class="font-medium text-highlighted">{{ project.year }}</dd>
                </div>

                <div class="flex items-center gap-1.5">
                  <dt class="text-muted">{{ t('dashboard.projects.field.updated') }}</dt>
                  <dd>
                    <time :datetime="project.updatedAt">{{ dateFormatter.format(new Date(project.updatedAt)) }}</time>
                  </dd>
                </div>
              </dl>
            </UCard>
          </li>
        </ul>

        <div v-if="totalPages > 1" class="mt-4 flex justify-center">
          <UPagination
            data-projects-pagination
            :page="parsed.page"
            :total="total"
            :items-per-page="ADMIN_PROJECTS_PER_PAGE"
            @update:page="goToPage"
          />
        </div>
          </div>
        </UiRequestState>
      </template>
    </section>
  </UContainer>
</template>
