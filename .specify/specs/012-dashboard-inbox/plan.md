# Feature 012 — Plan

## 1. Dashboard shell — component boundaries

Built once, durably. Nuxt UI first per doc 11 §3; each custom component carries a one-line
"why not Nuxt UI" note.

```
app/layouts/dashboard.vue            orchestrates only: skip link, sidebar, drawer, header, <slot/>
app/components/dashboard/
  DashboardSidebar.vue               desktop rail; consumes the nav model; renders badge slot
  DashboardNavDrawer.vue             mobile drawer (USlideover, side: start)
  DashboardNavList.vue               shared group/item rendering — ONE renderer for both surfaces
  DashboardHeader.vue                title, drawer trigger, user email, theme toggle, sign-out
app/composables/
  useDashboardNav.ts                 builds the nav model; filters by role + existence
  useUnreadCount.ts                  shared unread badge state (see §6)
  useMessages.ts                     list + mutations for the Messages route
```

**One renderer, two surfaces.** `DashboardNavList` is shared so desktop and mobile cannot drift
in active-state logic or badge rendering. The drawer is composition, not duplication.

## 2. Navigation configuration model

A declarative array — adding a governed IA group later is a data change, not a shell rewrite.

```ts
interface DashboardNavItem {
  key: string            // i18n key under dashboard.nav.*
  to: string             // must be a route that EXISTS
  icon: string
  badge?: Ref<number>    // optional slot; rendered only when > 0
}
interface DashboardNavGroup { key: string; items: DashboardNavItem[] }
```

Initial model renders **only existing destinations** — no disabled or placeholder links:

| Group | Item | Route | Badge |
|---|---|---|---|
| _(ungrouped)_ | Overview | `/dashboard` | — |
| Communication | Messages | `/dashboard/messages` | unread count |

Doc 04's remaining groups (Content, Library, System) are **absent from the model**, not
rendered-disabled. They are added by appending to this array when their routes exist.

**No `roles` field.** Owner decision 2 forbids inferring a grant from a role name, so the model
carries no role predicate at all — a documented-but-unused field would invite exactly the
duplication the decision rules out. Navigation is filtered by **route existence only**.

**Active state** uses `useRoute()` path matching with exact-match for `/dashboard` (so Overview
does not stay active on every child route) and prefix-match for section roots.
`aria-current="page"` marks the active item; styling never relies on colour alone.

## 3. Auth, roles, and API error handling

- Route protection: `definePageMeta({ layout: 'dashboard', middleware: 'auth' })` — per page, never global (doc 11 §1).
- **401:** already handled inside `useApi` — one silent refresh retry, then redirect to `/dashboard/login`. This slice adds nothing.
- **403:** rendered as the explicit forbidden state (spec §6). Never an empty list. The nav item **stays visible** — visibility is not an authorization claim, and the honest way to represent an unknown grant is to attempt the call and render the answer.
- **No role-based gating in this slice.** The session carries no permission list, and decision 2 forbids inferring `messages.read` from a role name. OWNER-only cosmetic gating is retained only where something is already governed OWNER-only; nothing here is.

## 4. List data flow

```
/dashboard/messages?view=inbox|archived&page=N&message=<uuid>
```

- `useMessages()` wraps `useApi()` and reads `GET /admin/messages` with `isArchived` fixed by the view (`false` for Inbox, `true` for Archived) and `page`/`perPage` from the URL.
- **Exactly two views.** `isRead` is never sent as a filter — decision 4 ships Inbox and Archived only. Read state is *displayed*, not filtered on.
- **Ordering is never re-sorted client-side** — the API guarantees unread-first, then newest-first.
- `perPage` = 12 (the API default; max 50) — an explicit constant, not an implicit default.
- URL is the single source of truth for view, page and selection, so every state is deep-linkable and Back/Forward correct.

## 5. URL-selected detail flow

The list row already contains the full message, so **no detail request is issued**.

- Selecting a row pushes `?message=<id>`; the slideover opens from the row already in memory.
- **Reload with `?message=<id>`:** after the list resolves, the row is looked up by id. If present, the slideover opens. If absent (wrong page, archived, or purged), the detail shows "Message not found" and the parameter is cleared — the list stays usable.
- **Back/Forward:** the slideover's open state is *derived* from the query parameter rather than stored independently, so history navigation opens and closes it correctly with no manual synchronization.
- A `GET /{id}` fallback is deliberately **not** added; §9 of the verification plan proves the list contract is sufficient before this is accepted.

## 6. Unread-count state ownership and request deduplication

**Owner:** `useUnreadCount()`, backed by a **`useState`-keyed shared ref** (`dashboard:unread`)
so the shell and the Messages page read one value rather than each holding a copy.

**Deduplication.** Both the shell (on init) and the Messages page (on stale return) can request
the count. The composable holds a module-level in-flight promise: a second caller while a
request is outstanding receives the same promise instead of issuing a second request. A
`lastFetchedAt` stamp supports the "refresh if stale" rule without polling.

```
shell init ─┐
            ├─► useUnreadCount().ensureFresh() ─► one in-flight request ─► shared state
page return ┘
mutation success ─► invalidate() ─► one refetch
```

Request: `GET /admin/messages?isRead=false&isArchived=false&perPage=1` → `meta.total`. `perPage=1`
transfers a single row while the envelope carries the full count. **No polling, no sockets.**

## 7. Read / unread / archive / unarchive transitions

All four are **confirmed** mutations — the UI changes only after the API responds.

