# Feature 012 — Dashboard Inbox

**Umbrella:** closes the Contact feature begun in `011-public-contact` (the umbrella
`web-005` stays OPEN for remaining public pages).
**Route:** `/dashboard/messages` (English-only dashboard chrome; **no** `/ar/dashboard/messages`
destination is linked — the i18n-generated Arabic route stays unlinked, as for every other
dashboard route).
**Requirements:** `FR-DSH-060`. Flow `F-D5`.
**Contract source:** API `origin/dev` `c4fc4ad06203a6666afe7abfc902ee0191002707`
(`openapi.json` `3347f6253d2b…`). **No contract change** — the Web already carries this exact
`openapi/openapi.json`, so **no doc 16 §3 adoption commit is required**.
**Governed by:** doc 02 (FR-DSH-060), doc 04 (IA), doc 05 (F-D5), doc 11 §1/§2/§3, doc 13,
doc 19 §6, doc 21, and **doc 20 v1.16.0 §1.1–§1.3 / D20-23** (authenticated dashboard budgets),
merged to Docs `main` **`470447501363fbc733e2833ec8b9b0275dbbce72`**.

## 1. Why this slice exists

Public Contact intake shipped in 011 and is live on `dev`. Messages now accumulate in the
database with **no owner-facing surface at all** — the only way to read one today is a direct
database query. This slice makes the platform's single conversion point answerable.

It is also the first **data-backed** dashboard route. `/dashboard` is a placeholder and
`/dashboard/login` is an auth form; there is no sidebar, no table, no pagination, no filter and
no mutation pattern in the dashboard world yet. This slice therefore establishes the durable
dashboard shell as well as the Inbox itself.

## 2. Scope

**In:** the durable dashboard shell (desktop sidebar, mobile navigation drawer, grouped
navigation model with an optional per-item badge slot, active-route states, authenticated
header, content area); `/dashboard/messages` with list + URL-selected detail; read/unread and
archive/unarchive triage; the sidebar unread badge; email and phone contact affordances;
plain-text + bidi rendering of visitor content; loading, empty, filtered-empty, error and
forbidden states; accessibility; dashboard route budget measurement; tests.

**Out (explicitly):** any reply composer or SMTP integration; bulk actions; tags, assignments
or internal notes; search; CRM features; reply history; real-time updates or sockets; a
WhatsApp action on a visitor number; any API change; issue #30; Skills taxonomy; promotion to
`main`; deployment.

## 3. Owner decisions this slice implements

| # | Decision |
|---|---|
| 1 | **Durable shell** — desktop sidebar, mobile drawer, dashboard header, active-route state, declarative navigation groups/items, optional badge slot, **one shared navigation renderer for desktop and mobile**, route content area. Initial visible destinations **only**: Overview → `/dashboard`; Communication → Messages → `/dashboard/messages`. **No disabled future links.** |
| 2 | **Auth/authz UX.** Existing auth middleware and session boot on every dashboard route; the API stays authoritative. Because the session exposes a role but **not** permission grants: do not infer `messages.read` from role names, do not duplicate a permission matrix, show Messages to authenticated sessions, render a proper forbidden state on `403`, and keep OWNER-only cosmetic gating only where already governed OWNER-only. **No API permission-list endpoint in this slice.** |
| 3 | **URL state** — `/dashboard/messages?view=<inbox\|archived>&page=<n>&message=<id>`. Default `view=inbox`, `page=1`. Back/Forward restores list *and* detail. Closing detail removes **only** `message`. Reload restores the selection when present in the loaded page. Invalid/stale ids are removed safely with a **non-destructive notice**. Filter and pagination stay in the URL. **No redundant detail request** while list rows carry the full body. |
| 4 | **Two views only** — Inbox (all unarchived, API unread-first order preserved) and Archived. **No** All/Unread/Read filters, search, bulk actions, tags, assignments, notes or CRM. Read/unread stays visible via row styling, status text/badge and actions, and **never depends on colour alone**. |
| 5 | **List and detail UI** — `UTable`, `UPagination`, `USlideover`, trailing per-row `UDropdownMenu`; **no nested interactive controls inside an interactive row**. The slideover shows subject, sender name, timestamp, read/unread state, email when present, phone when present, plain-text body, contact actions, read/unread action and archive/unarchive action. Visitor fields: name/subject/body `dir="auto"`; email/phone isolated LTR; body plain text with `white-space: pre-wrap` and safe wrapping of long words and URLs. **No Markdown, HTML, `v-html`, Shiki or markdown-it.** |
| 6 | **Read/unread flow** — opening an unread message requests `mark read`; the read state is **not visually committed until the API succeeds**. On failure: retain unread state, **retain the unread badge count**, show a recoverable error, keep the detail usable. Read messages offer `Mark unread`. All four mutations are **confirmed/pessimistic** with **no optimistic cache surgery**; the affected list and unread count refresh after success. |
| 7 | **Unread badge** — `GET /admin/messages?isRead=false&isArchived=false&perPage=1` → `meta.total`. Active unarchived unread only; hidden at zero; `99+` above 99; fetched during authenticated shell initialization; **state shared between shell and page**; simultaneous requests deduplicated by a single in-flight promise (or equivalent single-owner mechanism); refreshed after successful mutations and on stale return to Messages. **No polling, no sockets.** |
| 8 | **Contact actions** — email present: `Reply by email` via a safe `mailto:` with subject `Re: <original subject>` and an **empty body**; no composer; no claim a reply was sent. Phone present: `Call` and `Copy number`, LTR isolation preserved, **accessible copy-success feedback**. **No WhatsApp for visitor-submitted numbers.** Phone-only: Call + Copy, **no disabled email action**. Email-only: **no empty phone UI**. |
| 9 | **Archive and retention** — archive is not deletion; **no confirmation modal**; confirmed archive/unarchive mutations. The **Archived view** shows exactly: `Archived messages are retained for 12 months from the date they were archived.` — not on every archive click. The obsolete `archiveConfirm.*` keys are removed. |
| 10 | **Copy** — dashboard chrome is **English-only in v1**; the previous bilingual inventory is **not** carried forward. A dashboard-owned English inventory is created (§7). No fabricated Arabic dashboard strings to satisfy parity tooling; the parity boundary is scoped and documented, and **no public parity check is weakened**. |
| 12 | **Responsive list presentation** (approved 2026-08-03, after the visual review found the subject column unreadable at 320px). **`sm` and above keep the existing `UTable`, unchanged**; **below `sm` the list renders as compact message cards**. Both presentations consume the **same list state** and open the **same URL-driven `USlideover`** — there is no second fetch, mutation or unread-count path. No horizontal scrolling for the list, and desktop columns are not reproduced inside the card. Unread stays identifiable without colour alone. |
| 11 | **Offline and error states** — persistent offline banner, mutations disabled offline, **no offline queue**. Required states: session loading · list loading · initial empty Inbox · empty Archived · API error with retry · `401` → session recovery/login · `403` → permission state · mutation failure · offline · stale URL-selected message. |

