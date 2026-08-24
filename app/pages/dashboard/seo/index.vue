<script setup lang="ts">
import type { PageSeoPageKey } from '~/composables/useAdminPageSeo'
import {
  PAGE_SEO_PAGE_ORDER,
  orderedPageSeoPages,
  pageSeoRowsByKey,
  useAdminPageSeo
} from '~/composables/useAdminPageSeo'
import { PAGE_SEO_LOCALES } from '~/composables/admin-page-seo-form'
import type { components } from '~/types/api'

type Schemas = components['schemas']
type SeoTranslation = Schemas['PageSeoTranslationEntity']

/**
 * Dashboard Static Page SEO — ONE destination for the SEVEN fixed singleton pages (FE4-U1c).
 *
 * ⚠ THIS SURFACE IS READ-ONLY. It shows the current EN/AR override values per page and nothing
 * else: no save, no edit, no picker, no PATCH — the editable form arrives with U1d, and shipping a
 * disabled editor early would promise an affordance this unit does not own.
 *
 * ── THE LIST IS THE COMPLETE READ SOURCE ─────────────────────────────────────────────────────────
 * `GET /admin/seo/pages` returns every static page with its FULL per-locale map (an unauthored
 * locale arrives all-null), so exactly ONE request populates the entire surface. The detail
 * endpoint is deliberately unused: fetching `GET /admin/seo/pages/{pageKey}` to populate a panel
 * would re-download what the list already delivered.
 *
 * ── PRESENTATION ORDER IS A FRONTEND DECISION ───────────────────────────────────────────────────
 * The list contract promises NO ordering, so server array position means nothing here. The page
 * selector walks `PAGE_SEO_PAGE_ORDER` (home → contact) and looks rows up BY KEY; a scrambled
 * server array renders identically.
 *
 * ── SELECTION IS LOCAL UI STATE ──────────────────────────────────────────────────────────────────
 * Initial selection is `home` BY NAME, never by array position, and it survives a background
 * refresh unchanged: the selected key is held in a ref while rows are replaced underneath it. If
 * corrupt fixture data ever removes the selected key, the fallback is deterministically `home`.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()

/**
 * Destructured at TOP LEVEL so templates read unwrapped booleans — refs nested inside a plain
 * object do not auto-unwrap (the Taxonomy U2 lesson).
 */
const { items, pending, forbidden, failed, load } = useAdminPageSeo()

useHead({ title: () => `${t('dashboard.seo.page.title')} · ${t('dashboard.title')}` })

/* ── the request-state contract (§14.9), one surface, one resource ─────────────────────────────── */

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
/** Error surface ONLY when there is nothing usable underneath it. */
const showErrorState = computed(() => failed.value && !hasData.value)
/** A refresh that failed while data is still on screen. Polite rather than assertive. */
const showStaleNotice = computed(() => failed.value && hasData.value)
const isEmpty = computed(() => !pending.value && !failed.value && !forbidden.value && !hasData.value)

/* ── presentation order and selection ─────────────────────────────────────────────────────────── */

const productPages = computed(() => orderedPageSeoPages(items.value))

/** Held BY KEY — never derived from array position, never rewritten by a refresh. */
const selectedKey = ref<PageSeoPageKey>('home')

/**
 * The EFFECTIVE selection: the operator's chosen key while its row exists, falling back
 * deterministically to `home` when corrupt fixture data removes it. Both the panel AND the
 * selector highlight read this, so a fallback is visible rather than silent.
 */
const effectiveKey = computed<PageSeoPageKey>(() => {
  const byKey = pageSeoRowsByKey(items.value)
  return byKey.has(selectedKey.value) ? selectedKey.value : 'home'
})

const selectedRow = computed<Schemas['AdminPageSeoEntity'] | null>(() => {
  return pageSeoRowsByKey(items.value).get(effectiveKey.value) ?? null
})

function select(key: PageSeoPageKey): void {
  selectedKey.value = key
}

function selectFromRow(row: Schemas['AdminPageSeoEntity']): void {
  if ((PAGE_SEO_PAGE_ORDER as readonly string[]).includes(row.pageKey)) select(row.pageKey as PageSeoPageKey)
}

/* ── read-only value presentation ─────────────────────────────────────────────────────────────── */

function fieldValue(translation: SeoTranslation | undefined, field: keyof SeoTranslation): string | null {
  return translation?.[field] ?? null
}

/**
 * ONE load, called directly — NOT `watch(..., { immediate: true })`: the endpoint takes no
 * parameters, so nothing could require a second request. `/dashboard/**` is `ssr: false`, so this
 * runs on the client's first render; deliberately not awaited so the SKELETON renders in flight.
 */
