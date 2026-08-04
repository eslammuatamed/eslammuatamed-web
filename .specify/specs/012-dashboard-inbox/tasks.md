# Feature 012 — Tasks

**Status: IMPLEMENTATION COMPLETE — in final release verification.** The doc 20 budget class and
measurement method (**D20-23**, Docs `4704475`) and the superseding two-tier ceiling (**D20-24**,
Docs `d77f414` — **300 KB gz quality target / 320 KB gz hard release ceiling**) are both merged, as
is the Dashboard validation boundary (**D11-7**, same Docs SHA). No owner decision blocks this
slice. `/dashboard/messages` measures **295.5 KB gz**, below the quality target and therefore green
without a warning. The remaining gate is the **final release matrix**; PR #33 stops before merge.

## Phase A — gates before code (CLOSED)

- [x] T001 Doc 20 authenticated-route budget class, threshold and measurement method — **D20-23 merged**, Docs `main` `4704475`
- [x] T002 `/projects` public headroom — **accepted** for this slice; 250 KB not raised; `/projects` is the watch route
- [x] T003 Copy deltas — English-only; `archiveConfirm.*` removed; `filter.unread`/`filter.read` removed; phone + nav keys added
- [x] T004 Retention wording fixed and placed in the Archived view only; filter set fixed at two views
- [x] T005 Docs-first landed **before** any budget-affecting code
- [x] T006 Contract confirmed `3347f625…` — no doc 16 §3 adoption required

## Phase B — copy

- [ ] T010 Add approved English `dashboard.messages.*` keys to `i18n/locales/en.json`
- [ ] T011 Add `dashboard.nav.*` keys (Overview, Communication group)
- [ ] T012 Assert **no** `dashboard.*` key enters `ar.json`; document the parity boundary in the test (no whole-file gate exists; no public parity check is weakened)
- [ ] T013 Assert no key references a route that does not exist

## Phase C — durable dashboard shell

- [ ] T020 `useDashboardNav()` — declarative model, existence + role filtering (D11-2 courtesy only)
- [ ] T021 `DashboardNavList.vue` — single renderer for both surfaces; groups, active state, `aria-current`, badge slot
- [ ] T022 `DashboardSidebar.vue` — desktop rail
- [ ] T023 `DashboardNavDrawer.vue` — mobile drawer; focus trap; closes on navigation
- [ ] T024 `DashboardHeader.vue` — drawer trigger, user email, theme toggle, sign-out
- [ ] T025 Rework `layouts/dashboard.vue` to orchestration only; keep the existing skip link
- [ ] T026 Active-state correctness: `/dashboard` exact-match, section roots prefix-match
- [ ] T027 Prove no disabled/placeholder link renders; adding a future group is data-only

## Phase D — unread badge

- [ ] T030 `useUnreadCount()` over shared `useState('dashboard:unread')`
- [ ] T031 Derived request `?isRead=false&isArchived=false&perPage=1` → `meta.total`
- [ ] T032 In-flight promise dedup — concurrent shell + page callers issue **one** request
- [ ] T033 `ensureFresh()` staleness rule; `invalidate()` after each successful mutation
- [ ] T034 Hidden at zero; bounded `99+` display; accessible name
- [ ] T035 Assert no polling timer and no socket is created

## Phase E — Messages list

- [ ] T040 `useMessages()` — list read, view/page from URL, `perPage` explicit
- [ ] T041 `app/pages/dashboard/messages.vue` with `auth` middleware and dashboard layout
- [ ] T042 `UTable` columns (from, subject, received, status) + `UPagination`
- [ ] T043 Exactly two views (Inbox / Archived) via `isArchived`; `isRead` never sent as a filter; never re-sort client-side
- [ ] T044 Read/unread styling that is not colour-only
- [ ] T045 Per-row actions in a trailing `UDropdownMenu` — no nested interactive controls in a row
- [ ] T046 States: loading skeleton, initial empty, filtered empty, error+retry, forbidden (403)

## Phase F — detail via URL

- [ ] T050 `?message=<id>` drives a **derived** slideover open state
- [ ] T051 Open from the in-memory row — **no** detail request
- [ ] T052 Reload with a valid parameter restores detail; unknown id → not-found + parameter cleared
- [ ] T053 Back/Forward closes and reopens correctly
- [ ] T054 Focus enters the slideover; returns to the originating row on close
- [ ] T055 Plain-text body: `pre-wrap`, wraps long words/URLs, no overflow, text preserved exactly
- [ ] T056 `dir="auto"` on name/subject/body; isolated LTR on email/phone

## Phase G — triage mutations

- [ ] T060 Confirmed `mark read` on open; failure keeps unread and never hides the badge
- [ ] T061 Explicit `Mark as unread`
- [ ] T062 Archive / unarchive — confirmed, no per-action modal
- [ ] T063 Recoverable error surface + polite live-region announcement
- [ ] T064 Archived view retention notice (approved wording)
- [ ] T065 Contact affordances: `Reply by email` (guarded `mailto:`, `Re:` prefill, no-composer hint); `Call` + `Copy number`; **no** WhatsApp; phone-only and email-only render nothing broken or empty

