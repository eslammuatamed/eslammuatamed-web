<script setup lang="ts">
import type { DashboardNavGroup } from '~/composables/useDashboardNav'
import { isNavItemActive } from '~/composables/useDashboardNav'

/**
 * The ONE navigation renderer, used by both the desktop sidebar and the mobile drawer.
 *
 * Why not Nuxt UI: `UNavigationMenu` renders its own list semantics and does not expose a per-item
 * trailing badge slot alongside an `aria-current` link in the shape doc 11 §2 describes (grouped
 * items, optional unread badge). This is a thin `<nav><ul>` over the model instead of a wrapper that
 * fights the component — the interactive parts are still plain links, which is what keyboard and
 * screen-reader behaviour depends on.
 *
 * Sharing this between surfaces is deliberate: active-state logic and badge rendering existing twice
 * is how two navigations silently disagree.
 */
defineProps<{
  groups: readonly DashboardNavGroup[]
  /** Emitted intent for the drawer to close after a navigation; the sidebar ignores it. */
  onNavigate?: () => void
}>()

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <nav :aria-label="t('dashboard.nav.primary')" class="flex flex-col gap-6">
    <div v-for="(group, index) in groups" :key="group.key ?? `group-${index}`">
      <h2
        v-if="group.key"
        class="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted"
      >
        {{ t(`dashboard.nav.${group.key}`) }}
      </h2>

      <ul class="flex flex-col gap-1">
        <li v-for="item in group.items" :key="item.key">
          <NuxtLink
            :to="item.to"
            :aria-current="isNavItemActive(item, route.path) ? 'page' : undefined"
            class="group flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors"
            :class="isNavItemActive(item, route.path)
              ? 'bg-elevated font-medium text-highlighted'
              : 'text-default hover:bg-elevated/60'"
            @click="onNavigate?.()"
          >
            <!-- The active marker is a shape, not only a colour: a 2px bar plus the weight/background
                 change, so the current item survives a monochrome or high-contrast rendering. -->
            <span
              aria-hidden="true"
              class="h-5 w-0.5 rounded-full"
              :class="isNavItemActive(item, route.path) ? 'bg-primary' : 'bg-transparent'"
            />
            <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
            <span class="flex-1">{{ t(`dashboard.nav.${item.key}`) }}</span>

            <!-- Badge slot. Rendered only when the model supplies a value, so "not loaded yet"
                 (null) and "nothing unread" (0 -> null) both render nothing rather than a 0. -->
            <!-- `bg-primary-600`, not the default `primary` (500): white on the 500 shade measures
                 3.98:1 at this 12px size, under the 4.5:1 WCAG AA minimum. The 600 shade is
                 5.89:1 and is the same violet the Contact slice standardised on for exactly this
                 reason. Caught by axe during the visual review. -->
            <UBadge
              v-if="item.badge?.value"
              color="primary"
              variant="solid"
              size="sm"
              :ui="{ base: 'bg-primary-600 text-white' }"
              :aria-label="t('dashboard.messages.unreadBadgeLabel', { count: item.badge.value })"
            >
              {{ item.badge.value }}
            </UBadge>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
