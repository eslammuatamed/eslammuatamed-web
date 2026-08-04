<script setup lang="ts">
// Résumé (FR-PUB-023/024) — the printable HTML résumé plus the download action for the
// owner-maintained PDF. The header and the mobile drawer have linked `/resume` since 007; this
// page is what that link resolves to.
//
// EVERY WORD ON THIS PAGE IS EITHER A UI LABEL OR CONTRACT DATA. There is no résumé content in
// this repository: identity comes from Site Settings, roles from `/experiences`, and the stack
// from `/skills` — the same reads the rest of the public site uses (FR-PUB-024). The PDF is an
// opaque owner-maintained asset referenced by descriptor and is NEVER parsed to build this page.
const { t } = useI18n()
const localePath = useLocalePath()

const { settings, experiences, skills } = useResumeData()

// Identity, taken verbatim. `tagline` is the ONE governed public title
// (positioning-strategy v1.1.0, seeded through `PUBLIC_TAGLINE`); no surface may hard-code its
// own, so this renders the contract value and never a local string.
const name = computed(() => settings.data.value?.siteName ?? null)
const tagline = computed(() => settings.data.value?.tagline ?? null)

// The CV/outreach address — never `contactEmail`, never the admin auth address, and omitted
// entirely when null (see `resumeEmail`).
const email = computed(() => (settings.data.value ? resumeEmail(settings.data.value) : null))
const links = computed(() => resumeLinks(settings.data.value?.profileLinks))

// `resumeAsset` is the resolved descriptor; the bare id is admin-only and never reaches the
// public payload at all, so there is nothing here that could leak it.
const resume = computed(() => settings.data.value?.resumeAsset ?? null)

const entries = computed(() => experiences.data.value ?? [])
const skillGroups = computed(() => groupSkills(skills.data.value ?? []))

// Per-section state. Each read fails independently (NFR-DEGRADE): a dead `/skills` must degrade
// the Skills section alone, never blank a résumé whose Experience arrived.
const experiencesEmpty = computed(() => !!experiences.data.value && entries.value.length === 0)
const skillsEmpty = computed(() => !!skills.data.value && skillGroups.value.length === 0)

const crumbs = computed(() => [{ label: t('nav.home'), to: '/' }, { label: t('nav.resume') }])

const siteConfig = useSiteConfig()

// BreadcrumbList ONLY. D22-8 names this route explicitly: "/experience and /resume do not
// duplicate the full ProfilePage identity unless a later Web specification identifies a
// standards-supported need." Feature 010 identifies none — schema.org has no résumé type, and a
// second ProfilePage (or a second Person) would be the contradictory duplicate identity D22-8
// forbids. The site-wide `Person` is already emitted globally and is referenced by @id.
useSchemaOrg(() => [
  defineBreadcrumb({
    itemListElement: crumbs.value.map(crumb => ({
      name: crumb.label,
      item: crumb.to ? `${siteConfig.url}${localePath(crumb.to)}` : undefined
    }))
  })
])

// Title, description and OG/Twitter title+description only. Canonical, hreflang/x-default,
// og:locale, og:url and <html lang/dir> belong to @nuxtjs/i18n under strict SEO (D22-7) —
// writing them here would duplicate the tags and fight the global owner (that is how F-3
// happened). No `ogImage`: F-1 remains open (no branded social-image fallback exists), and
// emitting a URL that does not resolve is worse than inheriting nothing.
useSeoMeta({
  title: () => t('seo.resume.title'),
  description: () => t('seo.resume.description'),
  ogTitle: () => `${t('seo.resume.title')} — ${t('brand.name')}`,
  ogDescription: () => t('seo.resume.description'),
  twitterTitle: () => `${t('seo.resume.title')} — ${t('brand.name')}`,
  twitterDescription: () => t('seo.resume.description')
})
</script>

