# Frontend v1 — audit, product definition and execution plan

|                  |                                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| **Status**       | **APPROVED as execution basis 2026-08-17.** Campaign authorized; FE-1 in progress.  |
| **Created**      | 2026-08-17                                                                    |
| **Author**       | Claude (autonomous planning transition after Campaign 026)                     |
| **Base**         | Web `origin/dev` `54cea28737c558767ccb24a34e2b437b62f7f058`                    |
| **Branch**       | `plan/frontend-v1` (local, unpushed)                                           |
| **Governs**      | nothing — proposes scope; governing decisions stay in `eslammuatamed-docs`      |

**Label key used throughout:** `VERIFIED CURRENT` (measured this session, evidence cited) ·
`PROPOSED` (my recommendation, needs owner approval) · `DEFERRED` (explicitly out of v1) ·
`OWNER DECISION` (cannot be resolved without the owner).

**Evidence rule applied to every row below:** a claim earns `VERIFIED CURRENT` only with a file
path, route, endpoint, SHA or command output behind it. A row whose only support is a document
sentence saying something *should* exist is `PROPOSED`, `DEFERRED` or `OWNER DECISION` — never
current state. This is the rule that keeps the gap matrix from becoming a wish list.

---

## 1. Campaign 026 — final closure state · VERIFIED CURRENT

Campaign 026 is **CLOSED**. The final authorized mechanical step — the Web docs-only closeout PR —
was completed this session.

### 1.1 What was executed

| Step | Result |
| --- | --- |
| Branch pushed | `docs/026-phase8-closeout` → `origin` (new branch; did not previously exist remotely) |
| PR opened | **#71** — `docs/026-phase8-closeout` → `dev`, title `docs(web): close Campaign 026 documentation` |
| CI | **all 5 checks green** on run `32064848435` |
| Merge | **squash**, merge commit **`54cea28737c558767ccb24a34e2b437b62f7f058`**, merged 2026-08-17T20:28:34Z |

### 1.2 Pre-merge verification (before any mutation)

- `origin/dev` = `8598df61413ce46d66a2f6dbc622c3e02074ad2c` — matched the authorized base exactly,
  re-confirmed after `git fetch`.
- Branch tip `aa17904`, commits `c61f002` → `4cd71ec` → `aa17904`, base proven an ancestor via
  `git merge-base --is-ancestor`.
- Worktree clean; remote branch absent (`git ls-remote --heads` empty).

### 1.3 Scope proof — docs-only

PR file list read back from the GitHub API (`/pulls/71/files`), not from local git: **7 files, all
Markdown, all `modified`**, +223/−70.

| File |
| --- |
| `.specify/specs/026-web-modernization/spec.md` |
| `.specify/specs/026-web-modernization/plan.md` |
| `.specify/specs/026-web-modernization/tasks.md` |
| `PROJECT_GUIDE.md` |
| `README.md` |
| `CLAUDE.md` |
| `e2e/README.md` |

Zero application, runtime, tooling, test, config or lockfile changes. No Backend-owned work. No
owner CV/OG content.

**Post-merge equality check:** `git diff --name-status 8598df6 54cea287` → the same 7 files, and
`git diff --name-only 648aa46 54cea287 | grep -v '\.md$'` → **empty**. `dev` differs from `main`
**only in Markdown**. This is the mechanical proof that the post-Production `dev` commits are
documentation, not Production drift.

### 1.4 CI evidence

Run `32064848435` (`pull_request`, head `aa17904f`) — every job `success` with a non-empty step
array, and zero non-success steps:

| Job | Conclusion | Steps |
| --- | --- | --- |
| Lint · Typecheck · Test · Build · Isolation | success | 16 |
| E2E · Accessibility (Playwright + axe) | success | 12 |
| Lighthouse (mobile) | success | 9 |
| Lighthouse (desktop) | success | 9 |
| Branch-policy guard (advisory) | success | 3 |

Step arrays were read deliberately: a `success` conclusion on an empty step array means the job
never ran the work. Only one CI run exists for the head SHA, so this is not a duplicate-row reading.

### 1.5 Production untouched

| Claim | Evidence |
| --- | --- |
| `origin/main` unchanged | `648aa467cd8bc7157cbcad2fd7c0e8981ee1f16c` before and after the merge |
| No deploy triggered | latest `deploy.yml` run is still `32050429649` (2026-08-17T17:27:45Z, `648aa46`); latest `deploy-fallback.yml` run still `32050429706`. Neither moved. |
| No deploy path was reachable | `deploy.yml` triggers on `push → main` / `workflow_dispatch`; `deploy-fallback.yml` on `pull_request: branches:[main], types:[closed]`. A PR into `dev` matches neither — read from the workflow YAML before the merge, not inferred afterwards. |
| Only new run | `32065990467` — `CI`, `push`, branch `dev`, **completed `success`**. Expected: `ci.yml` has a `push: branches:[dev]` trigger. Verification only; it never deploys. |

**Scope note on this claim.** What is verified is `origin/main` unchanged + zero deploy runs +
no reachable deploy trigger. The live server release id was **not** re-read — no public release
marker is served (`scripts/stamp-build.mjs` writes a build-local provenance file, not an endpoint),
and re-reading it needs SSH. Stated precisely rather than asserted broadly.

### 1.6 Private Docs unchanged

`eslammuatamed-docs` is **PRIVATE** (`gh repo view --json visibility`). Nothing was pushed,
published, merged or committed there this session. Its working tree carries owner-authored CV/OG
content changes (`content/cv/eslam-muatamed-cv-2026-08.pdf`, `content/og_image.png`) which were
deliberately **not touched**.

### 1.7 Closure conditions

| Requirement | State |
| --- | --- |
| All Campaign 026 Web work intended for `dev` integrated | ✅ `dev` = `main` + Markdown only |
| Production on the successful 026 release | ✅ `648aa46` / release `20260817T175534Z-648aa46` |
| `main` has not moved unexpectedly | ✅ unchanged |
| Post-Production docs-only `dev` commit understood correctly | ✅ proven mechanically (§1.3) |
| Phase 8 truth reconciliation landed where authorized | ✅ PR #71 merged |
| SpecKit / ledger / roadmap agree | ✅ see §1.8 |
| No Campaign 026 engineering blocker remains | ✅ none open |
| Deferred work classified, not left as an open task | ✅ see §1.9 |

### 1.8 Artifact agreement

`spec.md`, `plan.md` and `tasks.md` all now carry **ALL PHASES CLOSED**, and all three cite the same
Production SHA `648aa467…`, release `20260817T175534Z-648aa46`, serving tree `7deef81c…` and current
`dev`. The campaign ledger lives in the private Docs repo on `docs/web-modernization-campaign`
(local-only, unpushed) and is **not** required to move for closure — it is a campaign record, not a
governing document.

### 1.9 Explicitly deferred OUT of Campaign 026 — DEFERRED

Transferred with a named receiving campaign and a trigger. Their existence does **not** hold
Campaign 026 open.

| Item | Receiving work | Trigger |
| --- | --- | --- |
| Web Learnability & Maintainability Pass (study maps T8.2–T8.4, broad comment cleanup, broad maintainability refactor, curriculum design) | `Web Learnability & Maintainability Pass` | after Frontend v1 |
| Dashboard UI/UX architecture pass (D11-8) + the D20-32 recalibration it owes | Dashboard UI/UX pass | after Dashboard stabilization — **see §7, this now lands inside Frontend v1** |
| Private Docs publication | owner decision | — |
| Backend workstream tasks | Backend | — |

### 1.10 Known open item inherited, not a 026 blocker

**`D19-11` collides across two diverged Docs branches** — two different decisions share the id. The
owner classified this as a real merge-integrity issue belonging to the Docs/Backend integration
step, **not** to Campaign 026 Web closeout. Untouched this session. Carried into §11 as a
dependency for any future Docs integration.

---

## 2. Backend / API readiness for Frontend v1 · VERIFIED CURRENT

**Verdict: the Backend is COMPLETE and Production-ready for Frontend v1. There is no API gap.
What remains is entirely Frontend integration work — including one contract adoption the Web has
not yet performed.**

### 2.1 API repository state

| Fact | Value |
| --- | --- |
| `origin/main` | `9af1aace27289404efa57e8111c5fc3786c65f75` |
| `origin/dev` | `9af1aace27289404efa57e8111c5fc3786c65f75` — **identical**, 0 commits ahead |
| Tip subject | `release: promote Frontend v1 API completion to production (#85)` |
| Preceding | `feat: API complete for Frontend v1 — static-page SEO, GTM-only tracking, nullable clearing semantics, and a temporary deepmerge-ts security override (CVE-2026-40345)` |

`dev` and `main` are the same commit: nothing is staged behind the release.

### 2.2 The campaign that closed the gaps

`eslammuatamed-docs/docs/research/api-frontend-v1-completion-ledger.md` records a zero-trust
Frontend↔API completeness audit that opened with `API NOT COMPLETE — BACKEND WORK REQUIRED` against
API `dev` `3fd0377`, naming four defects. All four are now closed:

