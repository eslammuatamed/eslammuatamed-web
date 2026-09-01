<script setup lang="ts">
import { skillLabel } from '~/composables/useAdminSkills'

/**
 * Pick a set of skills from the admin skill vocabulary.
 *
 * ── WHY THIS IS SHARED, AND WHY IT WAS RENAMED ─────────────────────────────────────────────────
 * It was `ProjectTechnologyPicker`, written for the one consumer that existed. FE-3 module 1 gave
 * it a SECOND real consumer — the Experiences editor's `technologyIds`, which is the same relation
 * against the same vocabulary with the same replace-wholesale semantics — so the boundary is
 * demonstrated rather than anticipated, which is §14.6's bar and OD-12's "extend the shared
 * pattern, not fork it".
 *
 * Writing a second picker beside this one was the alternative and it was rejected: two components
 * reading one vocabulary is how the "a selected id the vocabulary cannot explain must stay visible"
 * rule below comes to be implemented once and forgotten once.
 *
 * ⚠ THE COPY IS PASSED IN, NOT LOOKED UP. This component holds no i18n keys of its own. A key
 * PREFIX prop would have been shorter and is the thing to avoid: it invents a naming convention
 * every future consumer must match, and a mismatched prefix fails by rendering a raw key path at
 * runtime rather than by failing to compile. Explicit label props are checked by the type-checker.
 *
 * THIS IS THE ONE CLIENT-SIDE FILTER IN EITHER MODULE, and it is correct here for a reason that
 * does not generalise: `GET /admin/skills` declares no query parameters and returns the WHOLE
 * vocabulary in one response with no `meta`. There is no server-side search to defer to and no page
 * after this one, so narrowing the received list is narrowing everything there is. The paginated
 * collections never do this.
 *
 * A SELECTED ID THE VOCABULARY DOES NOT EXPLAIN IS STILL SHOWN. If the skills request fails, or an
 * id refers to something the list no longer carries, the id is rendered as its own row rather than
 * dropped: the relation is REPLACED on save, so a selection that quietly vanished from the UI would
 * be quietly deleted by the next save.
 */
export interface SkillPickerLabels {
  /** The accessible name of the checkbox group. */
  legend: string
  help: string
  filter: string
  empty: string
  error: string
  unknown: string
  /** Already formatted with the count by the caller, which owns the pluralisation. */
  selected: string
}

const props = defineProps<{
  modelValue: string[]
  labels: SkillPickerLabels
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { locale } = useDashboardI18n()
const { skills, pending, forbidden, failed, load } = useAdminSkills()

const filter = ref('')
const pickerRef = useTemplateRef<HTMLElement>('pickerRef')

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

/** Reload the canonical vocabulary after a context-independent Skill mutation. */
async function refresh(): Promise<void> {
  await load()
}

/** Move focus to a newly available technology without requiring its consumer to know picker markup. */
async function focusTechnology(id: string): Promise<boolean> {
  await nextTick()
  const option = [...(pickerRef.value?.querySelectorAll<HTMLElement>('[data-technology]') ?? [])]
    .find(element => element.dataset.technology === id)
  option?.focus()
  return option !== undefined
}

defineExpose({ refresh, focusTechnology })
</script>

<template>
  <div ref="pickerRef" class="flex flex-col gap-3">
    <p class="text-sm text-muted">{{ labels.help }}</p>

    <UAlert
      v-if="forbidden || failed"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      data-technologies-error
      :description="labels.error"
    />

    <div v-if="pending" class="flex flex-col gap-2" aria-busy="true">
      <USkeleton v-for="i in 3" :key="i" class="h-6 w-40" />
    </div>

    <template v-else>
      <UFormField v-if="ordered.length > 0" :label="labels.filter">
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
        {{ labels.empty }}
      </p>

      <p class="text-xs text-muted" data-technologies-count>
        {{ labels.selected }}
      </p>

      <!-- A real group of checkboxes with a name, so a screen reader announces what the list is for
           rather than reading thirty unattached labels. -->
      <fieldset v-if="visible.length > 0 || unknownSelected.length > 0" class="flex flex-col gap-2">
        <legend class="sr-only">{{ labels.legend }}</legend>
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
            :description="labels.unknown"
            :disabled="disabled"
            :data-technology-unknown="id"
            @update:model-value="toggle(id, $event === true)"
          />
        </div>
      </fieldset>
    </template>
  </div>
</template>
