<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

await navigateTo('/dashboard/testimonials?create=1', { replace: true })
</script>
