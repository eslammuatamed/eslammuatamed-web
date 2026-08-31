<script setup lang="ts">
/**
 * The shared per-entity SEO panel (FR-DSH-050) — one presentation of the four optional,
 * per-locale fields the entity contracts embed inside every translation row:
 * `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImageId`.
 *
 * PRESENTATION ONLY, and that boundary is load-bearing rather than aspirational. The panel owns
 * no persistence, no payload building, no API access, no form state, no tab ownership and no
 * status/slug logic — it renders the values it is handed and emits changes straight back out,
 * exactly like the rest of the Dashboard's field components. Which entities carry these fields
 * at all is decided by the contract, never by this file; a consumer whose translations do not
 * declare them has no honest use for it.
 *
 * DIRECTION IS PER FIELD, not inherited from the chrome (doc 11 §6): `contentDir` carries the
 * direction of the CONTENT being edited and applies to the two natural-language fields, while
 * the canonical URL is a machine address and stays LTR under every chrome and content direction.
 *
 * Clearing follows the contract's own inverse pair (D10-23): the picker's value travels through
 * untouched, so an explicit `null` reaches the caller verbatim and omission-vs-clear remains the
 * caller's payload decision.
 *
 * The OG picker is the LAZY variant on purpose: both consuming editors sit on governed routes whose
 * media subsystem was deliberately moved off the eager closure (a measured 24,769 B), and a static
 * import here would quietly pull it back onto every caller at once. Same component, same interface.
 */
const props = defineProps<{
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImageId: string | null
  /** Direction of the content being edited; independent of the dashboard chrome direction. */
  contentDir?: 'ltr' | 'rtl'
  disabled?: boolean
  /**
   * Renders the four fields BARE — no fieldset, legend or help — for a caller that owns its own
   * titled container (the editors' disclosure wrapper). Absent/false renders the titled group.
   * (Named for the OFF state on purpose: Vue casts an absent Boolean prop to `false`, so a
   * `heading?: boolean` would silently default this component to bare.)
   */
  bare?: boolean
  /** Server/validation errors surfaced verbatim by the caller's form context. */
  metaTitleError?: string
  metaDescriptionError?: string
  canonicalUrlError?: string
  ogImageError?: string
}>()

const emit = defineEmits<{
  'update:metaTitle': [value: string]
  'update:metaDescription': [value: string]
  'update:canonicalUrl': [value: string]
  'update:ogImageId': [value: string | null]
}>()

const { t } = useDashboardI18n()

const dir = computed(() => props.contentDir ?? 'ltr')

const bare = computed(() => props.bare === true)
</script>

<template>
  <component
    :is="bare ? 'div' : 'fieldset'"
    :class="bare
      ? 'flex flex-col gap-4'
      : 'mt-2 flex flex-col gap-4 rounded-control border border-default p-4'"
    data-seo-panel
  >
    <legend v-if="!bare" class="px-1 text-sm font-medium text-highlighted">{{ t('dashboard.seo.title') }}</legend>
    <p v-if="!bare" class="text-xs text-muted">{{ t('dashboard.seo.help') }}</p>

    <UFormField :label="t('dashboard.seo.field.metaTitle')" :error="metaTitleError">
      <UInput
        :model-value="metaTitle"
        :dir="dir"
        :disabled="disabled"
        class="w-full"
        data-seo-field="metaTitle"
        @update:model-value="emit('update:metaTitle', String($event))"
      />
    </UFormField>

    <UFormField :label="t('dashboard.seo.field.metaDescription')" :error="metaDescriptionError">
      <UTextarea
        :model-value="metaDescription"
        :rows="2"
        :dir="dir"
        :disabled="disabled"
        class="w-full"
        data-seo-field="metaDescription"
        @update:model-value="emit('update:metaDescription', String($event))"
      />
    </UFormField>

    <UFormField :label="t('dashboard.seo.field.canonicalUrl')" :error="canonicalUrlError">
      <UInput
        :model-value="canonicalUrl"
        dir="ltr"
        :disabled="disabled"
        class="w-full"
        data-seo-field="canonicalUrl"
        @update:model-value="emit('update:canonicalUrl', String($event))"
      />
    </UFormField>

    <UFormField :label="t('dashboard.seo.field.ogImage')" :error="ogImageError">
      <LazyDashboardMediaPicker
        :model-value="ogImageId"
        allowed-kind="IMAGE"
        :field-label="t('dashboard.seo.field.ogImage')"
        :disabled="disabled"
        data-seo-picker
        @update:model-value="emit('update:ogImageId', $event)"
      />
    </UFormField>
  </component>
</template>
