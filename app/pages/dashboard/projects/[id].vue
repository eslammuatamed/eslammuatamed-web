<script setup lang="ts">
/**
 * `/dashboard/projects/:id` — the editor for one project.
 *
 * The id is read from the route and handed down as a prop rather than read again inside the editor,
 * so the component has exactly one source for "which project is this" and stays testable without a
 * router. A repeated parameter arrives as an array from Vue Router; the first entry is taken so a
 * hand-edited address cannot produce `[object Object]` in a request path.
 */
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL. Rationale in `~/utils/dashboard-locale`.
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()
const route = useRoute()

const id = computed(() => {
  const value = route.params.id
  return Array.isArray(value) ? (value[0] ?? '') : String(value)
})

useHead({ title: () => `${t('dashboard.projects.title')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardProjectEditor :id="id" />
</template>
