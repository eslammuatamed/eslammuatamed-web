# Feature Specification: Public Pages — Projects P1 Journey Slice (005)

**Feature Branch**: `005-public-pages` (off Web `dev` `6898cf8`)

**SpecKit ID**: `005-public-pages` · **Milestone**: M4 (Public Site) · **Repo**: `eslammuatamed-web`

**Created**: 2026-07-27

**Status**: Specification — not implemented. Implementation must not begin until this specification is approved.

**Input**: Roadmap `web-005 public pages` (doc 24, D24-5). This is the **first vertical slice** of that
feature: the Projects journey. The remaining public pages (`/experience`, `/about`, `/uses`, `/resume`,
`/contact`) are follow-on slices of the same feature and are **out of scope here**.

---

## 1. Context & Scope Boundary

Feature 007 closed the site-wide public visual system and the Home, and shipped reusable primitives
(`UiSpread`, `UiSectionHead`, `UiRequestState`, `ContentWorkEntry`, `ContentProse`) explicitly intended
for this feature. Feature 007 is **closed and must not be reopened**. No Feature 008 exists — this work
is `web-005`.

The Home links to `/projects` and `/projects/{slug}`, which currently return `404` — the accepted
walking-skeleton state recorded in `007/spec.md:36-37` and `20-performance.md:351-352`. D24-5 gates
public promotion on "at least the projects index + one case study existing so the routing-hub journey
(F-P1) works". **This slice closes exactly that gap.**

**No API change is required or permitted.** API contract provenance is resolved: API `origin/dev`
`03f2b11b3bf121d4553332ae07a064a647b9518c` exports an OpenAPI document whose SHA-256 is
`7b8c8291a9f3eb090f429355ee3101c0fa4f1ecba9c182ccc2f56d6239c67e52`, byte-identical to the contract
already committed at `web/openapi/openapi.json`. Every field this slice needs already exists. API
`dev → main` remains frozen (D17-5 / D23-18); this slice neither needs nor triggers a promotion.

## 2. Routes

| Route | Purpose |
| --- | --- |
| `/projects` | Projects index (EN, default locale at root) |
| `/projects/{slug}` | Case study detail (EN) |
| `/ar/projects` | Projects index (AR, RTL) |
| `/ar/projects/{slug}` | Case study detail (AR, RTL) |

Static segments stay Latin in both locales (D04-1). Slugs are **per-locale** and differ between EN and
AR; the locale counterpart is resolved from the contract's `slugs` map, never by reusing the current
slug.

## 3. Requirements

### In scope

| ID | Requirement (doc 02) |
| --- | --- |
| **FR-PUB-030** (M) | Projects index: featured-first, filterable by technology, published only (unpublished never publicly reachable, incl. by direct slug — cf. FR-PUB-046) |
| **FR-PUB-031** (M) | Case study page renders the structured sections defined in FR-CNT-020 |
| **FR-PUB-032** (M) | Case study gallery with optimized images and captions |
| **FR-PUB-033** (M) | Links to live product and repository where they exist; absence handled gracefully |
| **FR-CNT-020** (M) | Project content model: title, slug, summary, overview, businessProblem, solution, role, architecture, technologies, challenges, features, lessonsLearned, gallery, links, featured, `isPublished`, SEO fields |
| **FR-PUB-046** (M) | Draft/unpublished content never publicly reachable, including by direct URL |
| **F-P1** | Hiring-manager journey: land → scan → open one case study → contact CTA |
| **F-P3** (partial) | The case study's closing CTA enters the contact path; the form itself is a later slice |
| **F-P5** | Locale switch swaps to the same page's counterpart |
| **NFR-001** | Lighthouse budgets (doc 20 §1) |
| **NFR-002** | WCAG 2.2 AA |
| **NFR-003** | No dashboard code in public bundles |
| **NFR-004** | SSR + crawlable; SEO per doc 22 |

### Explicitly out of scope

- **FR-PUB-034** (Prev/next case-study navigation) — priority **`C`** (doc 02 §4 `:73`). No mandatory
  journey breaks without it: F-P1 step 4 is satisfied by the case-study Contact CTA, and the index is
  always reachable via breadcrumbs. **Excluded.**
