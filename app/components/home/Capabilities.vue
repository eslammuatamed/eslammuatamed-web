<script setup lang="ts">
import type { Skill } from '~/types/models'

// Capabilities (FR-PUB-011) — the skills section, recomposed for 007 as a full-bleed ink spread: the
// first dark beat after the paper hero, establishing the page's ink/paper rhythm on scroll. Skills are
// grouped by kind (the grouping is real data, not decoration) and set as four capability columns; each
// technology carries its own brand colour as a small accent dot (the only place tech colours appear —
// doc 03 usage rule). Presentational: the page owns the fetch and passes state down (doc 12 §6). Empty
// result omits the whole section (NFR-DEGRADE); error offers an inline retry.
interface Props {
  skills: readonly Skill[] | null
  error?: boolean
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), { error: false, pending: false })
defineEmits<{ retry: [] }>()
const { t } = useI18n()

// The approved public taxonomy, in the approved order (Docs `content/positioning-strategy.md` §5).
// The API already sorts groups this way; naming them here keeps the columns stable and drops any
// group the registry grows that the taxonomy has not adopted.
const GROUP_ORDER = ['LANGUAGE', 'FRONTEND', 'BACKEND', 'DELIVERY'] as const

const groups = computed(() => {
  const list = props.skills ?? []
  return GROUP_ORDER.map(group => ({
    group,
    items: list.filter(skill => skill.group === group).sort((a, b) => a.order - b.order)
  })).filter(entry => entry.items.length > 0)
})

const hasData = computed(() => (props.skills ?? []).length > 0)
// Split pending into initial-load (skeleton) vs revalidation with content on screen (overlay).
const initialPending = computed(() => props.pending && !hasData.value)
const refreshing = computed(() => props.pending && hasData.value)
const show = computed(() => props.pending || props.error || hasData.value)
</script>

<template>
  <UiSpread v-if="show" tone="glass" aria-labelledby="capabilities-title">
    <div class="flex flex-col gap-y-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="kicker text-link">
          {{ t('home.techStack.eyebrow') }}
        </p>
        <h2 id="capabilities-title" class="mt-3 font-display text-h1 text-highlighted">
          {{ t('home.techStack.title') }}
        </h2>
      </div>
    </div>

    <UiRequestState
      class="mt-12 block"
      :pending="initialPending"
      :refreshing="refreshing"
      :error="error"
      skeleton="capabilities"
      @retry="$emit('retry')"
    >
      <!-- Four capability columns; each technology prefixed by its own brand-colour datum. On the ink
           ground the colour dots carry the accent while the type stays quiet — a spec read, not a pile. -->
      <div class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <section v-for="entry in groups" :key="entry.group" class="border-t border-default pt-5">
          <h3 class="kicker text-muted">
            {{ t(`home.techStack.group.${entry.group}`) }}
          </h3>
          <ul class="mt-4 flex flex-col gap-y-2.5">
            <li
              v-for="skill in entry.items"
              :key="skill.id"
              class="flex items-center gap-3 text-body text-default"
            >
              <span
                class="size-1.5 shrink-0 rounded-full"
                :style="{ backgroundColor: skill.brandColor ?? 'var(--ui-text-dimmed)' }"
                aria-hidden="true"
              />
              <bdi>{{ skill.label }}</bdi>
            </li>
          </ul>
        </section>
      </div>
    </UiRequestState>
  </UiSpread>
</template>
