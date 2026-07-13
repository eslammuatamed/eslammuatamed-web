<script setup lang="ts">
// Placeholder overview behind the auth guard (doc 04 §1). Modules land in feature 002.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useI18n()
const auth = useAuthStore()

useHead({ title: () => t('dashboard.title') })
</script>

<template>
  <UContainer class="py-12">
    <h1 class="text-h1 text-highlighted">{{ t('dashboard.title') }}</h1>
    <p v-if="auth.user" class="mt-3 text-muted">
      {{ t('dashboard.welcome', { email: auth.user.email }) }}
    </p>
    <p class="mt-6 text-muted">{{ t('dashboard.placeholder') }}</p>
  </UContainer>
</template>
