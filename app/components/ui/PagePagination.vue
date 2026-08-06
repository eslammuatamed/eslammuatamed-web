<script setup lang="ts">
// The PUBLIC pagination control, shared by `/projects` and `/blog` (024, D03-15).
//
// WHY A WRAPPER AND NOT AN `app.config.ts` THEME ENTRY. `UPagination` is also used by
// `/dashboard/messages`, so putting the public treatment in `ui.pagination` would restyle an
// authenticated surface this lane does not own. A wrapper applies the treatment to the two public
// call sites and leaves the dashboard's control resolving Nuxt UI's defaults, byte for byte.
//
// WHY A COMPONENT AND NOT A COPIED `:ui` OBJECT AT EACH CALL SITE. Two literal objects are two things
// to keep in step, and the brief is explicit that this is a shared control rather than a per-page
// one. One component means `/projects` and `/blog` cannot drift.
//
// STATE LADDER, and each rung is deliberate:
//   default  — `variant="ghost"`: no border, no fill. Pagination is navigation, not a call to action,
//              so the resting row stays quiet.
//   hover    — a light violet wash (`--glass-tint`), the same token the index rows use, so hovering a
//              row and hovering a page number feel like one system.
//   active   — the solid violet fill (`active-variant="solid"`), which IS the accent. An earlier
//              version added `accent-glass` lighting through `data-selected:accent-glass`; it was
//              measured at 44 B gz for a highlight one line tall on a 32 px control, and dropped.
//              The fill already distinguishes the state by fill, contrast and `aria-current`, so
//              nothing accessible was lost with it.
//   focus    — Nuxt UI's own `focus-visible` ring on `UButton`, deliberately left alone: it is
//              independent of hover, which is what keyboard users need, and re-implementing it here
//              would be a parallel mechanism to keep correct.
//   disabled — the prev/next controls at the ends keep Nuxt UI's disabled treatment and receive no
//              lighting, since `accent-glass` is bound to `data-selected` and a disabled control is
//              never selected.
//
// Direction is Nuxt UI's: it derives the chevrons from `useLocale().dir`, so the control mirrors in
// RTL without anything here.
interface Props {
  page: number
  total: number
  itemsPerPage: number
  /** Builds the href for a page — pagination stays real links, so it is crawlable and middle-clickable. */
  to: (page: number) => string | Record<string, unknown>
}

const props = defineProps<Props>()
</script>

<template>
  <UPagination
    :page="props.page"
    :total="props.total"
    :items-per-page="props.itemsPerPage"
    :to="props.to"
    variant="ghost"
    active-variant="solid"
    active-color="primary"
    :ui="{ item: 'hover:bg-[var(--glass-tint)]' }"
  />
</template>
