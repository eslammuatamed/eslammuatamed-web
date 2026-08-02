# Feature 011 — Tasks

## Phase A — contract adoption

- [x] T001 Adopt API `dev` `b2d1412` contract atomically (`openapi.json` + `api:types`)
- [x] T002 Verify type generation is deterministic (two runs byte-identical)
- [x] T003 Record API SHA, contract hash, generated-type hash
- [x] T004 SpecKit `011-public-contact` — spec, plan, tasks; dashboard copy recorded as deferred

## Phase B — copy

- [ ] T010 Add `contact.*` (37 keys) to `i18n/locales/en.json` and `ar.json`
- [ ] T011 Add `seo.contact.*` (2 keys) to both locale files
- [ ] T012 Assert EN/AR key parity for the new namespaces
- [ ] T013 Confirm **no** `dashboard.messages.*` key enters either locale file in this slice

## Phase C — page

- [ ] T020 `app/pages/contact.vue` — breadcrumb, identity, fallback, form, availability, status region
- [ ] T021 `UForm` + `UFormField`, blur/touched validation mirroring the API caps exactly
- [ ] T022 Client-side trim of the four visible values; whitespace-only rejected client-side
- [ ] T023 Honeypot — non-`website` DOM name, clip-hidden, `tabindex="-1"`, `aria-hidden`, hidden label, mapped onto `website` only at submission
- [ ] T024 Time trap — `performance.now()` origin, re-checking wait, re-measure, integer actual `elapsedMs`
- [ ] T025 Double-submit lock spanning the anti-spam wait and the network request
- [ ] T026 Submit-time focus of the first invalid field + one validation summary
- [ ] T027 Direct-email fallback from `settings.contactEmail` only; omitted when null
- [ ] T028 Availability note from `settings.availabilityStatus` only; omitted when null
- [ ] T029 `{retryAfter}` formatter — positive-integer-only, round up, `Intl.RelativeTimeFormat` with `numberingSystem: 'latn'` (D03-4)
- [ ] T030 Locale-switch reset — values, honeypot, status, timing origin; atomic route/lang/dir/SEO
- [ ] T031 SEO — `useSeoMeta` title/description only; `WebPage` + `BreadcrumbList`; no `og:image`, no second `Person`, no `ContactPage`

## Phase D — tests

- [ ] T040 Component/unit — all eleven states, validation, trimming, honeypot mapping, elapsed measurement, double-submit, locale reset
- [ ] T041 Extend `scripts/e2e/scenario-server.ts` with a POST `/contact` handler (no fifth server pair)
- [ ] T042 Scenario selection via `page.setExtraHTTPHeaders()`, scoped to the `ssr-scenarios` project only — never sent to the real API
- [ ] T043 E2E — EN/AR SSR, neutral 200, 422, 429 with and without a readable `Retry-After`, 500, network failure
- [ ] T044 E2E — `contactEmail` present/null, `availabilityStatus` present/null
- [ ] T045 E2E — no PII in URLs, console output or test logs
- [ ] T046 A11y — keyboard-only flow, 200% zoom, 320px `<main>` layout, reduced motion
- [ ] T047 Unfiltered axe — EN/AR × light/dark × mobile/desktop
- [ ] T048 Review `app/pages/experience.spec.ts:109` and `app/pages/about.spec.ts:176,234` (`not.toContain('/contact')`)
- [ ] T049 Repeat-based flake sweep at CI concurrency; confirm no new issue-#30 regression

## Phase E — real disposable API proof

- [ ] T060 Submit a unique message through the browser against a disposable DB + external temp env
- [ ] T061 Verify the row exists and all four visible fields are stored **trimmed**
- [ ] T062 Verify it appears via authenticated `GET /admin/messages`, unread and unarchived
- [ ] T063 `PATCH` read → verify; archive → verify `archivedAt`; unarchive → verify `archivedAt = null`
- [ ] T064 Delete only that row in the disposable DB, then drop the disposable DB
- [ ] T065 Confirm production untouched (trusted-proxy/test-IP isolation stayed local)

## Phase F — budgets

- [ ] T070 Add `/contact` + `/ar/contact` to `lighthouserc.cjs` and `check-route-size.mjs`; remove both deferral comments
- [ ] T071 Build, bundle isolation, route-size, CSS, Arabic-font budgets
- [ ] T072 Lighthouse desktop + mobile, three runs each, median assertions
- [ ] T073 Measure Home, Experience, About, Resume for no regression
- [ ] T074 Record zod's route impact separately; apply the pre-approved fallback only if a frozen budget fails
- [ ] T075 Exact-head CI green

## Phase G — close

- [ ] T080 Open the Web PR against `dev`; **do not merge**
- [ ] T081 Final verification report
- [ ] T082 Delete `.omc/research/contact-copy-inventory-and-api-correction.md` **after** T004 captured its content
- [ ] T083 Clean up worktrees, disposable DB, temp env; verify all pre-existing dirty state and stashes preserved

## Not in this slice

Dashboard inbox (Web PR 2) · integrated Contact closeout · issue #30 · `og:image` ·
Prisma 7 · promotion to `main` · deployment.
