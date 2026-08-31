<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import {
  SKILL_LOCALES,
  adminSkillDisplayLabel,
  adminSkillHasTranslation,
  type SkillLocale
} from '~/composables/admin-skill-fields'
import type { AdminSkill } from '~/composables/admin-project-types'

/**
 * Skills is an unpaginated server-owned vocabulary. Its create/edit workflow remains on this route
 * as an entity-owned slideover; only the overlay intent is shareable through its narrow query state.
 */
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const route = useRoute()
const router = useRouter()
const overlayOpen = ref(false)
const editingId = ref<string | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)
const { skills, pending, forbidden, failed, load } = useAdminSkills()

useHead({ title: () => `${t('dashboard.skills.title')} · ${t('dashboard.title')}` })

const hasData = computed(() => skills.value.length > 0)
const { initialPending, refreshing } = useRequestState(pending, hasData, failed)
const showErrorState = computed(() => failed.value && !hasData.value)
const stale = computed(() => failed.value && hasData.value)
const isEmpty = computed(() =>
  !pending.value && !failed.value && !forbidden.value && skills.value.length === 0
)

const columns: TableColumn<AdminSkill>[] = [
  { id: 'label', header: () => t('dashboard.skills.field.label') },
  { id: 'group', header: () => t('dashboard.skills.field.group') },
  { id: 'slug', header: () => t('dashboard.skills.field.slug') },
  { id: 'order', header: () => t('dashboard.skills.field.order') },
  { id: 'brandColor', header: () => t('dashboard.skills.field.brandColor') },
  { id: 'visibility', header: () => t('dashboard.skills.field.visibility') },
  { id: 'actions', header: () => t('dashboard.skills.field.actions') }
]

function rowLabel(skill: AdminSkill): string {
  return adminSkillDisplayLabel(skill, locale.value as SkillLocale)
}

function queryValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Route-driven bookmarks are the source of truth for opening a create or edit slideover. */
watch(
  () => [queryValue(route.query.create), queryValue(route.query.edit)] as const,
  ([create, edit]) => {
    if (edit) {
      editingId.value = edit
      overlayOpen.value = true
    } else if (create === '1') {
      editingId.value = null
      overlayOpen.value = true
    } else {
      overlayOpen.value = false
    }
  },
  { immediate: true }
)

async function setOverlayIntent(intent: 'create' | 'edit', id?: string): Promise<void> {
  const query = { ...route.query }
  if (intent === 'create') {
    query.create = '1'
    delete query.edit
  } else if (id) {
    query.edit = id
    delete query.create
  }
  await router.replace({ query })
}

function openCreate(event: MouseEvent): void {
  lastTrigger.value = event.currentTarget as HTMLElement
  void setOverlayIntent('create')
}

function openEdit(id: string, event: MouseEvent): void {
  lastTrigger.value = event.currentTarget as HTMLElement
  void setOverlayIntent('edit', id)
}

async function closeOverlay(): Promise<void> {
  const query = { ...route.query }
  if (editingId.value) delete query.edit
  else delete query.create
  await router.replace({ query })
  await nextTick()
  lastTrigger.value?.focus()
  lastTrigger.value = null
}

async function refreshAfterMutation(): Promise<void> {
  await load()
}

