<script setup lang="ts">
import type { AdminSkill } from '~/composables/admin-project-types'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{
  close: []
  saved: [skill: AdminSkill]
  deleted: []
}>()

const open = defineModel<boolean>('open', { required: true })
const { t } = useDashboardI18n()
const editorRef = useTemplateRef<{ dirty: boolean }>('editorRef')
const isCreate = computed(() => props.id === null)
const notifyClose = ref(false)

function requestClose(): void {
  if (editorRef.value?.dirty && !window.confirm(t('dashboard.skills.overlay.unsavedConfirm'))) return
  notifyClose.value = true
  open.value = false
}

function onSaved(skill: AdminSkill): void {
  emit('saved', skill)
  notifyClose.value = true
  open.value = false
}

function onDeleted(): void {
  emit('deleted')
  notifyClose.value = true
  open.value = false
}

/** Notify the owner only after Nuxt UI has completed its own focus-restoration lifecycle. */
function onAfterLeave(): void {
  if (!notifyClose.value) return
  notifyClose.value = false
  emit('close')
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :dismissible="false"
    :close="false"
    :title="isCreate ? t('dashboard.skills.editor.createTitle') : t('dashboard.skills.editor.editTitle')"
    :description="t('dashboard.skills.editor.description')"
    :ui="{ content: 'max-w-xl' }"
    @close:prevent="requestClose"
    @after:leave="onAfterLeave"
  >
    <template #content>
      <header class="border-b border-default p-4" data-skill-overlay>
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-medium text-highlighted" data-skill-overlay-title>
              {{ isCreate ? t('dashboard.skills.editor.createTitle') : t('dashboard.skills.editor.editTitle') }}
            </h2>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.skills.editor.description') }}</p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            data-skill-overlay-close
            :aria-label="t('dashboard.skills.overlay.close')"
            @click="requestClose"
          />
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-4">
        <DashboardSkillEditor
          v-if="open"
          :id="id"
          ref="editorRef"
          :key="id ?? 'create'"
          @saved="onSaved"
          @deleted="onDeleted"
        />
      </div>
    </template>
  </USlideover>
</template>
