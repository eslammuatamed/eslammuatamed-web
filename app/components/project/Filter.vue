<script setup lang="ts">
import type { Skill } from '~/types/models'

// Technology filter for the projects index (FR-PUB-030). Options come from the Skills registry, not
// free text (doc 04 §5) — the value sent to the API is the skill's canonical UUID, which is the only
// form `GET /projects?technology=` accepts; labels are display-only and arrive already localized.
//
// "All technologies" is the PLACEHOLDER, not a list option: reka-ui reserves the empty string for
// clearing a select and rejects an item whose value is `''` ("A <SelectItem /> must have a value prop
// that is not an empty string"). So the unfiltered state is the empty model value, and clearing is an
// explicit control that appears only while a filter is active — which also keeps the option list to
// real technologies instead of a permanent redundant row.
interface Props {
  technologies: readonly Skill[]
  /** Canonical technology UUID, or `undefined` for the unfiltered list. */
  modelValue: string | undefined
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const { t } = useI18n()

const items = computed(() =>
  props.technologies.map(technology => ({ label: technology.label, value: technology.id }))
)

const selected = computed({
  get: () => props.modelValue ?? '',
  // An empty selection means "no filter"; it must reach the query as `undefined`, never as
  // `technology=`, which the contract rejects with a 422 rather than treating as unfiltered.
  set: (value: string) => emit('update:modelValue', value === '' ? undefined : value)
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <!-- A visible label, not just an aria-label: the control's purpose must be readable, and the
         label is also a larger pointer target (doc 21). `for` binds it to the select trigger. -->
    <label id="projects-filter-label" class="kicker text-dimmed" for="projects-filter">
      {{ t('projects.filter.label') }}
    </label>

    <USelect
      id="projects-filter"
      v-model="selected"
      :items="items"
      :disabled="disabled"
      :placeholder="t('projects.filter.all')"
      aria-labelledby="projects-filter-label"
      class="min-w-52"
    />

    <UButton
      v-if="modelValue"
      variant="ghost"
      color="neutral"
      size="sm"
      icon="i-lucide-x"
      @click="emit('update:modelValue', undefined)"
    >
      {{ t('projects.filter.clear') }}
    </UButton>
  </div>
</template>