| ID | Defect | Resolution |
| --- | --- | --- |
| **API-GAP-001** | static-page SEO (`page_seo`) had no HTTP surface, against `FR-DSH-051` (`M`) | `seo` module built — 4 routes, 2 permissions, 17 e2e cases (`a236af3`) |
| **DRIFT-001** | 23–26 update-path fields nullable on read, non-nullable on write | fixed (`5203c71`); explicit `null` now clears, omission preserves (**D10-23**) |
| **DRIFT-003** | `PATCH /admin/articles/{id}` turned `publishAt: null` into the Unix epoch | fixed (`5203c71`), proven red-then-green with four control assertions |
| **DRIFT-002** | docs described a `seo` module / `GET /seo/pages/{pageKey}` that did not exist | the route was **built**, so the documentation row is now true |

Six governing decisions were produced: **D02-13** (dashboard contact reply is v1), **D02-14** (GTM is
the single tracking integration), **D09-24**, **D10-23**, **D10-24**, **D23-25**.

### 2.3 Live Production probe

```
GET https://api.eslammuatamed.com/api/v1/health          → 200
GET https://api.eslammuatamed.com/api/v1/seo/pages/home  → 200
{"data":{"pageKey":"home","locale":"en","metaTitle":null,"metaDescription":null,
         "ogImageId":null,"ogImage":null,"canonicalUrl":null}}
```

The new surface is **live in Production**, and returns the documented D10-24 shape
(200-with-nulls for a known key, rather than 404). This is measured, not inferred from the ledger.

### 2.4 The one real integration debt: contract drift

| Contract | Paths |
| --- | --- |
| API `origin/main` `openapi.json` | **52** |
| Web `openapi/openapi.json` | **49** |

`diff` of the sorted path sets — the Web contract is missing exactly:

```
/api/v1/admin/seo/pages
/api/v1/admin/seo/pages/{pageKey}
/api/v1/seo/pages/{pageKey}
```

The Web is pinned to a pre-campaign contract. `app/types/api.d.ts` is generated from it, so the new
surfaces are not even type-visible to the Web yet. **This is Frontend work, not an API gap** — the
first task of the first phase.

### 2.5 Web handoff carried by the API campaign (ledger §9)

| # | Handoff item | Frontend impact |
| --- | --- | --- |
| 1 | Adopt the regenerated contract: copy `openapi.json`, run `npm run api:types` (doc 16 §3, one atomic commit) | prerequisite for everything else |
| 2 | `analytics` → `gtmContainerId: string \| null`; admin `analyticsProvider`/`analyticsMeasurementId` → `gtmContainerId`. **Breaking on paper, inert in practice** — the Web referenced these only in `.spec.ts` fixtures, never on a render path | fixture updates only, no component changes |
| 3 | Replace the `mailto:` reply flow in `app/composables/useMessages.ts` with `POST /admin/messages/{id}/replies` (**D02-13**). Requires an `Idempotency-Key` header; body carries **only** `body`. History at `GET /admin/messages/{id}/replies` | real Dashboard feature work |
| 4 | New surfaces available and **unconsumed**: static-page SEO (`GET /seo/pages/{pageKey}` for head rendering, `/admin/seo/pages` for a Dashboard module) and the **FR-DSH-052** head/tag fields (verification tokens, `gtmContainerId`, `customMetas`) — on the public settings response, rendered nowhere | new public + Dashboard surfaces |
| 5 | Clearing a field is now expressible: send `null` to clear, omit to preserve (**D10-23**). Any Dashboard "empty this field" control must send explicit `null` | affects every Dashboard edit form |

### 2.6 API readiness matrix

Classification per Frontend v1 area. `READY` = endpoint exists, is in the API contract and is live.

| Frontend v1 area | API surface | Classification | Evidence |
| --- | --- | --- | --- |
| Home / site settings | `GET /settings/site` | **READY** | in both contracts; consumed today |
| Projects list + detail | `GET /projects`, `/projects/{slug}` | **READY** | consumed today |
| Blog list + article detail | `GET /articles`, `/articles/{slug}`, `/articles/{slug}/related` | **READY WITH FRONTEND INTEGRATION REMAINING** | `related` present in contract, no Web consumer found |
| Experience / timeline | `GET /experiences` | **READY** | consumed by `app/pages/experience.vue` |
| Skills | `GET /skills` | **READY** | consumed widely — `components/home/Capabilities.vue`, `components/project/Filter.vue`, `useResumeData.ts` |
| Testimonials | `GET /testimonials` | **READY** | consumed — `app/components/home/Voices.vue`, `useHomeData.ts`, `pages/index.vue` |
| Categories / tags (public) | `GET /categories`, `GET /tags` | **READY** | consumed — `useArticles.ts`, `pages/blog/index.vue`, `pages/projects/index.vue` |
| Contact form | `POST /contact` | **READY** | consumed; live in Production |
| Redirects | `GET /redirects/resolve` | **READY** | consumed |
| Locales | `GET /locales` | **READY** | — |
| Preview (draft) | `GET /preview/articles/{id}`, `/preview/projects/{id}` + `…/preview-token` | **READY** | both Web preview routes exist |
| **Static-page SEO (public head)** | `GET /seo/pages/{pageKey}` | **READY WITH FRONTEND INTEGRATION REMAINING** | live (§2.3); **absent from the Web contract** |
| **Static-page SEO (admin)** | `GET/PATCH /admin/seo/pages`, `/{pageKey}` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; absent from Web contract; no Dashboard module |
| Auth (login/refresh/logout) | `/auth/*` | **READY** | consumed |
| Admin projects | `/admin/projects*` | **READY** | Dashboard module exists |
| Admin media | `/admin/media*`, `/media/{id}/usages` | **READY** | Dashboard module exists |
| Admin messages (read/archive) | `/admin/messages*` | **READY** | Dashboard module exists |
| **Admin message reply** | `POST/GET /admin/messages/{id}/replies` | **READY WITH FRONTEND INTEGRATION REMAINING** | endpoint live; Web still uses `mailto:` (ledger §9.3) |
| **Admin articles** | `/admin/articles*`, `/{id}/preview-token` | **READY WITH FRONTEND INTEGRATION REMAINING** | full CRUD live; **no `app/pages/dashboard/articles`** |
| **Admin experiences** | `/admin/experiences*` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; no Dashboard module |
| **Admin skills** | `/admin/skills*` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; no Dashboard module |
| **Admin categories / tags** | `/admin/categories*`, `/admin/tags*` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; no Dashboard module |
| **Admin testimonials** | `/admin/testimonials*` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; no Dashboard module |
| **Admin settings** | `/admin/settings` | **READY WITH FRONTEND INTEGRATION REMAINING** | live; no Dashboard module — FR-DSH-052 head/tag fields unrendered |
| **Admin users / roles / permissions** | `/admin/users*`, `/admin/roles*`, `/admin/permissions` | **PRODUCT DECISION NEEDED** | live; no Dashboard module. Single-operator site — is user management v1? |
| Dashboard summary widget | *(none)* | **PRODUCT DECISION NEEDED** | `GET /admin/dashboard/summary` was **deliberately not built** (ledger §7); composes from `articles?status=` + `messages?isRead=`. If the overview needs stats, the Frontend composes them |
| `/uses` page | *(none)* | **DEFERRED** | route deferred by **D24-7**; no page key exists |
| RSS `/rss.xml` | *(none)* | **PRODUCT DECISION NEEDED** | no Web route; not an API concern (Nitro would generate it) |

**No row is classified `API GAP`.** Every unfinished item is Frontend work against an endpoint that
already exists and is live.

### 2.7 One trap classified correctly

`/projects/content-platform-api` (and its `/ar` twin) return **404 in Production**. This is a
**content gap, not an API gap and not a regression** — it matches the pre-deployment baseline
because the `content:sync` command has never been run. It belongs in the content/operations column
of §5, not in the API matrix.

---

## 3. Frontend v1 — proposed product definition · PROPOSED

### 3.1 The governing definition already exists

Doc 02 §7 is unambiguous: **"Launch requires: every `M` requirement, NFR-001…NFR-009, and the
content inventory gate (doc 01 §12)."** `S` requirements target launch but may slip by explicit
roadmap decision; `C` are candidates only.

So Frontend v1 is not something I need to invent. It is:

> **Every `M`-priority requirement in doc 02 that the Web owns, live in Production in both locales.**

Against the roadmap's milestones that means **M3 (Dashboard Complete) + closing M4 (Public Site
Complete)**. M5 (Launch Hardening) is the release milestone that follows v1, not part of building it.

### 3.2 What a visitor must be able to do

All of this is **already shipped** (§4) — v1 preserves it rather than building it:

browse the portfolio in English or Arabic with full RTL · read case studies and articles · filter
projects by technology · view an experience timeline · read the About narrative **with a portrait** ·
view and download a résumé PDF · contact the owner through a validated, spam-protected form with
direct email/phone/WhatsApp fallbacks · switch theme and locale on any route · find the site through
search engines with correct metadata, hreflang, canonicals and structured data.

**The one visitor-facing thing that is not yet true:** the About portrait (`FR-PUB-020`, `M`) is
absent, so `/about` renders its governed `portrait-missing` waiting state. Owner content task.

### 3.3 What the owner/admin must be able to do — this is the real v1 build

