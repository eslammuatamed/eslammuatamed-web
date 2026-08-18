<script setup lang="ts">
import {
  EXPERIENCE_LOCALES,
  experienceDisplayCompany,
  experienceDisplayRole,
  experienceHasTranslation,
  experienceIsCurrent
} from '~/composables/admin-experience-fields'
import type { AdminExperience } from '~/composables/admin-experience-types'

/**
 * Dashboard Experience — the collection (FE-3 module 1, `M1·U2`).
 *
 * Built on the request-state contract §10 records, so this page is the SECOND consumer of it rather
 * than a fresh interpretation. What differs from Articles is contract-driven and is called out
 * where it happens, because each difference is a place a copied implementation would be wrong.
 *
 * ── THREE THINGS ARTICLES HAS THAT THIS DELIBERATELY DOES NOT ───────────────────────────────────
 * 1. NO URL QUERY STATE. `GET /admin/experiences` declares ZERO query parameters, so there is no
 *    page and no filter to put in the address. Articles' "URL is the single source of truth" rule
 *    is not weakened here — it has nothing to be true about. `useAdminExperiences` therefore takes
 *    no argument and `load()` is called once.
 * 2. NO PAGINATION. The response is `{ data: [...] }` with NO `meta`, so there is no `total`,
 *    `page` or `totalPages`. A `UPagination` here would be driven by fields that do not exist.
 * 3. NO STATUS. Experiences have no `status` and no `publishAt` — publishing and scheduling are not
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
const { items, pending, forbidden, failed, load } = useAdminExperiences()

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

const isEmpty = computed(() =>
  !pending.value && !failed.value && !forbidden.value && items.value.length === 0
)

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
 * ONE load, called directly — NOT `watch(..., { immediate: true })`.
 *
 * Articles watches its parsed route query because a filter or page change must re-request. This
 * endpoint takes no parameters, so there is nothing whose change could require a second request,
 * and a watcher over a constant would be a re-request that can never fire dressed up as reactivity.
 *
 * `/dashboard/**` is `ssr: false`, so this runs on the client's first render. The promise is
 * deliberately not awaited in setup: awaiting it would suspend the page and delay the SKELETON,
 * which is the very state the request-state contract exists to show while this is in flight.
 */
void load()
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
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-experiences-stale-retry @click="load()">
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
        @retry="load()"
      >
        <!-- The SHARED error component, reused rather than re-implemented. Only its MESSAGE is
             supplied; its retry LABEL is deliberately NOT overridden, because that string resolves
             through `useSurfaceI18n()` inside the component and is the live F-1 surface. Passing a
             translated label in here would make the F-1 assertions vacuous — measured on Articles. -->
        <template #error>
          <UiStateError
            data-experiences-failed
            :message="t('dashboard.experiences.errorTitle')"
            @retry="load()"
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
            {{ t('dashboard.experiences.resultCount', { total: items.length }) }}
          </p>

          <!-- ⚠ `items` IS RENDERED IN THE ORDER RECEIVED. No `.sort()` here, ever — see the header. -->
          <ul class="flex flex-col gap-2">
            <li v-for="experience in items" :key="experience.id">
              <UCard as="article" :data-experience-row="experience.id">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <!-- `dir="auto"` so an Arabic role reads correctly inside an English shell and
                         the reverse — field content direction is independent of chrome direction. -->
                    <h2 dir="auto" class="truncate font-medium text-highlighted" :data-experience-role="experience.id">
                      {{ rowRole(experience) }}
                    </h2>
                    <p
                      v-if="experienceDisplayCompany(experience, locale)"
                      dir="auto"
                      class="mt-1 truncate text-sm text-muted"
                      :data-experience-company="experience.id"
                    >
                      {{ experienceDisplayCompany(experience, locale) }}
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/experiences/${experience.id}`"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-pencil"
                    :data-experience-edit="experience.id"
                    :aria-label="t('dashboard.experiences.editFor', { role: rowRole(experience) })"
                  >
                    {{ t('dashboard.experiences.edit') }}
                  </UButton>
                </div>

                <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.experiences.field.period') }}</dt>
                    <dd :data-experience-period="experience.id">
                      <!-- Read straight off `isCurrent`, never re-derived from `endDate`: the two can
                           legitimately disagree, because the API enforces no cross-field rule. -->
                      <UBadge
                        v-if="experienceIsCurrent(experience)"
                        color="success"
                        variant="subtle"
                        size="sm"
                        class="me-1.5"
                        :data-experience-current="experience.id"
                      >
                        {{ t('dashboard.experiences.current') }}
                      </UBadge>
                      <span dir="auto">{{ periodLabel(experience) }}</span>
                    </dd>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.experiences.field.employmentType') }}</dt>
                    <dd>
                      <UBadge
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :data-experience-employment="experience.employmentType"
                      >
                        {{ t(`dashboard.experiences.employmentType.${experience.employmentType}`) }}
                      </UBadge>
                    </dd>
                  </div>

                  <!-- Completeness, derived from which locales the translation MAP actually holds.
                       Nothing substitutes one language for the other. -->
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.experiences.translationState.label') }}</dt>
                    <dd class="flex items-center gap-1.5">
                      <UBadge
                        v-for="target in EXPERIENCE_LOCALES"
                        :key="target"
                        :color="experienceHasTranslation(experience, target) ? 'success' : 'warning'"
                        variant="subtle"
                        size="sm"
                        :icon="experienceHasTranslation(experience, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                        :data-experience-translation="`${target}:${experienceHasTranslation(experience, target) ? 'present' : 'missing'}`"
                      >
                        {{ t(
                          experienceHasTranslation(experience, target)
                            ? 'dashboard.experiences.translationState.present'
                            : 'dashboard.experiences.translationState.missing',
                          { locale: t(`dashboard.experiences.locale.${target}`) }
                        ) }}
                      </UBadge>
                    </dd>
                  </div>

                  <!-- Skills are shown as a COUNT, not as chips: the relation is replace-wholesale
                       and is edited in the editor, so a list row states how many are linked without
                       implying they can be changed here. -->
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.experiences.field.skills') }}</dt>
                    <dd :data-experience-skills="experience.technologyIds.length">
                      {{ t('dashboard.experiences.skillCount', { count: experience.technologyIds.length }) }}
                    </dd>
                  </div>
                </dl>
              </UCard>
            </li>
          </ul>
        </div>
      </UiRequestState>
    </section>
  </UContainer>
</template>
