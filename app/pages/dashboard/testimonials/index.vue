<script setup lang="ts">
import {
  TESTIMONIAL_LOCALES,
  testimonialDisplayAuthor,
  testimonialDisplayQuote,
  testimonialHasTranslation
} from '~/composables/admin-testimonial-fields'
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'

/**
 * Dashboard Testimonials — the collection (FE-3 module 3, `T·U2`).
 *
 * Built on the same request-state contract as Articles, Experiences and Skills, so this page adds no
 * new interpretation of it. What differs from them is contract-driven and called out where it
 * happens, because each difference is a place a copied implementation would be wrong.
 *
 * ── WHAT THE CONTRACT LEAVES OUT, THIS ROUTE LEAVES OUT ─────────────────────────────────────────
 * `GET /admin/testimonials` declares ZERO query parameters — an unsolicited query string is a 422 —
 * and answers `{ data: [...] }` with NO `meta`. So there is NO URL query state, NO pagination and NO
 * filter: a control for any of them would build a URL contract the API does not honour.
 *
 * Testimonials have exactly `order` and `isVisible` — no `status`, no `publishAt` — so there is no
 * status chip and no empty-FILTERED state: publishing and scheduling are not concepts in this shape.
 *
 * ── ⚠ THE ROWS ARE NOT SORTED HERE, AND THAT IS THE POINT ───────────────────────────────────────
 * The endpoint takes no sort parameter, so the server's order IS the contract. `v-for` walks `items`
 * in the order received and nothing re-orders it — not by `order`, not by anything else. A
 * client-side sort would silently override the operator's server-owned sequence, and the browser
 * lane pins this against fixtures whose `order` values are deliberately out of sequence.
 *
 * `avatarId` is presented as DATA — linked or none — never resolved into an image here: the list
 * shows what is stored, and rendering media belongs to surfaces that read the media library.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const { items, pending, forbidden, failed, load } = useAdminTestimonials()

useHead({ title: () => `${t('dashboard.testimonials.title')} · ${t('dashboard.title')}` })

/* ── the request-state contract (§10.3 rules 1–3) ──────────────────────────────────────────────── */

const hasData = computed(() => items.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)

/** Error surface ONLY when there is nothing usable underneath it — see Experiences. */
const showErrorState = computed(() => failed.value && !hasData.value)

/** A refresh that failed while rows are still on screen. Polite rather than assertive. */
const showStaleNotice = computed(() => failed.value && hasData.value)

const isEmpty = computed(() =>
  !pending.value && !failed.value && !forbidden.value && items.value.length === 0
)

/* ── row presentation ──────────────────────────────────────────────────────────────────────────── */

function rowAuthor(testimonial: AdminTestimonial): string {
  return testimonialDisplayAuthor(testimonial, locale.value, t('dashboard.testimonials.untitled'))
}

function rowQuote(testimonial: AdminTestimonial): string | null {
  return testimonialDisplayQuote(testimonial, locale.value)
}