| Trigger | Request | On success | On failure |
|---|---|---|---|
| Open unread message | `PATCH {isRead:true}` | row + detail show read; badge invalidated | row **stays unread**; recoverable error announced; **badge not hidden** |
| `Mark as unread` | `PATCH {isRead:false}` | row shows unread; badge invalidated | state retained; error announced |
| `Archive` | `PATCH {isArchived:true}` | row leaves Inbox; badge invalidated; feedback offered | state retained; error announced |
| `Restore from archive` | `PATCH {isArchived:false}` | row leaves Archived; badge invalidated | state retained; error announced |

No confirmation modal on archive (decision 6). `archivedAt` is server-managed and never sent.

## 8. Contact affordances

Rendered strictly from what exists — either field may be `null`, never both.

- **Email present:** `Reply by email` → `mailto:` built with `encodeURIComponent`, subject prefilled `Re: <original subject>`. A hint states replies are not sent from the dashboard. Guarded on `email !== null` so a `mailto:null` can never be constructed.
- **Phone present:** `Call` (`tel:` with the E.164 value) and `Copy number` (clipboard, with a confirmation). **No WhatsApp action.**
- **Phone-only:** Call + Copy are the primary actions; **no** disabled or broken Reply control is rendered.
- **Email-only:** no phone UI at all — not an empty row, not a dash.

## 9. Plain-text and bidi rendering

- Body renders inside a plain-text container: `white-space: pre-wrap; overflow-wrap: anywhere;` — line breaks preserved, long words/URLs wrapped, no horizontal overflow, stored text preserved exactly.
- **No** Markdown, HTML, `v-html`, Shiki or markdown-it on any dashboard path. The forbidden-module gate independently proves this.
- Chrome is English-only; visitor values are not: `name`, `subject`, `body` carry `dir="auto"`; `email` and `phone` are isolated LTR (`dir="ltr"` with isolation) so a `+` prefix cannot be reordered inside RTL text.

## 9a. Responsive list presentation (owner decision 12)

**One data flow, two presentations.** `useMessages()` and `useUnreadCount()` are untouched: the card
list renders the same `items` array, calls the same `openMessage`/`mutate`, and opens the same
slideover keyed by `?message=`. Nothing about `loadSeq`, `contextSeq`, request dedup, confirmed
mutations, pagination or filters changes — this is presentation only.

**Switching is CSS, not JavaScript.** The table wrapper is `hidden sm:block` and the card list is
`sm:hidden`. `display: none` removes the inactive presentation from the accessibility tree and from
the focus order, so the two cannot both be reachable. A JS viewport branch was rejected: it would be
hydration-sensitive and could render the wrong presentation on first paint.

**No nested interactive controls.** Each card is an `<article>` containing exactly two siblings — one
full-width opener `<button>` carrying the whole content, and a separately-focusable `UDropdownMenu`
trigger positioned over the card's trailing corner. The opener therefore never contains the menu, and
using the menu never opens the detail.

**No ids are emitted** by either presentation, so the duplicated rows cannot collide.

## 9b. Focus restoration (owner decision 12)

The opener ELEMENT is stored, never the message id. With both presentations in the DOM and one
hidden by CSS, a lookup by id could resolve to the hidden counterpart and focus would vanish — the
failure mode this rule exists to prevent.

`openMessage(message, event)` captures `event.currentTarget` in a non-reactive variable. When the
selection clears, that exact element is refocused **only if it is still `isConnected`** — a mutation
re-renders the list and can replace the node, in which case the stored reference is stale and focus
is left where the overlay put it rather than thrown at a detached element.

## 10. Bundle isolation strategy

- `UTable`, `UPagination` and `USlideover` are reached only from dashboard routes, which are `ssr: false` and code-split — measured landing in a `isDynamicEntry: true` chunk, absent from every static/entry chunk.
- `check-forbidden-modules.mjs` continues to prove no editor/Markdown weight reaches any client chunk.
- The dashboard route budget (spec §9) is **blocked on the owner decision** and is not silently assumed.

## 11. Accessibility

- One `<h1>`; `UTable` renders a real `<table>` with header cells and an accessible caption/label.
- **Unread is never colour-only** — an icon or text label plus an accessible name (`dashboard.messages.unreadBadgeLabel`), and the row exposes its state to assistive tech.
- **No nested interactive controls inside an interactive row.** The row's open affordance is a single control; per-row actions live in a trailing `UDropdownMenu` (doc 13 §5) rather than as sibling buttons inside a clickable row.
- Slideover has an accessible title and description; focus moves into it on open and **returns to the originating row** on close.
- Mutation failures are announced via a polite live region.
- 200 % zoom with no horizontal overflow; `prefers-reduced-motion` respected for slideover transitions.
- Long Arabic / mixed-language content is exercised in the a11y lane, not assumed.

## 12. Copy plan

**English-only, dashboard-owned.** The bilingual 011 inventory is **not** carried forward. A new
`dashboard.*` English inventory covers shell navigation · Inbox/Archived tabs · headings and
descriptions · unread/read states · loading · initial empty · view-empty · error + retry ·
forbidden · mark read/unread · archive/unarchive · Reply by email · Call · Copy number · copy
success/failure · retention text · pagination · stale selected-message notice · offline.

Removed: the four `archiveConfirm.*` keys (decision 9) and `filter.unread` / `filter.read`
(decision 4). Added: `detail.phone`, `actions.call`, `actions.copyNumber` and copy feedback.

**Exact retention string, rendered in the Archived view only:**

> `Archived messages are retained for 12 months from the date they were archived.`

**Parity boundary.** Verified: there is **no whole-file EN/AR parity gate** in this repository —
parity is asserted per page spec over that page's owned namespaces. English-only `dashboard.*`
keys therefore break nothing and **no public parity check is weakened**. The dashboard spec states
the boundary explicitly, and asserts that **no `dashboard.*` key exists in `ar.json`**, so the
English-only decision is enforced rather than merely intended.
