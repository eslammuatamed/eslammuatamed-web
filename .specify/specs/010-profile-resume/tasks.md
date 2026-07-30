# Feature 010 — Tasks

Checked only after execution and verification.

## Contract

- [x] T001 Verify API contract sufficiency at `188e7718` against API source, not only OpenAPI
- [x] T002 Adopt `openapi.json` `f6451878…` + regenerate types `3ecd3b66…` (one atomic commit, doc 16 §3)
- [x] T003 Run type generation twice, confirm byte-identical output
- [x] T004 Confirm drift is purely descriptive and zero unrelated files changed

## Data layer

- [x] T010 `useResumeData()` — settings on the shared `settings:site:{locale}` key namespace
- [x] T011 Reuse `useExperiences()` verbatim (FR-PUB-024 by construction)
- [x] T012 Skills read on `skills:{locale}` with the route locale
- [x] T013 Three independent reads so one failure degrades one section
- [x] T014 `app/utils/resume.ts` — `groupSkills`, `resumeEmail`, `resumeLinks`, `formatFileSize`, `impactBullets`

## Page

- [x] T020 `/resume` + `/ar/resume` via `app/pages/resume.vue`
- [x] T021 Identity header: name, governed tagline, professional email, profile links
- [x] T022 `ResumeActions` — download, honest unavailable state, print
- [x] T023 `ResumeEntry` — compact role entry, `<time datetime>`, API technology order
- [x] T024 Skills section grouped by API group, order preserved
- [x] T025 Per-section empty and error states, localized, with retry
- [x] T026 No About bio / philosophy / focus / availability / phone / contact email
- [x] T027 Semantic structure: one h1, h2 sections, `<ol>` for roles, `<ul>` for lists

## Print

- [x] T030 `@media print` gated on `body:has(.resume-page)` so rules cannot leak to other routes
- [x] T031 Hide header, footer, download and print controls
- [x] T032 Ink-efficient: white ground, black text, hairline borders, no shadows
- [x] T033 `break-inside: avoid` on entries; `break-after: avoid` on headings
- [x] T034 No forced paper size; `cm` margins usable on A4 and Letter
- [x] T035 EN and AR both print correctly, direction preserved

## i18n

- [x] T040 EN keys under `resume.*` and `seo.resume.*`
- [x] T041 AR keys, native Arabic, no English fallback
- [x] T042 Additive-only change to both locale files (verified: 56 insertions, 0 deletions)

## SEO

- [x] T050 Localized title/description + OG/Twitter title/description
- [x] T051 Locale keeps canonical/hreflang/x-default/`og:locale` (D22-7)
- [x] T052 BreadcrumbList only — no second `ProfilePage`, no duplicate `Person` (D22-8)
- [x] T053 No `og:image` (F-1 open)

## Tests

- [x] T060 `app/utils/resume.spec.ts` — 19 unit tests
- [x] T061 `app/composables/useResumeData.spec.ts` — 7 tests incl. the no-second-source proof
- [x] T062 `app/components/resume/Entry.spec.ts` — 12 tests
- [x] T063 `app/components/resume/Actions.spec.ts` — 15 tests
- [x] T064 `app/pages/resume.spec.ts` — 20 tests incl. AR copy reaching the DOM
- [x] T065 `e2e/resume.spec.ts` — contract lane (Prism)
- [x] T066 `e2e/scenarios/resume-states.spec.ts` — PDF-null, empty, error, locale transition
- [x] T067 `resume-pdf` lane: fixtures, backend variant, preview backend, Playwright project
- [x] T068 `e2e/resume-pdf/resume-download.spec.ts` — real `Content-Type`/`Content-Disposition`
- [x] T069 Unfiltered axe across EN/AR × desktop/mobile, plus both scenario lanes

## Gates

- [x] T070 lint
- [x] T071 typecheck
- [x] T072 typecheck:e2e
- [x] T073 unit/component suite
- [x] T074 build + bundle isolation
- [x] T075 route-size + CSS budgets for `/resume` and `/ar/resume`
- [x] T076 e2e: contract + scenarios + readiness + resume-pdf (216 passed)
- [x] T077 flake check at CI concurrency (3 consecutive green runs, 0 flaky)
- [x] T078 Lighthouse desktop + mobile medians
- [ ] T079 Exact-head CI green — awaiting the run on the pushed head

## Docs-first

- [x] T080 Docs D20-21 adding `/resume` + `/ar/resume` to the performance matrix (no threshold change)
- [x] T081 Squash-merge the Docs performance PR before Web merge eligibility (PR #30 → `c02dc23d`)
- [x] T082 Docs governance for the canonical 2026-08 PDF (identity by SHA-256, 2026-07 superseded) — PR #31 **opened and deliberately left open** (a retained blocker)
- [x] T083 Arabic module documentation for the résumé slice
- [x] T084 Feature-map entry for 010

## Blocked / not started (by instruction)

- [ ] Production PDF upload and `resumeAssetId` assignment
- [ ] Contact slice
- [ ] Branded social-card fallback (F-1)
- [ ] Prisma 7
- [ ] Promotion to `main` / deployment
