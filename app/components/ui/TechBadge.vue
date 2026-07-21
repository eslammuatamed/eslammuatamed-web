<script setup lang="ts">
// Technology badge (doc 12 §2, doc 03 §2). The brand colour is an identity ACCENT only — a small dot,
// never a text background (doc 03 §2: "never as backgrounds for body text"; contrast stays on the
// neutral surface). `brandColor` arrives as content data from the API (`PublicSkillEntity.brandColor`),
// so it is inlined here as the one sanctioned data-driven colour — the doc 03 §2 technology-identity
// carve-out to the doc 14 no-inline-colour rule (WD-4); it can't live in the semantic token layer
// because it is per-skill content, not a fixed UI token. Latin tech names stay LTR in Arabic via `bdi`
// (doc 21 §4).
interface Props {
  label: string
  brandColor?: string | null
}

withDefaults(defineProps<Props>(), { brandColor: null })
</script>

<template>
  <span
    class="inline-flex items-center gap-2 rounded-full border border-default bg-elevated px-3 py-1.5 text-body-sm text-default"
  >
    <span
      v-if="brandColor"
      class="size-2 shrink-0 rounded-full"
      :style="{ backgroundColor: brandColor }"
      aria-hidden="true"
    />
    <bdi>{{ label }}</bdi>
  </span>
</template>
