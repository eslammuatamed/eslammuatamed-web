<script setup lang="ts">
// Locale-aware link (doc 12 §2). Internal targets are resolved through the current locale's
// route prefix; external targets open safely in a new tab with a mirrored indicator. One place
// owns both concerns so pages never hand-build localePath() or rel="noopener".
interface Props {
  to: string
  external?: boolean
}

const props = defineProps<Props>()
const localePath = useLocalePath()

// A forced `:external` bypasses the `^https?://` auto-detect, so guard the external branch with a scheme
// allowlist (security review WD-5): a non-http(s)/mailto/tel target (e.g. `javascript:`) falls back to an
// inert `#` rather than binding a live `href`. Internal targets always resolve through localePath.
const SAFE_EXTERNAL = /^(https?:|mailto:|tel:)/i
const isExternal = computed(() => props.external ?? /^https?:\/\//.test(props.to))
const target = computed(() =>
  isExternal.value ? (SAFE_EXTERNAL.test(props.to) ? props.to : '#') : localePath(props.to)
)
</script>

<template>
  <a
    v-if="isExternal"
    :href="target"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1"
  >
    <slot />
    <UIcon name="i-lucide-arrow-up-right" class="size-4 rtl:-scale-x-100" aria-hidden="true" />
  </a>
  <NuxtLink v-else :to="target">
    <slot />
  </NuxtLink>
</template>