void load()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.skills.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.skills.description') }}</p>
      </div>
      <UButton icon="i-lucide-plus" data-skills-create @click="openCreate">
        {{ t('dashboard.skills.create') }}
      </UButton>
    </div>

    <UAlert
      v-if="forbidden"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      data-skills-forbidden
      :title="t('dashboard.skills.forbiddenTitle')"
      :description="t('dashboard.skills.forbiddenBody')"
    />

    <section v-else :aria-label="t('dashboard.skills.listRegionLabel')">
      <p v-if="stale" role="status" data-skills-stale class="mb-3 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-highlighted">
        {{ t('dashboard.skills.staleNotice') }}
        <UButton class="ms-2" size="xs" color="neutral" variant="subtle" data-skills-stale-retry @click="load">
          {{ t('dashboard.skills.retry') }}
        </UButton>
      </p>

      <UiRequestState
        :pending="initialPending"
        :refreshing="refreshing"
        :error="showErrorState"
        :empty="isEmpty"
        skeleton="rows"
        :count="5"
        @retry="load"
      >
        <template #error>
          <UiStateError data-skills-failed :message="t('dashboard.skills.errorTitle')" @retry="load" />
        </template>

        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-skills-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.skills.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.skills.emptyBody') }}</p>
            <UButton class="mt-4" icon="i-lucide-plus" data-skills-empty-create @click="openCreate">
              {{ t('dashboard.skills.create') }}
            </UButton>
          </div>
        </template>

        <div data-skills-loaded>
          <p class="mb-3 text-sm text-muted" data-skills-count>
            {{ t('dashboard.skills.resultCount', { total: skills.length }) }}
          </p>

          <div class="overflow-x-auto">
            <UTable
              :data="skills"
              :columns="columns"
              :loading="refreshing"
              :aria-label="t('dashboard.skills.listRegionLabel')"
              data-skills-table
            >
              <template #label-cell="{ row }">
                <div :data-skill-row="row.original.id" class="min-w-48 max-w-md">
                  <p dir="auto" class="break-words font-medium text-highlighted" :data-skill-label="row.original.id">
                    {{ rowLabel(row.original) }}
                  </p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <UBadge
                      v-for="target in SKILL_LOCALES"
                      :key="target"
                      :color="adminSkillHasTranslation(row.original, target) ? 'success' : 'warning'"
                      variant="subtle"
                      size="sm"
                      :icon="adminSkillHasTranslation(row.original, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                      :data-skill-translation="`${target}:${adminSkillHasTranslation(row.original, target) ? 'present' : 'missing'}`"
                    >
                      {{ t(
                        adminSkillHasTranslation(row.original, target)
                          ? 'dashboard.skills.translationState.present'
                          : 'dashboard.skills.translationState.missing',
                        { locale: t(`dashboard.skills.locale.${target}`) }
                      ) }}
                    </UBadge>
                  </div>
                </div>
              </template>

              <template #group-cell="{ row }">
                <UBadge dir="auto" color="neutral" variant="subtle" :data-skill-group="row.original.id">
                  {{ t(`dashboard.skills.group.${row.original.group}`) }}
                </UBadge>
              </template>

              <template #slug-cell="{ row }">
                <code dir="ltr" class="whitespace-nowrap text-xs text-muted" :data-skill-slug="row.original.id">
                  {{ row.original.slug }}
                </code>
              </template>

              <template #order-cell="{ row }">
                <span dir="ltr" :data-skill-order="row.original.id">{{ row.original.order }}</span>
              </template>

              <template #brandColor-cell="{ row }">
                <span dir="ltr" class="whitespace-nowrap text-sm text-muted" :data-skill-brand-color="row.original.id">
                  {{ row.original.brandColor ?? t('dashboard.skills.noBrandColor') }}
                </span>
              </template>

              <template #visibility-cell="{ row }">
                <UBadge
                  :color="row.original.isPublic ? 'success' : 'neutral'"
                  variant="subtle"
                  :data-skill-public="String(row.original.isPublic)"
                >
                  {{ t(row.original.isPublic ? 'dashboard.skills.public' : 'dashboard.skills.hidden') }}
                </UBadge>
              </template>

              <template #actions-cell="{ row }">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-pencil"
                  :data-skill-edit="row.original.id"
                  :aria-label="t('dashboard.skills.editFor', { label: rowLabel(row.original) })"
                  @click="openEdit(row.original.id, $event)"
                >
                  {{ t('dashboard.skills.edit') }}
                </UButton>
              </template>
            </UTable>
          </div>
        </div>
      </UiRequestState>
    </section>

      <LazyDashboardSkillOverlay
        :id="editingId"
        v-model:open="overlayOpen"
        @saved="refreshAfterMutation"
        @deleted="refreshAfterMutation"
        @close="closeOverlay"
    />
  </UContainer>
</template>
