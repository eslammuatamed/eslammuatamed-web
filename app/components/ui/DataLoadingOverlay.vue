<script setup lang="ts">
// DataLoadingOverlay (007 loading system) — the REVALIDATION state: shown over a region whose content is
// already on screen while it refreshes (e.g. after a locale switch or a manual retry). It communicates
// "content is being updated" — never fake percentage progress. Identity cue = the Monolith mark; a thin
// violet data-sweep carries the motion (static under prefers-reduced-motion via the global rule); status
// text is localized. The host region must be `position: relative`; content stays readable beneath a
// translucent scrim that inherits the section surface (paper or ink) via `bg-default`.
interface Props {
  show: boolean
  /** Localized status; defaults to "Updating". */
  label?: string
}

const props = withDefaults(defineProps<Props>(), { label: undefined })
// Both worlds render this component, so the locale that owns the SURFACE decides the
// copy — not the route locale, which is always `en` inside the dashboard (plan §14.9 F-1).
const { t } = useSurfaceI18n()
const text = computed(() => props.label ?? t('state.updating'))
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 z-10 grid place-items-center bg-default/70 backdrop-blur-[1px]"
      role="status"
      :aria-busy="true"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-4">
        <UiBrandMark :size="26" class="text-primary" />
        <p class="kicker text-muted">{{ text }}</p>
        <span class="sr-only">{{ text }}</span>
        <!-- Data-sweep: a violet segment traverses a hairline track; reversed in RTL, static in reduced motion. -->
        <div class="relative h-px w-28 overflow-hidden bg-accented">
          <span class="absolute inset-y-0 w-1/2 bg-primary [animation:data-sweep_1.4s_var(--ease-standard)_infinite] rtl:[animation-direction:reverse]" aria-hidden="true" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<!-- The `fade` transition classes live in app/assets/css/main.css beside `page-spread`: a scoped
     block here compiles to a separate render-blocking stylesheet request (D20-4). -->
