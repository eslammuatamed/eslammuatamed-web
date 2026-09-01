<script setup lang="ts">
import type { AdminTestimonial } from '~/composables/admin-testimonial-types'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ close: []; saved: [testimonial: AdminTestimonial]; deleted: [] }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useDashboardI18n()
const editorRef = useTemplateRef<{ dirty: boolean }>('editorRef')
const isCreate = computed(() => props.id === null)

function requestClose(): void {
  if (editorRef.value?.dirty && !window.confirm(t('dashboard.testimonials.overlay.unsavedConfirm'))) return
  open.value = false
  emit('close')
}
function onSaved(testimonial: AdminTestimonial): void { emit('saved', testimonial); open.value = false; emit('close') }
function onDeleted(): void { emit('deleted'); open.value = false; emit('close') }
</script>

<template>
  <USlideover
    v-model:open="open"
    :dismissible="false"
    :close="false"
    :title="isCreate ? t('dashboard.testimonials.editor.createTitle') : t('dashboard.testimonials.editor.editTitle')"
    :description="t('dashboard.testimonials.editor.description')"
    @close:prevent="requestClose"
  >
    <template #content>
      <div data-testimonial-overlay class="flex h-full flex-col">
        <header class="flex items-start justify-between gap-4 border-b border-default p-4">
          <div><h2 class="text-h3 text-highlighted">{{ isCreate ? t('dashboard.testimonials.editor.createTitle') : t('dashboard.testimonials.editor.editTitle') }}</h2><p class="mt-1 text-sm text-muted">{{ t('dashboard.testimonials.editor.description') }}</p></div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('dashboard.testimonials.overlay.close')" data-testimonial-overlay-close @click="requestClose" />
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-4"><DashboardTestimonialEditor v-if="open" :id="id" ref="editorRef" :key="id ?? 'create'" @saved="onSaved" @deleted="onDeleted" /></div>
      </div>
    </template>
  </USlideover>
</template>
