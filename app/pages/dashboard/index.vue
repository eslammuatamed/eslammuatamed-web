<script setup lang="ts">
import type { Paginated } from '~/types/models'
import { ApiError } from '~/utils/api-error'

defineI18nRoute(false)
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
type SnapshotPath = '/admin/articles' | '/admin/projects'
interface TotalSnapshot { total: Ref<number | null>, pending: Ref<boolean>, failed: Ref<boolean>, forbidden: Ref<boolean>, load: () => Promise<void> }
const { t } = useDashboardI18n()
const api = useApi()
const { count: unreadCount, ensureFresh, fetchCount } = useUnreadCount()
useHead({ title: () => t('dashboard.title') })

function totalSnapshot(path: SnapshotPath): TotalSnapshot {
  const total = ref<number | null>(null); const pending = ref(false); const failed = ref(false); const forbidden = ref(false)
  let sequence = 0
  async function load(): Promise<void> {
    const current = ++sequence; pending.value = true; failed.value = false; forbidden.value = false
    try { const response = await api<Paginated<unknown>>(path, { locale: false, query: { page: 1, perPage: 1 } }); if (current === sequence) total.value = response.meta.total }
    catch (error) { if (current === sequence) { if (error instanceof ApiError && error.status === 403) forbidden.value = true; else failed.value = true } }
    finally { if (current === sequence) pending.value = false }
  }
  return { total, pending, failed, forbidden, load }
}
const articles = totalSnapshot('/admin/articles')
const projects = totalSnapshot('/admin/projects')
const messagesPending = ref(unreadCount.value === null)
const messagesFailed = ref(false)
async function loadMessages(retry = false): Promise<void> {
  messagesPending.value = true; messagesFailed.value = false
  try { if (retry) await fetchCount(); else await ensureFresh(); messagesFailed.value = unreadCount.value === null }
  catch { messagesFailed.value = true } finally { messagesPending.value = false }
}
onMounted(() => { void articles.load(); void projects.load(); void loadMessages() })
</script>

<template>
  <UContainer class="py-8 sm:py-10" data-overview-page>
    <header class="max-w-2xl"><h1 class="text-h1 text-highlighted">{{ t('dashboard.overview.title') }}</h1><p class="mt-2 text-muted">{{ t('dashboard.overview.description') }}</p></header>
    <section class="mt-8" aria-labelledby="overview-content-snapshot"><h2 id="overview-content-snapshot" class="text-h2 text-highlighted">{{ t('dashboard.overview.contentSnapshot.title') }}</h2><p class="mt-1 text-sm text-muted">{{ t('dashboard.overview.contentSnapshot.description') }}</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard v-for="snapshot in [{ key: 'articles', label: 'dashboard.nav.articles', to: '/dashboard/articles', state: articles }, { key: 'projects', label: 'dashboard.nav.projects', to: '/dashboard/projects', state: projects }]" :key="snapshot.key" as="article" :data-overview-card="snapshot.key"><div class="flex min-h-28 flex-col justify-between gap-4"><div><h3 class="font-semibold text-highlighted">{{ t(snapshot.label) }}</h3><USkeleton v-if="snapshot.state.pending.value && snapshot.state.total.value === null" class="mt-3 h-7 w-16" /><p v-else-if="snapshot.state.total.value !== null" class="mt-2 text-2xl font-semibold text-highlighted" :data-overview-total="snapshot.key">{{ t('dashboard.overview.total', { count: snapshot.state.total.value }) }}</p><p v-else class="mt-2 text-sm text-muted" :data-overview-unavailable="snapshot.key">{{ t(snapshot.state.forbidden.value ? 'dashboard.overview.forbidden' : 'dashboard.overview.unavailable') }}</p></div><div class="flex flex-wrap gap-2"><UButton :to="snapshot.to" color="neutral" variant="subtle" size="sm">{{ t('dashboard.overview.openModule') }}</UButton><UButton v-if="snapshot.state.failed.value" color="neutral" variant="ghost" size="sm" :data-overview-retry="snapshot.key" @click="snapshot.state.load()">{{ t('dashboard.overview.retry') }}</UButton></div></div></UCard>
        <UCard v-for="module in [{ key: 'skills', label: 'dashboard.nav.skills', to: '/dashboard/skills' }, { key: 'testimonials', label: 'dashboard.nav.testimonials', to: '/dashboard/testimonials' }]" :key="module.key" as="article" :data-overview-card="module.key"><div class="flex min-h-28 flex-col justify-between gap-4"><div><h3 class="font-semibold text-highlighted">{{ t(module.label) }}</h3><p class="mt-2 text-sm text-muted">{{ t('dashboard.overview.navigationOnly') }}</p></div><UButton :to="module.to" color="neutral" variant="subtle" size="sm">{{ t('dashboard.overview.openModule') }}</UButton></div></UCard>
      </div></section>
    <section class="mt-10" aria-labelledby="overview-attention"><h2 id="overview-attention" class="text-h2 text-highlighted">{{ t('dashboard.overview.attention.title') }}</h2><div class="mt-4 max-w-md"><UCard as="article" data-overview-card="messages"><div class="flex min-h-28 flex-col justify-between gap-4"><div><h3 class="font-semibold text-highlighted">{{ t('dashboard.nav.messages') }}</h3><USkeleton v-if="messagesPending && unreadCount === null" class="mt-3 h-7 w-16" /><p v-else-if="unreadCount !== null" class="mt-2 text-2xl font-semibold text-highlighted" data-overview-total="messages">{{ t('dashboard.overview.unread', { count: unreadCount }) }}</p><p v-else class="mt-2 text-sm text-muted" data-overview-unavailable="messages">{{ t('dashboard.overview.unavailable') }}</p></div><div class="flex flex-wrap gap-2"><UButton to="/dashboard/messages" color="neutral" variant="subtle" size="sm">{{ t('dashboard.overview.openModule') }}</UButton><UButton v-if="messagesFailed" color="neutral" variant="ghost" size="sm" data-overview-retry="messages" @click="loadMessages(true)">{{ t('dashboard.overview.retry') }}</UButton></div></div></UCard></div></section>
    <section class="mt-10" aria-labelledby="overview-quick-actions"><h2 id="overview-quick-actions" class="text-h2 text-highlighted">{{ t('dashboard.overview.quickActions.title') }}</h2><p class="mt-1 text-sm text-muted">{{ t('dashboard.overview.quickActions.description') }}</p><div class="mt-4 flex flex-wrap gap-3" data-overview-quick-actions><UButton to="/dashboard/articles/new" data-overview-action="new-article">{{ t('dashboard.overview.quickActions.newArticle') }}</UButton><UButton to="/dashboard/projects/new" data-overview-action="new-project">{{ t('dashboard.overview.quickActions.newProject') }}</UButton><UButton to="/dashboard/media" color="neutral" variant="subtle" data-overview-action="media">{{ t('dashboard.overview.quickActions.media') }}</UButton><UButton to="/dashboard/seo" color="neutral" variant="subtle" data-overview-action="seo">{{ t('dashboard.overview.quickActions.seo') }}</UButton></div></section>
  </UContainer>
</template>