<template>
  <UContainer class="resume-page py-[var(--space-section)]">
    <UiBreadcrumbs
      class="print:hidden"
      :items="crumbs"
      :label="t('resume.breadcrumbLabel')"
    />

    <!-- ── Identity ─────────────────────────────────────────────────────────────────────
         A résumé leads with who this is, so the name is the h1 and the governed positioning
         line sits directly beneath it. Both come from Site Settings. -->
    <header class="mt-10 max-w-3xl print:mt-0">
      <p class="kicker text-dimmed print:hidden">{{ t('nav.resume') }}</p>

      <h1 class="mt-4 font-display text-display text-highlighted text-balance print:mt-0">
        {{ name ?? t('resume.title') }}
      </h1>

      <p v-if="tagline" class="mt-3 text-body-lg text-muted text-pretty">{{ tagline }}</p>

      <!-- Contact row: the professional email and the owner's public links, in API order.
           A list, so it is announced with a count rather than as a run of adjacent links.
           No phone number and no postal address — neither is required by FR-PUB-023 and a
           résumé page is a public URL. -->
      <ul
        v-if="email || links.length"
        class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm"
        :aria-label="t('resume.contactLabel')"
      >
        <li v-if="email">
          <a
            class="text-muted underline decoration-default underline-offset-4 transition-colors hover:text-default print:no-underline"
            :href="`mailto:${email}`"
          >{{ email }}</a>
        </li>
        <li v-for="link in links" :key="link.url">
          <a
            class="text-muted underline decoration-default underline-offset-4 transition-colors hover:text-default print:no-underline"
            :href="link.url"
            rel="noopener me"
            target="_blank"
          >{{ link.label }}</a>
        </li>
      </ul>

      <ResumeActions class="mt-8" :resume="resume" />
    </header>

    <!-- ── Experience ───────────────────────────────────────────────────────────────────
         The SAME records as /experience, from the same composable, in the API's order,
         rendered compactly (FR-PUB-024). -->
    <section class="mt-14 max-w-3xl print:mt-8" :aria-labelledby="'resume-experience'">
      <h2 id="resume-experience" class="font-display text-h2 text-highlighted">
        {{ t('resume.experienceTitle') }}
      </h2>

      <div
        v-if="experiences.error.value"
        class="mt-6 rounded-card border border-default bg-elevated p-6"
        role="alert"
      >
        <p class="font-display text-h4 text-highlighted">{{ t('resume.experienceErrorTitle') }}</p>
        <p class="mt-2 text-body-sm text-muted">{{ t('resume.experienceErrorBody') }}</p>
        <UButton
          class="print:hidden mt-4"
          variant="subtle"
          color="neutral"
          @click="experiences.refresh()"
        >
          {{ t('common.retry') }}
        </UButton>
      </div>

      <p v-else-if="experiencesEmpty" class="mt-6 text-body-sm text-muted">
        {{ t('resume.experienceEmpty') }}
      </p>

      <!-- An ORDERED list: reverse-chronological order is meaningful and must survive with CSS
           off. Order is the API's, rendered verbatim — no client-side sort. -->
      <ol v-else class="mt-6 flex flex-col" :aria-label="t('resume.experienceListLabel')">
        <ResumeEntry
          v-for="experience in entries"
          :key="experience.id"
          :experience="experience"
        />
      </ol>
    </section>

    <!-- ── Skills ───────────────────────────────────────────────────────────────────────
         The Skill registry's own groups and order. No proficiency percentages, no
         years-per-skill, no résumé-only list — none of those exist in the contract and
         inventing them would be a second source of truth. -->
    <section class="mt-12 max-w-3xl print:mt-8" :aria-labelledby="'resume-skills'">
      <h2 id="resume-skills" class="font-display text-h2 text-highlighted">
        {{ t('resume.skillsTitle') }}
      </h2>

      <div
        v-if="skills.error.value"
        class="mt-6 rounded-card border border-default bg-elevated p-6"
        role="alert"
      >
        <p class="font-display text-h4 text-highlighted">{{ t('resume.skillsErrorTitle') }}</p>
        <p class="mt-2 text-body-sm text-muted">{{ t('resume.skillsErrorBody') }}</p>
        <UButton
          class="print:hidden mt-4"
          variant="subtle"
          color="neutral"
          @click="skills.refresh()"
        >
          {{ t('common.retry') }}
        </UButton>
      </div>

      <p v-else-if="skillsEmpty" class="mt-6 text-body-sm text-muted">
        {{ t('resume.skillsEmpty') }}
      </p>

      <dl v-else class="mt-6 flex flex-col gap-4">
        <div
          v-for="skillGroup in skillGroups"
          :key="skillGroup.group"
          class="resume-entry break-inside-avoid sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4"
        >
          <!-- The contract's `group` is an ENUM TOKEN (`LANGUAGE`…`PRACTICE`), not a label.
               Its localized labels already exist for the home capabilities section, so they are
               REUSED here — a résumé-only copy of the same four strings would be exactly the
               second source of truth FR-PUB-024 forbids, one translation drift away from the
               two surfaces naming the same group differently. -->
          <dt class="font-mono text-caption text-dimmed uppercase tracking-wide sm:pt-0.5">
            {{ t(`home.techStack.group.${skillGroup.group}`) }}
          </dt>
          <dd class="mt-1.5 sm:mt-0">
            <ul class="flex flex-wrap gap-1.5">
              <li
                v-for="skill in skillGroup.skills"
                :key="skill.id"
                class="rounded-full border border-default px-2.5 py-0.5 font-mono text-caption text-muted"
              >
                {{ skill.label }}
              </li>
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  </UContainer>
</template>