Manage **the entire product from the Dashboard, without touching code, the database or a seed
script**. Doc 02 §4 lists the entity set explicitly: *"Applies to Projects, Articles, Categories,
Tags, Experiences, Skills, Testimonials"*, each needing `FR-DSH-010` full CRUD with server-side
pagination/sorting/filtering/search, `FR-DSH-011` per-locale translation editing with completeness
indicators, `FR-DSH-012` publish/draft + scheduled publishing for articles, `FR-DSH-013` Tiptap
rich text persisted as Markdown, `FR-DSH-015` per-locale slug management.

Plus: media library (`FR-DSH-030…034`), per-entity SEO (`FR-DSH-050`), static-page SEO
(`FR-DSH-051`), global head/tags incl. GTM (`FR-DSH-052`), inbox **with dashboard reply**
(`FR-DSH-060`), settings/profile (`FR-DSH-070`), and dynamic roles & permissions (`FR-DSH-090`).

**Four of those exist today. The rest do not.** That asymmetry is the whole of Frontend v1.

### 3.4 Content that must be manageable

Every public surface must be driven by a Dashboard-editable record: hero/positioning, featured
project curation, tech stack, timeline entries, skills registry, testimonials, About narrative +
portrait + philosophy + focus, résumé file, social links, availability, contact channels, per-page
SEO overrides, global verification tags and the GTM container id.

### 3.5 Explicitly NOT Frontend v1 — DEFERRED

| Excluded | Why |
| --- | --- |
| `/uses` page | deferred by **D24-7**; no page key exists in the API |
| RSS `/rss.xml` | not an `M` requirement in doc 02; no route exists |
| OG **image generation** (`ogImage.enabled=false`) | not an `M` requirement; per-entity OG *image selection* (FR-DSH-050) is v1, automatic image *generation* is not |
| Web Learnability & Maintainability Pass, study maps, curriculum | owner-deferred to after Frontend v1 |
| Command palette (`FR-DSH-080`) | priority `S` |
| Autosave / unsaved-changes guard (`FR-DSH-014`) | priority `S` — **recommend keeping the navigation guard**, see §12 |
| Ordering control (`FR-DSH-016`), duplicate-upload detection (`FR-DSH-034`), usages-before-delete UI (`FR-DSH-031`) | priority `S` |
| Analytics beyond a GTM container id | **D02-14** — GTM is the single integration; no per-vendor fields |
| Any Backend work | Backend is complete (§2) |

---

## 4. Current-state summary · VERIFIED CURRENT

Base: Web `origin/dev` `54cea287`. Route inventory from `git ls-tree app/pages`; consumption from
`grep` over `app/` excluding `*.spec.ts`, run with a positive control to prove the search was live.

### 4.1 Public surface — essentially v1-complete

| Route | State |
| --- | --- |
| `/`, `/about`, `/experience`, `/resume`, `/contact` | shipped, both locales, SSR |
| `/projects`, `/projects/[slug]` | shipped, technology filtering |
| `/blog`, `/blog/[slug]` | shipped, Markdown + Shiki, pagination |
| `/preview/articles/[id]`, `/preview/projects/[id]` | shipped |
| error page, locale switcher, theme toggle | shipped |
| SEO: hreflang / canonical / `og:*` / sitemap | shipped — owned by `@nuxtjs/i18n` `strictSeo` (**D22-7**) + `@nuxtjs/seo` |

Production smoke after the 026 cutover returned **16/16 governed routes at 200**.

### 4.2 Dashboard surface — the gap

| Module | Route | State |
| --- | --- | --- |
| Login | `app/pages/dashboard/login.vue` | ✅ shipped (JWT access + rotating refresh, token in memory) |
| Overview | `app/pages/dashboard/index.vue` | ✅ shipped (minimal) |
| Projects | `dashboard/projects/{index,new,[id]}.vue` | ✅ shipped — full CRUD |
| Media | `dashboard/media.vue` | ✅ shipped |
| Messages | `dashboard/messages.vue` | ⚠️ shipped **without reply** — still `mailto:` in `useMessages.ts` |
| Profile | `dashboard/profile.vue` | ⚠️ partial `FR-DSH-070` |
| **Articles** | — | ❌ **absent** — no page, no `useAdminArticles` composable |
| **Experiences** | — | ❌ absent |
| **Skills** | — | ❌ no module (`useAdminSkills.ts` exists but only feeds the project technology picker) |
| **Testimonials** | — | ❌ absent |
| **Categories / Tags** | — | ❌ absent |
| **SEO module** (051/052) | — | ❌ absent — `seo/pages` has **zero** consumers repo-wide |
| **Users / Roles / Permissions** (090) | — | ❌ absent |

### 4.3 The shell is already built for this

`app/composables/useDashboardNav.ts` is a **declarative** nav model over doc 04's IA groups
(Content · Communication · Library · System). Its own comment states the intent: *"adding one of
doc 04's remaining IA groups is an entry in this array, not a change to the shell."* Adding modules
does not require re-architecting navigation.

It also encodes **D11-2**: no `roles` predicate — navigation filters by **route existence only**,
and authorization is answered by each page's `forbidden` state from the API, never inferred from a
role name. Any RBAC UI work must respect that.

### 4.4 Stack and constraints carried in

`nuxt` 4.5.2 · `@nuxt/ui` 4.10.0 · `vue` 3.5.41 · `@nuxtjs/i18n` 10.6.0 (`strictSeo`) ·
`tailwindcss` 4.3.3 · Node ≥ 24.11.0 · TS 5.9 strict. Public CSS budget **29.08 / 30.00 KB gz** —
~0.9 KB headroom, not raised. Route JS budgets: **D20-31** public, **D20-32** Dashboard (INTERIM).
`@unhead/vue` v2/v3 duplication is upstream-owned and must not be attributed to any page.

---

## 5. Frontend v1 gap matrix

Columns: Surface · User · Current state · Evidence · API readiness · Frontend gap · UX gap ·
SEO/a11y/responsive impact · Dependencies · v1 disposition · Complexity/risk · Phase.

### 5.1 Public

| Surface | User | Current | Evidence | API | Frontend gap | UX gap | SEO/a11y/resp | Deps | Disposition | Risk | Phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | visitor | shipped | `pages/index.vue`, `useHomeData.ts` | READY | none | none | none | — | **v1 — done** | — | — |
| About | visitor | shipped, portrait missing | `pages/about.vue`; `portrait: null` in Production | READY | none (waiting state is governed) | none | portrait affects LCP/OG | **owner uploads photo** | **v1 — content task** | low | FE-5 |
| Projects index + detail | visitor | shipped | `pages/projects/*` | READY | none | none | none | content:sync | **v1 — done** | — | — |
| Blog index + article | visitor | shipped | `pages/blog/*` | READY | none | none | none | articles module for real content | **v1 — done (code)** | — | — |
| Related articles | visitor | not built | no consumer of `/articles/{slug}/related` | READY | consume endpoint | new section design | internal linking = SEO gain | articles content | **PROPOSED v1 (`S`-like)** | low | FE-4 |
| Experience timeline | visitor | shipped | `pages/experience.vue`, `useExperiences.ts` | READY | none | none | none | — | **v1 — done** | — | — |
| Résumé + PDF | visitor | shipped | `pages/resume.vue`, `useResumeData.ts` | READY | none | none | print CSS governed | résumé PDF uploaded | **v1 — done** | — | — |
| Contact | visitor | shipped | `pages/contact.vue`, `POST /contact` live | READY | none | none | none | — | **v1 — done** | — | — |
| Localization EN/AR + RTL | visitor | shipped | `strictSeo`, logical-properties gate | READY | none | none | first-class | — | **v1 — done** | — | — |
| SEO metadata / hreflang / canonical / sitemap | visitor | shipped | `@nuxtjs/i18n` strictSeo + `@nuxtjs/seo` | READY | none | none | core | — | **v1 — done** | — | — |
| Structured data (JSON-LD) | visitor | shipped | `useSiteSchema/useProjectSchema/useAboutSchema` | READY | none | none | core | — | **v1 — done** | — | — |
| **Static-page SEO overrides in the head** | visitor | **not built** | `seo/pages` has **zero** Web consumers | **READY** (live, §2.3) | consume `GET /seo/pages/{pageKey}` on static routes | none (invisible) | **direct SEO impact** — FR-DSH-051 pointless without it | contract adoption | **v1 — required** | med | FE-1 |
| **Global head/tags (verification, GTM, customMetas)** | visitor | **not built** | FR-DSH-052 fields on settings, rendered nowhere | **READY** | render from settings | none | verification + analytics | contract adoption | **v1 — required** | med | FE-1 |
| Loading / error / empty states | visitor | shipped | `useRequestState.ts`, `ContentSkeleton.vue` | READY | reuse for new surfaces | consistency | a11y live regions | — | **v1 — extend** | low | all |
| 404 + recovery | visitor | shipped | error page | READY | none | none | none | — | **v1 — done** | — | — |
| Mobile 380px / RTL / a11y | visitor | shipped + gated | axe in CI, logical props gate, Lighthouse × 16 routes | — | none | none | DoD | — | **v1 — done, must not regress** | — | all |
| OG **image generation** | visitor | disabled | `ogImage.enabled=false` | n/a | — | — | — | — | **DEFERRED** | — | — |
| RSS | visitor | absent | no route | n/a | — | — | — | — | **DEFERRED / OWNER DECISION** | — | — |
| `/uses` | visitor | absent | **D24-7** | n/a | — | — | — | — | **DEFERRED** | — | — |

