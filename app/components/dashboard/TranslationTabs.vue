<script setup lang="ts" generic="L extends string">
/**
 * The locale tabs every translated dashboard editor renders, and the rules that make them correct.
 *
 * ── EXTRACTED AT `M1·U4b`, ON MEASURED EVIDENCE ────────────────────────────────────────────────
 * §10.2 declined this while `ArticleEditor` was its only consumer. `ExperienceEditor` (`M1·U3`) is
 * the second, and the duplication was measured before it was extracted: the badge logic, the
 * fill→colour mapping and the per-panel direction rule were byte-identical across the two editors,
 * and ONLY the fields inside each panel differed — which is exactly a component with a per-locale
 * slot. §5.2 predicted EXTRACT from the contract alone, before either editor existed.
 *
 * ── THE THREE RULES THIS COMPONENT OWNS, NONE OF THEM COSMETIC ─────────────────────────────────
 *
 * 1. **PANELS STAY MOUNTED WHEN HIDDEN** (`:unmount-on-hide="false"`). A validation error in a
 *    hidden locale must remain DISCOVERABLE rather than being destroyed with its panel (§14.1), and
 *    switching tabs must not disturb unsaved work. ⚠ Form VALUES would survive a remount anyway
 *    because they live in the caller's form state — so a test that only retyped and switched tabs
 *    would PASS against a broken implementation. The ERROR state is the half that would not survive,
 *    which is why the discriminating test drives a real 422 into a hidden tab.
 *
 * 2. **FIELD DIRECTION IS INDEPENDENT OF CHROME DIRECTION** (OD-11, doc 11 §6). An Arabic panel is
 *    RTL inside an English dashboard and an English panel is LTR inside an Arabic one. Set per
 *    panel here, never inherited from the shell. ⚠ `dashboardDir()` is deliberately NOT called: its
 *    own documentation scopes it to the CHROME and says to use the field's own locale for a field.
 *    The rule is identical today; borrowing the helper would blur the one distinction it exists to
 *    protect.
 *
 * 3. **STATE IS NEVER COLOUR ALONE.** Both badges carry a word, so completeness and invalidity are
 *    legible to a screen reader and to anyone who does not distinguish the hues.
 *
 * ── WHAT IS DELIBERATELY NOT IN HERE ───────────────────────────────────────────────────────────
 * The fields (a slot), the copy (props — this component holds no i18n keys, for the reason
 * `SkillPicker` records: a key PREFIX invents a convention every consumer must match and fails at
 * runtime by rendering a raw key path, where explicit props fail at the type-checker), and which
 * locale is active (a `v-model`, because OD-9 makes the seed the caller's policy).
 */
export type TranslationFill = 'empty' | 'partial' | 'complete'

export interface TranslationTabItem<L extends string> {
  value: L
  label: string
  fill: TranslationFill
  invalid: boolean
}

defineProps<{
  items: readonly TranslationTabItem<L>[]
  /** Badge copy per fill state, formatted by the caller in the dashboard language. */
  fillLabels: Record<TranslationFill, string>
  /** Badge copy for a locale carrying an error. */
  invalidLabel: string
}>()

const active = defineModel<L>({ required: true })

const fillColor = (fill: TranslationFill) =>
  fill === 'complete' ? 'success' as const : fill === 'partial' ? 'warning' as const : 'neutral' as const
</script>

<template>
  <UTabs
    v-model="active"
    :items="[...items]"
    :unmount-on-hide="false"
    variant="link"
    data-editor-tabs
  >
    <template #default="{ item }">
      <span class="flex items-center gap-2">
        {{ item.label }}
        <UBadge
          v-if="item.invalid"
          color="error"
          variant="subtle"
          size="sm"
          :data-editor-tab-invalid="item.value"
        >
          {{ invalidLabel }}
        </UBadge>
        <UBadge
          v-else
          :color="fillColor(item.fill)"
          variant="subtle"
          size="sm"
          :data-editor-tab-fill="`${item.value}:${item.fill}`"
        >
          {{ fillLabels[item.fill as TranslationFill] }}
        </UBadge>
      </span>
    </template>

    <template #content="{ item }">
      <div
        class="flex flex-col gap-4 pt-4"
        :dir="item.value === 'ar' ? 'rtl' : 'ltr'"
        :data-editor-panel="item.value"
      >
        <slot name="panel" :locale="(item.value as L)" />
      </div>
    </template>
  </UTabs>
</template>
