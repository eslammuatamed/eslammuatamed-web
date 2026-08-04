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

## Status — MERGED to `dev` at `890366a` (2026-08-03)

- PR **#31 is MERGED** (squash, `2026-08-03T05:48:18Z`), merging head `2056712` into `dev`. The
  resulting Web `dev` commit is **`890366a303ff58e1040466d155b42ea88ce9de2c`**. The Contact public
  Web implementation is **complete on `dev`**.
- **Nothing was deployed** and `dev` was **not promoted to `main`** (`main` unchanged at `6898cf8`).
  Deployment runs only from `main`, so a `dev` merge cannot trigger one.
- **Post-merge CI run `30788194072` is green** — `push` event on `dev` at head SHA exactly
  `890366a`. This **supersedes** the pre-merge note below: exact-head CI was structurally
  unavailable for the *PR* branch, but the post-merge push run *is* exact-head CI on the merged
  commit, so **T075 is satisfied**.
- Dashboard Inbox (Web PR 2) **not started**. Issue **#30 remains open and untouched**.

### Pre-merge verification record (historical — kept as evidence, at head `31f0ac0`)

The matrix below was run at Web head `31f0ac0` *before* the merge. It is retained as the
verification evidence that supported the owner's merge approval; its SHAs are historical and are
**not** the current state of `dev`.
- **Final matrix run at `31f0ac0`.** Lint, typecheck, e2e typecheck clean (0 TS errors).
  **784** unit/component. Full browser suite. Repeat sweep `--repeat-each=3`, workers 2, retries 0:
  **751 passed / 2 failed / 753**, Contact **54 executions, 0 failures** across all 3 repetitions.
- **Both sweep failures are pre-existing issue #30**, proven by differential rather than by signature
  matching: base `acdbda8` and head run under the identical command, worker count, retry policy,
  Node v24.15.0 / npm 11.13.0, lockfile md5 `39994207e350be88a5db7da5613d0bc2`, Playwright 1.62.0,
  same idle host, run sequentially. Base 646/648 with the SAME two failures at the SAME repeat index
  (`harness.spec.ts:37` axe colour-contrast repeat2; `locale-head-contract.spec.ts:80` hydration
  repeat2). Base contains no Contact code and no shared-header change, so neither is attributable to
  this branch; head is not measurably worse (0.27% vs 0.31%).
- **Full unfiltered WCAG 2.2 AA axe matrix: 40/40 clean** — EN/AR × desktop/mobile × light/dark ×
  idle/validation/server-error/rate-limit/success. No horizontal overflow at 320/360/390, both locales.
- **One Contact blocker found and fixed at this head.** The dark success-state `Send another message`
  label measured **3.08:1** (`#7f22fe` on `#1a1129`) against the 4.5:1 AA minimum for 14px normal
  text. Deterministic, not the issue-#30 transitional-opacity artifact: identical at 400 ms and
  3000 ms settle, no compositing ancestor, reproduced through the app's own colour-mode path with no
  class injection. `variant="soft"` occurs exactly once in the app, so it was Contact-introduced. No
  gate covered it — the axe lane and Lighthouse both run the default light scheme. Corrected
  owner-approved with `dark:text-primary-300`: now **9.79:1**; light mode provably unchanged
  (still violet-600 `#7f22fe` on `#efe6fc` = 4.88:1).
- Budgets re-measured after the fix: `/contact` and `/ar/contact` **232.2 KB gz / 250**, app-owned
  **75 601 B / 101 KiB**, CSS **29.24 KB / 30**, Arabic fonts 117.6 KB / 130; bundle isolation
  (44 chunks) and logical-properties clean. Home, About, Résumé, Experience unchanged.
- Lighthouse 3 runs per route/profile, all medians within doc 20 §1.
- Real disposable-API + DB proof against API `dev` `9a79bbe`: nullable settings, the five owner-number
  shapes, every submission shape, normalization, trimming, blank→null, one row per valid request,
  honeypot and time-trap not persisted, the `contact_messages_contact_method_present` CHECK rejecting
  both-absent/blank/whitespace, and the inbox read/archive/unarchive lifecycle. No PII in any log.
  DB dropped, rows deleted, servers stopped.
- **GitHub PR merge-ref CI green at `8dfa847`** (= merge of `31f0ac0` into `acdbda8`). GitHub's
  `pull_request` event fetches only `refs/remotes/pull/31/merge`, so head-SHA CI was structurally
  unavailable *for the PR branch* — the merge-ref result must not be relabelled as exact-head CI.
  **Superseded after the merge:** post-merge run `30788194072` is a `push` event at head `890366a`
  and therefore *is* exact-head CI on the merged commit (see the current status above).
- No threshold changed, no retry added, no timeout raised, no assertion weakened.

## Open defects — must be fixed before the browser lane runs

- [x] **F-6 — FIXED.** Root cause: `UForm._validate({name})` replaces the error list filtered to the
  changed field, and `input` only revalidates an already-blurred field, so a cross-field issue keyed
  to `email` was never re-judged when the phone changed. The invariant is now a computed over current
  form values rather than a stored form error. Regression-tested in component and browser lanes.

- [x] ~~**F-6 (original report).**~~ After a failed submit leaves the pair error on `email`,
  subsequently filling the phone does not clear it and the resubmit stays blocked. A phone-only
  submission from a CLEAN page load works correctly (verified in a browser), so this is stale
  cross-field error state, not the pair rule itself: `superRefine` is an object-level check and
  `UForm` appears to retain the issue keyed to `email` until a full re-validation. Reproduce:
  submit empty → fill name/subject/message/phone → submit. Not yet diagnosed; not worked around.

## Not in this slice

Dashboard inbox (Web PR 2) · integrated Contact closeout · issue #30 · `og:image` ·
Prisma 7 · promotion to `main` · deployment.
