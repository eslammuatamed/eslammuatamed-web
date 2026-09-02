<script setup lang="ts">
/**
 * The public-only, CLIENT-ONLY GTM boundary (FE4-U2e2.1).
 *
 * WHY THIS COMPONENT EXISTS. GTM is public-shell, client-runtime, deferred-until-ready product
 * behaviour with no SSR markup — yet U2e2's direct call from `layouts/default.vue` made the entire
 * @nuxt/scripts GTM runtime (~9.3 KB gz: useScript core, registry schemas, GCM consent plumbing)
 * a STATIC dependency of the shared entry chunk, charging every route — including the dashboard,
 * which may never load analytics — to the doc 20 §1 floors. This component is the Nuxt-native
 * code-splitting seam:
 *
 *   - the `.client` suffix makes it client-only (nothing renders or runs during SSR);
 *   - the layout renders it through Nuxt's `Lazy` prefix (`<LazyPublicGtmRuntime>`), which turns it
 *     into an async component whose chunk is fetched on first client render — never part of the
 *     initial/shared closure;
 *   - the ONLY value crossing the boundary is the container id the public layout already resolved
 *     from its own awaited Settings read. No Settings request happens here (see the product
 *     invariant in `usePublicGtm`).
 *
 * Everything below this line is exactly the proven U2e2 behaviour: eligibility guard, Consent Mode
 * v2 denied defaults, `bundle:false`, `onNuxtReady`, strict-dynamic compatibility.
 */
const props = defineProps<{ containerId: string | null }>()

usePublicGtm(props.containerId)
</script>

<template>
  <!-- Renders nothing: the component exists to own the lazily-loaded registration side effect. -->
  <span hidden aria-hidden="true" />
</template>
