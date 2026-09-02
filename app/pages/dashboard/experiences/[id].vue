<script setup lang="ts">
/**
 * Edit a role. A thin wrapper, for the same reason `new.vue` is one: create and edit are the same
 * form, and splitting them is how two forms come to disagree about what an experience is.
 */
// No locale-prefixed twin of this route (D04-7).
defineI18nRoute(false)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const { t } = useDashboardI18n()

/**
 * The route param, as a string.
 *
 * Not validated as a UUID here: the API answers `400` for a malformed id and `404` for an absent
 * one, and the editor renders those as distinct surfaces. Pre-judging the shape in the browser would
 * duplicate the contract's rule in a second place, where it could drift.
 */
const id = computed(() => String(route.params.id))

useHead({ title: () => `${t('dashboard.experiences.editor.editTitle')} · ${t('dashboard.title')}` })
</script>

<template>
  <DashboardExperienceEditor :id="id" />
</template>
