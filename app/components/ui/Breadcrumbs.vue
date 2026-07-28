<script setup lang="ts">
// Breadcrumb trail for deep public pages (doc 04 §5, doc 22 §4 — the visible counterpart of the
// BreadcrumbList structured data). Recovery for a visitor who landed mid-site from search, and the
// reason FR-PUB-034 prev/next navigation is not needed for journey continuity in this slice.
//
// Semantics that matter and are easy to get wrong: the trail is a labelled <nav> containing an ordered
// list, and the LAST crumb is the current page — plain text with aria-current="page", never a link to
// itself. Separators are decorative and hidden from assistive technology.
export interface Crumb {
  label: string
  /** Omitted on the current page — the last crumb is never a link. */
  to?: string
}

interface Props {
  items: readonly Crumb[]
  /** Accessible name for the landmark; localized by the caller. */
  label: string
}

defineProps<Props>()
</script>

<template>
  <nav :aria-label="label">
    <!-- Logical margins/padding only so the trail mirrors in RTL without a second rule set (D15-3). -->
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
      <li v-for="(item, index) in items" :key="item.label" class="flex items-center gap-x-2">
        <UIcon
          v-if="index > 0"
          name="i-lucide-chevron-right"
          class="size-3.5 shrink-0 text-dimmed rtl:-scale-x-100"
          aria-hidden="true"
        />
        <AppLink v-if="item.to" :to="item.to" class="text-link hover:underline">
          {{ item.label }}
        </AppLink>
        <span v-else aria-current="page" class="text-default">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
