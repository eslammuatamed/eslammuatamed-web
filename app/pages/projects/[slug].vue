<script setup lang="ts">
import type { ProjectDetail } from '~/types/models'

// Case study (FR-PUB-031, FR-PUB-033). The eight FR-CNT-020 long-form fields are opaque Markdown in the
// contract and render through the single sanitizing ContentProse surface (D12-4, D19-5).
const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const resolveRedirect = useSlugRedirect()
// Called before the first await so it runs in a valid Nuxt context (auto-import caution); the returned
// setter is invoked once the project resolves.
const setI18nParams = useSetI18nParams()

const slug = computed(() => String(route.params.slug))

const { data: project, error } = await useProjectDetail(() => slug.value)

/**
 * A 404 is not immediately terminal. A published project whose slug was renamed keeps its old URL
 * working through the redirect table (D04-6), so the resolver is consulted BEFORE the error page:
 *   200 → navigate to the current slug (301: the old URL is permanently superseded);
 *   404 → no redirect exists, so this really is not found;
 *   any other status → rethrown by the resolver, and `projectErrorParams` preserves it, because a
 *                      transient 5xx must never be published as a deindexable 404 (review MAJOR-1).
 * `toPath` is section-relative, so it is localized before navigating.
 */
if (error.value) {
  if (isNotFound(error.value)) {
    const toPath = await resolveRedirect(`/projects/${slug.value}`)
    if (toPath) {
      await navigateTo(localePath(toPath), { redirectCode: 301, replace: true })
    }
  }
  throw createError({ ...projectErrorParams(error.value), fatal: true })
}

if (!project.value) {
  throw createError({ status: 404, statusText: 'Project not found', fatal: true })
}

// Register each locale's own slug as its route param (F-P5): EN and AR slugs differ, so without this
// the language switcher and hreflang alternates would reuse THIS locale's slug and 404.
setI18nParams(
  Object.fromEntries(
    Object.entries(project.value.slugs).map(([code, value]): [string, { slug: string }] => [
      code,
      { slug: value }
    ])
  )
)

/**
 * The FR-CNT-020 narrative in reading order: what it is → why it existed → what was built → my part →
 * how it was built → what was hard → what it does → what it taught. A field the owner left empty
 * renders nothing at all, so an unfinished case study never shows an orphan heading over blank space.
 */
const SECTION_KEYS = [
  'overview',
  'businessProblem',
  'solution',
  'role',
  'architecture',
  'challenges',
  'features',
  'lessonsLearned'
] as const satisfies readonly (keyof ProjectDetail)[]

const sections = computed(() =>
  SECTION_KEYS.map(key => ({ key, body: String(project.value?.[key] ?? '').trim() })).filter(
    section => section.body.length > 0
  )
)

const crumbs = computed(() => [
  { label: t('nav.home'), to: '/' },
  { label: t('nav.projects'), to: '/projects' },
  { label: project.value?.title ?? '' }
])

// CreativeWork + BreadcrumbList (doc 22 §4), built from the SAME crumbs the template renders so the
// markup and the structured data cannot disagree.
useProjectSchema(project, crumbs)

useSeoMeta({
  title: () => project.value?.metaTitle || project.value?.title,
  description: () => project.value?.metaDescription || project.value?.summary,
  ogTitle: () => project.value?.metaTitle || project.value?.title,
  ogDescription: () => project.value?.metaDescription || project.value?.summary,
  ogType: 'article'
})
</script>

<template>
  <UContainer v-if="project" class="py-[var(--space-section)]">
    <UiBreadcrumbs :items="crumbs" :label="t('projects.breadcrumbLabel')" />

    <article class="mt-10">
      <header class="max-w-3xl">
        <p v-if="project.year" class="kicker text-dimmed">{{ project.year }}</p>
        <h1 class="mt-4 font-display text-display text-highlighted text-balance">
          {{ project.title }}
        </h1>
        <p class="mt-5 text-body-lg text-muted text-pretty">{{ project.summary }}</p>

        <!-- <bdi> isolates Latin technology names inside Arabic prose so the bidi algorithm cannot
             reorder them against neighbouring RTL text (doc 21). -->
        <ul
          v-if="project.technologies.length"
          class="mt-7 flex flex-wrap gap-x-4 gap-y-1 font-mono text-caption text-dimmed"
        >
          <li v-for="tech in project.technologies" :key="tech.id"><bdi>{{ tech.label }}</bdi></li>
        </ul>

        <ProjectLinks class="mt-7" :live-url="project.liveUrl" :repo-url="project.repoUrl" />
      </header>

      <div class="mt-14 flex flex-col gap-14">
        <section v-for="section in sections" :key="section.key">
          <h2 class="font-display text-h2 text-highlighted">
            {{ t(`projects.sections.${section.key}`) }}
          </h2>
          <ContentProse
            class="mt-5"
            :source="section.body"
            :cache-key="`${project.id}:${section.key}:${locale}`"
          />
        </section>
      </div>

      <!-- Omitted entirely when the owner has not attached media yet — currently every seeded project
           has an empty gallery, so this is the normal state, not an edge case. -->
      <ProjectGallery
        v-if="project.gallery.length"
        class="mt-16 block"
        :items="project.gallery"
        :heading="t('projects.gallery.heading')"
      />
    </article>

    <ProjectContactCta class="mt-20" />
  </UContainer>
</template>
