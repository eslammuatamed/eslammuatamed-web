<script setup lang="ts">
// The single Markdown rendering surface (D12-4). Rendering is delegated to the /api/prose Nitro
// route so the Shiki highlighter stays server-side on both SSR and client navigation (D20-3).
// The v-html below is the one sanctioned use in the app: the renderer escapes raw HTML
// (html:false, D19-5), so nothing hostile reaches the DOM.
interface Props {
  source: string
  /** Stable identity (e.g. `${id}:${locale}`) so the rendered payload keys correctly. */
  cacheKey: string
}

const props = defineProps<Props>()

/**
 * The key is a GETTER and `source`/`cacheKey` are watched. Both halves are load-bearing, and the
 * absence of either is what shipped the first-locale-switch defect:
 *
 * `useAsyncData(\`prose:${props.cacheKey}\`, …)` passed a template literal, which JavaScript evaluates
 * ONCE during setup. The composable therefore never saw `cacheKey` change and stayed keyed to the
 * locale the component first mounted in. That alone would have been survivable if the instance were
 * replaced per locale, but the case-study page keys its `<section v-for>` by `section.key`
 * (`overview`, `role`, …) — locale-independent by design, since the section list is the same in every
 * language — so on a locale switch Vue PATCHES this component rather than remounting it. The instance
 * kept its first payload, and the Arabic page rendered Arabic headings over English bodies.
 *
 * Measured signature of the bug, worth keeping in mind when touching this: ZERO `/api/prose` requests
 * on the first locale switch, then 8 on every later transition. A test that only reads rendered text
 * can pass on a warm cache — assert the request count too.
 */
const { data } = await useAsyncData(
  () => `prose:${props.cacheKey}`,
  () =>
    // eslint-disable-next-line no-restricted-syntax -- internal Nitro route /api/prose, not the backend API (doc 15 §2 internal-route exemption)
    $fetch<{ html: string }>('/api/prose', { method: 'POST', body: { source: props.source } }),
  { watch: [() => props.source, () => props.cacheKey] }
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- renderer output is escaped-by-construction (D19-5) -->
  <div class="content-prose" v-html="data?.html" />
</template>
