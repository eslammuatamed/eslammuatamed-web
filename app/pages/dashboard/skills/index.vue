<script setup lang="ts">
import {
  SKILL_LOCALES,
  adminSkillDisplayLabel,
  adminSkillHasTranslation,
  type SkillLocale
} from '~/composables/admin-skill-fields'
import type { AdminSkill } from '~/composables/admin-project-types'

/**
 * Dashboard Skills collection (M2·U2). The endpoint returns the whole ordered vocabulary in one
 * `{ data }` envelope and declares no parameters, so this route has no query state, filtering or
 * pagination. The editor routes belong to M2·U3 and are intentionally not implemented here.
 */
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useDashboardI18n()
const { skills, pending, forbidden, failed, load } = useAdminSkills()

useHead({ title: () => `${t('dashboard.skills.title')} · ${t('dashboard.title')}` })

const hasData = computed(() => skills.value.length > 0)
const { initialPending } = useRequestState(pending, hasData, failed)
const showErrorState = computed(() => failed.value && !hasData.value)
const isEmpty = computed(() =>
  !pending.value && !failed.value && !forbidden.value && skills.value.length === 0
)

function rowLabel(skill: AdminSkill): string {
  return adminSkillDisplayLabel(skill, locale.value as SkillLocale)
}

void load()
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-h1 text-highlighted">{{ t('dashboard.skills.title') }}</h1>
        <p class="mt-2 text-muted">{{ t('dashboard.skills.description') }}</p>
      </div>
      <UButton to="/dashboard/skills/new" icon="i-lucide-plus" data-skills-create>
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
      <UiRequestState
        :pending="initialPending"
        :error="showErrorState"
        :empty="isEmpty"
        skeleton="rows"
        :count="5"
        @retry="load()"
      >
        <template #error>
          <UiStateError
            data-skills-failed
            :message="t('dashboard.skills.errorTitle')"
            @retry="load()"
          />
        </template>

        <template #empty>
          <div class="rounded-control border border-default p-10 text-center" data-skills-empty>
            <p class="font-medium text-highlighted">{{ t('dashboard.skills.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.skills.emptyBody') }}</p>
            <UButton class="mt-4" to="/dashboard/skills/new" icon="i-lucide-plus" data-skills-empty-create>
              {{ t('dashboard.skills.create') }}
            </UButton>
          </div>
        </template>

        <div data-skills-loaded>
          <p class="mb-3 text-sm text-muted" data-skills-count>
            {{ t('dashboard.skills.resultCount', { total: skills.length }) }}
          </p>

          <ul class="flex flex-col gap-2">
            <!-- The API owns ordering; the client renders the received array verbatim. -->
            <li v-for="skill in skills" :key="skill.id">
              <UCard as="article" :data-skill-row="skill.id">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <h2 dir="auto" class="truncate font-medium text-highlighted" :data-skill-label="skill.id">
                      {{ rowLabel(skill) }}
                    </h2>
                    <p class="mt-1 font-mono text-xs text-muted" :data-skill-slug="skill.id">
                      {{ skill.slug }}
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/skills/${skill.id}`"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-pencil"
                    :data-skill-edit="skill.id"
                    :aria-label="t('dashboard.skills.editFor', { label: rowLabel(skill) })"
                  >
                    {{ t('dashboard.skills.edit') }}
                  </UButton>
                </div>

                <dl class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.skills.field.group') }}</dt>
                    <dd><UBadge color="neutral" variant="subtle">{{ t(`dashboard.skills.group.${skill.group}`) }}</UBadge></dd>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.skills.field.order') }}</dt>
                    <dd :data-skill-order="skill.id">{{ skill.order }}</dd>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.skills.field.visibility') }}</dt>
                    <dd>
                      <UBadge
                        :color="skill.isPublic ? 'success' : 'neutral'"
                        variant="subtle"
                        :data-skill-public="String(skill.isPublic)"
                      >
                        {{ t(skill.isPublic ? 'dashboard.skills.public' : 'dashboard.skills.hidden') }}
                      </UBadge>
                    </dd>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.skills.field.brandColor') }}</dt>
                    <dd dir="auto" :data-skill-brand-color="skill.id">
                      {{ skill.brandColor ?? t('dashboard.skills.noBrandColor') }}
                    </dd>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <dt class="text-muted">{{ t('dashboard.skills.translationState.label') }}</dt>
                    <dd class="flex items-center gap-1.5">
                      <UBadge
                        v-for="target in SKILL_LOCALES"
                        :key="target"
                        :color="adminSkillHasTranslation(skill, target) ? 'success' : 'warning'"
                        variant="subtle"
                        size="sm"
                        :icon="adminSkillHasTranslation(skill, target) ? 'i-lucide-check' : 'i-lucide-circle-alert'"
                        :data-skill-translation="`${target}:${adminSkillHasTranslation(skill, target) ? 'present' : 'missing'}`"
                      >
                        {{ t(
                          adminSkillHasTranslation(skill, target)
                            ? 'dashboard.skills.translationState.present'
                            : 'dashboard.skills.translationState.missing',
                          { locale: t(`dashboard.skills.locale.${target}`) }
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
