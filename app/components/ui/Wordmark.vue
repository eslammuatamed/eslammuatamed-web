<script setup lang="ts">
// The nameplate lockup (019) — the Monolith mark beside the name set as real text. AP-9: the mark is
// decorative and the adjacent text IS the accessible identity; never an outlined lockup, never an image
// of the name.
//
// WHY THIS COMPONENT EXISTS. The chrome set the same identity twice, by hand, and the two did not agree:
// the header bar paired a 20px mark with 15px text and the drawer title paired an 18px mark with ~16px
// text, so the mark ran at 1.33 em of the word in one place and 1.13 in the other. One identity rendered
// two ways is the defect; a `size` prop over one authored lockup is the fix.
//
// THE RATIO IS THE RULE, AND IT IS WHY THE MARK IS SIZED IN `em` RATHER THAN THROUGH `UiBrandMark`'s px
// `size` prop. The root carries the register's font-size, so mark and gap resolve against the word itself
// and the lockup holds at any register by construction — including the header's responsive 15px → 18px
// step, which a single px mark size cannot follow (it is what produced the 1.33/1.13 split above). The
// `size-*` utility overrides the SVG's width/height presentation attributes, so `UiBrandMark` is left
// exactly as it is.
//
// THE FACE IS `font-display`, NOT `font-nameplate`, DELIBERATELY. Reem Kufi is the Arabic HERO face only
// (D03-12); `font-nameplate` here would swap the Arabic chrome to it and fetch its woff2 on every /ar
// route that has no hero. The Latin treatment travels via `.nameplate`, which is script-scoped in
// `main.css` — so this lockup is Space Grotesk 700 in English and unchanged Cairo 600 in Arabic.
//
// The name is the `brand.name` i18n string, NOT a settings read: the chrome resolves its identity without
// depending on `useSiteSettings`, and adding a settings read here would put a fetch in the layout shell.
interface Props {
  /**
   * Type register. `sm` is the header bar — 15px, stepping to the `md` register at the `md` breakpoint,
   * which is where the bar gains the room for it. `md` is the drawer title and the footer colophon.
   */
  size?: 'sm' | 'md'
}

const { size = 'sm' } = defineProps<Props>()
const { t } = useI18n()

// `whitespace-nowrap` is load-bearing, not cosmetic: at 320px the header controls leave too little inline
// space and "Eslam Muatamed" wraps to a second line, which breaks the header's fixed height. The name is
// never abbreviated or initialised — it is kept whole and the space is found elsewhere.
const register = computed(() => (size === 'sm' ? 'text-[15px] md:text-lg' : 'text-lg'))
</script>

<template>
  <span class="inline-flex items-center gap-[0.55em]" :class="register">
    <UiBrandMark class="size-[1.1em] text-primary" />
    <span class="nameplate font-display font-semibold tracking-tight whitespace-nowrap text-highlighted">
      {{ t('brand.name') }}
    </span>
  </span>
</template>