## 4. Current API surface (verified, not assumed)

Enumerated from the committed contract — exactly three operations:

| Endpoint | Permission | Notes |
|---|---|---|
| `GET /api/v1/admin/messages` | `messages.read` | Unread-first, `isRead` / `isArchived` filters, offset pagination |
| `GET /api/v1/admin/messages/{id}` | `messages.read` | Not required by this design (§2 decision 2) |
| `PATCH /api/v1/admin/messages/{id}` | `messages.update` | `isRead` / `isArchived` only |

- **Unread-first ordering is server-guaranteed:** `orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }]`, backed by `@@index([isArchived, isRead, createdAt])`. The client must **not** re-sort.
- **Pagination:** `page` (default 1), `perPage` (default 12, **max 50**); envelope `meta` = `{ page, perPage, total, totalPages }`.
- **No sort parameter, no text search, no count endpoint, no bulk endpoint, no delete endpoint.**
- `archivedAt` is server-managed: set when `isArchived` flips true, cleared when it flips false, and is the retention-purge basis (D09-14 / D19-10).
- `ContactMessageEntity.email` and `.phone` are `string | null`; **either may be null, never both** (D10-16 (d), backed by the database CHECK). Since API `c4fc4ad`, a blank optional value is normalized to SQL `NULL`, so the UI needs exactly one falsy check per field and never has to treat `''` as a value.

## 5. Permissions — what the Web can and cannot do

`AuthUserEntity` exposes only `role: { id, name }`. **There is no permission list on the session**,
so the Web cannot evaluate `messages.read` / `messages.update` — and, by owner decision, **must not
try**:

- **Do not infer `messages.read` from a role name.** A role name is not a grant.
- **Do not duplicate a permission matrix in the Web.**
- **Messages is shown to every authenticated session.** Visibility is not an authorization claim.
- **API `403` renders a proper forbidden state** — never an empty list, never a hidden nav item.
- **OWNER-only cosmetic gating is retained only where something is already explicitly governed
  OWNER-only.** Nothing in this slice is, so this slice adds none.
- **No API permission-list endpoint is added in this slice.**

This follows **D11-2**: client-side gating is courtesy only; the API is the authoritative
authorizer, and the honest way to represent an unknown grant is to attempt the call and render the
answer.

## 6. States

| State | Behaviour |
|---|---|
| Loading | Skeleton rows; the shell and sidebar remain usable |
| Initial empty | "No messages yet" — distinct from a filtered empty |
| Filtered empty | "No messages match this filter" + a route back to the Inbox |
| Error (5xx / network) | Recoverable error with a retry; existing rows are not discarded silently |
| Forbidden (403) | Explicit no-access state; never an empty list |
| Not found (404 on a selected id) | Detail shows "Message not found"; the list stays usable and the URL parameter is cleared |
| Offline | Dashboard offline banner per doc 05 §4; mutations disabled with an explanation |
| Mutation failure | Previous state retained, recoverable error announced; the unread badge is never silently hidden |

