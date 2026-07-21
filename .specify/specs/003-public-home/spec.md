# Feature Specification: Public Home Page

**Feature Branch**: `feat/003-public-home` (off Web `dev` `a7106f8`)

**SpecKit ID**: `003-public-home` · **Milestone**: M4 (Public Site — first slice) · **Repo**: `eslammuatamed-web`

**Created**: 2026-07-21

**Status**: Draft

**Input**: Owner directive — begin the Website/Homepage implementation phase. Deliver the full
designed public **Home page** (doc 02 §3 Home, FR-PUB-010…017) consuming the existing API
contract, both locales, to `dev` only (Release Freeze remains active — no promotion/deploy).

---

## Context & Scope Boundary

The M1 walking skeleton shipped a **hero-only** home page fed solely by `GET /settings/site`
(`siteName`, `tagline`, `availabilityStatus`). This feature builds the **complete designed home
page** — the primary hiring-manager surface (flow F-P1) and the site's routing hub (doc 04 §5).

**This is a Web-only feature.** Every data source already exists and is public:
`GET /settings/site` (M1), `GET /projects` featured-first, `GET /experiences`, `GET /skills`,
`GET /testimonials` (F002 — shipped + deployed 2026-07-16), `GET /articles` (M1). The Web
contract (`openapi/openapi.json` → `app/types/api.d.ts`) **already contains** every consumed
shape. **No API code, schema, migration, or contract change is in scope** (WD-1).

**Prerequisite (separate ownership):** the API dev seed produces no relational content
(`prisma/seed.ts` = locales + OWNER + settings + categories only). A **dev/demo seed** is
required to build and verify against real data — delivered as a separate API-repo PR (see
`plan.md` §Cross-repo). It never touches the production seed (WD-2).

**Milestone split (doc-first decision, D24-5):** the roadmap's M4 "Public Site Complete" is
delivered in slices; this feature is the **home page**. Remaining public pages (`/projects`
index + `/projects/{slug}` case study, `/experience`, `/about`, `/uses`, `/resume`, `/contact`)
are a follow-on feature. The home page links to those routes; where a target page is not yet
built it returns 404 — the established walking-skeleton state (PROJECT_GUIDE §12). The home
page's own conversion path (contact) stays functional via `mailto` (D05-4). **Public production
promotion is gated on the owner and on at least the projects index + one case-study detail
existing** so the F-P1 routing-hub journey works (see `plan.md` §Production-release next action).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Hiring manager "Scan" (Priority: P1) 🎯 MVP

A hiring manager (persona P1) lands on `/` from a CV/LinkedIn link. In one viewport the hero
answers **who, what level, available?** (FR-PUB-010). Scrolling, they see the **tech stack**
(FR-PUB-011), **three featured projects** with case-study framing (FR-PUB-012), and an
**experience timeline summary** (FR-PUB-013). Every section header can route deeper (doc 04 §5).
The whole experience is available identically in English and Arabic (RTL).

**Why this priority**: This is the platform's north-star journey (F-P1, doc 01 §4). Without it
the home page fails its one job. It is the smallest slice that delivers real value.

**Independent Test**: With the dev API + demo seed running, load `/` and `/ar` — the hero,
tech-stack, featured-projects, and experience sections render live API content in both locales
with correct RTL; each renders a designed loading, empty, and error state; no hydration
mismatch; Lighthouse and axe clean.

**Acceptance Scenarios**:

1. **Given** the API returns site settings + ≥3 published featured projects + experiences +
   skills, **When** a visitor loads `/`, **Then** the hero (name, role, availability, primary
   "view work" + secondary "contact" CTAs), a tech-stack section, exactly the top 3 featured
   projects as cards, and an experience summary all render server-side.
2. **Given** the same, **When** the visitor loads `/ar`, **Then** the identical structure
   renders mirrored (RTL), Arabic content from the API, Arabic font, no letter-spacing on
   headings, and directional icons/timeline flow mirrored.
3. **Given** `GET /projects` returns zero featured projects, **When** the page renders,
   **Then** the featured-projects section is omitted entirely (no broken/empty cards) and the
   rest of the page is unaffected.
4. **Given** `GET /experiences` fails (5xx) while other sections succeed, **When** the page
   renders, **Then** only the experience section shows its inline error/retry affordance; the
   hero, tech stack, and featured projects still render (per-section error isolation).

### User Story 2 — Reach & orient (Priority: P2)

Any visitor can reach a contact path and the owner's professional links from the home page and
global chrome: a **contact section** with a direct email and a link to the contact form
(FR-PUB-017), a footer with **social links, availability status, and a resume link**
(FR-PUB-003), and a contact CTA reachable without scrolling (FR-PUB-005, already in the header).

**Why this priority**: Conversion (P1/P3) and recruiter orientation (P2). The footer wiring is a
launch-blocking global `Must` currently stubbed out.

**Independent Test**: Footer renders `profileLinks` from `GET /settings/site` as accessible
external links (correct `rel`/`target`, RTL-aware icons), the availability status, and a resume
link pointing at `settings.resumeAsset` when present (hidden when absent); the home contact
section exposes a working `mailto:` and a link to `/contact`.