### 5.2 Dashboard

| Surface | User | Current | Evidence | API | Frontend gap | UX gap | a11y/resp | Deps | Disposition | Risk | Phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth / session | owner | shipped | `dashboard/login.vue`; in-memory token + rotating refresh | READY | none | none | none | — | **v1 — done** | — | — |
| Route protection | owner | shipped | `public-isolation.spec.ts`, ESLint boundary | READY | none | none | none | — | **v1 — done** | — | — |
| Overview | owner | minimal | `dashboard/index.vue` | **DECISION** — no summary endpoint by design (ledger §7) | compose stats from `articles?status=` + `messages?isRead=` | real IA: what does the owner see first? | — | modules exist | **v1 — rebuild** | low | FE-4 |
| Projects CRUD | owner | shipped | `dashboard/projects/*` | READY | align to null-clearing (D10-23) | pattern source | — | — | **v1 — refit** | low | FE-2 |
| Media library | owner | shipped | `dashboard/media.vue`, `useMediaLibrary.ts` | READY | none | — | — | — | **v1 — done** | — | — |
| Messages: list/read/archive | owner | shipped | `dashboard/messages.vue` | READY | none | — | — | — | **v1 — done** | — | — |
| **Messages: reply** | owner | **`mailto:` only** | `useMessages.ts` contains `mailto` | **READY** — `POST /admin/messages/{id}/replies` | build reply + history UI; **`Idempotency-Key` required** | compose UX, send-outcome history | live region on send | contract adoption | **v1 — required (D02-13)** | med | FE-1 |
| **Articles CRUD** | owner | **absent** | no `dashboard/articles`, no composable | READY (full CRUD + preview-token) | the **richest** module: editor, per-locale, scheduling, slug, SEO panel | whole module | forms a11y | Tiptap decision | **v1 — required, TRACER BULLET** | **high** | FE-2 |
| **Tiptap rich text** | owner | deps declared, **never imported** | `check:bundle` forbids public leakage (D06-5) | n/a | integrate in Dashboard only | editor UX | keyboard a11y | isolation gate | **v1 — required (FR-DSH-013 `M`)** | **high** | FE-2 |
| **Scheduled publishing** | owner | absent | FR-DSH-012 / FR-PUB-045 | READY (`publishAt`, DRIFT-003 fixed) | date/time UI, timezone clarity | — | — | articles module | **v1 — required** | med | FE-2 |
| **Experiences CRUD** | owner | absent | no module | READY | full module | — | — | patterns from FE-2 | **v1 — required** | med | FE-3 |
| **Skills CRUD** | owner | picker only | `useAdminSkills.ts` feeds `ProjectTechnologyPicker` | READY | full module | — | — | patterns | **v1 — required** | med | FE-3 |
| **Testimonials CRUD** | owner | absent | no module | READY | full module | — | — | patterns | **v1 — required** | low | FE-3 |
| **Categories / Tags CRUD** | owner | absent | no module | READY | taxonomy module | — | — | patterns | **v1 — required** | low | FE-3 |
| Per-locale translation editing + completeness | owner | projects only | FR-DSH-011 `M` | READY | shared pattern across all modules | **shared component decision** | — | FE-2 patterns | **v1 — required** | med | FE-2 |
| Slug management per locale | owner | projects only | FR-DSH-015 `M` | READY | shared pattern + rename warning | — | — | FE-2 | **v1 — required** | med | FE-2 |
| **Per-entity SEO panel** | owner | absent | FR-DSH-050 `M` | READY | shared SEO panel component | — | SEO | FE-2 | **v1 — required** | med | FE-3 |
| **Static-page SEO module** | owner | absent | FR-DSH-051 `M`; `/admin/seo/pages` live | **READY** | whole module | — | SEO | contract | **v1 — required** | med | FE-4 |
| **Global head/tags module** | owner | absent | FR-DSH-052 `M`; GTM toggle (D02-14) | **READY** | module + enable toggle | — | analytics/verif | contract | **v1 — required** | med | FE-4 |
| **Settings completion** | owner | partial | `dashboard/profile.vue`, `useAdminSettings.ts` | READY | remaining FR-DSH-070 fields; **explicit `null` to clear** | settings IA | — | D10-23 | **v1 — required** | med | FE-4 |
| **Users / Roles / Permissions** | owner | absent | FR-DSH-090 `M`; `/admin/{users,roles,permissions}` live | READY | whole module | — | — | D11-2 constraint | **v1 — OWNER DECISION** (§12) | high | FE-4 |
| Validation | owner | zod + `UForm` | Standard Schema | READY | extend per module | consistent error surfacing | a11y errors | — | **v1 — extend** | low | FE-2 |
| Loading / error / refresh | owner | `useRequestState` | — | READY | apply everywhere | consistency | live regions | — | **v1 — extend** | low | FE-2 |
| **Responsive admin ergonomics** | owner | unassessed | no evidence either way | — | — | **real gap — tables on mobile** | 380px | FE-2 patterns | **v1 — required** | med | FE-2/4 |
| Dashboard EN/AR | owner | i18n present | — | READY | keep parity per module | RTL admin tables | RTL | — | **v1 — required** | med | all |

### 5.3 Integration

| Item | Current | Evidence | Disposition | Phase |
| --- | --- | --- | --- | --- |
| **API types / contract** | **stale — 49 vs 52 paths** | §2.4 | **v1 — first task** | FE-1 |
| `gtmContainerId` rename | spec fixtures only | ledger §9.2 | **v1 — trivial** | FE-1 |
| **Null-clearing semantics (D10-23)** | not implemented | ledger §9.5 | **v1 — affects every edit form** | FE-1 |
| Error contract (RFC 7807 → `ApiError`) | shipped | `app/utils/README.md` | **v1 — done** | — |
| Pagination / search / filter | projects + blog only | — | **v1 — generalize** | FE-2 |
| Uploads / media reuse | shipped | `MediaPicker.vue` | **v1 — reuse** | — |
| Preview / draft / publish | public preview routes exist | `preview-token` endpoints | **v1 — wire from editors** | FE-2 |
| Refresh behavior after mutation | per-module | `useMessagesMutation.spec.ts` | **v1 — standardize** | FE-2 |

### 5.4 Operations

| Item | Current | Disposition |
| --- | --- | --- |
| CI (lint/typecheck/test/build/isolation/size/size:routes/Lighthouse×16/Playwright+axe) | green | **v1 — must stay green** |
| Env handling | `runtimeConfig`, env-driven (D23-8) | done |
| Production deploy + rollback | auto from `main`, manual approval gate | done |
| **Rollback pointer validity (R-3)** | **unverified** | **v1 — verify before release** |
| **Security recount (R-4)** | required before any assertion | **v1 — recount, do not carry forward** |
| **`content:sync` never run** | one project 404s | **v1 — owner/content op** |
| GTM container contents vs cookieless (doc 01 §9) | open | **OWNER DECISION** |
| Analytics | GTM only (D02-14/D23-25) | v1 |

---

## 6. Proposed campaign / phase structure · PROPOSED

**One campaign, five phases** — `Campaign 027 — Frontend v1`. One campaign keeps ownership and the
ledger in one place; five phases each end at a usable product boundary.

The sequencing principle: **the contract first, then the tracer bullet that establishes every
Dashboard pattern, then replication, then the system modules, then coherence and release.** This is
the roadmap's own M3 instruction (*"Articles first as the tracer bullet"*), and it is what prevents
building seven modules and redesigning them afterwards.

### Phase FE-1 — Contract adoption & integration foundation

- **Goal** — make the Web speak the current API, and land the three integration behaviours that
  every later phase depends on.
- **Product outcome** — the owner can **reply to a contact message from the Dashboard** (D02-13),
  and static-page SEO + verification/GTM tags render on the public site.
- **Surfaces** — `openapi/openapi.json`, `app/types/api.d.ts`, `useMessages.ts`,
  `dashboard/messages.vue`, public head composables, settings read path.
- **Backend deps** — none; all endpoints live.
- **Architecture** — contract adoption as **one atomic commit** (contract + generated types +
  adaptation, doc 16 §3). Establish the null-clearing helper (D10-23) as a shared utility now, so
  every later form inherits it. Establish `Idempotency-Key` generation for reply sends.
- **UX** — reply composer + per-message send-outcome history.
- **Testing** — contract fixed-point check in CI; unit tests for null-clearing; component tests for
  the composer; e2e for reply happy path + failure surface; SSR assertion that static-page SEO
  overrides reach the rendered head.
- **Docs** — doc 16 §3 adoption record; doc 22 update for static-page SEO in the head.
- **Exit** — contract path count matches the API (52); zero `mailto:` on the reply path; CI green.
- **Owner decisions** — none.
- **Risk** — **low**. Small, mechanical, high leverage.
- **Codex delegation** — good fit: fixture updates for the `gtmContainerId` rename, and the
  mechanical null-clearing refit across existing forms.

