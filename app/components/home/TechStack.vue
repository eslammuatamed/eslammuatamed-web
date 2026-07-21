<script setup lang="ts">
import type { Skill } from '~/types/models'

// Tech-stack section (FR-PUB-011): skills grouped by kind, technology brand colours as accents only
// (via UiTechBadge). Presentational — the page owns the fetch and passes state down (doc 12 §6). Empty
// result omits the whole section (graceful degradation, NFR-DEGRADE); error offers an inline retry.
interface Props {
  skills: readonly Skill[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

const GROUP_ORDER = ['LANGUAGE', 'FRAMEWORK', 'TOOLING', 'PRACTICE'] as const

const groups = computed(() => {
  const list = props.skills ?? []
  return GROUP_ORDER.map(group => ({
    group,
    items: list.filter(skill => skill.group === group).sort((a, b) => a.order - b.order)
  })).filter(entry => entry.items.length > 0)
})

const show = computed(() => props.pending || props.error || (props.skills ?? []).length > 0)
</script>

<template>
  <UiSection v-if="show">
    <UiDatumLabel :eyebrow="t('home.techStack.eyebrow')" :title="t('home.techStack.title')" />

    <UiStateError v-if="error" class="mt-8" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-8" :count="4" />

    <!-- Datasheet layout: each group is a labelled row (group | technologies), hairline-separated —
         the technical-spec register (brand §5), not a loose pile of pills. -->
    <dl v-else class="mt-10 divide-y divide-default border-t border-default">
      <div
        v-for="entry in groups"
        :key="entry.group"
        class="grid gap-x-6 gap-y-3 py-6 sm:grid-cols-[minmax(8rem,10rem)_1fr]"
      >
        <dt class="text-caption font-medium text-muted">
          {{ t(`home.techStack.group.${entry.group}`) }}
        </dt>
        <dd>
          <ul class="flex flex-wrap gap-2">
            <li v-for="skill in entry.items" :key="skill.id">
              <UiTechBadge :label="skill.label" :brand-color="skill.brandColor" />
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </UiSection>
</template>
