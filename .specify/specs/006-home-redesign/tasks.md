# Tasks: Home Redesign, Seed Governance & Article Collection

**Feature**: `006-home-redesign` · Base Web `dev` `d505f47` · Release Freeze active (dev only).
Legend: `[ ]` todo · `[x]` done · `[P]` parallelizable.

---

## Phase 0: Cross-repo prerequisites & governance (separate branches/PRs)

- [x] T001 API dev-seed expansion on `chore/006-home-seed` (off API `dev` `a964349`): expand
  `prisma/seed.dev.ts` — HR-8 owner-grounded identity (experiences Findropica/WeblyTech/WaveX; real
  GitHub/LinkedIn/email; siteName/tagline) + ≥12 bilingual published articles (hardcoded absolute
  `publishAt` across ~12 mo, none > 2026-07-21) + new tags; idempotent, dev-only, no prod-seed/
  schema/contract change. (Dogfoods D16-9.)
- [x] T002 Docs governance on a docs branch: **D16-9** (doc 16 §5.x DoD + §10 decision + review note),
  **D09-15** (doc 09 §6 overlay), CONTRIBUTING ×2 concise refs, seed task added to
  `.specify/templates/tasks-template.md` in **both** repos (separate follow-up per doc 16 §8.5).
- [x] T003 Clean-DB integration harness: external temp env → throwaway `eslammuatamed_test`; run
  `db:seed` then `db:seed:dev` twice (idempotent proof); real `.env` never touched.

## Phase 1: Setup — brand primitives & tokens (Web)

- [x] T010 `components/ui/BrandMark.vue` — inline Monolith SVG (`M2,6 H6 V2 H14 V10 H10 V14 H2 Z`),
  `currentColor`, size prop, `aria-hidden`.
- [x] T011 `components/ui/DatumLabel.vue` — locale-robust eyebrow (mono index/coordinate for
  numerals/Latin only + script-appropriate eyebrow word + optional action + hairline rule),
  caller-controlled heading level.
- [x] T012 `components/ui/Section.vue` — `<section>`+`<UContainer>` rhythm wrapper; `variant`
  base|elevated; consistent `--space-section`; optional top datum rule.
- [x] T013 [P] main.css — minimal surface/rule helpers via existing tokens only; no new colours;
  reduced-motion pulse for the loading mark. i18n keys (ladder, datum eyebrows) EN + native AR.

## Phase 2: Foundational — rhythm system wired (BLOCKS stories)

- [x] T020 `index.vue` composes the redesigned sequence with `UiSection` variants (base/elevated
  pacing); settings hard-dependency + API-unavailable state retained (now with BrandMark pulse).

## Phase 3: User Story 1 — Land & Scan (P1) 🎯 MVP

### Tests (update to new DOM first)
- [x] T030 Update `Hero.spec.ts`, `TechStack.spec.ts`, `FeaturedProjects.spec.ts`,
  `ExperienceSummary.spec.ts` + `ProjectCard.spec.ts`, `ExperienceItem.spec.ts` to assert the new
  structure/behaviour (identity block, mark present, one h1 via page, single-link cards, current-role
  -first, grouped skills, brand-colour dots, RTL logical classes).
### Implementation
- [x] T031 `Hero.vue` — identity composition (BrandMark + availability pill + display name + role
  ladder + primary/secondary CTA); CSS-first reveal, reduced-motion safe; LCP text/inline-SVG.
- [x] T032 `TechStack.vue` → `UiSection`+`UiDatumLabel`; grouped, dots only.
- [x] T033 `FeaturedProjects.vue` + `content/ProjectCard.vue` — datum header, 3-card grid, mono year,
  border/surface-step hover; preserve single-accessible-link.
- [x] T034 `ExperienceSummary.vue` (elevated variant) + `content/ExperienceItem.vue` — mono period,
  current-first, logical timeline rail (RTL-safe).

## Phase 4: User Story 2 — Reach, orient, read (P2)

### Tests
- [x] T040 Update `LatestArticles.spec.ts`, `Testimonials.spec.ts`, `TestimonialCard.spec.ts`,
  `ArticleCard` coverage to new DOM; add article-ordering assertion.
### Implementation
- [x] T041 `LatestArticles.vue` + `content/ArticleCard.vue` — redesigned meta/title/excerpt cards
  (mono date + reading time), 3 newest, `/blog/{slug}`.
- [x] T042 `Testimonials.vue` + `content/TestimonialCard.vue` — bounded linear grid, quote rail.
- [x] T043 `ContactCta.vue` — closing datum frame + mark echo; form link + mailto fallback (D05-4).
- [x] T044 Apply T001 seed to the integration DB; verify home renders 3 newest articles ordered +
  localized (SC-4 subset).

## Phase 5: User Story 3 — Governance & seed (P3)

- [x] T050 Land T002 (docs) + confirm T001 idempotent on clean DB (T003) — the D16-9 dogfood proof.
- [x] T051 `components/layout/Footer.vue` reviewed and **left unchanged** — already datum-aligned (top
  hairline border) and clean from 003; its behaviour (scheme allowlist WD-5, locale-reactive
  availability WD-6) is preserved. No edit needed.

## Phase 6: Polish & Cross-cutting

- [x] T060 Full Web gates: typecheck, lint, test, build, `check:bundle`, `check:logical`,
  `git diff --check`.
- [x] T061 A11y/RTL pass: one h1, heading order, focus ring ≥3:1, 44 px targets, 200 %/320 px
  reflow, `bdi` Latin-in-Arabic, reduced-motion; browser screenshots mobile/tablet/desktop × EN/AR.
- [x] T062 Integration verification (SC-4): SSR content-complete both locales, JSON-LD, standalone
  title, hreflang, zero console/hydration errors, sections from seeded data.
- [x] T063 API gates on seed branch: typecheck, lint, test, `contract:export` (+ e2e if feasible).

## Phase FINAL: Documentation & Handoff Gate (MANDATORY — doc 16 §5.1 / D16-8 + new D16-9; always last)

- [x] T070 Arabic module READMEs updated for every changed module (`components/`, `composables/` if
  touched, `pages/`; api `prisma/` seed doc note).
- [x] T071 SpecKit closed (spec/plan/tasks checked); feature-map adds `006-home-redesign`
  (status "🧪 Implemented on dev").
- [x] T072 Central docs merged (D16-9/D09-15 + CONTRIBUTING ×2 + tasks-template ×2).
- [x] T073 PROJECT_GUIDE + handoff memory + MEMORY.md updated (dev-complete, not prod-shipped).
- [x] T074 Final report: exact files, commits, SHAs, tests, seed commands, decisions, limitations,
  remaining production blockers, next safe owner-authorized action.
- [x] T075 **Documentation & Handoff Gate sign-off (D16-8/D16-9)** — all above satisfied; feature
  cleared to push / PR / merge to `dev` ONLY (Release Freeze: no `dev→main`/deploy).

---

## Dependencies & Execution Order

Phase 0 (seed+governance, parallel to Web build) → Phase 1 → Phase 2 → Phase 3 (P1 MVP) → Phase 4
(P2) → Phase 5 (P3) → Phase 6 → Phase FINAL. Seed (T001/T003) must be green before T044/T062
integration. Governance (T002) may land any time before T072.