### Phase FE-2 — Articles: the tracer bullet + Dashboard pattern architecture

- **Goal** — ship the richest content module **and**, in doing so, define the reusable Dashboard
  architecture every later module consumes.
- **Product outcome** — the owner can write, translate, schedule and publish an article end-to-end
  without touching the database. This alone makes the blog a real product.
- **Surfaces** — `dashboard/articles/{index,new,[id]}`, Tiptap editor, per-locale translation
  pattern, slug pattern, scheduling, preview-token wiring, list pattern (server pagination/sort/
  filter/search), form pattern, feedback pattern.
- **Backend deps** — none.
- **Architecture** — this phase's **real deliverable is the pattern set**: `DataTable` list shell,
  `EntityForm` shell, translation-tab component with completeness indicator, slug field with
  rename warning, SEO panel component, destructive-action dialog, save/error feedback. Nuxt UI
  first; custom UI only where Nuxt UI genuinely cannot express it, and recorded when so.
- **UX** — the Dashboard IA decision lands here (§7).
- **Testing** — Tiptap **Markdown round-trip test green before the editor is trusted** (doc 18 §3,
  a standing roadmap gate); unit for slug/translation logic; component for the shells; e2e for
  create → translate → schedule → publish → appears publicly; axe on every new page; **`check:bundle`
  must keep Tiptap out of public bundles (D06-5)**; route-JS budget measured against D20-32.
- **Docs** — doc 11 (dashboard architecture) pattern record; doc 12/13 component + UI patterns.
- **Exit** — an article authored in the Dashboard is live on `/blog` in both locales; Tiptap
  round-trip green; no public bundle regression; axe clean.
- **Owner decisions** — Tiptap confirmation (§12); Dashboard IA shape.
- **Risk** — **high**. Tiptap integration, bundle isolation, and scheduling/timezone semantics.
- **Codex delegation** — moderate: the list/table shell and pagination plumbing. Keep the editor and
  the isolation gate in-house.

### Phase FE-3 — Content module replication

- **Goal** — apply the FE-2 patterns to the remaining content entities.
- **Product outcome** — every public content surface becomes owner-editable: experiences, skills,
  testimonials, categories, tags. Plus the per-entity SEO panel (FR-DSH-050) across all modules.
- **Surfaces** — five Dashboard modules + the shared SEO panel.
- **Backend deps** — none.
- **Architecture** — **explicitly replication, not invention.** If a module needs a pattern FE-2 did
  not produce, that is a signal to extend the shared pattern, not to fork it.
- **UX** — consistency is the deliverable; no per-module bespoke design.
- **Testing** — one e2e journey per module (create → translate → publish → visible publicly); axe
  per page; unit for module-specific validation; route-size check per new Dashboard route.
- **Docs** — doc 11 module inventory.
- **Exit** — all seven doc 02 §4 content entities CRUD-complete with translation + SEO panels.
- **Owner decisions** — none if FE-2's patterns were approved.
- **Risk** — **medium**, mostly volume. Highly parallelizable.
- **Codex delegation** — **strongest fit in the whole plan.** Five structurally similar modules
  against an established pattern and a fixed contract. One module per lane, disjoint file ownership,
  reviewed before landing.

### Phase FE-4 — System modules: SEO, settings, access control, overview

- **Goal** — complete the non-content `M` requirements.
- **Product outcome** — the owner controls site-wide SEO, global head/tags and GTM, all profile and
  settings fields, and (subject to §12) users and roles — and the Dashboard overview becomes useful.
- **Surfaces** — SEO module (051/052), settings completion (070), users/roles/permissions (090),
  overview rebuild, related-articles public section.
- **Backend deps** — none.
- **Architecture** — RBAC UI must respect **D11-2**: no role-name inference; the API's `forbidden`
  state is the authority. The overview composes stats from existing list endpoints — there is
  deliberately no summary endpoint (ledger §7).
- **UX** — settings IA (grouped, not one long form); role/permission matrix legibility.
- **Testing** — e2e for SEO override → rendered head; settings clear-a-field via explicit `null`;
  RBAC e2e including a forbidden path; axe.
- **Docs** — docs 11, 19, 22.
- **Exit** — every `M` Dashboard requirement usable end-to-end.
- **Owner decisions** — **RBAC scope** (§12), GTM/consent (§12).
- **Risk** — **medium–high**, concentrated in RBAC.
- **Codex delegation** — good for the SEO and settings modules; keep RBAC in-house.

### Phase FE-5 — v1 coherence, verification and release readiness

- **Goal** — turn "all modules exist" into "one coherent product, verified".
- **Product outcome** — Frontend v1, releasable.
- **Surfaces** — Dashboard UI/UX coherence pass (§7), **D20-32 recalibration** (now that the
  Dashboard architecture is stable — this is the review D20-32 has always owed), M4 closure,
  full a11y matrix incl. an Arabic screen-reader pass (doc 21 §6), production smoke.
- **Backend deps** — none.
- **Architecture** — no new modules. Consolidation only.
- **UX** — the coherence pass, not a redesign.
- **Testing** — full matrix: unit, component, e2e, axe, RTL/mobile 380px, hydration, Lighthouse ×
  16 routes × both locales, production smoke; **verify the rollback pointer (R-3)**; **recount
  security from the paginated Dependabot API + `npm audit` (R-4)**.
- **Docs** — PROJECT_GUIDE, doc 24 M3/M4 closure, ledger, handoff.
- **Exit** — every `M` requirement live in Production in both locales; budgets green; M3 + M4
  exit gates satisfied.
- **Owner decisions** — content tasks (portrait, `content:sync`, content inventory gate).
- **Risk** — **medium**; the CSS budget has ~0.9 KB headroom and the Dashboard pass is visual.
- **Codex delegation** — poor fit. Judgement-heavy.

---

## 7. Dashboard UI/UX plan · PROPOSED

**The deferred D11-8 pass now lands inside Frontend v1 — but split in two, and that split is the
single most important recommendation in this document.**

Deferring *all* Dashboard UI/UX until after the modules exist would mean designing seven modules
twice. Doing it all up front would mean designing against surfaces nobody has used. So:

| | When | What it is |
| --- | --- | --- |
| **7a — Dashboard architecture** | **inside FE-2** | Establish the IA, navigation, page hierarchy, and the reusable list/form/dialog/feedback patterns **while building Articles**. Design decisions made against a real, rich module rather than in the abstract. |
| **7b — Dashboard coherence pass** | **FE-5** | Review the assembled whole: cross-module consistency, ergonomics, remaining Nuxt UI misuse, and **the D20-32 recalibration**. This is D11-8 proper. |

### 7.1 Information architecture

The nav model already encodes doc 04's groups. Proposed final shape:

- **(ungrouped)** Overview
- **Content** — Articles · Projects · Experiences · Skills · Testimonials · Taxonomy (Categories + Tags)
- **Communication** — Messages
- **Library** — Media
- **System** — SEO · Settings · Access (users/roles) · Profile

Taxonomy is grouped as one destination rather than two nav entries — categories and tags are the
same editing job and two entries would make the Content group top-heavy.

### 7.2 Patterns to define once, in FE-2

| Pattern | Requirement it serves |
| --- | --- |
| List shell — server pagination, sort, filter, text search, empty/loading/error | FR-DSH-010 |
| Form shell — `UForm` + zod Standard Schema, consistent error surfacing, **explicit-`null` clearing** | FR-DSH-010, D10-23 |
| Translation tabs + per-entity completeness indicator | FR-DSH-011 |
| Slug field — per-locale, uniqueness, safe-rename warning on published entities | FR-DSH-015 |
| Publish/draft + schedule control | FR-DSH-012 |
| SEO panel — meta title/description, OG image via `MediaPicker`, canonical override | FR-DSH-050 |
| Destructive-action dialog | all modules |
| Feedback — save/error/refresh, a11y live regions | all modules |

### 7.3 Explicit guidance

- **Nuxt UI first.** Custom UI only where Nuxt UI genuinely cannot express the need, and recorded
  as a decision when it happens. Existing bespoke Dashboard components should be re-examined in 7b
  against Nuxt UI 4.10 — but **only where they are actually causing inconsistency**, not on sight.
- **Tables are the mobile risk.** Admin list views at 380px are the least-designed surface in the
  product. Decide the small-screen list pattern (card fallback vs horizontal scroll) **in FE-2**,
  once, for every module.
- **Dialogs vs drawers vs pages** — pick one rule in FE-2 (recommendation: full pages for entity
  editing, slideovers for pickers, dialogs for confirmations) and hold it.
- **D20-32 is INTERIM by design.** Do **not** recalibrate it during FE-2/FE-3 — new modules will
  legitimately move the numbers. Recalibrate once, in FE-5, and record the 5 of 8 Dashboard routes
  that still lack accepted baselines **as part of that recalibration, never before it**.
- **Priority order for the Dashboard** (established constraint): correctness → maintainability →
  coherent UI architecture → learnability → marginal bytes. Do not flatten legitimate complexity for
  learning, and **file size alone is not a refactor trigger**.

---

## 8. Testing / verification strategy · PROPOSED

