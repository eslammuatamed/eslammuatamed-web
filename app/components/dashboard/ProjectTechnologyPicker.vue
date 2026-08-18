<script setup lang="ts">
import { skillLabel } from '~/composables/useAdminSkills'

/**
 * The project's technology set, chosen from the skill vocabulary.
 *
 * THIS IS THE ONE CLIENT-SIDE FILTER IN THE MODULE, and it is correct here for a reason that does
 * not generalise: `GET /admin/skills` declares no query parameters and returns the WHOLE vocabulary
 * in one response with no `meta`. There is no server-side search to defer to and no page after this
 * one, so narrowing the received list is narrowing everything there is. The projects list, which is
 * paginated, never does this.
 *
 * A SELECTED ID THE VOCABULARY DOES NOT EXPLAIN IS STILL SHOWN. If the skills request fails, or an
 * id refers to something the list no longer carries, the id is rendered as its own row rather than
 * dropped: `technologyIds` is REPLACED on save, so a selection that quietly vanished from the UI
 * would be quietly deleted from the project by the next save.
 */
const props = defineProps<{
  modelValue: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t, locale } = useDashboardI18n()
const { skills, pending, forbidden, failed, load } = useAdminSkills()

const filter = ref('')

onMounted(() => void load())

/** The vocabulary in a stable, meaningful order: grouped as the API groups them, then by `order`. */
const ordered = computed(() =>
  [...skills.value].sort((a, b) => (a.group === b.group ? a.order - b.order : a.group.localeCompare(b.group)))
)

const visible = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  if (needle === '') return ordered.value
  return ordered.value.filter(skill =>
    skillLabel(skill, locale.value).toLowerCase().includes(needle) || skill.slug.toLowerCase().includes(needle)
  )
})

/** Selected ids the loaded vocabulary cannot name — kept visible so they cannot be silently lost. */
const unknownSelected = computed(() => {
  const known = new Set(skills.value.map(skill => skill.id))
  return props.modelValue.filter(id => !known.has(id))
})

function toggle(id: string, checked: boolean): void {
  const next = checked
    ? [...new Set([...props.modelValue, id])]
    : props.modelValue.filter(candidate => candidate !== id)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-muted">{{ t('dashboard.projects.editor.technologiesHelp') }}</p>

    <UAlert
      v-if="forbidden || failed"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      data-technologies-error
      :description="t('dashboard.projects.editor.technologiesError')"
    />

    <div v-if="pending" class="flex flex-col gap-2" aria-busy="true">
      <USkeleton v-for="i in 3" :key="i" class="h-6 w-40" />
    </div>

    <template v-else>
      <UFormField v-if="ordered.length > 0" :label="t('dashboard.projects.editor.technologyFilter')">
        <UInput
          :model-value="filter"
          icon="i-lucide-search"
          type="search"
          class="w-full max-w-sm"
          data-technologies-filter
          :disabled="disabled"
          @update:model-value="filter = String($event)"
        />
      </UFormField>

      <p v-else-if="!forbidden && !failed" class="text-sm text-muted" data-technologies-empty>
        {{ t('dashboard.projects.editor.technologiesEmpty') }}
      </p>

      <p class="text-xs text-muted" data-technologies-count>
        {{ t('dashboard.projects.editor.technologiesSelected', { count: modelValue.length }) }}
      </p>

      <!-- A real group of checkboxes with a name, so a screen reader announces what the list is for
           rather than reading thirty unattached labels. -->
      <fieldset v-if="visible.length > 0 || unknownSelected.length > 0" class="flex flex-col gap-2">
        <legend class="sr-only">{{ t('dashboard.projects.editor.technologies') }}</legend>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <UCheckbox
            v-for="skill in visible"
            :key="skill.id"
            :model-value="modelValue.includes(skill.id)"
            :label="skillLabel(skill, locale)"
            :disabled="disabled"
            :data-technology="skill.id"
            @update:model-value="toggle(skill.id, $event === true)"
          />
          <UCheckbox
            v-for="id in unknownSelected"
            :key="id"
            :model-value="true"
            :label="id"
            :description="t('dashboard.projects.editor.technologiesUnknown')"
            :disabled="disabled"
            :data-technology-unknown="id"
            @update:model-value="toggle(id, $event === true)"
          />
        </div>
      </fieldset>
    </template>
  </div>
</template>