- `/experience`, `/about`, `/uses`, `/resume`, `/contact` page implementation (later slices).
- Any API change, API OpenAPI examples, or API deployment.
- Production/test content editing, image upload, deployment, `dev → main` promotion.
- Feature 007 changes.
- The operational debt in §10 — recorded, not fixed.

## 4. User Scenarios *(mandatory)*

1. **F-P1 — hiring manager** lands on `/`, scans Selected Work, follows "View all" to `/projects`, sees
   featured projects first, opens one case study, reads business problem → solution → architecture, and
   finds a Contact CTA at the end.
2. **Technology filter** — a visitor filters the index by a technology; the URL reflects the filter, the
   result set is server-filtered, and the filter is clearable and keyboard-operable.
3. **F-P5 — locale switch** — a visitor on `/projects/personal-platform` switches to Arabic and lands on
   `/ar/projects/al-mansa-al-shakhsiya`, not a 404 and not the index.
4. **Renamed slug** — a visitor follows an old, renamed URL; the app resolves the redirect and lands on
   the current slug rather than showing 404.
5. **Unknown / unpublished project** — a visitor requests a non-existent or unpublished slug and gets a
   proper localized 404 (never a masked 5xx, never a leaked draft).
6. **Degraded API** — the API is unreachable; the index shows an accessible inline error with retry, not
   a blank page.
7. **Empty gallery** — a case study with no gallery items renders cleanly with the gallery region omitted.

## 5. Functional Specification

### 5.1 Projects index (`/projects`, `/ar/projects`)

- **Data**: `GET /projects` via `useApi()` (locale injected automatically). Envelope `{data[], meta}`.
- **Ordering**: featured-first **as returned by the API** (`featured desc, order asc`). The client must
  **not** re-sort. The Home's cap-at-3 filter is a Home concern and must not be copied here.
- **Technology filter**: `?technology=<uuid>` — the canonical technology UUID query. Filter options come
  from `GET /skills`; the label shown is the localized `label`. An unknown/malformed UUID returns `422`
  from the API and must surface as a recoverable inline error with the filter cleared, never a crash.
- **Pagination**: `page` (≥1) and `perPage` (≤50, default 12) exist in the contract. The index uses the
  contract default and renders pagination controls **only when `meta.totalPages > 1`**. With 4 seeded
  projects the control set is not rendered; the logic is still implemented and unit-tested against a
  multi-page `meta`.
- **Published-only**: guaranteed server-side (`isPublished: true`). `isPublished` is **not** exposed on
  the public contract and must not be referenced in client code.
- **Cards without thumbnails**: `PublicProjectListItemEntity` has **no image field**. Cards are
  typographic — `ContentWorkEntry` already implements exactly this and is documented as "Reusable on the
  future /projects index". Reuse it; do not invent a cover-image slot.
- **URL/query state**: the technology filter is a URL query parameter so a filtered view is linkable and
  restores on reload/back. Filtered views canonicalize to the unfiltered index (doc 22 §canonicals).
- **States** (doc 13 §9.1 / D13-5, via `UiRequestState`): initial load → `UiContentSkeleton` matching
  index-row geometry; revalidation (filter/page change with content on screen) → `UiDataLoadingOverlay`;
  empty → the region's own localized `#empty` copy (this is a **list page**, so it shows empty copy and
  does **not** omit itself); error → inline `UiStateError` with accessible retry.
- **EN/AR parity and RTL**: logical properties only; the composition mirrors.

### 5.2 Case study (`/projects/{slug}`, `/ar/projects/{slug}`)

- **Data**: `GET /projects/{slug}` → `PublicProjectDetailEntity`.
- **Structured sections (FR-CNT-020)**: `overview`, `businessProblem`, `solution`, `role`,
  `architecture`, `challenges`, `features`, `lessonsLearned` — all **opaque Markdown**, all rendered
  through the single `ContentProse` surface (D12-4, D19-5, Shiki SSR-only D20-3). Each section gets a
  localized heading. A section whose value is an empty string renders nothing (no empty heading).
