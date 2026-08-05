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
// (positioning-strategy v2.0.0 §2, seeded through `PUBLIC_TAGLINE`); §8 states the rule as "ONE
// VALUE, SEVERAL CONSUMERS — no surface may hard-code its own title", so this renders the contract
// value and never a local string. The approved value is a two-line composition and the break
// travels with it; only the hero opts into displaying that break, and a résumé headline reads it
// as prose, so the newline collapses here exactly as §2 prescribes.
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
// happened). No `ogImage` of its own — web-013 CLOSED F-1 by committing a branded social card, so
// this route inherits the absolute site-wide image `app.vue` emits instead of carrying none.
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

    <!-- ONE measure for the whole document, set once rather than per section, so the identity
         block, the section rules and both rails share a single left and right edge. A résumé is
         read as one sheet; three independently constrained blocks read as three cards.

         `4xl`, where `/experience` uses `3xl`: the rail spends 10rem of the measure before any
         content starts, so at `3xl` the content column came out ~176px NARROWER than the timeline
         it is supposed to be denser than. At `4xl` the two pages have the same content measure and
         this one simply spends fewer vertical inches on it. Prose is exempt — the summary keeps
         its own narrower measure below, because a 720px line of running text is not readable. -->
    <div class="mt-8 max-w-4xl print:mt-0">
      <!-- ── Identity ───────────────────────────────────────────────────────────────────
           A résumé leads with who this is, so the name is the h1, the governed positioning
           line sits directly beneath it, and the summary follows. Name and positioning come
           from Site Settings. -->
      <header>
        <p class="kicker text-dimmed print:hidden">{{ t('nav.resume') }}</p>

        <h1 class="mt-3 nameplate font-display text-display text-highlighted text-balance print:mt-0">
          {{ name ?? t('resume.title') }}
        </h1>

        <p v-if="tagline" class="mt-3 font-display text-h3 text-muted text-pretty">{{ tagline }}</p>

        <!-- The summary positioning-strategy v2.0.0 §8 asks a résumé to carry: "Headline =
             displayed title; summary carries the hero description's substance". It is the
             SAME governed string the hero renders (`home.hero.valueProp`, the approved hero
             description of §2), reused rather than re-authored — a résumé-only paraphrase
             would be a second source of truth for the one approved sentence, one edit away
             from the two surfaces describing the same person differently. This is the
             established idiom on this page, which already reuses the skill-group labels and
             the employment-type labels for exactly that reason. -->
        <p class="mt-4 max-w-2xl text-body text-muted text-pretty">{{ t('home.hero.valueProp') }}</p>

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

        <ResumeActions class="mt-6" :resume="resume" />
      </header>

      <!-- ── Experience ─────────────────────────────────────────────────────────────────
           The SAME records as /experience, from the same composable, in the API's order,
           rendered compactly (FR-PUB-024).

           The section label is a `kicker` rather than a display-sized heading: on a résumé the
           roles are the content and the section name is only a signpost, so it takes the
           smallest structural register the design system has and a hairline rule carries the
           separation instead of a stack of empty margin. `kicker` is also the locale-aware
           device — it drops the mono/uppercase/tracked treatment under the Arabic root, which a
           hand-rolled `font-mono uppercase tracking-wide` label does not. -->
      <section class="mt-10 border-t border-default pt-8 print:mt-6 print:pt-4" :aria-labelledby="'resume-experience'">
        <h2 id="resume-experience" class="kicker text-muted">
          {{ t('resume.experienceTitle') }}
        </h2>

        <div
          v-if="experiences.error.value"
          class="mt-6 rounded-card border border-default bg-elevated p-6"
          role="alert"
        >
          <p class="font-display text-h3 text-highlighted">{{ t('resume.experienceErrorTitle') }}</p>
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
             off. Order is the API's, rendered verbatim — no client-side sort. The API owns it
             (`isCurrent DESC → startDate DESC → order ASC → id ASC`, D02-11) and re-deriving it
             here would put a second, silently divergent ordering in the Web app. -->
        <ol v-else class="mt-6 flex flex-col gap-7" :aria-label="t('resume.experienceListLabel')">
          <ResumeEntry
            v-for="experience in entries"
            :key="experience.id"
            :experience="experience"
          />
        </ol>
      </section>

      <!-- ── Skills ─────────────────────────────────────────────────────────────────────
           The Skill registry's own groups and order — which IS the approved taxonomy
           (positioning-strategy v2.0.0 §5: Languages · Frontend Engineering · Backend
           Engineering · Delivery & Quality, in that order, unrated). No proficiency
           percentages, no years-per-skill, no résumé-only list: §5 and §9 both ban rating a
           skill, and a résumé-only list would be a second source of truth. Exclusion from the
           taxonomy is a server-side visibility concern (§5, "hidden, never deleted"), so this
           surface renders what the public listing returns and filters nothing itself. -->
      <section class="mt-10 border-t border-default pt-8 print:mt-6 print:pt-4" :aria-labelledby="'resume-skills'">
        <h2 id="resume-skills" class="kicker text-muted">
          {{ t('resume.skillsTitle') }}
        </h2>

        <div
          v-if="skills.error.value"
          class="mt-6 rounded-card border border-default bg-elevated p-6"
          role="alert"
        >
          <p class="font-display text-h3 text-highlighted">{{ t('resume.skillsErrorTitle') }}</p>
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
            class="resume-entry break-inside-avoid sm:grid sm:grid-cols-[10rem_1fr] sm:gap-x-4"
          >
            <!-- The contract's `group` is an ENUM TOKEN (`LANGUAGE`…`DELIVERY`), not a label.
                 Its localized labels already exist for the home capabilities section, so they are
                 REUSED here — a résumé-only copy of the same four strings would be exactly the
                 second source of truth FR-PUB-024 forbids, one translation drift away from the
                 two surfaces naming the same group differently. They already carry the §5 wording
                 in both locales, so the approved taxonomy needs no résumé-side restatement. -->
            <dt class="kicker text-dimmed sm:pt-1">
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
    </div>
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

  /**
   * PRINT TYPE IS RESTATED IN PHYSICAL UNITS, by redefining the scale's own custom properties
   * for this subtree rather than by overriding utilities one at a time.
   *
   * The screen scale is fluid and viewport-derived: `--text-display` is
   * `clamp(2.5rem, 1.3rem + 5vw, 4rem)`, which at an A4 content width (~794px at 96dpi) resolves
   * to about 60px ≈ 45pt. That is a poster, not a résumé headline, and it spent most of the first
   * sheet on the name. Every `text-*` utility reads `var(--text-*)`, so redefining the tokens on
   * `.resume-page` re-scales the whole document in one place and no utility is duplicated.
   *
   * THIS LIST IS EXPLICIT AND CLOSED-ENDED — custom properties have no wildcard. Any token in the
   * scale that is NOT named below keeps its viewport-derived screen definition on paper. Adding a
   * token to the scale therefore means adding it here too; nothing detects the omission for you.
   * `--text-mega` is listed for exactly that reason: it is not used under `.resume-page` today, so
   * it changes no output, but leaving it out is what makes the next omission look normal.
   *
   * The values are the conventional print register for a CV: 20pt name, 10pt body, 8.5pt
   * captions, and a section label that reads as a label rather than a heading.
   */
  .resume-page {
    --text-mega: 24pt;
    --text-display: 20pt;
    --text-h1: 16pt;
    --text-h2: 13pt;
    --text-h3: 11.5pt;
    --text-body-lg: 10.5pt;
    --text-body: 10pt;
    --text-body-sm: 9.5pt;
    --text-caption: 8.5pt;

    font-size: 10pt;
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

  /**
   * ...and settle there INSTANTLY. The contact links carry `transition-colors` for their hover
   * treatment, so switching to print media starts a colour transition rather than applying one —
   * and a running transition outranks `!important`. Measured on the print render: the links were
   * still `oklab(0.3646 …)`, a mid-grey, for the length of the transition. Whether the rasteriser
   * catches that frame is a race, and a résumé that sometimes prints grey links is not a print
   * deliverable. Nothing on paper animates, so nothing on paper needs a transition.
   */
  .resume-page * {
    transition: none !important;
    animation: none !important;
  }

  .resume-page {
    max-width: none !important;
    padding: 0 !important;
  }

  /* The single document measure is a screen concern — on paper the sheet margin (`@page`) is
     the measure, and a 56rem cap would leave a wide empty gutter on A4 and on Letter alike. The
     summary's own narrower measure is released with it: a printed sheet is already a narrow
     column, so constraining prose twice would only lengthen the document. */
  .resume-page .max-w-4xl,
  .resume-page .max-w-2xl {
    max-width: none !important;
  }

  /**
   * Impact-bullet markers survive the ink rule. They are `background-color` on an empty span —
   * a decorative dot with no glyph — so `background: transparent` above erased every one of them
   * and the printed bullets became bare indented lines. Measured on the print render before this
   * rule existed. Black rather than the accented border token: the printed document is a
   * one-colour document by design.
   *
   * `print-color-adjust: exact` IS REQUIRED HERE and is not belt-and-braces. Chrome ships its print
   * dialog with "Background graphics" unchecked, Firefox with "Print backgrounds" off, and Safari
   * likewise; under those defaults the browser paints NO element background whatever the stylesheet
   * says, and this marker is nothing but a background. Without it the rule above is honoured in the
   * test environment and silently dropped on real paper — `page.emulateMedia({ media: 'print' })`
   * rasterises like a screen render, so every print test in this repo would keep passing while the
   * bullets vanished in the only place that matters. The property is scoped to this one decorative
   * dot deliberately: the sheet-wide policy of NOT forcing colour (see the ink rule above) stands.
   */
  .resume-page .resume-bullet {
    background: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
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

  /* A section rule landing as the first mark on a sheet would read as a stray line. What prevents
     it is the `break-after: avoid` on the headings above — the rule is drawn by the section's
     heading block, so keeping the heading with what follows keeps the rule with it.

     There was a `.resume-page section { break-before: auto }` here claiming to do this. It did
     nothing: `auto` is the initial value of `break-before` and nothing in this app, Tailwind's
     preflight or Nuxt UI sets that property, so it overrode nothing. Removed rather than left to
     look like a solved problem. `break-inside: avoid` on the section is NOT substituted for it —
     that would try to hold an entire Experience section on one sheet and push a large blank area
     onto the previous one, which is worse than the stray line it would prevent. */

  /* Prose that survives a page break breaks with company, not one stranded line.
     Both values restate the CSS initial value; they are declared explicitly because this sheet's
     whole point is that the printed register is stated rather than inherited, and a future reader
     changing the pagination rules should see the intended minimum. Do not read them as the cause
     of the behaviour — remove them and printed prose still keeps two lines together. */
  .resume-page p,
  .resume-page li {
    orphans: 2;
    widows: 2;
  }

  /* Nothing on the printed page may overflow the sheet horizontally. */
  .resume-page * {
    overflow: visible !important;
  }
}
</style>
