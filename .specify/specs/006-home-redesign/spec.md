# Feature Specification: Home Redesign, Seed Governance & Article Collection

**Feature Branch**: `006-home-redesign` (off Web `dev` `d505f47`)

**SpecKit ID**: `006-home-redesign` · **Milestone**: M4 (Public Site — home quality pass) · **Repo**: `eslammuatamed-web` (+ cross-repo: `eslammuatamed-api` dev seed, `eslammuatamed-docs` governance)

**Created**: 2026-07-21

**Status**: Draft

**Input**: Owner directive — the merged `003-public-home` home page is functionally complete but
visually unacceptable for a senior frontend-engineer portfolio. Deliver a genuine redesign (not a
polish pass) that executes the approved "Mirror" brand language well; make development/demo seed
data a project-wide Definition-of-Done requirement; and populate a real bilingual article
collection. `dev` only — Release Freeze remains active (no promotion/deploy).

---

## Context & Scope Boundary

`003-public-home` shipped the full section set (Hero, TechStack, FeaturedProjects,
ExperienceSummary, LatestArticles, Testimonials, ContactCta + footer chrome) wired to the live
F002 + M1 contract. Its **composition** is the problem: seven identical
`section.py-[var(--space-section)] > UContainer > UiSectionHeader(eyebrow+title)` blocks on one
flat surface — no rhythm, no surface differentiation, a bare-text hero with no identity anchor, and
zero use of the brand's "Mirror" motif (the Monolith mark, Datum hairline rules, step geometry). It
reads as a generic template, failing doc 01 Pillar 4 (premium SaaS restraint) and the brand §13
gate ("feels like a premium software product").

This feature **redesigns the visual layer** by editing the existing `003` component files (it does
NOT reopen the `003` spec — HR-7). It is **Web-only** for the UI; it consumes the same contract with
**no API code, schema, migration, or contract change** (HR-1). Two supporting cross-repo tracks ride
along on their own branches: a **dev/demo seed expansion** (`eslammuatamed-api`, dev-only) so the
redesign is verified against realistic owner-grounded data and a full article collection, and a
**project-wide seed-governance decision** (`eslammuatamed-docs`).