void load()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.seo.page.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.seo.page.description') }}</p>
      </div>
      <!-- Read-only refetch of THE one collection; selection and visible data survive it. -->
      <UButton
        size="sm"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        data-seo-refresh
        :disabled="pending"
        :aria-label="t('dashboard.seo.refresh')"
        @click="load()"
      >
        {{ t('dashboard.seo.refresh') }}
      </UButton>
    </div>

    <!-- 403 answered on its own terms: not retryable, not empty (D11-2). -->
    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-seo-forbidden
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.seo.forbiddenTitle')"
      :description="t('dashboard.seo.forbiddenBody')"
    />

    <template v-else>
      <!-- A refresh that failed while data stays on screen: polite, retryable, data untouched. -->
      <p
        v-if="showStaleNotice"
        role="status"
        data-seo-stale
        class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
      >
        {{ t('dashboard.seo.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-seo-stale-retry @click="load()">
          {{ t('common.retry') }}
        </UButton>
      </p>

      <UiRequestState
        :pending="initialPending"
        :refreshing="refreshing"
        :error="showErrorState"
        :empty="isEmpty"
        skeleton="rows"
        :count="3"
        @retry="load()"
      >
        <template #error>
          <UiStateError data-seo-failed :message="t('dashboard.seo.errorTitle')" @retry="load()" />
        </template>

        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-seo-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.seo.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.seo.emptyBody') }}</p>
          </div>
        </template>

        <div data-seo-loaded>
          <!-- ═══ the seven static pages, in PRODUCT order — never server array order ═══ -->
          <div class="flex flex-wrap gap-2" role="tablist" :aria-label="t('dashboard.seo.pages.regionLabel')">
            <UButton
              v-for="{ key, row } in productPages"
              :key="key"
              size="sm"
              role="tab"
              :aria-selected="effectiveKey === key"
              :color="effectiveKey === key ? 'primary' : 'neutral'"
              :variant="effectiveKey === key ? 'solid' : 'ghost'"
              :data-seo-page-select="key"
              @click="selectFromRow(row)"
            >
              {{ t(`dashboard.seo.pages.${key}`) }}
            </UButton>
          </div>

          <!-- ═══ the selected page's current overrides, READ ONLY ═══ -->
          <section
            v-if="selectedRow"
            :aria-label="t('dashboard.seo.selected.regionLabel', { page: t(`dashboard.seo.pages.${selectedRow.pageKey}`) })"
            data-seo-selected
            class="mt-5 flex flex-col gap-5"
          >
            <div
              v-for="seoLocale in PAGE_SEO_LOCALES"
              :key="seoLocale"
              :data-seo-locale-block="seoLocale"
              class="rounded-control border border-default p-4"
            >
              <h2 class="flex items-center gap-2 text-lg font-medium text-highlighted">
                {{ t('dashboard.seo.localeHeading', { locale: t(`dashboard.seo.locale.${seoLocale}`) }) }}
                <UBadge variant="subtle" size="sm">{{ seoLocale.toUpperCase() }}</UBadge>
              </h2>

              <dl class="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div :data-seo-field-meta-title="seoLocale">
                  <dt class="text-muted">{{ t('dashboard.seo.field.metaTitle') }}</dt>
                  <!-- Content direction pinned PER LOCALE BLOCK: Arabic values render RTL inside an
                       English chrome and vice versa (doc 11 §6). -->
                  <dd dir="auto" class="mt-0.5 break-words text-highlighted" :data-seo-value-meta-title="seoLocale">
                    <template v-if="fieldValue(selectedRow.translations[seoLocale], 'metaTitle') !== null">
                      {{ fieldValue(selectedRow.translations[seoLocale], 'metaTitle') }}
                    </template>
                    <template v-else>
                      <span class="text-muted italic">{{ t('dashboard.seo.notSet') }}</span>
                    </template>
                  </dd>
                </div>

                <div :data-seo-field-canonical="seoLocale">
                  <dt class="text-muted">{{ t('dashboard.seo.field.canonicalUrl') }}</dt>
                  <!-- ⚠ ALWAYS LTR — a URL under Arabic chrome must not inherit RTL. -->
                  <dd dir="ltr" class="mt-0.5 break-all text-highlighted" :data-seo-value-canonical="seoLocale">
                    <template v-if="fieldValue(selectedRow.translations[seoLocale], 'canonicalUrl') !== null">
                      {{ fieldValue(selectedRow.translations[seoLocale], 'canonicalUrl') }}
                    </template>
                    <template v-else>
                      <span class="text-muted italic">{{ t('dashboard.seo.notSet') }}</span>
                    </template>
                  </dd>
                </div>

                <div class="sm:col-span-2" :data-seo-field-meta-description="seoLocale">
                  <dt class="text-muted">{{ t('dashboard.seo.field.metaDescription') }}</dt>
                  <dd dir="auto" class="mt-0.5 break-words text-highlighted" :data-seo-value-meta-description="seoLocale">
                    <template v-if="fieldValue(selectedRow.translations[seoLocale], 'metaDescription') !== null">
                      {{ fieldValue(selectedRow.translations[seoLocale], 'metaDescription') }}
                    </template>
                    <template v-else>
                      <span class="text-muted italic">{{ t('dashboard.seo.notSet') }}</span>
                    </template>
                  </dd>
                </div>

                <div class="sm:col-span-2" :data-seo-field-og-image="seoLocale">
                  <dt class="text-muted">{{ t('dashboard.seo.field.ogImage') }}</dt>
                  <dd class="mt-0.5" :data-seo-value-og-image="seoLocale">
                    <!-- The id ONLY: media resolution is not this surface's job (and U1c adds no
                         fetching beyond the single list read). -->
                    <code v-if="fieldValue(selectedRow.translations[seoLocale], 'ogImageId') !== null" dir="ltr" class="break-all rounded bg-elevated px-1.5 py-0.5 text-xs">
                      {{ fieldValue(selectedRow.translations[seoLocale], 'ogImageId') }}
                    </code>
                    <span v-else dir="ltr" class="text-muted italic">{{ t('dashboard.seo.notSet') }}</span>
                  </dd>
                </div>
              </dl>
            </div>

            <p class="text-xs text-muted" data-seo-readonly-note>{{ t('dashboard.seo.readonlyNote') }}</p>
          </section>
        </div>
      </UiRequestState>
    </template>
  </UContainer>
</template>
