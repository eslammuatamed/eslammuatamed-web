# Tasks — Profile Pages: Experience Slice (008)

Slice of the `web-005` Profile Pages umbrella. Branch `008-profile-experience` off Web `dev` `c1e698d`.

Legend: `[x]` done · `[ ]` open · `[owner]` blocked on owner review.

> A box is ticked only after the command has actually been run and passed in this branch. An
> unticked box below is genuinely outstanding, not an oversight.

## T0 — Baseline and identity

- [x] T001 Fetch Docs/API/Web remotes; verify all three checkpoints (Docs `a1be740`, API `f3a8e9eb` /
      `40a0c917`, Web `c1e698d`) — **all matched, no divergence**
- [x] T002 Confirm no open conflicting Web PR, clean worktree, zero stashes, ports free
- [x] T003 Inspect SpecKit + feature-map conventions; create `008-profile-experience` preserving
      `web-005` as the umbrella; record the relationship in `spec.md` and the feature map

## T1 — Contract adoption (one atomic commit, doc 16 §3)

- [x] T010 Copy `openapi.json` from API `f3a8e9eb` → sha256 `3376ac58…` (was `7b8c8291…`)
- [x] T011 `npm run api:types`; prove idempotence (two runs → `api.d.ts` sha256 `56f7b714…`)
- [x] T012 Enumerate schema-level drift — **purely additive**, no removals/paths/version change
- [x] T013 Adapt test fixtures for newly-required properties (Profile fields `null`, `technologies []`)
- [x] T014 Commit `5f6282e` — contract + types + adaptation together

## T2 — Docs and design trace

- [x] T020 FR-PUB-021, D02-9, D06-6, D03-13, D22-7, D22-8, D10-6, D18-6, D16-8/D16-9
- [x] T021 Confirm ordering is API-owned (`startDate desc, order asc`; technologies by `Skill.order`)
- [x] T022 Confirm structured-data type from doc 22 §4 + D22-8 → **`BreadcrumbList` only**
- [x] T023 Inspect Home / Projects index / Project detail / shared primitives for visual continuity

## T3 — Implementation

- [x] T030 `Experience` + `ExperienceTechnology` model aliases
- [x] T031 `useExperiences()` — route locale (D06-6), key == sent locale, `watch: [locale]`
- [x] T032 `ContentTimelineEntry`: technologies list (labelled, API order), `<time datetime>` pair,
      `headingLevel` prop mirroring `ContentWorkEntry`
- [x] T033 `app/pages/experience.vue` — shell mirroring `/projects`, `<ol>` timeline, states
- [x] T034 EN/AR copy: `experience.*` (10 keys) + `seo.experience.*` (2 keys); key parity verified
- [x] T035 `BreadcrumbList` JSON-LD; no `ProfilePage`, no second `Person`
- [x] T036 No `ogImage` — no fallback asset exists; recorded as finding F-1, not faked

## T4 — Tests

- [x] T040 Unit: `TimelineEntry.spec.ts` extended (12 tests) — technology order, `<time>`, heading
      level, empty fields, decorative elements hidden
- [x] T041 Unit: `useExperiences.spec.ts` (7 tests) — request shape, route-vs-UI locale, no re-sort,
      no cross-locale fallback, error capture
- [x] T042 Contract e2e `e2e/experience.spec.ts` (24 tests) — EN/AR direct load, SSR completeness,
      semantics, strict SEO, locale switch, axe matrix
- [x] T043 Scenario backend `/experiences` handler + `scenario-server.spec.ts` coverage
- [x] T044 Scenario e2e `e2e/scenarios/experience-states.spec.ts` (9 tests) — empty, error/retry,
      D03-13 atomicity, head-vs-direct-load invariant
- [x] T046 Page spec `app/pages/experience.spec.ts` (6 tests) — covers the two state x locale
      combinations the scenario lane cannot reach (**AR empty**, **EN error**), resolving `t` against
      the real locale files so a missing or English-leaking Arabic string fails
- [x] T045 Unfiltered axe: EN + AR × desktop + mobile × light + dark (8 scans), each asserting the
      emulated colour scheme actually reached `<html>` so no two scans are silent duplicates

## T5 — Gates

- [x] T050 `lint` · `typecheck` · `typecheck:e2e` — all clean
- [x] T051 Unit/component — **50 files, 510 tests**, exit 0 (no unhandled errors)
- [x] T052 Contract + scenario e2e — **107 tests**
- [x] T053 Flake check at CI concurrency — `CI=1 npx playwright test --repeat-each=3`
      (2 workers, 0 retries): **321 passed, 0 flaky**
- [x] T054 `build`
- [x] T055 `check:bundle` — 39 public chunks, no editor/dashboard identifiers
- [x] T056 `check:logical` — logical properties only
- [x] T057 `size` (CSS) + `size:routes` with `/experience` and `/ar/experience` added to `ROUTES`
- [x] T058 Lighthouse collect (mobile + desktop, 3 runs x 10 URLs each) with both new routes added
      to the URL list, then `lhci:assert` — **all medians within doc 20 §1, no threshold changed**

## T7 — Owner review corrections (2026-07-29)

- [x] T080 Isolate the home summary: `showTechnologies` prop (default **false**), `/experience` opts
      in, no route checks in the shared component, no duplicated component, markup absent from the
      DOM when disabled
- [x] T081 Lock both sides — home spec asserts the prop is never enabled and no chip text renders;
      component spec asserts default renders no technology markup; page + e2e specs assert
      `/experience` still renders them in API order
- [x] T082 Home bundle after correction vs pre-slice baseline recorded (91170 → 93132 B)
- [x] T083 Docs-first: doc 20 **D20-18** adds `/experience` + `/ar/experience` to the Lighthouse
      matrix — Docs PR #23, squash `78bc945d32c8ab37a9a8ebfc3ac957489bd441df`, doc 20 **v1.11.0**
- [x] T084 Full exact-head re-verification after the amendment

## T6 — Closeout (D16-8 / D16-9)

- [x] T060 Arabic module documentation
- [x] T061 SpecKit `spec.md` / `plan.md` / `tasks.md`
- [x] T062 Feature-map row for 008; `web-005` umbrella left OPEN
- [x] T063 Record API/OpenAPI source SHA + hash, test totals, performance evidence — in the PR body
- [x] T064 Verify no secrets, clean diff, clean worktree, zero stashes
- [ ] T065 **[owner]** Native Arabic UI copy review — **blocks merge**

## D16-9 — seed data

- [x] T070 No new seed required: this slice consumes the existing `/experiences` contract, and the
      dev/demo seed already ships experience rows (feature 006/007). Technologies come from the
      existing Skill registry through `ExperienceTechnology`, which the API seeds. Recorded rather
      than skipped silently.

## Out of scope (unchanged)

`/about` · `/resume` · Resume PDF · `/uses` · Contact · analytics/GTM · social-card artwork ·
Prisma · API changes · deployment · promotion · About copy into API seeds · portrait upload.
