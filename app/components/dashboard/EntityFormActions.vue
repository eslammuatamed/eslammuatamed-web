<script setup lang="ts">
/**
 * The persistently reachable primary actions every dashboard editor carries — §14.4.
 *
 * Sticky to the bottom of the viewport so Save is in reach from anywhere in a long form, rather
 * than only after scrolling past a 16-row body field.
 *
 * ── THIS IS THE "PARTIAL" IN `EntityFormLayout` · PARTIAL, AND THE LINE IS DELIBERATE ──────────
 * §5.2 predicted **PARTIAL AT BEST** for a full editor layout, and `M1·U4` confirmed the reason
 * rather than merely the label: the generic chrome duplicates across both editors, but Articles'
 * publish/schedule region duplicates NOWHERE — Experiences has no `status`, no `publishAt`, no
 * preview and no publish shortcut, exactly as Projects has none. **Two entities lacking a region is
 * evidence that region is Articles-specific, not evidence to generalise it.**
 *
 * So what is shared is extracted and what is not stays where it belongs, reached through slots:
 * `#leading` carries Articles' status badge, `#actions` its Publish shortcut. Neither is modelled
 * here, and no prop describes a "status", because this component must not learn what publishing is.
 *
 * The **unreadable alert is deliberately NOT extracted** either, though it duplicates structurally:
 * it is three conditional titles and three conditional descriptions, all of them entity copy, so a
 * component would drill six strings through a prop bag and buy nothing. That is the owner's
 * "do not generalize entity-specific behavior" applied to a case that looked extractable.
 *
 * ── THE TWO-STEP DELETE ────────────────────────────────────────────────────────────────────────
 * The destructive action is placed AWAY from the primary one and requires an explicit confirmation
 * (§14.4). The confirming flag is a `v-model` rather than internal state: on a failed delete the
 * caller must be able to put the control back, and a component that owned the flag privately would
 * leave the operator staring at a confirm button for a delete that already failed.
 */
defineProps<{
  saveState: 'saving' | 'unsaved' | 'saved' | 'idle'
  /** Copy for the three announced states, in the dashboard language. */
  saveStateLabels: Record<'saving' | 'unsaved' | 'saved', string>
  saveLabel: string
  saving: boolean
  /** Create has nothing to delete, so the destructive control is absent rather than disabled. */
  deletable: boolean
  deleting: boolean
  deleteLabels: { delete: string, confirm: string, cancel: string }
}>()

const emit = defineEmits<{ delete: [] }>()

const confirming = defineModel<boolean>('confirming', { required: true })
</script>

<template>
  <div
    class="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-default bg-default/95 px-4 py-3 backdrop-blur"
    data-editor-actions
  >
    <div class="flex items-center gap-3">
      <!-- saved / saving / unsaved, announced politely rather than asserted on every keystroke. -->
      <p role="status" class="text-sm text-muted" :data-editor-save-state="saveState">
        <span v-if="saveState === 'saving'">{{ saveStateLabels.saving }}</span>
        <span v-else-if="saveState === 'unsaved'">{{ saveStateLabels.unsaved }}</span>
        <span v-else-if="saveState === 'saved'">{{ saveStateLabels.saved }}</span>
      </p>
      <slot name="leading" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <template v-if="deletable">
        <template v-if="confirming">
          <UButton
            color="error"
            variant="solid"
            size="sm"
            :loading="deleting"
            :disabled="deleting"
            data-editor-delete-confirm
            @click="emit('delete')"
          >
            {{ deleteLabels.confirm }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="deleting"
            data-editor-delete-cancel
            @click="confirming = false"
          >
            {{ deleteLabels.cancel }}
          </UButton>
        </template>
        <UButton
          v-else
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          data-editor-delete
          @click="confirming = true"
        >
          {{ deleteLabels.delete }}
        </UButton>
      </template>

      <slot name="actions" />

      <!-- Loading belongs to THIS action, never to a page-blocking screen (§14.9 criterion 4). -->
      <UButton type="submit" :loading="saving" :disabled="saving" data-editor-save>
        {{ saveLabel }}
      </UButton>
    </div>
  </div>
</template>
