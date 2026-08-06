<script setup lang="ts">
import type { MediaAsset, MediaUsage } from '~/types/models'
import { parseMediaQuery } from '~/utils/media-query'
import { dimensionsOf, libraryAltFor } from '~/utils/media-asset'

/**
 * Dashboard Media Library (doc 07, design §5).
 *
 * CONSUMES THE EXISTING PIPELINE UNCHANGED. Upload processing, R2 storage, SHA-256 deduplication,
 * image variants, BlurHash, usage inspection and delete-in-use protection are all already built and
 * governed on the API. This page is a surface over them and reimplements none of it.
 *
 * URL IS THE SINGLE SOURCE OF TRUTH for search, kind and page — `?q=&kind=&page=` — following the
 * Inbox. Back/Forward, reload and a shared link all reproduce the same grid without any manual
 * synchronisation, because history navigation changes the query and the UI simply follows.
 *
 * Deliberately NOT here (design §5): folders, tags, cropping and image editing. Assets are immutable
 * by design (D07-6) — "replace" means selecting or uploading a different asset and repointing the
 * reference, which is the picker's job, not an edit to bytes that other records already reference.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const library = useMediaLibrary()

useHead({ title: () => `${t('dashboard.media.title')} · ${t('dashboard.title')}` })

/** ONE canonical parse of the route query; every read below derives from it. */
const parsedQuery = computed(() => parseMediaQuery(route.query))
const q = computed(() => parsedQuery.value.q)
const kind = computed(() => parsedQuery.value.kind)
const page = computed(() => parsedQuery.value.page)

function setQuery(patch: Record<string, string | undefined>): void {
  // Build the next query by filtering rather than deleting: `undefined` means "drop this parameter",
  // stated without mutating the route's own query object, and unrelated parameters are preserved.
  const merged = { ...route.query, ...patch }
  const next = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined))
  void router.push({ query: next })
}

const browser = useTemplateRef<{ reload: () => Promise<void> }>('browser')

// ── detail ──────────────────────────────────────────────────────────────────────────────────────
/**
 * The asset whose detail is open.
 *
 * Held as a local ref rather than in the URL, unlike the Inbox's `?message=`. The two are genuinely
 * different: a message is a THING A READER LINKS TO and returns to, while an asset's detail is a
 * transient inspection of a row in a grid the URL already describes. Adding a fourth query parameter
 * would put a history entry behind every card click for no navigational benefit.
 */
const detail = ref<MediaAsset | null>(null)
const detailOpen = computed({
  get: () => detail.value !== null,
  set: (open: boolean) => {
    if (!open) closeDetail()
  }
})

const usages = ref<readonly MediaUsage[]>([])
const usagesPending = ref(false)
const usagesFailed = ref(false)
const deleting = ref(false)
const deleteError = ref(false)
/** Set when a delete was REFUSED because the asset is in use — distinct from a delete that errored. */
const deleteBlocked = ref(false)
const confirmingDelete = ref(false)

/**
 * Monotonic token for the usages lookup. Opening asset A then quickly B can leave A's request in
 * flight; without the guard it resolves later and lists A's usages under B — which, on a surface
 * whose whole purpose is deciding whether something is safe to delete, is the worst possible lie.
 */
let usagesSeq = 0

async function openDetail(asset: MediaAsset): Promise<void> {
  detail.value = asset
  confirmingDelete.value = false
  deleteError.value = false
  deleteBlocked.value = false
  await loadUsages(asset.id)
}

async function loadUsages(id: string): Promise<void> {
  const seq = ++usagesSeq
  usagesPending.value = true
  usagesFailed.value = false
  usages.value = []
  try {
    const found = await library.usages(id)
    if (seq !== usagesSeq) return
    usages.value = found
  } catch {
    if (seq !== usagesSeq) return
    usagesFailed.value = true
  } finally {
    if (seq === usagesSeq) usagesPending.value = false
  }
}

function closeDetail(): void {
  usagesSeq += 1
  detail.value = null
  usages.value = []
  confirmingDelete.value = false
  deleteError.value = false
  deleteBlocked.value = false
}

/**
 * Whether deletion may even be offered.
 *
 * The API is the authority — every media relation is `onDelete: Restrict` and a referenced asset is
 * refused with a 409 — so this is a courtesy, not the enforcement. It is also why the blocked path
 * below is a real, reachable state rather than a defensive branch: the usage list can be stale by
 * the time the operator clicks, and the server's refusal is what actually holds.
 */
