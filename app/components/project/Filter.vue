<script setup lang="ts">
import type { Skill } from '~/types/models'

// Technology filter for the projects index (FR-PUB-030). Options come from the Skills registry, not
// free text (doc 04 §5) — the value sent to the API is the skill's `slug`, the canonical form of
// `GET /projects?technology=` (D10-17); labels are display-only and arrive already localized, so a
// label must never become the filter value or the URL would change meaning with the language.
//
// PLAIN `<button aria-pressed>` CHIPS, deliberately — not a Nuxt UI overlay component. `USelect` is a
// reka-ui Select (listbox + popper + focus-guard stack) and measured 22.8 KB gz on a route governed by
// a frozen 250 KB budget (doc 20 §1); it was the entire reason this route breached it. The same
// judgement is already recorded on `/contact`, which keeps a native `<select>` for the same reason.
// A short row of toggles needs none of that machinery: the platform supplies the semantics, the
// keyboard behaviour and the focus ring.
//
// `aria-pressed` rather than a radiogroup. A radiogroup would capture the arrow keys and collapse the
// row to a single tab stop — the wrong trade for a handful of always-visible toggles, and each chip
// genuinely IS an on/off control that announces its own state.
//
// "All technologies" is a REAL CHIP, not a placeholder. Under `USelect` it could not be: reka-ui
// reserves the empty string for clearing a select and rejects an item whose value is `''`, so the
// unfiltered state had no control of its own and clearing needed a separate button that existed only
// while a filter was active. That constraint dies with the overlay. As a chip, "showing everything" is
// visible and pressable like every other state, and the separate clear control becomes redundant
// rather than merely unnecessary.
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

/**
 * The rendered row: "All" first, then one chip per technology in registry order.
 *
 * The unfiltered chip carries `undefined`, not `''`, because that is what the query layer and the API
 * both mean by "no filter" — `technology=` is a 422, not "unfiltered" — so the sentinel never has to
 * be translated at a boundary where getting it wrong looks like a broken filter rather than an error.
 */
const chips = computed(() => [
  { key: 'all', label: t('projects.filter.all'), value: undefined as string | undefined },
  ...props.technologies.map(technology => ({
    key: technology.slug,
    label: technology.label,
    value: technology.slug as string | undefined
  }))
])

/** A chip is pressed when its value IS the active filter; "All" is pressed exactly when none is. */
function isPressed(value: string | undefined): boolean {
  return props.modelValue === value
}

/**
 * Re-pressing the active chip is a NO-OP, not a toggle-off. Toggling off would give one visible state
 * two different meanings depending on history, and it would push a URL identical to the current one.
 */
function select(value: string | undefined): void {
  if (!isPressed(value)) emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- A visible label, not just an aria-label: the control's purpose must be readable (doc 21). It
         names the GROUP, so it is bound with `aria-labelledby` on a `role="group"` rather than with
         `for`, which addresses exactly one control and no longer applies to a row of them. -->
    <p id="projects-filter-label" class="kicker text-dimmed">
      {{ t('projects.filter.label') }}
    </p>

    <!--
      Scrolls horizontally on narrow viewports rather than wrapping into a tall stack that would push
      the list itself below the fold; wraps normally from `sm` up, where the row fits.

      `p-1` is load-bearing, not spacing. The focus ring is drawn OUTSIDE the button box
      (`outline-offset-2` plus a 2px outline = 4px), and an overflow container clips anything past its
      padding box — so without it the ring on the first and last chip would be shaved off at exactly
      the moment a keyboard user needs to see it. The matching `-m-1` keeps the row optically aligned
      with the heading above. Both are symmetric, so neither needs an RTL counterpart.
    -->
    <div
      id="projects-filter"
      role="group"
      aria-labelledby="projects-filter-label"
      class="-m-1 flex gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-x-visible"
    >
      <!--
        The pressed state differs by MORE than colour — filled surface, inverted text and a heavier
        weight — because colour alone is not an acceptable way to convey state (WCAG 1.4.1); a
        colour-only chip leaves the active filter unreadable to a visitor who cannot perceive the hue.
        `shrink-0` + `whitespace-nowrap` keep a two-word label one chip instead of two inside the
        scroller.
      -->
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        :aria-pressed="isPressed(chip.value)"
        :disabled="disabled"
        class="shrink-0 rounded-control px-3 py-1.5 text-body-sm whitespace-nowrap ring ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-75"
        :class="isPressed(chip.value)
          ? 'bg-primary text-inverted font-semibold ring-primary'
          : 'bg-elevated text-muted ring-accented hover:text-highlighted'"
        @click="select(chip.value)"
      >
        {{ chip.label }}
      </button>
    </div>
  </div>
</template>