Per phase, the practical verification — not a testing curriculum.

| Kind | FE-1 | FE-2 | FE-3 | FE-4 | FE-5 |
| --- | --- | --- | --- | --- | --- |
| Unit | null-clearing, idempotency key | slug, translation, scheduling | module validation | RBAC gating, settings clear | — |
| Component | reply composer | list/form/SEO shells | per module | SEO/settings/roles | — |
| Nuxt-specific | SSR head from `seo/pages` | `useAsyncData` keys (**not template literals** — a frozen key mixes locales) | same | same | — |
| E2E | reply happy + failure | create→translate→schedule→publish→public | one journey/module | SEO→head, forbidden path | full journeys |
| Accessibility | axe on changed pages | axe on all new pages | axe per module | axe | **full matrix + Arabic screen-reader pass** (doc 21 §6) |
| RTL / mobile 380px | — | list pattern both locales | per module | per module | full sweep |
| Hydration | — | editor mount, `ClientOnly` | — | — | sweep; **issue #30 stays out of scope** |
| Async / race | idempotent re-send | autosave-free save races, refresh-after-mutation | — | — | — |
| API integration | **contract fixed-point in CI** | preview-token flow | pagination/filter | RBAC 403 contract | — |
| SEO | static-page override reaches head | article metadata | per-entity SEO | global tags render | Lighthouse × 16 × 2 locales |
| Performance | — | **`check:bundle` keeps Tiptap public-free**; route size vs D20-32 | route size per module | — | budgets + **D20-32 recalibration** |
| Production smoke | — | — | — | — | governed smoke; **rollback pointer (R-3)** |

**Standing instrument rules carried in** (learned, not theoretical): negative-control any new gate
before trusting it · `size:routes` **exit 2 = measurement failure**, rebuild with `ANALYZE_BUNDLE=1`
· `size-limit` reports `size:0, passed:true` on a **missing build**, so assert build success and
size > 0 · rebuild between a source fix and a Playwright run (Playwright serves a prebuilt
`.output`) · count requests on a non-SWR route · Tailwind scans comments, so naming a class in a
comment emits its CSS.

---

## 9. Dependencies and sequencing

```
FE-1 (contract + integration)          ← hard prerequisite for everything
   │
   ├── FE-2 (Articles tracer + patterns)   ← defines what FE-3 replicates
   │        │
   │        └── FE-3 (5 content modules)   ← parallelizable across modules
   │                 │
   └────────────────── FE-4 (SEO / settings / RBAC / overview)
                              │
                              └── FE-5 (coherence + D20-32 + M4 closure + release)
```

**Hard edges.** FE-1 before all: the contract is stale, so FE-2+ would be typed against a contract
missing three routes. FE-2 before FE-3: replication needs something to replicate. FE-5 last:
D20-32 recalibration is only meaningful once the Dashboard architecture is stable.

**Soft edge.** FE-4 needs only FE-1 technically, so its SEO/settings modules could run beside FE-3
if disjoint file ownership is preserved.

**External / owner-gated, not on the critical path until FE-5:** About portrait upload ·
`content:sync` run · content inventory gate (≥3 case studies + ≥2 articles, both locales — and note
**FE-2 is what makes authoring those articles possible**) · D19-11 reconciliation before any Docs
integration.

---

## 10. Deferred post-v1 work · DEFERRED

| Item | Trigger |
| --- | --- |
| Web Learnability & Maintainability Pass — study maps, curriculum, broad comment cleanup, broad maintainability refactor | after Frontend v1 |
| `/uses` page | **D24-7**; owner reopens |
| RSS | owner decision (§12) |
| OG image generation | not `M` |
| Command palette (FR-DSH-080, `S`) · autosave (FR-DSH-014, `S`) · ordering control (FR-DSH-016, `S`) · duplicate-upload detection (FR-DSH-034, `S`) · usages-before-delete UI (FR-DSH-031, `S`) | post-launch iteration unless the owner pulls them in |
| Issue **#30** — `test:e2e:repeat` hydration defect, red by design | its own issue; **do not suppress, do not duplicate** |
| Private Docs publication | owner decision |
| CommonJS → ESM (API) | Backend, post-closure |

**Structural hotspots noted while planning** — classified as instructed, not acted on:

| Hotspot | Classification |
| --- | --- |
| `useMessages.ts` carries the legacy `mailto:` reply path | **REQUIRED FOR V1** — FE-1 replaces it |
| No shared list/form abstraction (projects module is bespoke) | **REQUIRED FOR V1** — FE-2 creates it; projects refits |
| Public CSS budget at 29.08/30.00 KB gz | **REQUIRED FOR V1** — a constraint to respect, not a refactor |
| `@unhead/vue` v2/v3 duplication | **DEFER** — upstream-owned; `overrides` forbidden by policy |
| Bespoke Dashboard components predating Nuxt UI 4.10 | **DEFER TO POST-V1** unless FE-5 finds real inconsistency |
| Doc 11's compatibility table not re-measured on Nuxt 4.5.2 | **DEFER TO POST-V1 LEARNABILITY PASS** |

---

## 11. Risks and watchpoints

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | **Tiptap integration leaks into public bundles** | breaks D06-5 and the CSS/JS budgets | `check:bundle` already enforces it; treat a leak as a blocking failure, not a budget negotiation |
| R2 | **Public CSS budget ~0.9 KB headroom** | any public visual work can breach 30 KB | measure before committing; compare the CSS filename hash to Production rather than rebuilding a baseline |
| R3 | **D20-32 is INTERIM and 5 of 8 Dashboard routes lack baselines** | new modules will move numbers | do **not** recalibrate mid-build; once, in FE-5 |
| R4 | **Scheduling/timezone semantics** | articles publish at the wrong time | DRIFT-003 is fixed API-side; the Frontend must be explicit about the timezone shown vs stored |
| R5 | **RBAC UI vs D11-2** | rebuilding the forbidden permission-inference matrix | the API's `forbidden` state stays the authority; the module edits roles, it does not gate nav by them |
| R6 | **Replication drift across five modules in FE-3** | five dialects of one pattern | shared components, not copy-paste; extend the pattern rather than fork it |
| R7 | **Security posture is stale (R-4)** | wrong claims | recount from paginated Dependabot API **plus** `npm audit`, report the delta; carry **no** remembered count forward |
| R8 | **Rollback pointer unverified (R-3)** | a failed release may not roll back | verify before the v1 release; a retained directory is not a proven pointer |
| R9 | **`content:sync` never run** | a project 404s in Production | content operation; not a code defect |
| R10 | **D19-11 id collision across Docs branches** | silent loss of a decision on merge | preserve both, renumber one, update cross-references, run docs/group + link/anchor gates — **before** any Docs integration |
| R11 | Issue #30 hydration defect | noise during FE-5 | out of scope; do not suppress or duplicate |
| R12 | GTM contents vs the cookieless requirement (doc 01 §9) | may require a consent banner | owner decision (§12); no API impact either way |

---

## 12. Owner decision table · OWNER DECISION

Only genuine product/UX/architecture decisions. Everything mechanical has a default and is not here.