- **Technologies**: rendered from `technologies[]`; each label wrapped in `<bdi>` so Latin identifiers
  isolate correctly inside Arabic text.
- **Optional links (FR-PUB-033)**: `liveUrl` and `repoUrl` are nullable. All four combinations must be
  handled: both, live-only, repo-only, neither. "Neither" renders **no link region at all** — no
  disabled buttons, no "not available" copy.
- **Gallery (FR-PUB-032)**: `gallery[]` ordered by `order` ascending (already sorted by the API; the
  client preserves order and does not re-sort). Each item carries `mediaAsset` with `url`, `width`,
  `height`, `blurhash`, `alt` (localized, nullable) and `variants[]` (WebP/AVIF, width asc). Rendering
  uses `<NuxtImg>` exclusively. **Empty gallery → the gallery region is omitted entirely.**
  - `alt === null` → no translation exists → the image is skipped for a11y purposes with `alt=""` and
    `aria-hidden`, and the caption carries the meaning; `alt === ""` → intentionally decorative → `alt=""`.
    These two are different states in the contract and must not be collapsed.
  - `caption` is localized and nullable; rendered as `<figcaption>` when present.
  - `width`/`height` are always set on the element to reserve space (CLS = 0).
  - `blurhash` supplies the LQIP placeholder.
- **Breadcrumbs**: Home → Projects → *current project title*, mirroring in RTL, with the current item
  marked `aria-current="page"` and not a link.
- **Contact CTA**: links to the accepted current contact route. `/contact` is a **documented web-005
  limitation** and still 404s in this slice; the CTA therefore **also** exposes a working `mailto:` from
  `GET /settings/site` profile links, so the conversion path is never dead (D05-4 — the email path
  always works). This is a carried limitation, recorded, not a defect introduced here.
- **Slug-redirect resolution before final 404**: on a `404` from `GET /projects/{slug}`, the app calls
  `GET /redirects/resolve?path=/projects/{slug}` **once**. On `200`, it redirects to `toPath` (a
  section-relative path) with an SSR-correct 301-style navigation. On `404` from the resolver, it throws
  the real localized 404. Any non-404 error keeps its real status — a transient 5xx must never be masked
  as a deindexable 404 (the `articleErrorParams` precedent in `app/utils/article-error.ts`).
- **Locale switching**: `setI18nParams` is fed from the contract's `slugs` map, exactly as
  `app/pages/blog/[slug].vue:35-43` already does, so `switchLocalePath` and hreflang alternates resolve
  to the counterpart locale's own slug.
- **Missing translation**: if a locale has no translation the API returns `404` for that locale's slug.
  The counterpart link is only rendered for locales present in `availableLocales`.
- **States**: loading skeleton matching the case-study composition; inline error with retry; localized
  404 through the existing `error.vue`.

### 5.3 SEO

- **SSR-visible content** — both routes are server-rendered; no content appears only after hydration.
- **Title/metadata fallback chain**: `metaTitle` → `title`; `metaDescription` → `summary`. Never a
  hardcoded string, never an invented description.
- **Canonical**: self-canonical per locale; filtered index views canonicalize to `/projects`.
- **hreflang**: EN↔AR pair + `x-default` → EN (D22-3), driven by the `slugs` map on detail pages.
- **Open Graph / Twitter**: from the resolved title/description; `ogImage` when the contract supplies
  one (it is nullable and currently null for all seeded projects — absence must be graceful).
- **JSON-LD**: `CreativeWork` (author, about, dates) + `BreadcrumbList` on the case study (doc 22 §4
  `:70`), emitted through `useSchemaOrg` so the graph has one source of truth. The index emits
  `BreadcrumbList` only.
- **Sitemap**: published project translations only, per locale, with hreflang annotations, sourced from
  the API (doc 22 §sitemap). The current sitemap is static; this slice adds a dynamic source for
  Projects only.

### 5.4 Accessibility (release-blocking — NFR-002)

