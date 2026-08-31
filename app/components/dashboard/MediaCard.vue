<script setup lang="ts">
import type { MediaAsset } from '~/types/models'
import { thumbnailFor } from '~/utils/media-asset'

/**
 * ONE media asset as a grid card. Purely presentational — it fetches nothing and decides nothing
 * about selection, so the library page and the picker can render an identical grid while meaning
 * two different things by a click.
 *
 * It is always a `<button>`, never a link or a bare div: in the library it opens the asset's detail,
 * in the picker it selects. Both are actions, and a real button is what makes the grid keyboard
 * navigable and announces the pressed state without any ARIA of our own beyond `aria-pressed`.
 */
const props = defineProps<{
  asset: MediaAsset
  /** Renders the selected treatment and sets `aria-pressed`; only the picker passes it. */
  selected?: boolean
}>()

defineEmits<{ select: [asset: MediaAsset] }>()

const { t, locale } = useDashboardI18n()

const thumbnail = computed(() => thumbnailFor(props.asset))

/**
 * The card's accessible name.
 *
 * The filename alone is not enough — a grid of "IMG_4821.jpg" is unusable by ear — so the kind is
 * named too. The asset's LIBRARY alt is deliberately NOT used: it is per-locale metadata that may be
 * absent, and it describes the picture rather than identifying the file the operator is choosing
 * between.
 */
const label = computed(() =>
  t('dashboard.media.cardLabel', {
    filename: props.asset.originalFilename,
    kind: t(`dashboard.media.kind.${props.asset.kind}`)
  })
)
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected === undefined ? undefined : selected"
    :aria-label="label"
    :data-media-id="asset.id"
    data-media-card
    class="group flex w-full flex-col overflow-hidden rounded-card border text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="selected
      ? 'border-primary ring-2 ring-primary bg-elevated'
      : 'border-default hover:bg-elevated/60'"
    @click="$emit('select', asset)"
  >
    <!-- A fixed 4:3 frame so the grid does not reflow as thumbnails of different shapes arrive —
         the images are lazy and arrive over many frames, and an unreserved box would move every
         card below each time one landed. -->
    <span class="flex aspect-square w-full items-center justify-center overflow-hidden bg-elevated">
      <img
        v-if="thumbnail"
        :src="thumbnail.url"
        :width="thumbnail.width"
        :height="thumbnail.height"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      >
      <!-- A PDF has no rendition to show, so it gets an icon rather than a broken frame. `alt=""`
           above and `aria-hidden` here for the same reason: the card's own label already names the
           file and its kind, so the thumbnail is decoration and announcing it would repeat. -->
      <UIcon v-else name="i-lucide-file-text" class="size-10 text-muted" aria-hidden="true" />
    </span>

    <span class="flex flex-col gap-1 p-3">
      <!-- `dir="auto"` because a filename can be Arabic, and `break-all` because it can also be one
           unbroken 80-character string with nowhere to wrap. -->
      <span dir="auto" class="line-clamp-2 break-all text-sm font-medium text-highlighted">
        {{ asset.originalFilename }}
      </span>
      <span class="flex items-center gap-2 text-xs text-muted">
        <span>{{ t(`dashboard.media.kind.${asset.kind}`) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ formatFileSize(asset.sizeBytes, locale, {
          kb: t('dashboard.media.unit.kb'),
          mb: t('dashboard.media.unit.mb')
        }) ?? '—' }}</span>
      </span>
    </span>
  </button>
</template>