## 7. Copy — dashboard-owned English inventory

**The dashboard is English-only in v1.** The bilingual `dashboard.messages.*` inventory recorded
during 011 is **not carried forward**; this slice creates a dashboard-owned **English** inventory
covering: shell navigation · Inbox and Archived tabs · headings and descriptions · unread/read
states · loading · initial empty · view-empty · error + retry · forbidden · mark read/unread ·
archive/unarchive · Reply by email · Call · Copy number · copy success/failure · retention text ·
pagination · stale selected-message notice · offline.

- The four `archiveConfirm.*` keys are **removed** — decision 9 drops the modal.
- `filter.unread` / `filter.read` are **removed** — decision 4 ships two views only.
- Phone keys are **added**: `detail.phone`, `actions.call`, `actions.copyNumber`, copy feedback.
- **No fabricated Arabic dashboard strings** are added to satisfy parity tooling.

**Locale-parity boundary (decision 10).** Verified: the repository has **no whole-file EN/AR parity
gate**. Parity is asserted **per page spec over that page's owned namespaces** (e.g. `contact.spec.ts`
declares `OWNED = ['contact.', 'seo.contact.', 'nav.', 'brand.']`). Adding English-only `dashboard.*`
keys therefore breaks nothing, and **no public parity check is weakened**. The dashboard spec states
the boundary explicitly — public namespaces remain strictly bilingual; `dashboard.*` is
English-only by decision.

## 8. Non-goals

Reply composer · SMTP · bulk actions · tags · assignments · internal notes · search · CRM · reply
history · real-time / sockets · WhatsApp on a visitor number · delete · any API change · Arabic
dashboard chrome · All/Unread/Read filters · an API permission-list endpoint · issue #30 · Skills
taxonomy · promotion to `main` · deployment.

## 9. Route budget — governed by D20-23

**Governed, not proposed.** Doc 20 **v1.16.0 §1.1–§1.3 (D20-23)** is merged to Docs `main`
`4704475`. This slice implements it.

| Budget (per measured dashboard route) | Limit |
|---|---|
| Total initial JavaScript | **≤ 280 KB gz** |
| App-owned Rollup rendered bytes | **≤ 101 KiB (103,424 B)** |
| CSS | **≤ 30 KB gz** |
| Dashboard ↔ public isolation | **Mandatory, release-blocking** |

Measured routes: `/dashboard/login`, `/dashboard`, `/dashboard/messages`.

**Measurement method (§1.2).** The public HTML-asset reader cannot see these routes —
`/dashboard/**` is `ssr: false`, so every dashboard route reports the same ~204.5 KB gz shared entry
and nothing route-specific. Dashboard routes are measured by a **deterministic Rollup chunk-graph
closure**.

> **Implementation rule — seed, then static closure.** The seed set is: shared client entry +
> dashboard layout entry + the route page dynamic entry + auth/session middleware and store chunks.
> The closure then follows **static `imports`** transitively from the seed. `dynamicImports` are
> followed **only** from seed members where the target is required for initial usable state, and are
> **never** expanded transitively from the entry's route map — the entry's `dynamicImports` lists
> *every* page chunk in the application, so a naive transitive expansion would pull the whole bundle
> into every dashboard route and fail the gate for the wrong reason.
>
> **Ground truths at Web `76f8fa6`** — the closure implementation must reproduce these, or the
> algorithm is wrong: `/dashboard` ≈ 205.1 + 0.7 + 0.4 KB gz; `/dashboard/login` ≈ 223.2 KB gz.

**Public-route impact (§1.3).** The ~0.9 KB gz router-manifest growth is **accepted for this
slice**; the 250 KB public ceiling is **not** raised. `/projects` (≈ 247.8 KB gz) is the **watch
route**. Any public increase beyond the attributable manifest effect is investigated; public
functionality is **not** pre-emptively stripped while a route is inside budget.

## 10. Owner decisions — resolved

Every decision that previously blocked this slice is resolved:

| Was blocking | Resolution |
|---|---|
| Dashboard budget class + method | **D20-23 merged** (Docs `4704475`) — 280 KB gz / 101 KiB / 30 KB gz + closure method |
| `/projects` public headroom | **Accepted** for this slice; 250 KB not raised; `/projects` is the watch route |
| Shell scope | **Durable shell**, initial destinations Overview + Communication → Messages only |
| Role gating | **No role inference**; Messages visible to any authenticated session; 403 renders forbidden |
| Filter set | **Two views only** — Inbox and Archived |
| Copy | Dashboard-owned **English** inventory; `archiveConfirm.*` removed; phone keys added |
| Retention wording | Exact string, **in the Archived view only** (§6 of `plan.md`) |
| Detail request | **None** while list rows carry the full body |

**No owner decision remains outstanding for implementation.** The next owner gate is the
**visual review**, before the full Lighthouse / repeat-flake / final CI matrix.
