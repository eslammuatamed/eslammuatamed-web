<script setup lang="ts">
import type { NuxtError } from '#app'

// Locale-aware error page (doc 06 §6). Recovery paths (home, blog) satisfy FR-PUB-004; a 404
// and a 5xx read differently. `clearError` unwinds the error state before navigating.
interface Props {
  error: NuxtError
}

const props = defineProps<Props>()
const { t } = useI18n()
const localePath = useLocalePath()

// `<html lang dir>` is NOT set here. It used to be (finding F-2): a fatal error renders this component
// instead of `app.vue`, so app.vue's `htmlAttrs` never ran and the Arabic 404 laid out left-to-right.
// Under strict SEO (D22-7) the i18n module writes those attributes itself, independently of which
// component renders, so a second writer here would be duplication. Verified by removing it and
// re-running the Arabic-404 test, which still asserts `dir="rtl"` — F-2's behaviour is unchanged, only
// its owner is.

// `status`/`statusText` are the current NuxtError accessors; `statusCode`/`statusMessage` are
// `@deprecated` in their favor. createError and the H3 layer accept the new names too (see the
// createError calls in blog/[slug].vue), so nothing depends on the deprecated aliases.
const isNotFound = computed(() => props.error.status === 404)
const heading = computed(() => (isNotFound.value ? t('error.notFoundTitle') : t('error.serverTitle')))
const message = computed(() => (isNotFound.value ? t('error.notFoundBody') : t('error.serverBody')))

useSeoMeta({ title: () => heading.value, robots: 'noindex' })

function goHome(): Promise<void> {
  return clearError({ redirect: localePath('/') })
}

function goBlog(): Promise<void> {
  return clearError({ redirect: localePath('/blog') })
}
</script>

<template>
  <NuxtLayout name="default">
    <section
      class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center"
    >
      <p class="text-display font-semibold text-muted">
        {{ error.status }}
      </p>
      <h1 class="mt-4 text-h1 text-highlighted">{{ heading }}</h1>
      <p class="mt-3 text-muted">{{ message }}</p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <UButton size="lg" @click="goHome">{{ t('error.goHome') }}</UButton>
        <UButton size="lg" color="neutral" variant="subtle" @click="goBlog">
          {{ t('error.goBlog') }}
        </UButton>
      </div>
    </section>
  </NuxtLayout>
</template>