- WCAG 2.2 AA. Semantic heading order: one `h1` per page, project titles as `h2`/`h3` in the index,
  section headings descending without skips in the case study.
- **One accessible link target per project card** — `ContentWorkEntry` already uses a stretched
  pseudo-element so assistive tech announces a single link per row (doc 21 §1). Preserve this.
- Filtering is fully keyboard-operable with visible focus; the global
  `:where(a,button):focus-visible` violet ring from 007 applies.
- Empty and error states are accessible: `role="status"`, `aria-busy`, polite live region, and an
  accessible retry control (doc 13 §9.1).
- Meaningful image alternatives; decorative images correctly `alt=""`; the `null` vs `""` distinction in
  §5.2 respected.
- `<html lang dir>` correct per locale; Latin technical identifiers inside Arabic content wrapped in
  `<bdi>` for LTR isolation.
- Reduced motion: gallery and route transitions collapse to ≤120 ms opacity (doc 13 §9.1).
- Gallery is keyboard-navigable and screen-reader coherent; each figure's caption is programmatically
  associated with its image.
- Touch targets ≥ 24×24 CSS px (2.5.8), consistent with the 007 acceptance pass.

### 5.5 Performance

- **Nitro SWR route rules** added for `/projects`, `/projects/**`, `/ar/projects`, `/ar/projects/**` at
  the same `swr: 60` used by `/` and `/blog/**` (`nuxt.config.ts:78-99`).
- **No dashboard code in public bundles** — enforced by `npm run check:bundle`.
- **No new or changed performance threshold.** The following remain exactly as they are, and this slice
  must not edit them:

  | Budget | Value | Source |
  | --- | --- | --- |
  | LCP lab, desktop | ≤ 1200 ms | `lighthouserc.cjs:14`, D20-14 |
  | LCP lab, mobile | ≤ 4000 ms | `lighthouserc.cjs:14`, D20-14 |
  | LCP lab, mobile `/ar` (home) | ≤ 5000 ms CI ceiling | D20-16 |
  | Arabic-script fonts, first view | ≤ 130 KB woff2 | `lighthouserc.cjs:16`, D20-15 |
  | CSS | ≤ 30 KB gz | `.size-limit.cjs` |
  | JS per public route | ≤ 250 KB gz | doc 20 §1, D20-11 |
  | App-owned rendered bytes per route | ≤ 101 KiB | doc 20 §1, D20-12 |

- **Lighthouse matrix**: add `/projects`, `/ar/projects`, `/projects/{slug}`, `/ar/projects/{slug}` to
  `lighthouserc.cjs`. This closes the D20-8 deferral, which states the matrix is partial *"only because
  two of the four documented pages do not exist yet (web-005)"*. **URLs are added; thresholds are not
  touched.**
- **Images**: only the genuine above-the-fold image may be `loading="eager"` / `fetchpriority="high"`.
  Every other gallery image lazy-loads. Explicit `width`/`height` on every image (CLS = 0).

## 6. Testing Strategy

The Web repository must remain independently testable with **no live API dependency** (doc 00 §3,
D18-2/D18-3).

### 6.1 Unit / component (Vitest) — no snapshot-only tests

Required coverage: project-card rendering · all four optional-link combinations · technology filter
state and URL sync · breadcrumb semantics (`aria-current`, order, RTL) · structured case-study section
rendering incl. empty-section omission · gallery empty and populated states · image descriptor/variant
selection · `alt === null` vs `alt === ""` handling · redirect-resolution composable (200 → navigate,
404 → throw 404, 5xx → preserve status) · locale slug mapping into `setI18nParams` · metadata and
JSON-LD generation · pagination visibility logic · accessible state behavior.

### 6.2 Playwright + axe (new infrastructure — D18-3)

`18-testing-strategy.md:40,49-55` mandates Playwright e2e against the Prism mock plus `axe-core` scans on
"home, article, **project**, contact". **None of this infrastructure exists today** — the Web repo has
no Playwright, no axe, and no e2e directory. Standing it up is part of this slice.

