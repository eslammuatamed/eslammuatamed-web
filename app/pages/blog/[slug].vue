<script setup lang="ts">
import type { Article, Envelope } from '~/types/models'

// Article page (FR-PUB-042): body rendered through the single ContentProse surface. Nuxt captures a
// useAsyncData handler throw into `error` (it does NOT re-throw from the awaited call), so we map it
// explicitly after the await: a genuine 404 stays a 404; any other failure keeps its real status
// (review MAJOR-1 — never mask a 5xx/transport error as a deindexable 404).
const { t, locale } = useI18n()
const route = useRoute()
const api = useApi()
// The ROUTE's locale, not the reactive UI locale (D06-6). Article slugs are per-locale (D04-2), so
// during the D03-13 deferred locale commit this page would otherwise request the incoming locale's
// slug in the OUTGOING language and render a 404 for an article that exists. `locale` above stays the
// UI locale — it is used for date formatting, which must match the chrome the visitor is looking at.
const contentLocale = useRouteLocale()
// Call this composable before the await so it runs in a valid Nuxt context (auto-import context
// caution) — the returned setter is invoked once the article resolves.
const setI18nParams = useSetI18nParams()

const slug = computed(() => String(route.params.slug))

const { data: article, error } = await useAsyncData(
  () => `article:${slug.value}:${contentLocale.value}`,
  () =>
    api<Envelope<Article>>(`/articles/${slug.value}`, { locale: contentLocale.value }).then(
      res => res.data
    )
)

if (error.value) {
  throw createError({ ...articleErrorParams(error.value), fatal: true })
}

if (!article.value) {
  throw createError({ status: 404, statusText: 'Article not found', fatal: true })
}

// Register each locale's own slug as its route param (F-P5): the EN and AR slugs differ, so without
// this the switcher and hreflang alternates reuse THIS locale's slug and 404. `setI18nParams` (the
// current @nuxtjs/i18n API) is what `switchLocalePath` reads to resolve the counterpart path.
setI18nParams(
  Object.fromEntries(
    Object.entries(article.value.slugs).map(([code, value]): [string, { slug: string }] => [
      code,
      { slug: value }
    ])
  )
)

const publishedLabel = computed(() =>
  article.value?.publishAt ? formatDate(article.value.publishAt, locale.value) : ''
)

// TIER 1 of the metadata hierarchy (utils/metadata.ts): the article's own localized values win.
// `metaTitle`/`metaDescription` are the authored SEO overrides and are preferred over the display
// title/excerpt — `/projects/{slug}` already did this and the article route did not, so the two
// routes disagreed about whether authored SEO copy was honoured. `pickMeta` also means a
// whitespace-only override falls through instead of rendering a blank tag.
//
// The image is emitted ONLY when the article actually carries one; otherwise every image tag is
// inherited from the committed floor in `app.vue`. Width/height/alt travel WITH the url so they
// always describe the same file.
const siteConfig = useSiteConfig()
const socialImage = computed(() => entitySocialImage(article.value?.ogImage, siteConfig.url))

useSeoMeta({
  title: () => pickMeta(article.value?.metaTitle, article.value?.title),
  description: () => pickMeta(article.value?.metaDescription, article.value?.excerpt),
  ogTitle: () => pickMeta(article.value?.metaTitle, article.value?.title),
  ogDescription: () => pickMeta(article.value?.metaDescription, article.value?.excerpt),
  ogType: 'article',
  ogImage: () => socialImage.value?.url,
  ogImageWidth: () => socialImage.value?.width,
  ogImageHeight: () => socialImage.value?.height,
  ogImageAlt: () => socialImage.value?.alt,
  twitterImage: () => socialImage.value?.url,
  twitterImageAlt: () => socialImage.value?.alt
})
</script>

<template>
  <!-- ONE reading column, centred, at the governed measure — this page is a reading surface, not a
       dashboard, so nothing sits beside the text (015).

       WHAT WAS WRONG, MEASURED. The header and the body used to disagree about their width: the h1
       and the meta line ran the FULL 1216px container while `.content-prose` capped itself at its
       own `68ch`. The result at 1280px and above was a start-aligned body with dead space on the
       end side — 468px in EN, 672px in AR — under a headline three times wider than its own text.
       Both numbers were measured in a real browser, not estimated.

       THE COLUMN OWNS THE MEASURE, NOT THE PROSE. `--measure-prose` is set here on the wrapper and
       `.content-prose` is released with `max-w-none`, so header, lede and body are bounded by ONE
       value that cannot drift. Releasing the prose is also what keeps this change local: the same
       `.content-prose` rule is shared with /about, /projects/{slug} and the two preview routes, and
       narrowing it there is a separate, coordinated decision.

       `text-body-lg` IS THE MEASURE'S BASIS, NOT DECORATION. Doc 03 §3 assigns `body-lg` (18px) to
       article prose; the page was inheriting the 16px UI size. It is set on the WRAPPER because
       `--measure-prose` is in `em`: font-size and column width then resolve against the same
       element, so the character count per line is correct by construction rather than by
       coincidence. -->
  <UContainer v-if="article" class="py-[var(--space-section)]">
    <div class="mx-auto max-w-[var(--measure-prose)] text-body-lg">
      <AppLink to="/blog" class="inline-flex items-center gap-1 text-sm text-link">
        <UIcon name="i-lucide-arrow-left" class="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {{ t('article.back') }}
      </AppLink>

      <article class="mt-10">
        <header>
          <!-- Null when the category has no translation in this locale (D10-20) — the eyebrow is
               then simply absent, exactly as the excerpt below is. -->
          <p v-if="article.category" class="kicker text-dimmed">{{ article.category.name }}</p>
          <h1 class="mt-4 font-display text-h1 text-highlighted text-balance">
            {{ article.title }}
          </h1>
          <!-- The excerpt is required by the contract but may be blank, so it is rendered only when
               it carries something — an empty standfirst would leave a gap the reader has to skip. -->
          <p v-if="article.excerpt" class="mt-5 text-body-lg text-muted text-pretty">
            {{ article.excerpt }}
          </p>
          <!-- Date and reading time are the reader's orientation, so they sit UNDER the title with
               the byline rule, not above it as an eyebrow — the category already holds that slot. -->
          <div
            class="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-default pt-4 text-caption text-muted"
          >
            <time :datetime="article.publishAt ?? undefined">{{ publishedLabel }}</time>
            <span aria-hidden="true">·</span>
            <span>{{ t('blog.minRead', { count: article.readingTimeMin }) }}</span>
          </div>
        </header>

        <ContentProse
          class="mt-10 max-w-none"
          :source="article.body"
          :cache-key="`${article.id}:${locale}`"
        />
      </article>
    </div>
  </UContainer>
</template>
