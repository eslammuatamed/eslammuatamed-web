<script setup lang="ts">
import type { NuxtError } from '#app'

// Locale-aware error page (doc 06 §6). Recovery paths (home, blog) satisfy FR-PUB-004; a 404
// and a 5xx read differently. `clearError` unwinds the error state before navigating.
interface Props {
  error: NuxtError
}

const props = defineProps<Props>()
const { t, locale, localeProperties } = useI18n()
const localePath = useLocalePath()

/**
 * `<html lang dir>` has to be set HERE as well as in `app.vue`.
 *
 * A fatal error renders `error.vue` INSTEAD of `app.vue`, so app.vue's `htmlAttrs` never run — the
 * Arabic 404 and 500 pages were served without `dir="rtl"` and laid out left-to-right. i18n supplies
 * `lang` on its own, which is what made the omission easy to miss: the page looked localized while
 * every RTL behaviour was wrong. Caught by the SSR scenario lane's unknown-slug test.
 */
const activeLocale = computed(() => localeProperties.value)
useHead(() => ({
  htmlAttrs: {
    lang: activeLocale.value?.language ?? locale.value,
    dir: activeLocale.value?.dir ?? 'ltr'
  }
}))

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
