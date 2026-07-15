<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Locale switch that preserves the current route (flow F-P5): `switchLocalePath` resolves the
// counterpart path for each locale, so switching never drops the visitor back to the homepage.
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const items = computed<DropdownMenuItem[]>(() =>
  locales.value.map(item => ({
    label: item.name ?? item.code,
    to: switchLocalePath(item.code),
    // `to` is already the fully resolved target-locale path. Nuxt UI's ULink otherwise re-localizes
    // a prefix-less `to` to the CURRENT locale, so the default-locale target (`/blog`) would get the
    // active `/ar` prefix re-applied — the AR→EN switch then 404s. `locale: false` opts out.
    locale: false,
    icon: item.code === locale.value ? 'i-lucide-check' : undefined
  }))
)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-languages"
      color="neutral"
      variant="ghost"
      :aria-label="t('a11y.switchLanguage')"
    />
  </UDropdownMenu>
</template>
