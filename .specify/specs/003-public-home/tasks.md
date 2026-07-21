---
description: "Task list — Public Home Page (003-public-home)"
---

# Tasks: Public Home Page

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md) · **Repo**: `eslammuatamed-web` (branch `feat/003-public-home` off `dev` `a7106f8`)

**Tests**: INCLUDED (the spec requests component + integration tests; a11y/perf are release gates).

**Legend**: `[P]` = parallelizable (different files, no dep) · `[US#]` = user story · exact paths given.

---

## Phase 0: Cross-repo prerequisites & governance (separate PRs, separate ownership)

- [x] T001 **[API repo]** Add dev/demo seed `prisma/seed.dev.ts` + `db:seed:dev` script (both locales:
  ≥3 published+featured projects, experiences, skills across all groups, ≥3 published articles,
  ≥2 visible testimonials). Idempotent; production `seed.ts` untouched (WD-2). Run ONLY vs test DB
  via external temp env — never the real `.env`. Branch `chore/dev-demo-seed` off API `dev` `df4d0b3`. → PR to API `dev`.
- [x] T002 **[Docs repo]** doc 24: add **D24-5** (M4 delivered in slices; home first) + **D24-6**
  (Philosophy FR-PUB-015 deferral — doc 02 §7). Bump doc 24 version + review note. Branch off Docs `main` `30ddc00`. → PR to Docs `main`.
- [x] T003 **[Web repo]** Update `.specify/memory/feature-map.md`: split row 003 (public-site → **public-home** this feature; add remaining-public-pages follow-on row); status 🧪 in progress → dev.

---

## Phase 1: Setup — shared foundations (Web)

- [x] T010 Create branch `feat/003-public-home` off Web `dev` `a7106f8`.
- [x] T011 [P] Add view-model aliases in `app/types/models.ts`: `ProjectListItem = PublicProjectListItemEntity`,
  `Skill = PublicSkillEntity`, `Experience = PublicExperienceEntity`, `Testimonial = PublicTestimonialEntity`,
  `MediaImage = PublicMediaImageDescriptor`, `MediaPdf = PublicMediaPdfDescriptor` (no handwritten types).
- [x] T012 [P] Add date/period + `employmentType`→localized-label helpers in `app/utils/format.ts` (Intl only, no date lib).
- [x] T013 [P] Add `home.*` section i18n keys (eyebrows, headings, view-all, empty/error copy, contact,
  section labels) to `i18n/locales/en.json`.
- [x] T014 [P] Mirror T013 keys in `i18n/locales/ar.json` (native Arabic register; match existing quality). Flag for owner locale review.
- [x] T015 [P] Add state primitives: `app/components/ui/SectionSkeleton.vue`, `ui/StateError.vue` (inline
  retry). **`ui/StateEmpty.vue` intentionally NOT created** — empty results omit the whole section
  (graceful degradation, NFR-DEGRADE), so no visible empty-state component is needed on the home page.

**Checkpoint**: types, i18n, utils, state primitives ready.

---

## Phase 2: Foundational — data + SEO orchestration (BLOCKS all stories)

- [x] T020 Implement `app/composables/useHomeData.ts` — SSR-safe; one `useAsyncData` per section keyed
  by locale, run in parallel, each isolated so a rejection yields `{data:null,error}` (never rejects the
  page); `/settings/site` is the single hard dependency (its failure → existing API-unavailable state).
- [x] T021 [P] Implement `app/composables/useSiteSchema.ts` — `Person` + `WebSite` JSON-LD via
  `useSchemaOrg` from settings/skills (name, jobTitle, `sameAs` from profileLinks, `knowsAbout` from skills).
- [x] T022 [P] Unit-test `useHomeData` isolation: one section endpoint failing does NOT reject the aggregate;
  empty result surfaces as empty (tests/unit or co-located `.spec.ts`).

**Checkpoint**: page can orchestrate sections with graceful degradation + SEO graph.

---

## Phase 3: User Story 1 — Hiring manager Scan (P1) 🎯 MVP

### Tests (write first, must fail)

