<script setup lang="ts">
import type { ProjectDetail } from '~/types/models'

// Draft-preview of a project (D10-11). There is no public project detail page yet, so this renders
// the draft directly: header, meta, and each long-form section through the single `ContentProse`
// surface — the same renderer the live pages will use. All security (noindex, no-referrer, no token
// leak, opaque failure) lives in `usePreview`.
definePageMeta({ layout: 'preview', middleware: 'preview-locale' })

const { t, locale } = useI18n()
const { document: project, unavailable } = await usePreview<ProjectDetail>('projects')

// Long-form Markdown sections, in reading order; empty sections are skipped so a partial draft reads
// cleanly. Each is rendered through `ContentProse`, keyed per section + locale.
const sections = computed(() => {
  const p = project.value
  if (!p) return []
  return ([
    ['overview', p.overview],
    ['businessProblem', p.businessProblem],
    ['solution', p.solution],
    ['role', p.role],
    ['architecture', p.architecture],
    ['challenges', p.challenges],
    ['features', p.features],
    ['lessonsLearned', p.lessonsLearned]
  ] as const).filter(([, body]) => body.trim().length > 0)
})

const gallery = computed(() => [...(project.value?.gallery ?? [])].sort((a, b) => a.order - b.order))
</script>

<template>
  <PreviewUnavailable v-if="unavailable" />

  <UContainer v-else-if="project" class="py-16">
    <article>
      <header class="mb-8">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span v-if="project.year">{{ t('preview.project.year') }}: {{ project.year }}</span>
        </div>
        <h1 class="mt-4 text-h1 text-highlighted">{{ project.title }}</h1>
        <p class="mt-3 max-w-2xl text-lg text-muted">{{ project.summary }}</p>

        <div v-if="project.technologies.length" class="mt-4 flex flex-wrap gap-2">
          <UBadge
            v-for="tech in project.technologies"
            :key="tech.id"
            color="neutral"
            variant="subtle"
          >
            {{ tech.label }}
          </UBadge>
        </div>

        <div v-if="project.liveUrl || project.repoUrl" class="mt-6 flex flex-wrap gap-3">
          <UButton
            v-if="project.liveUrl"
            :to="project.liveUrl"
            target="_blank"
            rel="noopener noreferrer"
            icon="i-lucide-external-link"
            variant="subtle"
          >
            {{ t('preview.project.liveUrl') }}
          </UButton>
          <UButton
            v-if="project.repoUrl"
            :to="project.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            icon="i-lucide-github"
            color="neutral"
            variant="subtle"
          >
            {{ t('preview.project.repoUrl') }}
          </UButton>
        </div>
      </header>

      <div class="space-y-10">
        <section v-for="[key, body] in sections" :key="key">
          <h2 class="mb-3 text-h2 text-highlighted">{{ t(`preview.project.${key}`) }}</h2>
          <ContentProse :source="body" :cache-key="`preview:project:${project.id}:${key}:${locale}`" />
        </section>

        <section v-if="gallery.length">
          <h2 class="mb-3 text-h2 text-highlighted">{{ t('preview.project.gallery') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <figure v-for="item in gallery" :key="item.mediaAssetId">
              <NuxtImg
                :src="item.mediaAsset.url"
                :alt="item.mediaAsset.alt ?? item.caption ?? ''"
                :width="item.mediaAsset.width"
                :height="item.mediaAsset.height"
                loading="lazy"
                class="w-full rounded-card"
              />
              <figcaption v-if="item.caption" class="mt-2 text-caption text-muted">
                {{ item.caption }}
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
    </article>
  </UContainer>
</template>