<style>
/* ── Print (FR-PUB-023: "printable HTML page") ──────────────────────────────────────────
   Unscoped on purpose: the rules that hide the global header and footer target elements
   this page does not own, and a `scoped` block cannot reach them. The `.resume-page`
   ancestor selector keeps every rule confined to this route, so no other page is affected.

   Paper size is deliberately NOT forced. No governing document fixes one, and `@page { size:
   A4 }` would override the user's own paper choice — a US Letter printer would then either
   scale or clip. The layout is fluid and fits both; the margin is set in `cm` so it is
   physically identical on either sheet. */
@page {
  margin: 1.5cm;
}

@media print {
  /**
   * Chrome is furniture. The sticky header, the colophon footer, the skip link and the
   * back-to-top control carry no résumé content and would cost most of a page between them.
   *
   * SCOPED TO LAYOUT-LEVEL SIBLINGS OF `<main>`, not to `header`/`footer` by tag. The page's OWN
   * identity block is a `<header>` too — it holds the name, the positioning line and the contact
   * row — so a bare `header { display: none }` printed a résumé with no name on it. This selects
   * "every child of the element that contains `#main-content`, except `#main-content` itself",
   * which reaches exactly the shell and cannot reach anything inside the page.
   *
   * GATED ON `body:has(.resume-page)`. These selectors target elements this page does not own,
   * and a page component's <style> block is injected globally and STAYS loaded after a
   * client-side navigation away. Without the gate, printing `/about` after having visited
   * `/resume` in the same session would silently lose its chrome. CSS-only — no JS, no cleanup
   * hook to forget.
   */
  body:has(.resume-page) :has(> #main-content) > *:not(#main-content) {
    display: none !important;
  }

  /* Ink efficiency + contrast: the screen theme is a dark-capable token system, and printing
     a dark surface would flood the page. Force a white ground and black text regardless of
     which theme the visitor had on screen — `color-adjust` is NOT set to `exact`, so the
     browser is free to drop remaining decorative colour. */
  .resume-page,
  .resume-page * {
    background: transparent !important;
    box-shadow: none !important;
    color: #000 !important;
  }

  .resume-page {
    max-width: none !important;
    padding: 0 !important;
  }

  /* Borders stay, but as hairlines rather than themed surfaces, so the technology and skill
     chips remain legible groupings instead of dissolving into the text. */
  .resume-page [class*='border'] {
    border-color: #999 !important;
  }

  /* Links: readable as text. URLs are NOT expanded after the label — a résumé's links are
     short, recognisable names, and printing eight raw URLs would add noise and risk a line
     break mid-URL. */
  .resume-page a {
    color: #000 !important;
    text-decoration: none !important;
  }

  /* Pagination. An entry should not be split across a page boundary when it fits whole, and a
     section heading must never be the last thing on a sheet. */
  .resume-page .resume-entry {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .resume-page h1,
  .resume-page h2,
  .resume-page h3 {
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
  }

  .resume-page h2 {
    /* A section heading pulls its first entry with it rather than orphaning at a page foot. */
    margin-top: 0.6cm;
  }

  /* Nothing on the printed page may overflow the sheet horizontally. */
  .resume-page * {
    overflow: visible !important;
  }
}
</style>