- [x] T030 [P] [US1] `app/components/home/Hero.spec.ts` — name/role/availability/CTAs, both locales, LCP heading is single h1.
- [x] T031 [P] [US1] `app/components/home/TechStack.spec.ts` — grouped skills, UiTechBadge brand-accent, empty omit, RTL.
- [x] T032 [P] [US1] `app/components/content/ProjectCard.spec.ts` — single accessible link → `/projects/{slug}`, no nested links, RTL chevron mirrors.
- [x] T033 [P] [US1] `app/components/home/ExperienceSummary.spec.ts` + `content/ExperienceItem.spec.ts` — reverse-chron, employmentType label, current flag, RTL timeline flow.

### Implementation

- [x] T034 [US1] Rework `app/components/home/Hero.vue` — role positioning + availability dot (status not
  color-alone: icon+text), primary "view work"/secondary "contact" CTAs (44px), hero entrance motion
  (reduced-motion safe), LCP-friendly. Semantic tokens + logical props only.
- [x] T035 [P] [US1] `app/components/home/TechStack.vue` — grouped skills via `UiSectionHeader` + `UiTechBadge`
  (`--brand-*`), `bdi`/`dir="ltr"` for latin tech names in AR, empty→omit, error→inline retry.
- [x] T036 [P] [US1] `app/components/content/ProjectCard.vue` — image-optional single-link card (title, summary,
  year, technologies), hover via border/surface step.
- [x] T037 [US1] `app/components/home/FeaturedProjects.vue` — top-3 featured (server-ordered), `UiSectionHeader`
  + "view all"→`/projects`, ProjectCard grid, empty→omit, error→inline.
- [x] T038 [P] [US1] `app/components/content/ExperienceItem.vue` + `app/components/home/ExperienceSummary.vue` —
  reverse-chron timeline summary, period via Intl, RTL-mirrored flow.
- [x] T039 [US1] Wire Hero + TechStack + FeaturedProjects + ExperienceSummary into `app/pages/index.vue` via
  `useHomeData`; keep the designed API-unavailable fallback for the settings hard-dependency.

**Checkpoint**: MVP — the P1 Scan journey renders live in both locales with all three states.

---

## Phase 4: User Story 2 — Reach & orient (P2)

### Tests

- [x] T040 [P] [US2] `app/components/layout/Footer.spec.ts` — social links (external-safe, single-link),
  availability, resume link present/omitted by `resumeAsset`, RTL; `/blog` still renders (regression).
- [x] T041 [P] [US2] `app/components/home/ContactCta.spec.ts` — `mailto:` + `/contact` link, both locales.

### Implementation

- [x] T042 [US2] Unstub `app/components/layout/Footer.vue` — render `settings.profileLinks` (social, external
  `rel="me noopener"`/`target`, RTL-aware icons), availability status, resume link/download from
  `settings.resumeAsset` (omit when null). Fetch settings SSR (shared/singleton, no duplicate call).
- [x] T043 [P] [US2] `app/components/home/ContactCta.vue` — `UiSectionHeader` + direct email (`mailto:`) +
  contact-form link (`/contact`); email path always functional (D05-4).
- [x] T044 [US2] Add ContactCta into `app/pages/index.vue`.

**Checkpoint**: contact path + professional links complete site-wide.

---

## Phase 5: User Story 3 — Recent writing & social proof (P3)

### Tests

- [x] T050 [P] [US3] **REUSED the existing `content/ArticleCard.vue` unchanged** (M1, text-forward,
  single-link → `/blog/{slug}`) rather than adding a new card — on-brand (typography-first) and avoids
  regressing the blog index. No new `ArticleCard.spec.ts`; `LatestArticles.spec.ts` covers its usage.
- [x] T051 [P] [US3] `app/components/home/LatestArticles.spec.ts` + `Testimonials.spec.ts` — populated/empty/error, linear (no carousel), RTL.

### Implementation

