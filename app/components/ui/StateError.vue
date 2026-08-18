<script setup lang="ts">
// Inline load-failure state for a public section (doc 13 §1/§2): it says what happened and offers a
// retry — never a bare "something went wrong". Retry is emitted so the owning page re-runs that
// section's `useAsyncData` refresh, recovering one section without touching the others (NFR-DEGRADE).
interface Props {
  message?: string
}

withDefaults(defineProps<Props>(), { message: undefined })
defineEmits<{ retry: [] }>()

// Both worlds render this component, so the locale that owns the SURFACE decides the
// copy — not the route locale, which is always `en` inside the dashboard (plan §14.9 F-1).
const { t } = useSurfaceI18n()
</script>

<template>
  <div class="rounded-card border border-default bg-elevated p-6" role="alert">
    <p class="text-body-sm text-muted">{{ message ?? t('home.sectionError') }}</p>
    <UButton class="mt-3" size="sm" variant="subtle" color="neutral" @click="$emit('retry')">
      {{ t('common.retry') }}
    </UButton>
  </div>
</template>