**Prism is the default mock.** A read-only investigation against the committed contract proved that
Prism serves usable responses **without any OpenAPI examples**, because the schemas carry
property-level `example` keywords:

- `GET /projects` and `GET /projects/{slug}` return schema-valid, fully populated responses.
- List → detail navigation works (list slug `content-platform-api` resolves at the detail route).
- Gallery/media descriptors are generated complete: `url`, `width` 2400, `height` 1350, `blurhash`,
  `alt`, `variants[]`, `order`, `caption`.
- Responses are byte-deterministic across repeated requests.
- RFC 7807 error responses are selectable via the `Prefer: code=<status>` header (`404`, `400`, `422`),
  and malformed input (e.g. `?technology=not-a-uuid`) is rejected `422` automatically.

**Web-owned route interception / fixtures** are used **only** for what Prism cannot represent
deterministically without changing the API contract:

| Scenario | Why Prism cannot do it |
| --- | --- |
| EN/AR content differentiation | Prism ignores `?locale=` and returns one static example for both |
| Empty project list | No named example exists to select, so `data: []` is unreachable |
| Unknown-slug default 404 | Any slug returns `200` unless `Prefer: code=404` is forced |
| Exact authored long-form Markdown | Markdown fields return the literal `"string"` |

**Do not add a mock layer to application code**, and **do not request API OpenAPI examples for test
convenience** — the API is frozen and the gap is a Web-test concern.

**Required e2e coverage**: F-P1 (land → index → case study → Contact CTA) · F-P5 locale switch preserving
the equivalent project route · both locales · RTL smoke (`dir`, mirrored composition) · unknown project ·
redirect-resolved slug · empty list · unavailable API · axe scans on Projects index and Project detail.

## 7. Reusable existing infrastructure

Reuse, do not re-create: `UiSpread` · `UiSectionHead` · `UiRequestState` · `UiContentSkeleton` ·
`UiDataLoadingOverlay` · `UiStateError` · `ContentWorkEntry` · `ContentProse` · `AppLink` · `useApi` ·
`app/types/models.ts` (`ProjectListItem`, `ProjectDetail`, `ProjectGalleryItem`, `MediaImage` — already
defined) · `app/utils/api-error.ts` · `error.vue` · i18n `nav.projects` (already present in both locales).

Genuinely new: the two pages, a projects data composable, a gallery component, a technology-filter
control, a breadcrumbs component, project JSON-LD, a redirect-resolution composable, `@nuxt/image`
configuration for the media origin, and the Playwright + axe harness.

## 8. Acceptance Criteria

1. All four routes render server-side in both locales with correct `lang`/`dir`.
2. Index ordering matches the API response exactly; no client re-sorting.
3. Technology filter round-trips through the URL and is keyboard-operable.
4. All eight FR-CNT-020 fields render through `ContentProse`; empty fields render nothing.
5. All four `liveUrl`/`repoUrl` combinations render correctly, including "neither".
6. Gallery renders ordered, lazy (except any true above-the-fold image), with explicit dimensions,
   blurhash placeholder, localized alt and caption; an empty gallery omits the region.
7. A renamed slug resolves via `/redirects/resolve` before any 404 is shown.
8. Locale switch on a case study lands on the counterpart slug from the `slugs` map.
9. Unknown and unpublished slugs return a localized 404; non-404 errors keep their real status.
10. Canonical, hreflang, OG/Twitter, `CreativeWork` and `BreadcrumbList` are present and correct.
11. Sitemap contains published project translations for both locales.
12. axe reports zero violations on both new pages in both locales.
13. All existing gates stay green with **no threshold changed**: `typecheck` 0 · `lint` · `test` ·
    `build` · `check:bundle` · `check:logical` · `size` · `size:routes`.
14. Lighthouse matrix includes the Projects routes; budgets unchanged.

## 9. Content and image policy (owner decision, recorded)

- **Real project images are not required to begin implementation.** Gallery UI is implemented and tested
  using contract-based mock descriptors and Web-owned test fixtures.
