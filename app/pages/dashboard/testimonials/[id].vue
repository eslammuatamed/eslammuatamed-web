<script setup lang="ts">
defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const id = computed(() => String(route.params.id))
await navigateTo({ path: '/dashboard/testimonials', query: { ...route.query, edit: id.value } }, { replace: true })
</script>
