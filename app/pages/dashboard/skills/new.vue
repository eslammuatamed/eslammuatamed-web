<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()
useHead({ title: () => `${t('dashboard.skills.editor.createTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardSkillEditor :id="null" />
</template>
