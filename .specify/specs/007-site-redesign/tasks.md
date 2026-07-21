# Tasks: Site-wide Public Redesign (007)

**Branch**: `007-site-redesign` · **Spec**: `./spec.md` · **Plan**: `./plan.md`
All tasks complete on `dev` (pending owner review). `[X]` = done.

## Phase 0 — Direction (pixels before system)
- [X] T001 Inspect current public routes/components; identify what is structurally inherited from 006.
- [X] T002 Pull the real seeded data (settings/skills/projects/experiences/articles/testimonials) — confirm no images in the list contracts (type-led direction).
- [X] T003 Define the new visual concept + rationale; record the 006 rejection decision (D03-8). Keep violet + zinc.
- [X] T004 Prototype the signature (Nameplate + one ink section); screenshot EN + AR, light + dark; critique against "any dev portfolio?" — pass before scaling.

## Phase 1 — Token layer
- [X] T010 Add display register: import Space Grotesk + Cairo; `--font-display` / `--font-display-arabic`; Arabic swap in one place (D14-6).
- [X] T011 Add `--text-mega` (nameplate) with per-token metrics; Latin tracking reset for Arabic.
- [X] T012 Add `.on-ink` theme-aware surface (light 50/elevated/950; dark 950/900/800) (D14-7, D03-10).
- [X] T013 Add `.kicker` utility (Latin mono/tracked → Arabic Plex/normal) + defensive Arabic `tracking-*` reset.

## Phase 2 — Primitives
- [X] T020 `ui/Spread.vue` (tone paper/lift/ink, ruled, as).
- [X] T021 `ui/SectionHead.vue` (kicker + display title + action slot, accent).
- [X] T022 Content entries: `WorkEntry`, `TimelineEntry` (markdown impact bullets), `ArticleRow`, `QuoteBlock` (null-safe avatar).

## Phase 3 — Home (data-driven, state-isolated)
- [X] T030 `home/Nameplate.vue` (mega name, role, value prop, CTAs, availability plane, baseline register; i18n fallback).
- [X] T031 `home/Capabilities.vue` (ink; grouped skills; brand-colour dots).
- [X] T032 `home/SelectedWork.vue` (featured cap 3; WorkEntry rows).
- [X] T033 `home/Timeline.vue` (current-first; TimelineEntry).
- [X] T034 `home/Writing.vue` (latest 3; ArticleRow; live `/blog/{slug}`).
- [X] T035 `home/Voices.vue` (testimonials pull quotes).
- [X] T036 `home/Contact.vue` (closing ink plate; mailto + scheme-safe social).
- [X] T037 `pages/index.vue` — wire the ink/paper section rhythm + redesigned API-unavailable fallback.

## Phase 4 — Shell
- [X] T040 `layout/Header.vue` — display wordmark, violet active nav (`aria-current`), Contact plate, switchers, considered mobile overlay (trailing-edge, both directions).
- [X] T041 `layout/Footer.vue` — colophon + nav + scheme-safe social + availability + résumé + switchers + copyright; degrades to nav shell.
- [X] T042 Install `@iconify-json/simple-icons`; migrate blog index to `SectionHead` + `ArticleRow`.
- [X] T043 i18n: `home.hero.since`, `footer.colophon` in both locales.

## Phase 5 — Remove the rejected baseline (HR-2)
- [X] T050 Delete 006 home sections + cards + primitives (`Hero`, `TechStack`, `FeaturedProjects`, `ExperienceSummary`, `LatestArticles`, `Testimonials`, `ContactCta`, `ProjectCard`, `ArticleCard`, `TestimonialCard`, `ExperienceItem`, `UiBrandMark`, `UiDatumLabel`, `UiSection`, `UiSectionHeader`, `UiTechBadge`) + their specs.

## Phase 6 — Tests (HR-7, rewrite not delete-to-green)
- [X] T060 New specs for all new components (13 files): grouping/filter/sort logic, state handling + retry, markdown bullet parse, null-safety, scheme filter, tone-class mapping. `test` → 24 files / 78 tests green.

## Phase 7 — Verification
- [X] T070 Visual matrix: EN/AR × light/dark × desktop/tablet/mobile; header states; mobile nav (both locales); footer; all sections. Judged genuinely-new + portfolio-quality.
- [X] T071 SSR: no hydration mismatch (fresh server), 0 console errors both locales. Router "no-match" warnings are the carried web-005 limitation only.
- [X] T072 Gates: `typecheck` 0 errors · `lint` · `test` 78 · `build` · `check:bundle` · `check:logical`.

## Phase 8 — Governance & docs (D16-8 gate)
- [X] T080 **Seed (D16-9 §5.2 / D09-15):** no data change — the existing owner-grounded dev seed is reused and re-verified; governance rule preserved (HR-6).
- [X] T081 Docs: D03-8/9/10 (design), D14-6/7 (tokens); feature-map row 007; Arabic component README; SpecKit spec/plan/tasks; handoff + MEMORY.
- [X] T082 Freeze upheld: Web/API `main` unchanged; no deploy/promotion/dispatch/prod-config/DB/R2/secrets.
