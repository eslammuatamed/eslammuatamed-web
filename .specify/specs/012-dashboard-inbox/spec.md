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
doc 19 §6, doc 21, doc 20 §1/§5 (**a new budget decision is REQUIRED — see §9**).

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
| 1 | **Durable shell, not a temporary one.** Build the reusable dashboard shell (desktop sidebar, mobile drawer, active-route state, grouped navigation model, optional badge slot per item, authenticated header, content area, role-based Web gating per D11-2 with the API remaining authoritative). **Render only destinations that exist** — no disabled or placeholder links for future modules. Future governed IA groups must be addable through the navigation model **without replacing the shell**. |
| 2 | **Single-route Messages page.** `/dashboard/messages` with `UTable` for the list (where appropriate and within budget) and `USlideover` for detail. The selected message is represented in the URL via a stable query parameter. Back/Forward closes and reopens the selection correctly; a direct reload with a valid parameter restores detail state when possible. **The list response already carries the full body — no redundant detail request** unless verification proves the list contract insufficient. |
| 3 | **Read state is confirmed, never optimistic.** Opening an unread message requests `mark read`; the UI shows it read **only after the mutation succeeds**. On failure: keep the previous unread state, show a recoverable error, and **never silently hide the unread badge**. An explicit `Mark unread` action exists for read messages. Mark read, mark unread, archive and unarchive are all confirmed mutations. |
| 4 | **Derived unread badge — no new endpoint.** Count comes from `GET /admin/messages?isRead=false&isArchived=false&perPage=1` via `meta.total`: active, unarchived, unread only. Hidden at zero; bounded display (`99+`); fetched on authenticated shell initialization; refreshed after every successful read/unread/archive/unarchive mutation and when returning to Messages if stale. **No polling. No sockets.** |
| 5 | **Contact affordances.** With an email: `Reply by email` via a safe `mailto:` handoff prefilled `Re: <original subject>` — no composer, and no claim that a reply was sent from the dashboard. With a phone: `Call` and `Copy number`, the number kept internally LTR and isolated. **No WhatsApp action** — the Contact contract does not establish that a visitor's number is a WhatsApp number. Phone-only messages get Call + Copy as primary actions and render **no** disabled/broken Reply action. Email-only messages render **no** empty phone UI. |
| 6 | **Archive is not deletion.** No confirmation modal per archive action; confirmed mutations with normal recoverable feedback. The **Archived view** carries concise copy that archived messages remain governed by the documented 12-month retention policy. |
| 7 | **Plain text only.** Visitor content renders as plain text — no Markdown, HTML, `v-html`, syntax highlighting, Shiki or markdown-it. Bodies preserve line breaks via a safe `pre-wrap` treatment, wrap long words and URLs, never overflow, and preserve the stored text exactly. Dashboard chrome is **English-only**. Visitor values may be Arabic or mixed: name/subject/body use `dir="auto"`; email and phone are isolated LTR. |
| 8 | **Minimal first version.** Inbox and Archived views, API-guaranteed unread-first ordering, pagination, clear read/unread styling, and loading / initial-empty / filtered-empty / recoverable-error / forbidden states. Only API-supported filters. No bulk actions, tags, assignments, notes, search, CRM, reply history or real-time updates. |
| 9 | **Dashboard routes get a real budget.** `/dashboard`, `/dashboard/login` and `/dashboard/messages` join the governed measurement matrix. The public 250 KB threshold is **not** reused by default; a bounded dashboard threshold is proposed from measured attribution (§9). No existing public threshold is raised, no route is omitted to avoid a failure, and no essential first-view control is lazy-loaded merely to manipulate the metric. |

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

`AuthUserEntity` exposes only `role: { id, name }`. **There is no permission list on the
session**, so the Web cannot evaluate `messages.read` / `messages.update` directly. Per
**D11-2**, client-side gating is courtesy only and limited to "which role sees which menu";
the API is the authoritative authorizer.

Consequently: navigation visibility and action affordances gate on **role name**, and a `403`
from the API is rendered as an honest forbidden state — never as an empty list.

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

## 7. Copy

48 `dashboard.messages.*` keys were owner-approved during 011 and recorded in
`011-public-contact/plan.md §7`. **Three deltas require attention (see §10):** the approved set
is bilingual while decision 7 makes the dashboard English-only; the approved
`archiveConfirm.*` group implements a per-action modal that decision 6 removes; and the set has
**no phone keys**, which decision 5 now requires.

## 8. Non-goals

Reply composer · SMTP · bulk actions · tags · assignments · internal notes · search · CRM ·
reply history · real-time / sockets · WhatsApp on a visitor number · delete · any API change ·
Arabic dashboard chrome · issue #30 · Skills taxonomy · promotion to `main` · deployment.

