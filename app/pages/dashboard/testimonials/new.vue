<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useDashboardI18n()
useHead({ title: () => `${t('dashboard.testimonials.editor.createTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardTestimonialEditor :id="null" />
</template>
