<script setup lang="ts">
import type { DashboardLocale } from '~/utils/dashboard-locale'
import { DASHBOARD_LOCALES } from '~/utils/dashboard-locale'

/**
 * The Dashboard application-language switcher (D02-15 / D11-8).
 *
 * ⚠ NOT `LayoutLangToggle`, and the difference is the whole decision. The public toggle is two
 * `<SwitchLocalePathLink>`s — it NAVIGATES, because on the public site the locale IS the route
 * (`prefix_except_default`). The dashboard's language is a persisted preference and its routes are
 * unprefixed in both languages (D04-7), so this must change state and nothing else. Two buttons,
 * one shared visual language; a link here would remount the page and discard unsaved translation
 * state, which D02-15 forbids in as many words.
 *
 * Shape is deliberately the same segmented control as the public toggle (two locales, both visible,
 * active segment marked by fill + weight + `aria-current` — a shape cue, not colour alone), so an
 * operator moving between the two surfaces recognizes the same control.
 *
 * `role="group"` with real `<button>`s rather than a radio group: the value commits on activation
 * with no separate confirm step, which is button semantics. Arrow-key roving focus would imply a
 * radiogroup contract this does not implement.
 */
const { locale, t, setLocale } = useDashboardI18n()

// The switch awaits the incoming catalogue before it flips (see `useDashboardLocale`), so it has a
// real pending window — short on a warm cache, a network round trip on the first switch. Disabling
// the control during it stops a double-click queueing a second load, and `aria-busy` announces it.
const switching = ref(false)

async function choose(next: DashboardLocale): Promise<void> {
  if (switching.value || next === locale.value) return
  switching.value = true
  try {
    await setLocale(next)
  } finally {
    switching.value = false
  }
}

const options = computed(() =>
  DASHBOARD_LOCALES.map(code => ({
    code,
    short: code.toUpperCase(),
    // The locale's own endonym, always in its own language — an Arabic reader looking for Arabic
    // should not have to recognize the English word "Arabic" first.
    name: t(`locale.${code}`),
    active: code === locale.value
  }))
)
</script>

<template>
  <div
    class="inline-flex items-center rounded-full border border-default bg-elevated p-0.5"
    role="group"
    :aria-label="t('dashboard.shell.language')"
    :aria-busy="switching ? 'true' : undefined"
  >
    <button
      v-for="opt in options"
      :key="opt.code"
      type="button"
      :data-dashboard-locale="opt.code"
      :disabled="switching"
      :aria-current="opt.active ? 'true' : undefined"
      :title="opt.name"
      :lang="opt.code"
      class="rounded-full px-3 py-2 text-caption font-semibold leading-none transition-colors disabled:opacity-60"
      :class="opt.active ? 'bg-primary text-white' : 'text-muted hover:text-default'"
      @click="() => choose(opt.code)"
    >
      {{ opt.short }}
      <span class="sr-only">{{ opt.name }}</span>
    </button>
  </div>
</template>
