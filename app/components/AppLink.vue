<script setup lang="ts">
// Locale-aware link (doc 12 §2). Internal targets are resolved through the current locale's
// route prefix; external targets open safely in a new tab with a mirrored indicator. One place
// owns both concerns so pages never hand-build localePath() or rel="noopener".
interface Props {
  to: string
  /**
   * Force external handling. **Absent means auto-detect**, and preserving that third state is the
   * whole reason for the explicit `undefined` default below: a `boolean` prop declared only as
   * optional is Boolean-cast by Vue to `false` when absent, so `props.external ?? detect(...)` would
   * short-circuit on `false` and the auto-detect could never run. That defect routed every external
   * URL through the internal branch — silently, since NuxtLink still emits a usable href (found by
   * web-005).
   */
  external?: boolean
}

const props = withDefaults(defineProps<Props>(), { external: undefined })
const localePath = useLocalePath()

/** Only http(s) navigates away to another site — the signal for opening a new tab. */
const HTTP_URL = /^https?:\/\//i
/**
 * Anything carrying a URL scheme, or a protocol-relative `//host`, leaves the router's world. Detecting
 * on "has a scheme" rather than "is http(s)" is deliberate: if the detect only matched http(s), a
 * `javascript:` target would fall through to the INTERNAL branch and be emitted as a live href,
 * bypassing the allowlist below entirely. Safe-by-default means every non-path target is routed through
 * the allowlist.
 */
const HAS_SCHEME = /^([a-z][a-z0-9+.-]*:|\/\/)/i
/**
 * Scheme allowlist (security review WD-5). Anything outside it — `javascript:`, `data:`, a
 * protocol-relative host — renders inert instead of reaching a live `href`.
 */
const SAFE_EXTERNAL = /^(https?:|mailto:|tel:)/i

const isExternal = computed(() => props.external ?? HAS_SCHEME.test(props.to))
const href = computed(() => (SAFE_EXTERNAL.test(props.to) ? props.to : '#'))

/**
 * A new tab is for http(s) only. `mailto:`/`tel:` hand off to the OS handler and never replace the
 * page, so `target="_blank"` would leave an orphaned blank tab behind — and the arrow indicator would
 * promise a navigation that does not happen.
 */
const opensNewTab = computed(() => isExternal.value && HTTP_URL.test(href.value))
</script>

<template>
  <a
    v-if="isExternal"
    :href="href"
    :target="opensNewTab ? '_blank' : undefined"
    :rel="opensNewTab ? 'noopener noreferrer' : undefined"
    class="inline-flex items-center gap-1"
  >
    <slot />
    <UIcon
      v-if="opensNewTab"
      name="i-lucide-arrow-up-right"
      class="size-4 rtl:-scale-x-100"
      aria-hidden="true"
    />
  </a>
  <NuxtLink v-else :to="localePath(to)">
    <slot />
  </NuxtLink>
</template>
