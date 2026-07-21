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

const GROUP_ORDER = ['LANGUAGE', 'FRAMEWORK', 'TOOLING', 'PRACTICE'] as const

const groups = computed(() => {
  const list = props.skills ?? []
  return GROUP_ORDER.map(group => ({
    group,
    items: list.filter(skill => skill.group === group).sort((a, b) => a.order - b.order)
  })).filter(entry => entry.items.length > 0)
})

const show = computed(() => props.pending || props.error || (props.skills ?? []).length > 0)
</script>

<template>
  <UiSpread v-if="show" tone="ink" aria-labelledby="capabilities-title">
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

    <UiStateError v-if="error" class="mt-10" @retry="$emit('retry')" />
    <UiSectionSkeleton v-else-if="pending" class="mt-10" :count="4" />

    <!-- Four capability columns; each technology prefixed by its own brand-colour datum. On the ink
         ground the colour dots carry the accent while the type stays quiet — a spec read, not a pile. -->
    <div v-else class="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
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
  </UiSpread>
</template>
