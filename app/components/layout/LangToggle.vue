<script setup lang="ts">
// Language toggle (007, replaces the dropdown) — two locales, so both choices show at once as a compact
// segmented control. The active segment is marked by a filled surface + weight + `aria-current` (a shape
// cue, not colour alone). Two side-by-side links mirror naturally in RTL. Comfortable target size;
// keyboard + visible focus via the global focus-visible ring.
//
// EACH SEGMENT IS `<SwitchLocalePathLink>`, the module's own component, not a `<NuxtLink>` fed a
// pre-resolved `switchLocalePath()`. On a per-locale-slug route (D04-2) the counterpart slug only
// exists once the page has called `setI18nParams()` — and this toggle lives in the HEADER, which
// server-renders BEFORE the page does. Resolving the path here therefore produced a stale `href`:
// `/ar/projects/<en-slug>` instead of `/ar/projects/<ar-slug>`. Clicking still worked, because the
// router resolved the reactive target at click time, so the defect was invisible to a person using a
// mouse — and live for anyone following the raw href: a crawler, a middle-click, a no-JS visitor.
//
// `SwitchLocalePathLink` fixes it at the source: the module wraps the link in markers and rewrites the
// `href` on `app:rendered`, once the whole page — `setI18nParams()` included — has run. Surfaced by the
// D22-7 strict-SEO adoption; the ordering hazard predates it.
const { t, locale, locales } = useI18n()
const route = useRoute()

// Project detail deliberately has no Nitro payload cache: a Dashboard edit must reach the next
// request. Use the already-correct localized href as a document navigation on that one surface so a
// second locale switch cannot race the destination page's asynchronous `setI18nParams()` call.
const forceDocumentNavigation = computed(() => /^\/(?:ar\/)?projects\/[^/]+\/?$/.test(route.path))

const options = computed(() =>
  locales.value.map(item => ({
    code: item.code,
    short: item.code.toUpperCase(),
    name: item.name ?? item.code,
    active: item.code === locale.value
  }))
)
</script>

<template>
  <div
    class="inline-flex items-center rounded-full border border-default bg-elevated p-0.5"
    role="group"
    :aria-label="t('a11y.switchLanguage')"
  >
    <SwitchLocalePathLink
      v-for="opt in options"
      :key="opt.code"
      :locale="opt.code"
      :external="forceDocumentNavigation"
      :aria-current="opt.active ? 'true' : undefined"
      :title="opt.name"
      class="rounded-full px-3 py-2 text-caption font-semibold leading-none transition-colors"
      :class="
        opt.active
          ? 'bg-primary text-white'
          : 'text-muted hover:text-default'
      "
    >
      {{ opt.short }}
    </SwitchLocalePathLink>
  </div>
</template>
