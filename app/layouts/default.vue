<script setup lang="ts">
// Public shell: skip link first (D21-1), landmarked header/main/footer (doc 21 §1). On client
// navigation focus moves to <main> so keyboard/AT users land on the new content while the route
// announcer reads the title.
const { t } = useI18n()
const main = useTemplateRef<HTMLElement>('main')
const router = useRouter()

if (import.meta.client) {
  const stop = router.afterEach((to, from) => {
    if (to.path === from.path) return
    void nextTick(() => main.value?.focus())
  })
  onBeforeUnmount(stop)
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="sr-only rounded-control bg-elevated px-4 py-2 text-default ring-2 ring-primary focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <LayoutHeader />

    <!-- overflow-x-clip contains the page-spread transition's inline translate so it never spawns a
         transient horizontal scrollbar; clip (not hidden) keeps position:sticky working inside. -->
    <main id="main-content" ref="main" tabindex="-1" class="flex-1 overflow-x-clip outline-none">
      <slot />
    </main>

    <LayoutFooter />
    <UiBackToTop />
  </div>
</template>
