<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

await navigateTo('/dashboard/skills?create=1', { replace: true })
</script>