**Acceptance Scenarios**:

1. **Given** settings include `profileLinks` and `resumeAsset`, **When** any public page renders,
   **Then** the footer lists each social link (single accessible link, external-safe) and a
   resume link/download; **When** `resumeAsset` is null, the resume link is omitted gracefully.
2. **Given** the contact section, **When** a visitor activates the direct-email affordance,
   **Then** a `mailto:` opens; **When** they activate "contact form", **Then** they navigate to
   `/contact` (which may 404 until built — the email path always works, D05-4).

### User Story 3 — Recent writing & social proof (Priority: P3)

A visitor sees the **3 latest articles** (FR-PUB-014) linking to the built `/blog/{slug}`
pages, and **curated testimonials** (FR-PUB-016) for social proof (persona P3/P4).

**Why this priority**: Both are `Should` requirements. Latest articles link to already-built
blog pages (real, non-404 depth). Testimonials strengthen the P3 journey.

**Independent Test**: With ≥3 published articles and ≥2 visible testimonials seeded, both
sections render in both locales with loading/empty/error states; article cards link to
`/blog/{slug}`; empty responses omit the section.

**Acceptance Scenarios**:

1. **Given** ≥1 published article, **When** the home page renders, **Then** up to 3 latest
   article cards show (title, excerpt, reading time, category, cover image via `<NuxtImg>`) and
   link to `/blog/{slug}`; **Given** zero articles, the section is omitted.
2. **Given** ≥1 visible testimonial, **When** the home page renders, **Then** testimonials
   render as a linear (non-carousel) layout; **Given** zero, the section is omitted.

### Edge Cases

- **Total API outage (SSR):** `GET /settings/site` fails → the existing designed
  API-unavailable state renders with retry (styled error, not a blank/500). The page never
  renders a broken shell.
- **Partial data:** any single section's endpoint failing must not blank the page (per-section
  isolation); any section's empty result omits that section.
- **Missing media:** article cover / testimonial avatar descriptor `null` → render without image
  (no broken `<img>`), layout reserved to avoid CLS.
- **Locale with missing translation:** should not occur (locale parity); if a field is absent the
  section degrades gracefully rather than showing raw keys.
- **Theme/locale switch:** no flash of wrong theme (pre-hydration script), route preserved on
  locale switch (F-P5).
- **Reduced motion:** hero/section entrance animation collapses to ≤120 ms opacity or none.
- **200% zoom / 320 px viewport:** no horizontal scroll, no content loss (WCAG reflow).

## Requirements *(mandatory)*

### Functional Requirements (home page — doc 02 §3)

- **FR-PUB-010** (M): Hero — name, role positioning, availability status, primary CTA (view work)
  + secondary CTA (contact). Sourced from `GET /settings/site` (`siteName`, `tagline`,
  `availabilityStatus`) + i18n role copy. Hero is the LCP surface.
- **FR-PUB-011** (M): Tech stack section from `GET /skills`, grouped
  (LANGUAGE/FRAMEWORK/TOOLING/PRACTICE), technology brand colors as **accents only** (`UiTechBadge`
  + `--brand-*` tokens, one color per element, never UI chrome).
- **FR-PUB-012** (M): Featured projects — top 3 from `GET /projects` (server-ordered
  featured-first, published-only), case-study framing (title, summary, year, technologies),
  cards link to `/projects/{slug}`.
- **FR-PUB-013** (M): Experience timeline summary from `GET /experiences` (role, company,
  period, employment-type label, current flag), reverse-chronological, mirrored flow in RTL.
- **FR-PUB-014** (S): Latest 3 articles from `GET /articles` (title, excerpt, reading time,
  category, cover image), cards link to `/blog/{slug}`.
- **FR-PUB-016** (S): Testimonials from `GET /testimonials` (quote, author, role, avatar),
  curated/visible-only, linear layout (no carousel, D13-10).
- **FR-PUB-017** (M): Contact section — direct email (`mailto:`) + link to the contact form
  (`/contact`); email path always functional (D05-4).
- **FR-PUB-015** (S): Developer philosophy section — **DEFERRED** (WD-3 / D24-6); no API or
  content source exists and it requires owner-authored native bilingual copy (doc 03 §7).

### Global chrome touched (doc 02 §2)

- **FR-PUB-003** (M): Footer completed with social links (`profileLinks`), availability status,
  and resume link (from `settings.resumeAsset`) — currently stubbed.
- **FR-PUB-001/002** (M): Locale switcher + theme toggle — already present; must remain correct
  (regression-check `/blog` too).
- **FR-PUB-005** (M): Contact CTA reachable without scrolling — header CTA already present.
- **FR-PUB-007** (M): Full RTL for every new section.

### Cross-cutting (NFR — docs 13/20/21/22)

- **NFR-STATE**: Every data section ships designed **loading + empty + error** states (D13-1);
  skeletons match final dimensions (CLS 0), appear only past 150 ms, and apply only to
  client-side refinement (SSR first paint is content-complete, D13-2).
