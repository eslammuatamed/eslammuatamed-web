<script setup lang="ts">
import type { MediaPdf } from '~/types/models'

// The two résumé actions (FR-PUB-023): download the owner-maintained PDF, and print the HTML.
// Both are screen-only — `print:hidden` removes them from the printed document, where a button
// is furniture rather than content.
interface Props {
  /** The contract's PDF descriptor, or `null` when no résumé PDF is configured. */
  resume: MediaPdf | null
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

// The descriptor's `url` is an ABSOLUTE media-origin URL built by the API from PUBLIC_MEDIA_URL.
// It is used exactly as served: no API-origin rewrite, no client-side reconstruction of a
// storage key, no string surgery. Reconstructing it here would put a second, silently divergent
// copy of the storage layout in the Web app.
const href = computed(() => props.resume?.url ?? null)

const sizeLabel = computed(() => {
  if (!props.resume) return null
  return formatFileSize(props.resume.sizeBytes, locale.value, {
    kb: t('resume.pdf.unitKb'),
    mb: t('resume.pdf.unitMb')
  })
})

// The accessible name states the format and, when known, the size — so a screen-reader user is
// told they are about to download a PDF rather than follow a page link, which WCAG 3.2.5 and
// doc 21 §4 both ask for. The visible label stays short.
const downloadLabel = computed(() =>
  sizeLabel.value
    ? t('resume.pdf.downloadA11yWithSize', { filename: props.resume?.filename, size: sizeLabel.value })
    : t('resume.pdf.downloadA11y', { filename: props.resume?.filename })
)

function print(): void {
  window.print()
}
</script>

<template>
  <div class="print:hidden flex flex-wrap items-center gap-3">
    <!-- A PLAIN ANCHOR, not a router link or a JS handler: the download must work with
         JavaScript disabled, and an <a href> to the media origin does.

         `download` is present but is NOT the mechanism. The attribute is ignored by browsers
         for cross-origin URLs, and the media origin is a different host — so the authoritative
         download behaviour is the object's own `Content-Disposition: attachment` header, which
         the API writes as object metadata at upload time (doc 19 §5). The attribute is kept
         only because it costs nothing and helps in the same-origin local-storage dev setup.

         `rel="noopener"` on a cross-origin link; no `target=_blank` — a download should not
         strand an empty tab. -->
    <UButton
      v-if="href"
      :to="href"
      :external="true"
      download
      rel="noopener"
      icon="i-lucide-download"
      :aria-label="downloadLabel"
    >
      {{ t('resume.pdf.download') }}
      <span v-if="sizeLabel" class="font-mono text-caption opacity-70">{{ sizeLabel }}</span>
    </UButton>

    <!-- PDF unavailable. An honest, localized note — NOT a disabled button and NOT a link to a
         URL that does not exist. It does not mention `resumeAssetId` or any other technical
         vocabulary, does not claim a download exists, does not offer Contact (that route is a
         later slice and does not exist yet), and does not hide the HTML résumé, which is
         complete on its own and remains the primary artifact of this page. -->
    <p v-else class="text-body-sm text-muted" data-testid="resume-pdf-unavailable">
      {{ t('resume.pdf.unavailable') }}
    </p>

    <!-- Print stays available in BOTH states: the HTML résumé is printable whether or not a PDF
         exists, which is the whole point of FR-PUB-023 having two deliverables.
         A <button>, not a link — it performs an action on the current page and has no href. -->
    <UButton
      variant="subtle"
      color="neutral"
      icon="i-lucide-printer"
      @click="print"
    >
      {{ t('resume.print') }}
    </UButton>
  </div>
</template>