- [x] T052 [P] [US3] `content/ArticleCard.vue` reused as-is (text-forward). **Cover-image `<NuxtImg>`
  enhancement DEFERRED** to the public-pages feature (`005`) — the existing M1 card renders no cover, which
  is on-brand and keeps the blog index untouched. TestimonialCard uses `<NuxtImg>` for avatars.
- [x] T053 [US3] `app/components/home/LatestArticles.vue` — latest 3, `UiSectionHeader` + view-all→`/blog`, empty→omit.
- [x] T054 [P] [US3] `app/components/content/TestimonialCard.vue` + `app/components/home/Testimonials.vue` —
  linear layout (no carousel), avatar `<NuxtImg>`|omit, quote/author/role.
- [x] T055 [US3] Add LatestArticles + Testimonials into `app/pages/index.vue`.

**Checkpoint**: all populated homepage sections present.

---

## Phase 6: Polish & Cross-cutting

- [x] T060 Finalize `app/pages/index.vue` SEO — `useSiteSchema` + standalone home title + self-canonical +
  hreflang EN↔AR + `x-default`, OG/Twitter `summary_large_image`, settings verification/custom metas.
- [x] T061 a11y pass — one h1, heading order, landmarks, focus ring, 44px targets, contrast, reduced-motion,
  RTL focus order, `bdi` inline tech; axe clean on `/` + `/ar`.
- [x] T062 Perf/bundle — `<NuxtImg>` only, LCP eager/`fetchpriority=high` if a hero image exists, motion hero-only;
  `npm run build && npm run check:bundle` (JS budget, no dashboard/editor leak).
- [x] T063 Gates — `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:logical`, `git diff --check`.
- [x] T064 **Integration vs real dev API + demo seed** (test DB, external temp env, real `.env` untouched):
  `/` + `/ar` — hydration clean, media descriptor URLs resolve on media origin, per-locale shapes, RTL,
  loading/empty/error, responsive desktop/tablet/mobile, no token/secret leakage.

---

## Phase FINAL: Documentation & Handoff Gate (MANDATORY — doc 16 §5.1 / D16-8; always last)

- [x] T070 Arabic module docs of shipped behavior — `app/components/home/README.md`,
  `app/components/content/README.md` (Arabic prose, English identifiers), update
  `app/components/README.md` + `app/pages/README.md`; PROJECT_GUIDE §3 (home now full, not hero-only).
- [x] T071 SpecKit closeout — check completed tasks in this file; record deferrals (WD-3/D24-6) + accepted limitations.
- [x] T072 Central source-of-truth sync — Docs PR (T002) merged; Web feature-map (T003); confirm no contract
  change (no `api:types` regen needed). No stale "planned/in-progress" for shipped work.
- [x] T073 Project status + handoff — update `memory/project-m1-handoff.md` + `MEMORY.md` (branches/SHAs/PRs/tests/
  limitations/next-action); no duplicate status files.
- [x] T074 Final consistency verification — Arabic docs match code, central docs match reality, `git diff --check`
  + `check:bundle` + `check:logical` pass, **no secrets or local `.env` contents committed anywhere**.
- [x] T075 **Documentation & Handoff Gate sign-off (D16-8)** — all above satisfied; feature cleared to push / PR / merge to `dev` ONLY (Release Freeze: no `dev→main`/deploy).

**Checkpoint**: Gate passed — cleared for dev delivery only.

---

## Dependencies & Execution Order

- **Phase 0** (cross-repo) runs in parallel with Web work; T001 (seed) must land before T064 integration verify.
- **Phase 1** → **Phase 2** (foundational, blocks stories) → **Phase 3 (P1 MVP)** → **Phase 4 (P2)** → **Phase 5 (P3)** → **Phase 6** → **Phase FINAL**.
- Within a story: tests (fail first) → cards → sections → page wiring.
- `[P]` tasks touch distinct files and may run together.

## Parallel Opportunities

- T011–T015 (setup) all `[P]`. T021/T022 `[P]` with T020 done. Card components (`content/*`) `[P]` with their sections.
- Phase 0 API seed + Docs decisions proceed independently of Web coding (only integration T064 depends on the seed).