- **NFR-DEGRADE**: Sections fetch in parallel with **per-section error isolation**; one failing
  endpoint never blanks the page; an empty result omits its section.
- **NFR-A11Y**: WCAG 2.2 AA (NFR-002) — one `<h1>`, no skipped headings, landmarks, skip link,
  visible focus ring (≥3:1), single-accessible-link cards, 44×44 px targets, contrast 4.5:1,
  status not color-alone, reduced-motion, `bdi`/`dir="ltr"` for inline tech identifiers, RTL
  focus order, 200%/320 px reflow, Arabic screen-reader sanity.
- **NFR-SEO**: `Person` + `WebSite` JSON-LD via `useSchemaOrg` from API data; self-canonical per
  locale; hreflang EN↔AR + `x-default`→EN (central); standalone home title (not templated);
  OG + Twitter `summary_large_image`; verification/custom metas from settings render on home.
- **NFR-PERF**: JS ≤ 90 KB gz (≤ 35 KB app-code) per public route; CSS ≤ 30 KB gz; Lighthouse
  100 (home × EN/AR); LCP < 1.8 s field; CLS designed to 0. `<NuxtImg>` only; hero/LCP image (if
  any) eager+`fetchpriority=high`, others lazy + blurhash. `motion` library **hero-only**; CSS
  transitions elsewhere. No new runtime deps beyond that (bundle budget).
- **NFR-TOKENS**: semantic `--ui-*` tokens only; logical properties only; per-locale font
  switching at root; no raw hex / physical utilities in components.

### Key Entities *(consumed API shapes — read-only)*

- **PublicSiteSettingsEntity**: `siteName`, `tagline`, `availabilityStatus`, `profileLinks[]`
  (`{label,url,icon?}`), `careerStartYear/Month`, `resumeAsset` (PDF descriptor | null),
  verification/analytics/customMetas, `availableLocales[]`.
- **PublicProjectListItemEntity**: `id, slug, title, summary, featured, year, technologies[{id,label}]`.
- **PublicSkillEntity**: `id, label, group, order, brandColor`.
- **PublicExperienceEntity**: `id, role, company, location, impact, employmentType, isCurrent,
  startDate, endDate, order`.
- **PublicTestimonialEntity**: `id, avatar(descriptor|null), quote, authorName, authorRole, order`.
- **PublicArticleListItemEntity**: `id, title, slug, excerpt, readingTimeMin, publishAt,
  coverImage(descriptor|null), category, tags[]`.

## Success Criteria *(mandatory)*

- **SC-001**: A visitor loading `/` (and `/ar`) sees hero + all populated `M` sections
  server-rendered, with no client-side layout shift on hydration (CLS < 0.05, target 0).
- **SC-002**: Every data-driven section demonstrably renders three states (populated / empty /
  error) without breaking the page, verified by component tests.
- **SC-003**: Lighthouse scores 100 across all four categories on the home page in **both**
  locales in CI; axe-core reports zero violations.
- **SC-004**: Public route JS stays ≤ 90 KB gz (≤ 35 KB app-code); `check:bundle` confirms no
  dashboard/editor code leaks into the home bundle.
- **SC-005**: Locale parity — a bilingual reviewer cannot tell which locale was designed first;
  RTL is fully mirrored; no raw i18n keys or physical-property leaks (`check:logical` passes).
- **SC-006**: `Person` + `WebSite` structured data validates; hreflang pairs are bidirectional
  (EN↔AR + `x-default`).

## Assumptions

- The API dev/demo seed (prerequisite PR) provides ≥3 published+featured projects, several
  experiences, skills across all groups, ≥3 published articles, ≥2 visible testimonials, in both
  locales — used for local build + verification only (never production).
- Verification runs against the **real dev API + demo seed** (not only the Prism mock), against
  the **test** database via an external temp env (the real `.env` is never touched).
- The home page consumes the current committed contract as-is; no re-adoption is required (types
  already present in `app/types/api.d.ts`).
- Deep links to not-yet-built pages returning 404 is acceptable at the **dev** integration stage
  and documented for the owner's production-release decision.

## Decisions & Deferrals (feature-level; doc-first IDs recorded in Docs PR)

- **WD-1** (this repo): Web-only — no API/schema/migration/contract change; add `models.ts`
  view-model aliases + i18n keys + `components/home/*` only.
- **WD-2**: Dev/demo seed is a **separate** API artifact; production `seed.ts` is untouched.
- **WD-3 → D24-6**: Philosophy section (FR-PUB-015, `S`) deferred by explicit roadmap decision
  (doc 02 §7 forbids silent `S` slips) — no data/content source; needs owner bilingual voice.
- **D24-5**: M4 delivered in slices; this feature = home page; remaining public pages = follow-on.

## Out of Scope

- Any API/DB/contract change; production promotion/deploy/tags/`PUBLIC_WEB_URL` (Release Freeze).
- Building `/projects`, `/experience`, `/about`, `/uses`, `/resume`, `/contact` pages (follow-on).
- The contact **form** (FR-PUB-050 — a Contact-page feature); the home page only links to it.
- Philosophy section (WD-3), OG-image generation, RSS wiring, analytics enablement.
