<script setup lang="ts">
import type { PageSeoPageKey } from '~/composables/useAdminPageSeo'
import {
  orderedPageSeoPages,
  pageSeoRowsByKey,
  useAdminPageSeo
} from '~/composables/useAdminPageSeo'

/**
 * Dashboard Static Page SEO — ONE destination for the SEVEN fixed singleton pages (FE4-U1c read,
 * FE4-U1d edit). A THIN WRAPPER by campaign convention: this page owns the collection read, the
 * request-state shell, product-order selection and unsaved-switch protection; the selected record
 * is edited by `DashboardPageSeoEditor`, whose form/payload semantics live entirely in the U1b
 * layer and whose transport is the composable's PATCH.
 *
 * ── THE LIST ROWS REMAIN THE EDIT SOURCE ────────────────────────────────────────────────────────
 * Selecting a page hands its collection row to the editor — there is no detail GET on any path,
 * and after a save the AUTHORITATIVE PATCH RESPONSE replaces the row in place (`replaceRow`),
 * which flows back into the editor as a clean re-seed without a second request.
 *
 * ── UNSAVED WORK IS PROTECTED IN BOTH DIRECTIONS ────────────────────────────────────────────────
 * The editor publishes its dirty flag upward: switching pages while DIRTY asks (confirm) — cancel
 * keeps everything, confirm discards; CLEAN switches immediately. Route-leave/reload are guarded
 * inside the editor. A background refresh NEVER disturbs a dirty editor (the editor ignores row
 * swaps while dirty); a clean one rehydrates from the refreshed list.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()

/** Destructured at TOP LEVEL so templates read unwrapped booleans (the Taxonomy U2 lesson). */
const { items, pending, forbidden, failed, load, replaceRow } = useAdminPageSeo()

useHead({ title: () => `${t('dashboard.seo.page.title')} · ${t('dashboard.title')}` })

/* ── the request-state contract (§14.9), one surface, one resource (U1c, preserved) ────────────── */

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
const showErrorState = computed(() => failed.value && !hasData.value)
const showStaleNotice = computed(() => failed.value && hasData.value)
const isEmpty = computed(() => !pending.value && !failed.value && !forbidden.value && !hasData.value)

/* ── presentation order + selection (U1c semantics, now guarded by dirtiness) ──────────────────── */

const productPages = computed(() => orderedPageSeoPages(items.value))

const selectedKey = ref<PageSeoPageKey>('home')

const effectiveKey = computed<PageSeoPageKey>(() => {
  const byKey = pageSeoRowsByKey(items.value)
  return byKey.has(selectedKey.value) ? selectedKey.value : 'home'
})

const selectedRow = computed(() => pageSeoRowsByKey(items.value).get(effectiveKey.value) ?? null)

/** Published by the editor; gates BOTH page-switch confirmation paths below. */
const editorDirty = ref(false)

/**
 * Page switching with unsaved-change protection (OD-8): CLEAN switches immediately; DIRTY asks —
 * cancel keeps the current page AND its edits, confirm discards. The switch itself is just a key
 * change: the editor is keyed per page and seeds fresh from the destination row.
 */
function selectFromRow(target: { key: PageSeoPageKey }): void {
  if (target.key === effectiveKey.value) return
  if (!editorDirty.value || window.confirm(t('dashboard.seo.editor.discardConfirm'))) {
    selectedKey.value = target.key
  }
}

/** The authoritative PATCH response replaces exactly that row in the collection. */
function onEditorSaved(updated: ReturnType<typeof pageSeoRowsByKey> extends Map<string, infer R> ? R : never): void {
  replaceRow(updated)
}

/** One load, called directly — the endpoint takes no parameters (U1c reasoning unchanged). */
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
              v-for="{ key } in productPages"
              :key="key"
              size="sm"
              role="tab"
              :aria-selected="effectiveKey === key"
              :color="effectiveKey === key ? 'primary' : 'neutral'"
              :variant="effectiveKey === key ? 'solid' : 'ghost'"
              :data-seo-page-select="key"
              @click="selectFromRow({ key })"
            >
              {{ t(`dashboard.seo.pages.${key}`) }}
            </UButton>
          </div>

          <!-- ═══ the selected page's EDITOR ═══ keyed per page: a switch is a fresh, honest seed ═══ -->
          <section
            v-if="selectedRow"
            :aria-label="t('dashboard.seo.selected.regionLabel', { page: t(`dashboard.seo.pages.${selectedRow.pageKey}`) })"
            data-seo-selected
            class="mt-5 flex flex-col gap-5"
          >
            <DashboardPageSeoEditor
              :key="effectiveKey"
              v-model:dirty="editorDirty"
              :row="selectedRow"
              @saved="onEditorSaved"
            />
          </section>
        </div>
      </UiRequestState>
    </template>
  </UContainer>
</template>
