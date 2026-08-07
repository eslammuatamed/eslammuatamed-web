<script setup lang="ts">
import { PROJECT_LOCALES, newGalleryItem, type ProjectGalleryItemForm, type ProjectLocale } from '~/composables/admin-project-form'

/**
 * The project gallery: an ORDERED list of media references with a caption per locale.
 *
 * ORDER IS THE ARRAY. The operator moves rows; `order` is written from the array index when the
 * payload is built. Exposing `order` as a number to type would let two rows claim the same position
 * and make the list on screen disagree with the list that gets sent.
 *
 * SELECTION AND UPLOAD ARE THE MEDIA PICKER'S, not this component's. There is exactly one uploader
 * in the dashboard and this is a consumer of it — a second one would be a second set of kind
 * restrictions, a second deduplication story and a second place for the two to drift.
 *
 * MOVE BUTTONS, NOT DRAG AND DROP. A drag handle is unusable from a keyboard without reimplementing
 * the whole interaction, and reordering is a rare operation on a handful of images.
 */
const props = defineProps<{
  modelValue: ProjectGalleryItemForm[]
  disabled?: boolean
  showErrors?: boolean
  /** Indices whose image is still unchosen; `mediaAssetId` is required on every item the API accepts. */
  missingAsset: readonly number[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ProjectGalleryItemForm[]] }>()

const { t } = useI18n()

function replace(next: ProjectGalleryItemForm[]): void {
  emit('update:modelValue', next)
}

function patchItem(index: number, patch: Partial<ProjectGalleryItemForm>): void {
  replace(props.modelValue.map((item, i) => (i === index ? { ...item, ...patch } : item)))
}

function setCaption(index: number, locale: ProjectLocale, value: string): void {
  const item = props.modelValue[index]
  if (!item) return
  patchItem(index, { captions: { ...item.captions, [locale]: value } })
}

function add(): void {
  replace([...props.modelValue, newGalleryItem()])
}

function removeAt(index: number): void {
  replace(props.modelValue.filter((_, i) => i !== index))
}

/**
 * Swap with the neighbour rather than splice-and-reinsert: a swap is the operation the two buttons
 * describe, and each row keeps its own `key`, so Vue moves the existing MediaPicker instances
 * instead of reusing them in place — which is what stops one row's preview appearing in the other's
 * slot for a frame.
 */
function move(index: number, delta: -1 | 1): void {
  const target = index + delta
  const next = [...props.modelValue]
  const current = next[index]
  const neighbour = next[target]
  if (!current || !neighbour) return
  next[index] = neighbour
  next[target] = current
  replace(next)
}

const isMissing = (index: number): boolean => props.showErrors === true && props.missingAsset.includes(index)
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="modelValue.length === 0" class="text-sm text-muted" data-gallery-empty>
      {{ t('dashboard.projects.editor.galleryEmpty') }}
    </p>

    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="(item, index) in modelValue"
        :key="item.key"
        class="rounded-control border p-4"
        :class="isMissing(index) ? 'border-error' : 'border-default'"
        :data-gallery-item="index"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <h4 class="text-sm font-medium text-highlighted">
            {{ t('dashboard.projects.editor.galleryItem', { position: index + 1 }) }}
          </h4>
          <div class="flex items-center gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-up"
              :disabled="disabled || index === 0"
              :aria-label="t('dashboard.projects.editor.galleryMoveUp', { position: index + 1 })"
              :data-gallery-up="index"
              @click="move(index, -1)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-down"
              :disabled="disabled || index === modelValue.length - 1"
              :aria-label="t('dashboard.projects.editor.galleryMoveDown', { position: index + 1 })"
              :data-gallery-down="index"
              @click="move(index, 1)"
            />
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              :disabled="disabled"
              :ui="{ base: 'text-error-700 dark:text-error-300' }"
              :aria-label="t('dashboard.projects.editor.galleryRemove', { position: index + 1 })"
              :data-gallery-remove="index"
              @click="removeAt(index)"
            />
          </div>
        </div>

        <DashboardMediaPicker
          :model-value="item.mediaAssetId"
          allowed-kind="IMAGE"
          :field-label="t('dashboard.projects.editor.galleryItem', { position: index + 1 })"
          :disabled="disabled"
          @update:model-value="patchItem(index, { mediaAssetId: $event })"
        />

        <p v-if="isMissing(index)" class="mt-2 text-xs text-error-700 dark:text-error-300" :data-gallery-error="index">
          {{ t('dashboard.projects.editor.galleryImageMissing') }}
        </p>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <UFormField
            v-for="captionLocale in PROJECT_LOCALES"
            :key="captionLocale"
            :label="`${t('dashboard.projects.field.caption')} — ${t(`dashboard.projects.locale.${captionLocale}`)}`"
          >
            <UInput
              :model-value="item.captions[captionLocale]"
              :dir="captionLocale === 'ar' ? 'rtl' : 'ltr'"
              :disabled="disabled"
              class="w-full"
              :data-gallery-caption="`${index}.${captionLocale}`"
              @update:model-value="setCaption(index, captionLocale, String($event))"
            />
          </UFormField>
        </div>
      </li>
    </ul>

    <div class="flex">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-plus"
        :disabled="disabled"
        data-gallery-add
        @click="add()"
      >
        {{ t('dashboard.projects.editor.galleryAdd') }}
      </UButton>
    </div>
  </div>
</template>
