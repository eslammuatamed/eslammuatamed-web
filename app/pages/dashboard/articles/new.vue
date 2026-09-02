<script setup lang="ts">
/**
 * Create an article. A thin wrapper: the editor is ONE component for create and edit, so this route
 * only says which mode it is (`:id="null"`).
 *
 * The static segment is matched before `[id].vue`, so `/dashboard/articles/new` reaches this page
 * rather than being read as an article whose id is the word "new".
 */
// No locale-prefixed twin of this route (D04-7).
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()
useHead({ title: () => `${t('dashboard.articles.editor.createTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardArticleEditor :id="null" />
</template>