| # | Question | Recommendation | Alternatives | Product impact | Technical impact | Blocked if unanswered |
| --- | --- | --- | --- | --- | --- | --- |
| **OD-1** ✅ **APPROVED 2026-08-17** | **Is the full Dashboard (M3) in Frontend v1?** Doc 02 §7 says launch requires every `M`, which includes seven content modules, SEO, settings and RBAC. | **Yes — hold the `M` bar.** It is the documented gate, the API is complete for it, and a portfolio whose content cannot be edited is not finished. | (a) Trim v1 to Articles + SEO + settings, defer taxonomy/testimonials/RBAC; (b) defer the whole Dashboard and ship the public site as v1 | Determines whether the owner can run the site without a developer | Sets the size of the entire campaign | **Everything.** This is the scope question. |
| **OD-2** ✅ **APPROVED 2026-08-17 — DEFERRED** | **Is FR-DSH-090 (dynamic RBAC UI) really v1** on a single-operator site? | **Defer to post-v1**, keep `M` for the API (already built). Recommend reclassifying the *UI* to `S` by explicit roadmap decision. | Build it in FE-4 as specified | Zero user-visible value today; real value as a portfolio demonstration of access-control design (D02-6's stated intent) | Removes the highest-complexity FE-4 item | FE-4 scope |
| **OD-3** | **Confirm Tiptap** (FR-DSH-013 `M`) as the rich-text editor. Deps are declared but have never been imported. | **Yes, confirm.** It is an `M` requirement, deps are already declared, and `check:bundle` already guards public isolation. | A lighter Markdown editor; plain Markdown textarea | Authoring experience for the blog | Largest single technical risk in FE-2 | FE-2 |
| **OD-4** | **Dashboard small-screen list pattern** — cards or horizontal scroll? | **Card fallback below `md`.** Horizontal scroll on a 380px admin table is the worse experience. | Horizontal scroll; hide columns | Admin usability on phone | Set once in FE-2, inherited by all modules | FE-2 pattern set |
| **OD-5** | **RSS** — v1 or not? Not an `M` requirement and no route exists. | **Not v1.** Add post-launch if the blog gets a cadence. | Build in FE-4 (small: a Nitro route) | Discovery channel | Small | FE-4 scope only |
| **OD-6** | **GTM contents vs the cookieless requirement** (doc 01 §9 vs D23-25). GTM sets no cookies; tags inside it (GA4, Meta Pixel) can. | **Decide what goes in the container before enabling it.** If anything cookie-setting is configured, a consent banner becomes v1 scope. | Enable with cookieless tags only (no banner); enable with GA4 + banner; leave disabled | Compliance + a visible UI element | A banner is real v1 frontend work if chosen | FE-4 (the toggle ships either way, disabled by default) |
| **OD-7** | **Related-articles section** (endpoint live, unconsumed). | **Include** — small, real SEO/internal-linking value. | Defer post-v1 | Reader engagement | Low | FE-4 only |
| **OD-8** | **Keep the unsaved-changes guard** even though FR-DSH-014 (`S`) defers autosave? | **Yes — keep the guard, defer autosave.** Losing a long article to a stray navigation is the worst Dashboard failure available. | Full autosave in v1; neither | Prevents data loss | Small | FE-2 |

**Content tasks owed by the owner** (not decisions, but they gate M4/M5): upload the About portrait
with per-locale alt text (`FR-PUB-020`) · run `content:sync` · reach the content inventory gate
(≥3 case studies + ≥2 articles, both locales) — **which FE-2 is what makes possible**.

---

## 13. Recommended first execution campaign after approval · PROPOSED

**Start with `Campaign 027 — Frontend v1`, Phase FE-1 (Contract adoption & integration foundation).**

Why this first, concretely:

1. **It is a hard prerequisite.** The Web contract is missing three live routes (§2.4). Any module
   built before adoption is typed against a stale contract.
2. **It is the smallest phase with real product value** — the owner gains Dashboard reply (D02-13),
   and the public site starts honouring static-page SEO and verification/GTM tags.
3. **It is low-risk and mostly mechanical**, so it can proceed on the existing authorization pattern
   without new product decisions — **FE-1 needs none of the §12 answers.**
4. **It de-risks everything after it** by establishing the null-clearing helper and the
   `Idempotency-Key` pattern before seven modules need them.

**Concrete first three actions:**

1. Copy the API's `openapi.json` into `openapi/openapi.json`, run `npm run api:types`, and land it
   as **one atomic commit** (doc 16 §3). Verify the Web path count reaches **52**.
2. Update the `.spec.ts` fixtures for `analyticsProvider`/`analyticsMeasurementId` → `gtmContainerId`
   (inert on render paths, per ledger §9.2).
3. Replace the `mailto:` reply path in `useMessages.ts` with `POST /admin/messages/{id}/replies`
   plus reply history, including the required `Idempotency-Key`.

**What must NOT start:** FE-2 module work before FE-1 lands, and the Web Learnability &
Maintainability Pass at any point during Frontend v1.

**Before FE-1 opens**, only **OD-1** needs an answer — it sets whether this campaign is five phases
or two. OD-2/3/4 are needed before FE-2, not before FE-1.


---

## 14. Dashboard UX requirements — owner input 2026-08-17 · APPROVED REQUIREMENTS

Raised by the owner from real Dashboard screenshots. These are **product/UX requirements**, not
future polish. Nothing here was implemented; this section assigns each item to a phase.

### 14.1 Multilingual authoring pattern — the biggest single architecture item

**Problem observed.** The Project editor renders the **complete English block followed by the
complete Arabic block**, doubling the length of an already-complex page and making authoring
awkward.

**Required pattern for every translatable entity:**

| Field class | Treatment |
| --- | --- |
| **Shared / language-independent** — publication state, year/order, technologies, gallery/media, structural relationships, non-translated metadata | visible **once**, outside the tabs |
| **Translatable content** | **locale tabs** (`English | العربية`), one surface visually active at a time |

**Behavioural contract the implementation must satisfy:**

- the active tab **defaults coherently from the current Dashboard/application locale** — it must not
  always force English;
- switching tabs **preserves unsaved form state**;
- validation failures in an **inactive** locale stay **discoverable** — a hidden tab must never
  swallow an error;
- tabs **visibly indicate** invalid/incomplete translations;
- keyboard and screen-reader behaviour correct (tabs are a real ARIA tab pattern, not styled divs);
- Arabic fields render **RTL**, English fields **LTR**, within the same form;
- works at **380px**;
- **form orchestration is not duplicated per module.**

**Not routes.** Locale editing must **not** become separate routes unless evidence shows a genuine
advantage.

**Also required:** evaluate showing translation completeness **without opening each tab** — note this
is already an `M` requirement (`FR-DSH-011`, per-entity translation-completeness indicators), so the
indicator is in scope by requirement, and the open question is only its placement (tab badge vs list
column vs both). **Recommendation: both** — a badge on the tab and a column in the list view.

**Applies to:** Projects · Articles · Experiences · Profile/About content · SEO page content · every
other multilingual `M` content module.

### 14.2 Dashboard global header / shell

**Problem observed.** The owner must **hand-edit the URL** to get from the Dashboard back to the
public site. Explicitly called unacceptable as a final admin workflow.

Required in the Dashboard shell:

- **locale switcher adjacent to the appearance/theme control**;
- a clear, persistent **`View site` / `Open portfolio`** action;
- correct **external-link semantics** where applicable;
- **operator identity / session actions**;
- consistent **responsive behaviour**.

**Contextual public-view actions.** When editing a **published** entity that has a real public
destination, offer e.g. **`View project`**, resolving the correct public route **and locale**.
**Do not** add public-view actions for entities with no public destination (categories, tags, media,
messages, settings). For unpublished entities the action must be absent or clearly a *preview*,
using the existing `preview-token` surfaces — never a link to a 404.

### 14.3 Login page — full product-quality redesign

`/dashboard/login` is functionally minimal and below v1 quality. Treated as **real v1 Dashboard
work**, built on the established stack (Nuxt UI · Zod · existing auth API · existing design tokens),
**clean and restrained, not decorative**.

Scope to evaluate: branded/logo treatment · logo or explicit home action back to the public
portfolio · coherent card/layout composition · email field · password field · **password visibility
control** · inline Zod validation · server/authentication error presentation · loading/submitting
state · disabled-state behaviour · keyboard submission · focus and **error-focus** behaviour ·
accessibility · mobile layout · dark/light · Dashboard language switch · consistency with the
product.

**Constraints:** do **not** replace Nuxt UI controls with bespoke equivalents without a concrete
recorded reason; do **not** introduce a second validation architecture.

### 14.4 Long-form authoring ergonomics

Beyond locale duplication, long authoring workflows need deliberate ergonomics:

strong section hierarchy · translation tabs · shared fields outside the tabs · **sticky or otherwise
persistently reachable Save/Publish** · clear **saved / saving / unsaved** feedback ·
**scroll-to-first-error** or equivalent validation navigation · contextual **Preview / View on site**
· deliberate **destructive-action placement** · mobile ergonomics · **avoiding accidental loss of
edits** · clear publication-state presentation.

**Starting hypothesis (owner-set):** `one coherent authoring page` + `clear sections` + `locale tabs`
+ `persistent primary actions`. **No multi-step wizard** unless the real workflow proves sequential
steps are semantically required — and that would be an owner decision, not an implementation choice.

**Note on §12 OD-8.** The owner's "avoiding accidental loss of edits" confirms the recommendation
there: **keep the unsaved-changes guard in v1** even though autosave (`FR-DSH-014`) stays `S`.

### 14.5 Phase assignment

| Item | FE-1 | FE-2 (establish) | FE-3/FE-4 (replicate) | FE-5 (finalize) |
| --- | :--: | :--: | :--: | :--: |
| Multilingual tabbed authoring pattern | — | **build** | apply per module | cross-module consistency |
| Shared-vs-translatable field split | — | **build** | apply | audit |
| Translation completeness indicator (FR-DSH-011) | — | **build** | apply | consistency |
| Long-form authoring ergonomics (sticky actions, scroll-to-error, unsaved guard) | — | **build** | apply | audit |
| Contextual `View on site` / preview action | — | **build** (Articles) | apply where a public destination exists | consistency |
| Dashboard shell: `View site`, locale switcher, theme, session menu | — | **minimum viable shell** | inherit | **full coherence pass** |
| Login redesign | — | **minimum** if it blocks exercising FE-2 | — | **finalize** |
| Header/global nav IA, action placement, terminology | — | conventions only | inherit | **finalize** |
| D20-32 review | — | measure only | measure only | **review/recalibrate** |

**Rationale for pulling the shell forward.** The owner authorized placing the minimum necessary
shell work earlier *if it is a dependency for exercising FE-2 naturally*. It is: FE-2 must establish
"contextual public-view actions" and "list ↔ editor navigation", and neither can be designed against
a shell with no `View site` affordance and no locale switcher. **Recommendation: build the minimum
viable shell at the start of FE-2** — `View site`, locale switcher beside the theme control, session
menu — and leave IA refinement, terminology and visual coherence to FE-5.

**Login** is a weaker dependency: FE-2 can be exercised through the existing login. **Recommendation:
leave the full login redesign in FE-5**, unless FE-2 work shows the current page obstructs the
authoring loop.

### 14.6 Shared components / composables likely to emerge

Named now so FE-2 builds them deliberately rather than discovering them five modules late — but
**extracted only after the real Articles flow demonstrates the boundary**, per the owner's
instruction not to build an abstract framework first.

| Likely artifact | Responsibility |
| --- | --- |
| `useTranslatableForm` (composable) | per-locale state, dirty tracking, tab-scoped validity, completeness |
| `TranslationTabs` (component) | ARIA tabs, per-locale `dir`, validity badges, 380px behaviour |
| `EntityFormLayout` (component) | section hierarchy, sticky primary actions, destructive placement |
| `useUnsavedChangesGuard` (composable) | navigation guard + browser `beforeunload` |
| `useFirstErrorFocus` (composable) | scroll/focus to first invalid field, tab-aware across locales |
| `usePublicEntityLink` (composable) | resolve public route + locale for a published entity; `null` when none |
| `DashboardShell` header slice | `View site`, locale switcher, theme, session menu |
| `useSaveFeedback` (composable) | saving / saved / failed presentation, a11y live region |

**Boundary discipline:** pages own routing and orchestration · components own presentation ·
composables own reusable behaviour · pure utilities own rules. No abstraction created before a second
real consumer exists, except where the owner's contract above already names it as cross-module.

### 14.7 Verification requirements added by this input

- **Tab state preservation** — edit both locales, switch tabs, assert nothing is lost (a test that
  would pass trivially if tabs were re-mounted must be written to fail in that case).
- **Inactive-locale validation discoverability** — submit with an error only in the hidden locale;
  assert the error is surfaced **and** the tab is marked invalid. This is the discriminating test for
  §14.1; without it the whole pattern can ship broken and look fine.
- **ARIA tabs** — roles, `aria-selected`, arrow-key navigation, focus management; axe on both states.
- **Mixed direction** — Arabic field `dir="rtl"` and English field `dir="ltr"` **within one form**.
- **380px** — the authoring page and the list view, both locales.
- **Unsaved-changes guard** — in-app navigation and reload.
- **`View on site`** — resolves the right route and locale for a published entity; **absent** for an
  unpublished one and for entities with no public destination.
- **Login** — keyboard submit, error focus, visibility toggle a11y, dark/light, 380px.

### 14.8 Genuine owner decisions arising — OWNER DECISION

Most of this input is already determined by existing product principles and needs no owner ruling.
Two genuine questions remain:

| # | Question | Recommendation | Why it is a real decision |
| --- | --- | --- | --- |
| **OD-9** | **Is the Dashboard UI language independent of the content locale being edited?** i.e. does switching the Dashboard to Arabic also switch which translation tab is active, or are they separate concepts? | **Separate but coupled at first paint**: the Dashboard UI locale drives the *initial* active tab (satisfying "default coherently from the current Dashboard locale"), after which tab selection is independent per entity. | Genuinely different product outcomes: coupling them permanently means an Arabic-reading operator cannot comfortably edit English copy, while full independence loses the sensible default the owner asked for. |
| **OD-10** | **Does the Dashboard shell get a full localized UI (EN/AR) in v1**, or does it stay English-only with only *content* translated? | **Full EN/AR Dashboard UI** — the owner asked for a locale switcher in the header, which implies a localized shell; and an Arabic-first operator is the actual user. | Sets translation scope for every Dashboard string across all modules — a material cost that should not be discovered mid-FE-3. |

**RESOLVED 2026-08-17 by the owner's execution-authorization message — neither is escalated.** That
message settles both from the authoritative decision list:

- **OD-9 → resolved as recommended.** "active locale derived coherently from Dashboard/app locale"
  confirms the UI locale seeds the initial tab; tab selection is thereafter independent per entity.
- **OD-10 → resolved as recommended.** "Dashboard shell needs: locale control" implies a localized
  EN/AR Dashboard shell, so every Dashboard string is translatable and that cost is in FE-2's budget,
  not a surprise in FE-3.

Both are therefore **settled inputs to FE-2**, not open questions.

---

## 15. FE-1 execution record · VERIFIED CURRENT

Branch `campaign/frontend-v1`, off `origin/dev` `54cea287`. **Nothing pushed; nothing deployed.**

### 15.1 Contract adoption — DONE

| Step | Evidence |
| --- | --- |
| Authoritative source confirmed | API `origin/main` `9af1aac` `openapi.json` vs **live** `https://api.eslammuatamed.com/docs-json`: `jq -S` normalized comparison → **STRUCTURALLY IDENTICAL**. The committed contract *is* what Production serves. |
| Contract adopted | `openapi/openapi.json` 49 → **52 paths** |
| Types regenerated | `npm run api:types` (`openapi-typescript` 7.13.0) — **not hand-authored** |
| Fixed point | second generation **byte-identical**; CI's `api:types` idempotence gate will compare against the committed file |
| Three SEO paths type-visible | `/api/v1/seo/pages/{pageKey}` (L197), `/api/v1/admin/seo/pages` (L217), `/api/v1/admin/seo/pages/{pageKey}` (L237) in `app/types/api.d.ts` |
| New schemas | `PublicPageSeoEntity`, `AdminPageSeoEntity`, `PageSeoTranslationEntity`, `PageSeoTranslationDto`, `UpdatePageSeoDto` |
| **No unrelated drift** | full normalized contract diff enumerated: additions are the 5 PageSeo schemas + 3 routes; **the only removals are the retired analytics fields** (`analyticsProvider`, `analyticsMeasurementId`, the `analytics` object) plus reworded descriptions |
| Consumers typecheck | `npm run typecheck` → **exit 0, 0 errors** |

### 15.2 `gtmContainerId` reconciliation — DONE

`gtmContainerId` now appears 4× in generated types; `analyticsProvider` **0×**. Nine fixture files
reconciled, in two groups:

- **Typecheck-failing (4)** — `home/Contact.spec.ts`, `home/Nameplate.spec.ts`,
  `layout/Footer.spec.ts`, `project/ContactCta.spec.ts`: typed `const … : SiteSettings` literals that
  correctly failed on the missing field. Added `gtmContainerId: null`.
- **Silently stale (5)** — `pages/about.spec.ts`, `utils/about-readiness.spec.ts`,
  `pages/contact.spec.ts`, `utils/portrait-form.spec.ts`, `pages/dashboard/profile.spec.ts`: still
  named the retired fields but did **not** fail. Renamed to `gtmContainerId`.

Repo-wide sweep for `analyticsProvider|analyticsMeasurementId|analytics: null` outside generated
types → **NONE**.

### 15.3 A finding worth recording — POST-V1

**Fixtures built with a `Partial<T>` spread are not contract-checked.** The five "silently stale"
files above all end `} as SiteSettings` / `as unknown as AdminSiteSettings`, which suppresses **both**
excess-property and missing-property errors — which is why a retired field survived there while the
same drift failed loudly in the four annotated fixtures.

**The cast is not sloppiness:** every one of those files spreads `...overrides` from a
`Partial<SiteSettings>`, and TypeScript widens spread properties to `T | undefined`, so the cast is
forced by the pattern. Removing it would produce TS-limitation noise, not real safety.

**Therefore not fixed here** — that would be the broad refactoring FE-1 was told to avoid. Recorded
for the post-v1 Learnability & Maintainability Pass: a `makeSettings()` factory that applies defaults
through a `Required<T>` base before spreading would restore genuine contract checking across all
fixtures. **Classification: DEFER TO POST-V1** — it does not block v1 implementation.

### 15.4 Not done in FE-1 — and why

The **Dashboard reply flow** (`POST /admin/messages/{id}/replies`) was investigated but **deliberately
not implemented**: it is Dashboard **UI** work, and the owner's §14 input directly governs the form,
validation, error-presentation and save-feedback patterns it would have to use. Building it before
FE-2 establishes those patterns would create exactly the throwaway work the tracer-bullet sequencing
exists to prevent.

**Contract facts captured for when it is built:**

- `POST /api/v1/admin/messages/{id}/replies` — **`Idempotency-Key` header required**, 8–200 printable
  ASCII, no whitespace, **scoped to the message**; body carries **only** `body` (plain text, 1–5000
  chars, no HTML — D02-13e).
- Repeating a request with the **same** key returns the existing attempt with **200** and never
  re-sends. A deliberate second reply needs a **new** key.
- **`201`/`200` are both success-shaped even when the send FAILED** — the attempt was recorded either
  way, and the outcome lives in `status`, not the HTTP code. **A UI that treats 2xx as "sent" will lie
  to the operator.**
- `status` ∈ `PENDING | SENT | FAILED`. `SENT` means the provider *accepted* it — not delivered, not
  read. `FAILED` does **not** prove no mail was sent. `PENDING` is ambiguous **by design** and is
  never evidence of non-delivery (D09-23).
- **`409`** — the message has no email address (phone-only intake is valid per D10-16) and can never
  be replied to. `GET` still returns `200 []` for it: **empty history and 404 are different facts.**
- **`mailto:` is NOT removed.** `FR-DSH-060` states replying from the owner's own email client
  "remains available and is unaffected". `replyMailto()` stays; the dashboard reply is an **addition**.
