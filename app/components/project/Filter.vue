<script setup lang="ts">
import type { ProjectTechnologyFacet } from '~/types/models'

// Technology filter for the projects index (FR-PUB-030).
//
// Options are the API's FACETS (D10-19), not the global Skills registry. That distinction is the
// whole point: a Skill is a taxonomy entry, and a taxonomy entry is not evidence that any published
// project uses it. Building the filter from `/skills` offered chips that return an empty page — on
// live Production, 13 of 18 options — plus Delivery & Quality entries, which are ways of working
// rather than things a project is built with. A facet exists only because a published project in
// this locale uses it, so every chip is guaranteed to lead somewhere.
//
// It also removes a request: the facets ride along on the list response the page already awaits.
//
// This component remains only the facets→options MAPPING; the control is `UiChipFilter`, shared with
// the blog index. It is kept rather than inlined because the mapping is the part with a contract to
// get wrong (slug vs id vs label), and it is what these tests pin.
//
// Skill `slug` is LOCALE-INDEPENDENT, unlike a Category slug (D04-2). That is why a `?technology=`
// URL survives a locale switch unchanged and `?category=` does not.
interface Props {
  facets: readonly ProjectTechnologyFacet[]
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

// Group headings are translated HERE, from the contract's stable `frontend`/`backend` keys — the API
// deliberately sends the key, not a display string, so the label follows the UI locale rather than
// whatever language the request happened to resolve.
//
// A group with no facets produces no heading at all: `UiChipFilter` derives its sections from the
// options it is given, so "hide empty groups" needs no branch here and cannot be forgotten. That
// matters in practice — live Production currently has exactly one backend technology.
const options = computed(() =>
  props.facets.map(facet => ({
    value: facet.slug,
    label: facet.label,
    group: t(`projects.filter.group.${facet.group}`)
  }))
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
