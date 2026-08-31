<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

await navigateTo('/dashboard/categories', { replace: true })
</script>
