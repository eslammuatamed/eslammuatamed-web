<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const { t } = useDashboardI18n()
const id = computed(() => String(route.params.id))

useHead({ title: () => `${t('dashboard.skills.editor.editTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardSkillEditor :id="id" />
</template>