## 9. Route budget — measured, and blocked on an owner decision

**The existing gate cannot honestly measure dashboard routes today.** `check-route-size.mjs`
collects each route's assets from its **rendered HTML**, but `nuxt.config.ts` sets
`'/dashboard/**': { ssr: false }`, so the server returns a bare SPA shell and the dashboard's
real chunks are fetched by the client router **after hydration**. Measured directly, both
dashboard routes report **1 asset / 204.5 KB gz / 6 192 B app-owned** — identical to each
other, because that number is the shared entry chunk and nothing route-specific. Adding the
routes to `ROUTES` unchanged would produce a passing number that does not measure what it
claims — exactly the "confidently wrong number" the gate's own design rejects.

**Measured attribution** (production build at Web `76f8fa6`, gzip, `ANALYZE_BUNDLE=1` Rollup
provenance — chunk closure computed from the sidecar, not from filenames):

| Component | Measured |
|---|---|
| Shared SPA entry (not dashboard-owned) | **205.1 KB gz** |
| `dashboard.vue` layout chunk | 0.7 KB gz |
| `/dashboard` page chunk | 0.4 KB gz |
| `/dashboard/login` page chunk | 18.5 KB gz |
| **`UTable` + `UPagination` + `USlideover` probe chunk** | **24.7 KB gz** |
| Probe closure excluding entry (the honest incremental cost) | **33.6 KB gz** |
| **Projected `/dashboard/messages` first view (skeleton, no page logic)** | **238.7 KB gz** |

Two findings follow:

1. **238.7 KB gz is a floor, not an estimate of the finished route.** The probe carries no page
   logic, no shell/sidebar, no states, no composables and no i18n. The finished route will sit
   materially above it, so reusing the public 250 KB ceiling would leave roughly 11 KB of
   headroom for the entire feature — which is why decision 9 forbids reusing it by default.
2. **Adding a dashboard route consumes *public* headroom.** One extra route grew every public
   route by ~0.9 KB gz (router manifest in the shared entry): `/projects` moved
   **246.9 → 247.8 KB gz** against a frozen 250 KB ceiling, leaving **2.2 KB**. This is the
   tightest constraint in the repository and it is not a dashboard budget problem — it is a
   public-route one.

**Isolation holds:** TanStack table code landed **only** in a dynamic-entry chunk
(`isDynamicEntry: true`) and appears in no static or entry chunk, so `UTable` does not ship to
public routes.

**Proposal (requires owner approval — see §10).** Introduce an authenticated-dashboard budget
class in doc 20 §1 with its own threshold, separate from the public gate:

- **Total JS per authenticated dashboard route ≤ 280 KB gz** — the measured 238.7 KB floor plus
  bounded headroom for the shell, page logic and states, while remaining a real constraint.
- **App-owned rendered bytes ≤ 101 KiB**, reusing the existing D20-12 metric unchanged (this is
  a project-owned-growth metric, not the public transfer threshold, so reusing it is not the
  reuse decision 9 forbids).
- **Method fix:** the gate must resolve a client-only route's chunk set from the Rollup sidecar's
  `dynamicImports`/`imports` closure rather than from rendered HTML. Without this the number is
  not measurable, and the gate's own contract is to exit `2` (infrastructure) rather than report
  a figure it cannot justify.

## 10. Owner decisions still required

1. **The doc 20 dashboard budget decision** (§9) — a new budget class, threshold and measurement
   method for authenticated routes. Introducing it is an architectural decision, so per decision
   9 step 6 this slice **stops here** and no Docs change has been made.
2. **The `/projects` 2.2 KB public headroom** — adding the Messages route consumes public
   budget. Accept the reduced headroom, or direct a separate remediation? No existing threshold
   may be raised.
3. **Copy deltas** — (a) confirm the dashboard is English-only, leaving the approved Arabic
   halves recorded but unshipped; (b) confirm removal of the four `archiveConfirm.*` keys per
   decision 6; (c) approve **new** phone keys, which the 011 set does not contain:
   `detail.phone`, `actions.call`, `actions.copyNumber`, a copy-confirmation string, and the
   Archived-view retention notice. Nav keys for the shell (`Overview`, the `Communication`
   group label) are also new.
4. **Retention wording placement** — the approved `archiveConfirm.body` states archiving starts
   the 12-month clock. That is **factually supported** by the contract (`archivedAt` is set on
   archive and is the documented purge basis), but decision 6 moves the message to the Archived
   view. Confirm the wording to use there.
5. **Filter set** — decision 8 requires Inbox and Archived. The 011-approved copy also includes
   Unread and Read filters, both API-supported. Ship all four, or only the two required?
