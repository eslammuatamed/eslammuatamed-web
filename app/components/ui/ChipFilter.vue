<script setup lang="ts">
// A row of single-select filter chips, shared by the Projects and Blog indexes.
//
// EXTRACTED ON THE SECOND USE, not the first. It was written inline for `/projects` and only became a
// component when `/blog` needed exactly the same control — so the shape is drawn from two real callers
// rather than guessed from one.
//
// PLAIN `<button aria-pressed>`, deliberately — not a Nuxt UI overlay component. `USelect` is a reka-ui
// Select (listbox + popper + focus-guard stack) and measured 22.8 KB gz on `/projects`, a route
// governed by a frozen 250 KB budget (doc 20 §1); it was the entire reason that route breached it. The
// same judgement is already recorded on `/contact`, which keeps a native `<select>`. A short row of
// toggles needs none of that machinery: the platform supplies the semantics, the keyboard behaviour
// and the focus ring.
//
// `aria-pressed` rather than a radiogroup. A radiogroup would capture the arrow keys and collapse the
// row to a single tab stop — the wrong trade for a handful of always-visible toggles, and each chip
// genuinely IS an on/off control that announces its own state.
//
// The "all" chip is a REAL CHIP, not a placeholder. Under `USelect` it could not be: reka-ui reserves
// the empty string for clearing a select and rejects an item whose value is `''`, so the unfiltered
// state had no control of its own and clearing needed a separate button that existed only while a
// filter was active. As a chip, "showing everything" is visible and pressable like every other state.
interface Option {
  /** The value written to the URL. Must be stable and locale-independent where the route allows it. */
  value: string
  /** Display text. Already localized by the caller, and never used as the value. */
  label: string
}

interface Props {
  /** DOM id for the group; the label's id is derived from it, so two rows on one page cannot collide. */
  id: string
  /** The group's visible label, e.g. "Technology" or "Category". */
  label: string
  /** Label for the unfiltered chip, e.g. "All technologies". */
  allLabel: string
  options: readonly Option[]
  /** The active value, or `undefined` for unfiltered. */
  modelValue: string | undefined
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const labelId = computed(() => `${props.id}-label`)

/**
 * The rendered row: the "all" chip first, then the options in the order the caller supplied.
 *
 * The unfiltered chip carries `undefined`, not `''`, because that is what the query layer and the API
 * both mean by "no filter" — an empty `?category=`/`?technology=` is a 422, not "unfiltered" — so the
 * sentinel never has to be translated at a boundary where getting it wrong looks like a broken filter
 * rather than an error.
 */
const chips = computed(() => [
  { key: '__all__', label: props.allLabel, value: undefined as string | undefined },
  ...props.options.map(option => ({
    key: option.value,
    label: option.label,
    value: option.value as string | undefined
  }))
])

/** A chip is pressed when its value IS the active filter; "all" is pressed exactly when none is. */
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
         `for`, which addresses exactly one control and does not apply to a row of them. -->
    <p :id="labelId" class="kicker text-dimmed">{{ label }}</p>

    <!--
      Scrolls horizontally on narrow viewports rather than wrapping into a tall stack that would push
      the list itself below the fold; wraps normally from `sm` up, where the row fits.

      `p-1` is load-bearing, not spacing. The focus ring is drawn OUTSIDE the button box
      (`outline-offset-2` plus a 2px outline = 4px), and an overflow container clips anything past its
      padding box — so without it the ring on the first and last chip would be shaved off at exactly
      the moment a keyboard user needs it. The matching `-m-1` keeps the row optically aligned with the
      heading above. Both are symmetric, so neither needs an RTL counterpart.
    -->
    <div
      :id="id"
      role="group"
      :aria-labelledby="labelId"
      class="-m-1 flex gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-x-visible"
    >
      <!--
        The pressed state differs by MORE than colour — filled surface, inverted text and a heavier
        weight — because colour alone is not an acceptable way to convey state (WCAG 1.4.1); a
        colour-only chip leaves the active filter unreadable to a visitor who cannot perceive the hue.
        `shrink-0` + `whitespace-nowrap` keep a two-word label one chip instead of two in the scroller.
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
