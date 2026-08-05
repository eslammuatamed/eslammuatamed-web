<script setup lang="ts">
import type { Skill } from '~/types/models'

// Technology filter for the projects index (FR-PUB-030). Options come from the Skills registry, not
// free text (doc 04 §5) — the value sent to the API is the skill's `slug`, the canonical form of
// `GET /projects?technology=` (D10-17); labels are display-only and arrive already localized, so a
// label must never become the filter value or the URL would change meaning with the language.
//
// This component is now only the Skills→options MAPPING; the control itself is `UiChipFilter`, shared
// with the blog index. It is kept rather than inlined because the mapping is the part with a contract
// to get wrong (slug vs id vs label), and it is what these tests pin.
//
// Skill `slug` is LOCALE-INDEPENDENT, unlike a Category slug (D04-2). That is why a `?technology=` URL
// survives a locale switch unchanged and `?category=` does not — see `app/pages/blog/index.vue`.
interface Props {
  technologies: readonly Skill[]
  /**
   * The active filter value, or `undefined` for the unfiltered list. Canonically a Skill `slug`; a
   * uuid from a link shared before the slug contract landed is still valid and still round-trips.
   */
  modelValue: string | undefined
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const { t } = useI18n()

const options = computed(() =>
  props.technologies.map(technology => ({ value: technology.slug, label: technology.label }))
)
</script>

<template>
  <UiChipFilter
    id="projects-filter"
    :label="t('projects.filter.label')"
    :all-label="t('projects.filter.all')"
    :options="options"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
