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

const { data } = await useAsyncData(`prose:${props.cacheKey}`, () =>
  $fetch<{ html: string }>('/api/prose', { method: 'POST', body: { source: props.source } })
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- renderer output is escaped-by-construction (D19-5) -->
  <div class="content-prose" v-html="data?.html" />
</template>
