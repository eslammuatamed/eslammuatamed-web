<script setup lang="ts">
// ContentSkeleton (007 loading system) — initial-load placeholders whose geometry MATCHES the real
// composition (not a generic spinner or a grey box): the tech capability grid, the work index rows, the
// timeline, the article reading list, or the testimonial quotes. Each block is the `.skeleton` sweep
// (static under prefers-reduced-motion via the global rule). One polite live region announces the load.
interface Props {
  variant?: 'capabilities' | 'work' | 'timeline' | 'articles' | 'quotes' | 'rows'
  count?: number
}

const props = withDefaults(defineProps<Props>(), { variant: 'rows', count: 3 })
// Both worlds render this component, so the locale that owns the SURFACE decides the
// copy — not the route locale, which is always `en` inside the dashboard (plan §14.9 F-1).
const { t } = useSurfaceI18n()
const items = computed(() => Array.from({ length: props.count }, (_, i) => i))
</script>

<template>
  <div role="status" :aria-busy="true" :aria-label="t('state.loading')">
    <span class="sr-only">{{ t('state.loading') }}</span>

    <!-- Capabilities: four labelled columns of skill rows. -->
    <div v-if="variant === 'capabilities'" class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="border-t border-default pt-5">
        <div class="skeleton h-3 w-20" />
        <div class="mt-5 flex flex-col gap-3">
          <div v-for="r in 4" :key="r" class="skeleton h-3.5" :style="{ width: `${60 + ((r * 13) % 30)}%` }" />
        </div>
      </div>
    </div>

    <!-- Work index / timeline / articles: stacked full-width rows, hairline-separated. -->
    <div v-else-if="variant === 'work' || variant === 'timeline' || variant === 'articles'" class="flex flex-col" aria-hidden="true">
      <div
        v-for="i in items"
        :key="i"
        class="border-t border-default py-8 first:border-t-0"
        :class="variant === 'timeline' ? 'ps-8' : ''"
      >
        <div class="skeleton h-3 w-28" />
        <div class="skeleton mt-4 h-6" :class="variant === 'articles' ? 'w-3/4' : 'w-2/3'" />
        <div class="skeleton mt-3 h-3.5 w-full max-w-2xl" />
        <div v-if="variant !== 'articles'" class="skeleton mt-2 h-3.5 w-4/5 max-w-xl" />
      </div>
    </div>

    <!-- Quotes: a row of pull-quote cards. -->
    <div v-else-if="variant === 'quotes'" class="grid gap-x-10 gap-y-10 md:grid-cols-3" aria-hidden="true">
      <div v-for="i in items" :key="i" class="border-t border-default pt-6">
        <div class="skeleton h-3.5 w-full" />
        <div class="skeleton mt-2 h-3.5 w-11/12" />
        <div class="skeleton mt-2 h-3.5 w-3/4" />
        <div class="mt-6 flex items-center gap-3">
          <div class="skeleton size-10 rounded-full" />
          <div class="flex-1">
            <div class="skeleton h-3 w-24" />
            <div class="skeleton mt-1.5 h-2.5 w-16" />
          </div>
        </div>
      </div>
    </div>

    <!-- Generic rows fallback. -->
    <div v-else class="flex flex-col gap-4" aria-hidden="true">
      <div v-for="i in items" :key="i" class="skeleton h-16" />
    </div>
  </div>
</template>