- Real images will be uploaded exactly once through
  **`Dashboard → Media Library → API pipeline → R2`**. Manual upload to Web `public/`, the VPS
  filesystem, or R2 directly is **forbidden** and must never be proposed as the production workflow.
- **Final Projects promotion is blocked** until at least one complete case study has real
  production-approved media, EN/AR alt text, and EN/AR captions.
- The currently seeded Projects are **test/demo content**, not final owner-approved production case
  studies. All four currently have `gallery = 0`, `liveUrl = null`, `repoUrl = null`, `ogImage = null`.
- Project content is being prepared separately by the owner and **must not be invented** by the
  implementation — no fabricated metrics, dates, client permissions, image URLs, or project facts.

## 10. Dependencies & Risks

### 10.1 Deferred operational debt (recorded, NOT in scope)

These were surfaced during the API provenance remediation. All are **non-blockers for `web-005`**,
**must be reviewed before real Production launch**, and are **outside the Projects frontend
implementation scope**. None is fixed by this slice.

| # | Finding | Classification |
| --- | --- | --- |
| OD-1 | API release artifacts cannot run the TypeScript seeds independently — the tarball omits `src/` and `tsconfig.json`, both of which `prisma/seed.ts` requires | API/ops · pre-launch review |
| OD-2 | The test database is named `eslammuatamed_prod`, inviting confusion with real production | API/ops · pre-launch review |
| OD-3 | The test PostgreSQL connection uses passwordless loopback `trust` authentication | API/security · pre-launch review |
| OD-4 | API `npm audit` reports 25 high-severity findings, **all in dev dependencies**; production dependencies report zero. The CI step is `continue-on-error: true` and informational per doc 19 §7 | API/supply chain · pre-launch review |
| OD-5 | The test deployment path is manual while API `dev → main` remains frozen | Ops · pre-launch review |

### 10.2 Carried Web limitations (unchanged by this slice)

- `/experience`, `/about`, `/uses`, `/resume`, `/contact` still `404`. The case-study Contact CTA keeps a
  working `mailto:` so F-P1 step 4 never dead-ends.
- No CSP / security headers on public routes (launch-hardening follow-up).
- FR-PUB-015 philosophy section remains deferred (D24-6).
- Arabic UI copy is author-written and pending owner native review.

### 10.3 Risks

- **Contract drift**: if the API contract changes before this ships, re-adopt via doc 16 §3 (one atomic
  commit: contract + generated types + adaptation). Today the contract is stable and identical across
  API `origin/dev`, the Web-committed copy, and the deployed test binary.
- **Lighthouse on new routes**: adding four URLs may surface real budget pressure. Any failure is a
  genuine signal to fix the page, **never** a reason to edit a threshold (doc 20 §1).
- **Playwright/axe is new infrastructure** and is the largest single unknown in this slice; it is
  sequenced so the pages can be verified even if harness work runs long (see `plan.md` §Sequencing).

## 11. Hard Rules

- **HR-1** — Web-only. No API code, schema, migration, seed, contract, or OpenAPI-example change.
- **HR-2** — Feature 007 is closed; its components are reused, not modified beyond additive needs.
- **HR-3** — No performance threshold, budget, or release rule is changed. URLs may be added to the
  Lighthouse matrix; numbers may not be touched.
- **HR-4** — No production/test content editing, no image upload, no deployment, no `dev → main`
  promotion, no workflow dispatch.
- **HR-5** — No mock layer in application code; Prism and Web-owned test fixtures live in test scope only.
- **HR-6** — Types are generated from the committed contract (`npm run api:types`), never handwritten.
- **HR-7** — Both locales verified for every user-facing change; WCAG 2.2 AA behaviors are
  release-blocking.
- **HR-8** — The intentional `404` on not-yet-built routes is a documented limitation, not a regression.

## 12. Non-Goals

- Building `/experience`, `/about`, `/uses`, `/resume`, `/contact`.
- `FR-PUB-034` prev/next navigation (priority `C`).
- Any API change or API OpenAPI examples.
- Fixing the §10.1 operational debt.
- Deployment, promotion, or production content/media work.
