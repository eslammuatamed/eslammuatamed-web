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
  <!-- `:external="true"` is explicit rather than relying on AppLink's auto-detect. That detect is
       currently inert: `external` is declared as an optional Boolean, so Vue casts an absent prop to
       `false` (not `undefined`), and `props.external ?? /^https?:\/\//.test(props.to)` therefore
       short-circuits on `false` and never tests the URL. Passing it explicitly takes the external
       branch and, critically, applies the WD-5 scheme allowlist, so a non-http(s) `liveUrl`/`repoUrl`
       from the CMS renders inert instead of becoming a live `javascript:` href. The underlying
       AppLink defect is reported separately — it belongs to Feature 007, not to this slice. -->
  <div v-if="hasAny" class="flex flex-wrap items-center gap-x-6 gap-y-3">
    <AppLink v-if="liveUrl" :to="liveUrl" :external="true" class="text-body-sm text-link hover:underline">
      {{ t('projects.links.live') }}
    </AppLink>
    <AppLink v-if="repoUrl" :to="repoUrl" :external="true" class="text-body-sm text-link hover:underline">
      {{ t('projects.links.repo') }}
    </AppLink>
  </div>
</template>
