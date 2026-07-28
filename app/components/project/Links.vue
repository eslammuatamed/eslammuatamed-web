<script setup lang="ts">
// Live-product and repository links for a case study (FR-PUB-033). Both are nullable in the contract,
// and "absence handled gracefully" is the explicit requirement — so when BOTH are null this renders
// nothing at all. No disabled buttons, no "not available" copy: an absent link is not a broken one, and
// announcing its absence would be noise on a page whose job is to demonstrate the work.
//
// All four combinations are real and tested: both, live only, repo only, neither. Several of the
// currently seeded projects are client work with no public URL, so "neither" is the common case, not
// an edge case.
interface Props {
  liveUrl: string | null
  repoUrl: string | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const hasAny = computed(() => Boolean(props.liveUrl || props.repoUrl))
</script>

<template>
  <!-- AppLink owns external handling: it auto-detects http(s), opens a new tab with a safe rel, and
       applies the WD-5 scheme allowlist so a non-http(s) value from the CMS renders inert rather than
       becoming a live javascript: href. No per-call flag is needed. -->
  <div v-if="hasAny" class="flex flex-wrap items-center gap-x-6 gap-y-3">
    <AppLink v-if="liveUrl" :to="liveUrl" class="text-body-sm text-link hover:underline">
      {{ t('projects.links.live') }}
    </AppLink>
    <AppLink v-if="repoUrl" :to="repoUrl" class="text-body-sm text-link hover:underline">
      {{ t('projects.links.repo') }}
    </AppLink>
  </div>
</template>
