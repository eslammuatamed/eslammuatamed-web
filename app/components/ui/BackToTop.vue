<script setup lang="ts">
// Back-to-top (007) — a floating control that appears only after meaningful downward scroll and returns
// to the top. Positioned with logical properties (`end`/`bottom`) so it sits in the trailing-bottom corner
// in both directions, clear of mobile browser UI via the safe-area inset. Smooth scroll when motion is
// allowed; immediate under prefers-reduced-motion. Fixed, so showing/hiding causes no layout shift; the
// reveal is a short opacity+transform. Real button with a localized accessible name and the global
// focus-visible ring.
const { t } = useI18n()
const visible = ref(false)

function onScroll(): void {
  visible.value = window.scrollY > 600
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function toTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
</script>

<template>
  <ClientOnly>
    <Transition name="fab">
      <button
        v-show="visible"
        type="button"
        :aria-label="t('a11y.backToTop')"
        :title="t('a11y.backToTop')"
        class="fixed bottom-6 end-6 z-40 grid size-11 place-items-center rounded-full border border-default bg-elevated/90 text-muted backdrop-blur transition-colors hover:border-primary hover:text-primary"
        style="margin-block-end: env(safe-area-inset-bottom)"
        @click="toTop"
      >
        <UIcon name="i-lucide-arrow-up" class="size-5" aria-hidden="true" />
      </button>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.fab-enter-active,
.fab-leave-active {
  transition:
    opacity var(--duration-standard) var(--ease-standard),
    transform var(--duration-standard) var(--ease-standard);
}
.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .fab-enter-from,
  .fab-leave-to {
    transform: none;
  }
}
</style>