const deletable = computed(() => !usagesPending.value && !usagesFailed.value && usages.value.length === 0)

async function confirmDelete(): Promise<void> {
  const asset = detail.value
  if (!asset) return
  deleting.value = true
  deleteError.value = false
  deleteBlocked.value = false
  try {
    const result = await library.remove(asset.id)
    if (result.deleted) {
      closeDetail()
      await browser.value?.reload()
      return
    }
    // Refused: the asset gained a usage since the list was read. Show WHAT is holding it rather than
    // a bare failure — the operator's next action is to unpick those references.
    deleteBlocked.value = true
    confirmingDelete.value = false
    usages.value = result.usages
  } catch {
    deleteError.value = true
    confirmingDelete.value = false
  } finally {
    deleting.value = false
  }
}

// Named rather than inline assignments: an assignment expression evaluates to the assigned value, so
// an inline handler returns a boolean where Nuxt UI's click prop is typed `void` (caught by
// `nuxt typecheck`).
function startDelete(): void {
  confirmingDelete.value = true
}

function cancelDelete(): void {
  confirmingDelete.value = false
}

/**
 * A usage rendered as human words.
 *
 * The contract's `type` is a stable enum, so it is translated from a key rather than printed raw —
 * `settings-portrait` is an implementation label, not something to show an operator. The reference
 * ids ARE shown, unlocalized, because they are the only handle on WHICH record is holding the asset.
 */
function usageLabel(usage: MediaUsage): string {
  return t(`dashboard.media.usage.${usage.type}`)
}

