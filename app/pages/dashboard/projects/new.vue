<script setup lang="ts">
/**
 * `/dashboard/projects/new`.
 *
 * A static segment, so it is matched ahead of `[id].vue` and `new` can never be read as a project
 * id. The page is deliberately thin: create and edit are ONE form, and the only thing that differs
 * between them is whether there is a project to load — which is exactly what `id` says.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useI18n()

useHead({ title: () => `${t('dashboard.projects.editor.createTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardProjectEditor :id="null" />
</template>
