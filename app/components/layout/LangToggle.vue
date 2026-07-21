<script setup lang="ts">
// Language toggle (007, replaces the dropdown) — two locales, so both choices show at once as a compact
// segmented control. The active segment is marked by a filled surface + weight + `aria-current` (a shape
// cue, not colour alone). Each segment is a real link to the counterpart route via `switchLocalePath`
// (preserves the equivalent path/query where supported); plain `<NuxtLink>` navigates to that fully
// resolved path with no i18n re-prefixing (the double-prefix trap — feed it the resolved path directly).
// Two side-by-side links mirror naturally in RTL. Comfortable target size; keyboard + visible focus via
// the global focus-visible ring.
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const options = computed(() =>
  locales.value.map(item => ({
    code: item.code,
    short: item.code.toUpperCase(),
    name: item.name ?? item.code,
    to: switchLocalePath(item.code),
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
    <NuxtLink
      v-for="opt in options"
      :key="opt.code"
      :to="opt.to"
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
    </NuxtLink>
  </div>
</template>