/**
 * ONE load, called directly — NOT `watch(..., { immediate: true })`.
 *
 * This endpoint takes no parameters, so there is nothing whose change could require a second request,
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
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.testimonials.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.testimonials.description') }}</p>
      </div>
      <UButton to="/dashboard/testimonials/new" icon="i-lucide-plus" data-testimonials-create>
        {{ t('dashboard.testimonials.create') }}
      </UButton>
    </div>

    <!-- No filter section: the endpoint rejects any query string with a 422, so there is nothing to
         filter BY. An invented control would build a URL contract the API does not honour. -->

    <!-- 403 is answered on its own terms: not retryable, not empty (D11-2). -->
    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-testimonials-forbidden
      :ui="{ title: 'text-error-700 dark:text-error-300', description: 'text-error-700 dark:text-error-300' }"
      :title="t('dashboard.testimonials.forbiddenTitle')"
      :description="t('dashboard.testimonials.forbiddenBody')"
    />

    <section v-else :aria-label="t('dashboard.testimonials.listRegionLabel')">
      <!-- Polite, not an alert: the rows below are still usable and still shown. -->
      <p
        v-if="showStaleNotice"
        role="status"
        data-testimonials-stale
        class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted"
      >
        {{ t('dashboard.testimonials.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-testimonials-stale-retry @click="load()">
          {{ t('dashboard.testimonials.retry') }}
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
        <!-- The SHARED error component; only its message is supplied, its retry label resolves
             through `useSurfaceI18n()` inside the component and stays the live F-1 surface. -->
        <template #error>
          <UiStateError
            data-testimonials-failed
            :message="t('dashboard.testimonials.errorTitle')"
            @retry="load()"
          />
        </template>

        <!-- ONE empty state: with no filter, only the library case can occur. -->
        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-testimonials-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.testimonials.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.testimonials.emptyBody') }}</p>
            <UButton class="mt-4" to="/dashboard/testimonials/new" icon="i-lucide-plus" data-testimonials-empty-create>
              {{ t('dashboard.testimonials.create') }}
            </UButton>
          </div>
        </template>

        <div data-testimonials-loaded>
          <p class="mb-3 text-sm text-muted" data-testimonials-count>
            {{ t('dashboard.testimonials.resultCount', { total: items.length }) }}
          </p>

          <!-- ⚠ `items` IS RENDERED IN THE ORDER RECEIVED. No `.sort()` here, ever — see the header. -->
          <ul class="flex flex-col gap-2">
            <li v-for="testimonial in items" :key="testimonial.id">
              <UCard as="article" :data-testimonial-row="testimonial.id">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <!-- `dir="auto"` so an Arabic name reads correctly inside an English shell and
                         the reverse — field content direction is independent of chrome direction. -->
                    <h2 dir="auto" class="truncate font-medium text-highlighted" :data-testimonial-author="testimonial.id">
                      {{ rowAuthor(testimonial) }}
                    </h2>
                    <!-- One-line quote preview, clamped so a 4000-character quote cannot take over
                         the list; the editor is where full quotes are read and written. -->
                    <p
                      v-if="rowQuote(testimonial)"
                      dir="auto"
                      class="mt-1 truncate text-sm text-muted"
                      :data-testimonial-quote="testimonial.id"
                    >
                      {{ rowQuote(testimonial) }}
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/testimonials/${testimonial.id}`"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-pencil"
                    :data-testimonial-edit="testimonial.id"
                    :aria-label="t('dashboard.testimonials.editFor', { author: rowAuthor(testimonial) })"
                  >
                    {{ t('dashboard.testimonials.edit') }}
                  </UButton>
                </div>

                <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.testimonials.field.order') }}</dt>
                    <!-- Displayed AS DATA. It is not a sort control and implies no sorting policy:
                         the sequence on screen is the API's, whatever these numbers say. -->
                    <dd :data-testimonial-order="testimonial.id">{{ testimonial.order }}</dd>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.testimonials.field.visibility') }}</dt>
                    <dd>
                      <UBadge
                        :color="testimonial.isVisible ? 'success' : 'neutral'"
                        variant="subtle"
                        size="sm"
                        :data-testimonial-visible="String(testimonial.isVisible)"
                      >
                        {{ t(testimonial.isVisible ? 'dashboard.testimonials.visible' : 'dashboard.testimonials.hidden') }}
                      </UBadge>
                    </dd>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.testimonials.field.avatar') }}</dt>
                    <dd>
                      <UBadge
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :data-testimonial-avatar="testimonial.avatarId ?? 'none'"
                      >
                        {{ t(testimonial.avatarId ? 'dashboard.testimonials.avatarLinked' : 'dashboard.testimonials.noAvatar') }}
                      </UBadge>
                    </dd>
                  </div>

                  <!-- Completeness, derived from which locales the translation MAP actually holds.
                       Nothing substitutes one language for the other. -->
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.testimonials.translationState.label') }}</dt>
                    <dd class="flex items-center gap-1.5">
                      <UBadge
                        v-for="target in TESTIMONIAL_LOCALES"
                        :key="target"
                        :color="testimonialHasTranslation(testimonial, target) ? 'success' : 'warning'"
                        variant="subtle"
                        size="sm"
                        :icon="testimonialHasTranslation(testimonial, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                        :data-testimonial-translation="`${target}:${testimonialHasTranslation(testimonial, target) ? 'present' : 'missing'}`"
                      >
                        {{ t(
                          testimonialHasTranslation(testimonial, target)
                            ? 'dashboard.testimonials.translationState.present'
                            : 'dashboard.testimonials.translationState.missing',
                          { locale: t(`dashboard.testimonials.locale.${target}`) }
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
    </section>
  </UContainer>
</template>