## Phase G2 — responsive list (owner decision 12, approved after visual review)

- [ ] T066 Table wrapper `hidden sm:block`; card list `sm:hidden` — CSS only, no JS viewport branch
- [ ] T067 Card = `<article>` with ONE full-width opener button + sibling `UDropdownMenu`; no nesting
- [ ] T068 Opener accessible name carries state, sender and subject; keyboard-activatable
- [ ] T069 Store the opener ELEMENT for focus return; never look it up by message id
- [ ] T069a Assert no duplicate ids and no document overflow at 320/360/390 and 200% zoom
- [ ] T069b Cards reuse the same list state, slideover and mutations — no second data path

## Phase G3 — Nuxt UI / Zod architecture (owner decision 13)

- [x] T069c `UCard` replaces the bespoke card surface; presentational only, `as="article"`, `ui` padding override
- [x] T069d Canonical Zod route-query schema for `view` / `page` / `message`; total, pure, no URL rewrite
- [x] T069e `isMessagesView` deleted — one validator, not two
- [x] T069f Login form audited: already `UForm` + `UFormField` + Zod with typed `z.output` — no gap
- [x] T069g **RESOLVED by D20-24** (Docs `d77f414`) — the 280 KB ceiling is superseded by a 300 KB gz quality target / 320 KB gz hard ceiling. `/dashboard/messages` measures **295.5 KB gz (302,582 B)**: below the quality target, green **without** a warning. Neither `UCard` nor regular Zod was reverted
- [x] T069h **APPLIED as D11-7** (Docs `d77f414`) — doc 11 gains §4.1 covering route/query parsing with regular Zod, recorded as clarifying a gap rather than changing the approved form rule
- [x] T069i Two-tier gate implemented — `dashboardTotalVerdict` (PASS/WARN/FAIL) with the six-part D20-24 attribution block on WARN, plus dashboard breach detail that the public loop never printed
- [x] T069j Warn/block bands covered by unit tests (exact-byte boundaries at 300 KB and 320 KB), since neither band executes on a green run at this head

## Phase H — budgets, isolation, a11y

- [ ] T070 Implement the D20-23 closure (**seed, then static closure** — never expand the entry's `dynamicImports` route map); add `/dashboard`, `/dashboard/login`, `/dashboard/messages`
- [ ] T070a **Trust gate:** reproduce the `76f8fa6` ground truths (`/dashboard` ≈ 206.2, `/dashboard/login` ≈ 223.2 KB gz) and prove via a synthetic chunk-graph fixture that a dashboard-only chunk raises the dashboard closure while public closures stay unchanged. **Do not continue if the measurement is not trustworthy.**
- [ ] T071 Assert the dashboard class — total JS **≤ 300 KB gz quality target / ≤ 320 KB gz hard ceiling** (D20-24), app-owned **≤ 101 KiB**, CSS **≤ 30 KB gz** (both unchanged from D20-23); re-measure every public route against frozen ceilings; record the exact router-manifest delta
- [ ] T072 `check-forbidden-modules.mjs` — no Markdown/editor weight in any client chunk
- [ ] T073 Confirm table code stays in a dynamic chunk, absent from entry/static chunks
- [ ] T074 Full axe pass incl. 200 % zoom, reduced motion, long Arabic/mixed-language content
- [ ] T075 Logical-properties (RTL) gate

## Phase I — tests

- [ ] T080 Unit: nav model (existence/role filtering), `useUnreadCount` dedup + invalidation, `mailto:` construction incl. the null-email guard
- [ ] T081 Component: list states, read/unread styling, phone-only vs email-only affordances, bidi attributes
- [ ] T082 E2E: list → open (marks read) → mark unread → archive → Archived view → unarchive
- [ ] T083 E2E: URL selection — deep link, reload, Back/Forward, unknown id
- [ ] T084 E2E: mutation failure keeps state, announces error, badge not hidden
- [ ] T085 E2E: 403 renders forbidden, not an empty list
- [ ] T086 **Prove the list contract is sufficient** — assert the list row carries the full body, justifying the absence of a detail request (plan §5)
- [ ] T087 Verify against the real API + dev seed on a throwaway database with an external temp env — the real `.env` is never read or written

## Phase J — close

- [ ] T090 Documentation & Handoff Gate (doc 16 §5.1 / D16-8)
- [ ] T091 Update `.specify/memory/feature-map.md`
- [ ] T092 Full gate: lint · typecheck · unit · e2e · build · isolation · budgets · logical-properties
- [ ] T093 Open the Web PR against `dev`; **do not merge**
- [ ] T094 Clean up worktrees, disposable DB and temp env; verify all pre-existing dirty state and stashes preserved

## Not in this slice

Reply composer · SMTP · bulk actions · tags · assignments · notes · search · CRM · reply
history · real-time/sockets · WhatsApp on a visitor number · delete · API changes · Arabic
dashboard chrome · issue #30 · Skills taxonomy · promotion to `main` · deployment.