`availabilityStatus` remains a non-localized scalar (English in `/ar`) — carried, not fixed (HR-4);
FR-PUB-015 philosophy section stays deferred (D24-6, HR-5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Hiring manager "Land & Scan" on a page that signals seniority (Priority: P1) 🎯 MVP

A P1 engineering manager lands on `/` (F-P1). In one viewport the hero must answer *who, what
level, available?* with genuine presence — a real identity composition, not left-aligned text on a
flat field — and every section below must read as a deliberately-composed, premium, typography-first
page that itself is Exhibit A (Pillar 2). They scan hero → stack → featured projects → experience,
each a link deeper.

**Why this priority**: The home is the primary conversion surface; the "Land" 10-second quality
judgment (doc 05 F-P1 step 1) is exactly what the current build fails. Redesigning the hero + rhythm
is the MVP — without it the feature has no value.

**Independent Test**: Load `/` and `/ar` at mobile/tablet/desktop; confirm a distinct hero identity
block (mark + name + role ladder + availability + primary "view work"/secondary "contact"),
differentiated section rhythm, one `<h1>`, and that it renders from seeded API data — verifiable
without stories 2–3.

**Acceptance Scenarios**:

1. **Given** seeded API data, **When** `/` renders (SSR), **Then** the hero shows name, role
   positioning, availability (dot + text), and a primary + secondary CTA within the first viewport,
   anchored by the Monolith-mark motif — no raster image (LCP stays text/inline-SVG).
2. **Given** a viewer on `/ar`, **When** the page renders, **Then** the entire layout mirrors (RTL),
   the mark reads identically, Latin tech names stay LTR (`bdi`), and Arabic is visibly first-class
   (not a shrunken translation).
3. **Given** `prefers-reduced-motion`, **When** the hero enters, **Then** motion collapses to an
   opacity fade ≤120 ms; there is no scroll-triggered or looping decorative animation anywhere.

### User Story 2 — Reach, orient, and read real writing (Priority: P2)

The same visitor (and a P4 reader) continues to Latest Articles and finds a real, dated, bilingual
article collection — recent development writing grounded in this platform's engineering decisions
plus general engineering topics — not an empty or single-item section. The redesigned cards make the
writing feel like a maintained publication.

**Why this priority**: Latest Articles (FR-PUB-014) and the blog are the P4 top-of-funnel and part
of F-P1 "Verify"; an empty or thin section undermines the whole proof-over-claims bet.

**Independent Test**: With the expanded seed applied, `/` shows 3 most-recent articles correctly
ordered (publishAt desc), and `/blog` lists ≥10 published bilingual articles with reading time,
category, and date, dates distributed across ~12 months, none in the future.

**Acceptance Scenarios**:

1. **Given** the expanded seed, **When** `/` renders, **Then** exactly the 3 most-recent published
   articles show, newest first, each linking to `/blog/{slug}`.
2. **Given** `/ar/blog`, **When** it renders, **Then** article titles/excerpts/dates are Arabic and
   per-locale slugs resolve.

### User Story 3 — Deterministic, mandatory dev seed for every future data-backed flow (Priority: P3)

A developer (or a future feature author) can run one documented command to populate a realistic,
owner-grounded home + blog dataset on a clean development/test database, idempotently, and the
project now *requires* such a seed for any feature touching a data-backed flow.

**Why this priority**: Governance + reproducibility; it de-risks every future feature's
integration verification and is the mechanism that keeps the platform "Exhibit A" demoable.

**Independent Test**: On a throwaway test DB, run the base seed then the dev seed twice; the second
run is a no-op (no duplicates, no errors); the home renders owner-grounded data; the rule appears in
doc 16 DoD and both repos' SpecKit task templates.

**Acceptance Scenarios**:

1. **Given** a clean test DB, **When** `npm run db:seed && npm run db:seed:dev` runs twice, **Then**
   the result is identical and non-destructive (idempotent; no `deleteMany`/reset; existing rows
   preserved).
2. **Given** the governance decision, **When** a new feature spec is generated, **Then** the tasks
   template carries a mandatory dev/demo-seed task for data-backed flows.

### Edge Cases

- Any single section endpoint fails → only that section degrades (inline retry / omit), page stays
  content-complete (NFR-DEGRADE, unchanged from 003).
- `settings` fails → designed API-unavailable state (the one hard dependency).
- Empty optional sections (testimonials/articles) → section omitted gracefully.
- `availabilityStatus` English in `/ar` → accepted, documented release-blocker (HR-4).

## Requirements *(mandatory)*

### Functional Requirements (redesign — doc 02 §3 Home)

- **FR-PUB-010** Hero: identity composition — name, role positioning (the owner ladder), availability
  (dot + text, never colour alone), primary "view work" + secondary "contact"; anchored by the
  Monolith mark at architectural scale (single-fill, monochrome). One viewport answer to who/level/
  available.
- **FR-PUB-011** Tech stack from `GET /skills`, grouped, technology brand colours as ≤8 px dots only
  — no proficiency, no skill bars.
- **FR-PUB-012** Featured projects: top-3 published+featured, case-study framing, links to
  `/projects/{slug}`.
- **FR-PUB-013** Experience timeline summary: reverse-chronological, current role first,
  role/company/period/employment-type.
- **FR-PUB-014** Latest articles: 3 most-recent published, redesigned cards, link to `/blog`.
- **FR-PUB-016** Testimonials: curated, bounded, linear (no carousel).
- **FR-PUB-017** Contact: form link + data-driven `mailto:` fallback that survives an API outage.
- **FR-PUB-015** Developer philosophy — **DEFERRED (D24-6, HR-5), not built.**

### Cross-cutting (NFR — docs 03/13/14/20/21/22)

- Execute the brand "Mirror" language (brand-identity.md v2.0.2): Monolith mark motif + Datum
  hairline rules + one violet accent per composition; anti-goals honoured (no glassmorphism/glow/
  gradient-mesh/particles/sci-fi/`</>`/terminal chrome). Typography-first; borders/surface-steps for
  depth (D03-3).
- Semantic `--ui-*` tokens + **logical CSS properties only**; full RTL + both locales at parity;
  `<NuxtImg>` only; CSS-first, reduced-motion-safe motion (no `motion` dep — perf budget); Lucide
  icons only. No new dependencies.
- One `<h1>`; heading levels never skip; landmarks; single-accessible-link cards; visible focus
  ring ≥3:1; tap targets ≥44 px; contrast 4.5:1 text / 3:1 UI both themes; 200 % zoom / 320 px no
  h-scroll.
- Person + WebSite JSON-LD via `useSchemaOrg` from API data; standalone home title (D22-4); hreflang
  central (D22-3). SSR content-complete both locales; no hydration/console errors.
- Perf budgets stay green (LCP<1.8 s, CLS<0.05, JS ≤90 KB gz / ≤35 KB app, CSS ≤30 KB gz, Lighthouse
  100×4). LCP surface = text + inline SVG.

### Seed & governance requirements (cross-repo)

- **API (dev-only, `chore/006-home-seed`)**: expand `prisma/seed.dev.ts` / `db:seed:dev` — correct
  fictional experiences + placeholder social links to real owner-profile data (HR-8); ensure
  siteName/tagline; expand articles to ≥12 published bilingual entries with hardcoded absolute
  `publishAt` distributed across ~12 months (none > 2026-07-21), grounded topics + general topics;
  new tags added; **idempotent, dev/test-only, stable slug keys, no `deleteMany`, no prod-seed/
  schema/contract change** (HR-6).
- **Docs governance (`eslammuatamed-docs`)**: **D16-9** — a project-wide DoD rule that every feature
  adding/changing a data-backed flow ships deterministic dev/demo seed (idempotent, dev/test-only,
  stable IDs/slugs, bilingual en+ar for localized entities, integrated into seed orchestration,
  documented command + expected result, exercised in an integration verification, never reads/writes
  the real `.env`, uses an external temp DB for clean checks, preserves existing data). Companion
  **D09-15** documents the `seed.dev.ts`/`db:seed:dev` overlay in doc 09 §6. Concise references added
  to both repos' CONTRIBUTING and a mandatory seed task to both `.specify/templates/tasks-template.md`
  (separate follow-up per doc 16 §8.5).

### Key Entities *(consumed API shapes — read-only, unchanged)*

`PublicSiteSettingsEntity` (siteName/tagline/availabilityStatus/profileLinks/resumeAsset,
careerStart), `PublicSkillEntity` (group/order/brandColor/label), `PublicProjectListItemEntity`
(featured/year/title/slug/summary/technologies), `PublicExperienceEntity`
(startDate/endDate/isCurrent/employmentType/role/company/location), `PublicArticleListItemEntity`
(title/slug/excerpt/publishAt/readingTimeMin/category/tags), `PublicTestimonialEntity`
(quote/authorName/authorRole/avatar/order).

## Success Criteria *(mandatory)*

- **SC-1** The home reads as a distinctive senior frontend-engineer portfolio (brand §13 gate
  passes), verified visually at mobile/tablet/desktop × EN/AR RTL via browser screenshots.
- **SC-2** All Web gates green: typecheck, lint, tests (updated), build, `check:bundle`,
  `check:logical`, `git diff --check`.
- **SC-3** All API gates green on the seed branch: typecheck, lint, unit tests, `contract:export`
  (no DB), e2e (seed change is data-only — contract unaffected).
- **SC-4** Clean-DB integration: base seed + dev seed run idempotently on a throwaway test DB with an
  external temp env (real `.env` untouched); the home renders every section from seeded data (not
  hardcoded arrays); article ordering + localized content correct; RTL mirrored; zero hydration/
  console errors, both locales.
- **SC-5** Governance recorded (D16-9 + D09-15 + CONTRIBUTING ×2 + tasks-template ×2); all module
  Arabic READMEs updated; feature-map/handoff/MEMORY updated; final report distinguishes
  dev-complete from production-shipped.

## Assumptions

- The live F002 + M1 contract satisfies all home data needs (verified in 003); no contract adoption
  is required.
- The Monolith SVG path (brand §3, `M2,6 H6 V2 H14 V10 H10 V14 H2 Z`) is a static brand asset,
  inlineable — not an image dependency.
- `check:bundle` / `check:logical` / test scripts from 003 remain the Web gates.
- Local native Postgres (`eslammuatamed_test` throwaway DB); no Docker.

## Decisions & Deferrals (feature-level — HR-n; central doc-first IDs in Docs PR)

- **HR-1** Web-only UI redesign; consumes live contract; no API schema/contract/endpoint change.
- **HR-2** Execute the brand "Mirror" language (Monolith mark + Datum hairline motif); no new
  aesthetic; no new deps; CSS-first motion.
- **HR-3** Datum-label device is locale-robust: mono (JetBrains) only for numerals/coordinates/Latin
  tech names (mono has no Arabic glyphs); Arabic words render in Plex Arabic.
- **HR-4** `availabilityStatus` locale gap carried, not hacked; documented production release-blocker.
- **HR-5** FR-PUB-015 philosophy stays deferred (D24-6).
- **HR-6** Seed expansion on a separate API dev-only branch; no production-seed/schema/contract change.
- **HR-7** Redesign supersedes 003's visual layer by editing its component files; the 003 spec is not
  reopened.
- **HR-8** Correct dev-seed identity data to real owner-profile values (experiences
  Findropica/WeblyTech/WaveX; real GitHub/LinkedIn/email; siteName/tagline); no invented facts;
  documented placeholders where a value is genuinely absent.
- **D16-9 / D09-15** (Docs) mandatory dev/demo seed governance — canonical wording in the docs repo.

## Out of Scope

- No production promotion, deploy, `workflow_dispatch`, `PUBLIC_WEB_URL`, or prod DB/R2/config/secret
  change (Release Freeze).
- No API schema/contract/endpoint change; no production-seed change.
- The philosophy section (D24-6); `/projects`, `/experience`, `/about`, `/resume`, `/contact` pages
  (web-005 — deep links may 404); CSP/security headers (launch-hardening); `availabilityStatus`
  localization (owner schema decision).