function usageReference(usage: MediaUsage): string {
  return Object.entries(usage.reference ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')
}

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', {
  dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn'
}))
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6">
      <h1 class="text-h1 text-highlighted">{{ t('dashboard.media.title') }}</h1>
      <p class="mt-2 text-muted">{{ t('dashboard.media.description') }}</p>
    </div>

    <DashboardMediaBrowser
      ref="browser"
      :q="q"
      :kind="kind"
      :page="page"
      @update:q="setQuery({ q: $event })"
      @update:kind="setQuery({ kind: $event })"
      @update:page="setQuery({ page: $event === 1 ? undefined : String($event) })"
      @select="openDetail"
    />

    <USlideover
      v-model:open="detailOpen"
      :title="detail?.originalFilename ?? t('dashboard.media.detail.title')"
      :description="detail ? t(`dashboard.media.kind.${detail.kind}`) : ''"
    >
      <template #body>
        <div v-if="detail" class="flex flex-col gap-5">
          <!-- PREVIEW. An image previews itself; a PDF cannot be shown inline without embedding a
               viewer, so it gets an explicit open-in-new-tab link instead of a blank frame. -->
          <div class="overflow-hidden rounded-card border border-default bg-elevated">
            <img
              v-if="detail.kind === 'IMAGE'"
              :src="detail.url"
              :width="detail.width ?? undefined"
              :height="detail.height ?? undefined"
              :alt="libraryAltFor(detail, locale) ?? ''"
              decoding="async"
              class="max-h-80 w-full object-contain"
            >
            <div v-else class="flex flex-col items-center gap-3 p-8">
              <UIcon name="i-lucide-file-text" class="size-12 text-muted" aria-hidden="true" />
              <UButton :to="detail.url" external target="_blank" color="neutral" variant="subtle" icon="i-lucide-external-link">
                {{ t('dashboard.media.detail.openPdf') }}
              </UButton>
            </div>
          </div>

          <dl class="flex flex-col gap-3 text-sm">
            <div>
              <dt class="text-muted">{{ t('dashboard.media.detail.filename') }}</dt>
              <dd dir="auto" class="break-all font-medium text-highlighted">{{ detail.originalFilename }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ t('dashboard.media.detail.type') }}</dt>
              <dd dir="ltr" class="font-medium text-highlighted">{{ detail.mimeType }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ t('dashboard.media.detail.size') }}</dt>
              <dd class="font-medium text-highlighted">
                {{ formatFileSize(detail.sizeBytes, locale, {
                  kb: t('dashboard.media.unit.kb'),
                  mb: t('dashboard.media.unit.mb')
                }) ?? '—' }}
              </dd>
            </div>
            <div v-if="dimensionsOf(detail)">
              <dt class="text-muted">{{ t('dashboard.media.detail.dimensions') }}</dt>
              <dd dir="ltr" class="font-medium text-highlighted">{{ dimensionsOf(detail) }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ t('dashboard.media.detail.uploaded') }}</dt>
              <dd class="font-medium text-highlighted">
                <time :datetime="detail.createdAt">{{ dateFormatter.format(new Date(detail.createdAt)) }}</time>
              </dd>
            </div>
            <!-- The LIBRARY default alt, labelled as such. It is asset-level metadata (D09-22) and is
                 not what any usage publishes; shown here because this IS the library. -->
            <div v-if="detail.kind === 'IMAGE'">
              <dt class="text-muted">{{ t('dashboard.media.detail.libraryAlt') }}</dt>
              <dd dir="auto" class="font-medium text-highlighted">
                {{ libraryAltFor(detail, locale) ?? t('dashboard.media.detail.libraryAltNone') }}
              </dd>
              <p class="mt-1 text-xs text-muted">{{ t('dashboard.media.detail.libraryAltHint') }}</p>
            </div>
          </dl>

          <!-- ── usages ─────────────────────────────────────────────────────────────────────── -->
          <div>
            <h3 class="mb-2 text-sm text-muted">{{ t('dashboard.media.detail.usageHeading') }}</h3>

            <div v-if="usagesPending" class="flex flex-col gap-2" aria-busy="true">
              <USkeleton v-for="i in 2" :key="i" class="h-8 w-full" />
            </div>
            <p v-else-if="usagesFailed" class="text-sm text-error">
              {{ t('dashboard.media.detail.usageFailed') }}
            </p>
            <p v-else-if="usages.length === 0" class="text-sm text-muted" data-usage-none>
              {{ t('dashboard.media.detail.usageNone') }}
            </p>
            <ul v-else class="flex flex-col gap-2" data-usage-list>
              <li
                v-for="usage in usages"
                :key="`${usage.type}:${usage.id}`"
                class="rounded-control border border-default p-2 text-sm"
              >
                <p class="font-medium text-highlighted">{{ usageLabel(usage) }}</p>
                <p v-if="usageReference(usage)" dir="ltr" class="break-all text-xs text-muted">
                  {{ usageReference(usage) }}
                </p>
              </li>
            </ul>
          </div>

          <!-- ── delete ─────────────────────────────────────────────────────────────────────── -->
          <div aria-live="polite" class="empty:hidden">
            <UAlert
              v-if="deleteBlocked"
              color="warning"
              variant="subtle"
              icon="i-lucide-shield-alert"
              data-delete-blocked
              :title="t('dashboard.media.delete.blockedTitle')"
              :description="t('dashboard.media.delete.blockedBody')"
            />
            <UAlert
              v-else-if="deleteError"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :ui="{ title: 'text-error-700 dark:text-error-300' }"
              :title="t('dashboard.media.delete.errorTitle')"
              :description="t('dashboard.media.delete.errorBody')"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div v-if="detail" class="flex w-full flex-col gap-2">
          <!-- In use ⇒ no delete control at all, plus the reason. Offering a button that is known to
               fail is worse than not offering it: the operator's real next step is to unpick the
               references listed above, and the copy says so. -->
          <p v-if="!deletable && !usagesPending && !usagesFailed" class="text-xs text-muted">
            {{ t('dashboard.media.delete.inUseHint') }}
          </p>

          <div v-if="deletable" class="flex flex-wrap gap-2">
            <template v-if="confirmingDelete">
              <UButton color="error" :loading="deleting" data-delete-confirm @click="confirmDelete()">
                {{ t('dashboard.media.delete.confirm') }}
              </UButton>
              <UButton color="neutral" variant="ghost" :disabled="deleting" @click="cancelDelete()">
                {{ t('dashboard.media.delete.cancel') }}
              </UButton>
            </template>
            <UButton
              v-else
              color="error"
              variant="subtle"
              icon="i-lucide-trash-2"
              data-delete-start
              @click="startDelete()"
            >
              {{ t('dashboard.media.delete.start') }}
            </UButton>
          </div>
          <p v-if="confirmingDelete" class="text-xs text-muted">{{ t('dashboard.media.delete.warning') }}</p>
        </div>
      </template>
    </USlideover>
  </UContainer>
</template>
