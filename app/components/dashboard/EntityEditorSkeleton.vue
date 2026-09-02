<script setup lang="ts">
/**
 * The editor-shaped loading state — §14.9 criterion 3.
 *
 * An editor that painted an EMPTY FORM first invites the operator to start typing over content that
 * has not arrived, and then to save nothing over something real. So the fields do not exist until
 * there is either an entity or a definite answer that there is none.
 *
 * ⚠ ON A MODULE WITH A REPLACE-WHOLESALE RELATION THIS IS NOT ONLY AN INTERACTION RULE. A form
 * rendered before its GET resolves holds an EMPTY relation; submitting it replaces a real one with
 * nothing — 200 OK, no 422, every gate green, and the links silently gone. `ExperienceEditor`'s
 * `technologyIds` is exactly that shape, which is why this gate and the form's seeding are BOTH
 * required: the seeding makes the value right, this makes the un-seeded state unreachable.
 *
 * Extracted at `M1·U4b` — byte-identical across both editors, and the caller supplies only its own
 * accessible label.
 */
defineProps<{ label: string }>()
</script>

<template>
  <div
    role="status"
    :aria-busy="true"
    :aria-label="label"
    data-editor-loading
    class="flex flex-col gap-6"
  >
    <span class="sr-only">{{ label }}</span>
    <div aria-hidden="true" class="flex flex-col gap-4">
      <div class="skeleton h-9 w-2/3" />
      <div class="skeleton h-32 w-full" />
      <div class="skeleton h-64 w-full" />
    </div>
  </div>
</template>
