# Tasks: Public Pages — Projects P1 Journey Slice (005)

**Branch**: `005-public-pages` · **Spec**: `./spec.md` · **Plan**: `./plan.md`

Status legend: `[ ]` not started · `[X]` done.

**Specification approved by the owner on 2026-07-27; implementation is in progress under PR #22.** The
PR merge stays blocked until the complete **D16-8 Documentation & Handoff Gate** (Phase 9) passes.

**Ordering changed by owner decision:** the Playwright + axe foundation moved from last to **Phase 1**,
ahead of substantial page work, because it is the largest implementation uncertainty. The full Projects
e2e scenarios remain mandatory and land in Phase 8, once the pages exist. The harness must **not** be
split into a separate PR.

## Phase 0 — Contract adoption check (no change expected)
- [X] T000 Verify `openapi/openapi.json` SHA-256 is `7b8c8291a9f3eb090f429355ee3101c0fa4f1ecba9c182ccc2f56d6239c67e52` and matches API `origin/dev` `03f2b11`. If identical (expected), **no adoption commit is needed**. If it has drifted, stop and run the doc 16 §3 adoption flow as one atomic commit before any page work.
- [X] T001 Confirm `app/types/models.ts` already exposes `ProjectListItem`, `ProjectDetail`, `ProjectGalleryItem`, `MediaImage` — it does; no type work is expected.

## Phase 1 — Playwright + axe FOUNDATION (first, per owner decision) *(depends on Phase 0)*
- [X] T005 Add `@playwright/test` + `@axe-core/playwright` as devDependencies; install browsers.
- [X] T006 `playwright.config.ts` in the repo's TypeScript conventions; `webServer` delegates to `scripts/ci-preview.mjs` (Prism on the committed contract + built Nitro, both TCP-readiness-gated, SIGTERM teardown). Deterministic ports, no live API.
- [X] T007 Package scripts: `test:e2e`, `test:e2e:ui`.
- [X] T008 Minimal EN/AR smoke on an **already-stable** route (`/` and `/ar`): asserts `html[lang]` and `html[dir]` are correct — proves the harness without depending on Projects.
- [X] T009 One minimal axe scan proving the accessibility integration works end-to-end.
- [X] T009a Wire an e2e job into `.github/workflows/ci.yml`. **No existing threshold, budget, or job is modified.**
- [X] T009b Verify: `npm ci` integrity · `lint` · `typecheck` · `test` · Playwright smoke · axe scan · `build` · isolation gates (`check:bundle`, `check:logical`). Commit atomically.

## Phase 2 — Data layer *(depends on Phase 1)*
- [X] T010 `app/composables/useProjects.ts` — list + detail via `useApi()`, locale-keyed `useAsyncData`, `watch` on locale/page/technology.
- [X] T011 `app/utils/project-error.ts` — 404 → not-found; every other status preserved (mirrors `article-error.ts`). Pure and Nuxt-free.
- [X] T012 `app/composables/useSlugRedirect.ts` — single-shot `GET /redirects/resolve`; `toPath` on 200, `null` on 404, rethrow otherwise.
- [X] T013 Unit tests for T010–T012, including the 5xx-must-not-become-404 case.

## Phase 3 — Projects index *(depends on Phase 2)*
- [X] T020 `app/pages/projects/index.vue` — `UiSpread` + `UiSectionHead` + `UiRequestState` + `ContentWorkEntry` list. API order preserved verbatim (no client sort).
- [X] T021 `app/components/project/Filter.vue` — technology filter from `GET /skills`; canonical UUID query; keyboard-operable, labelled, clearable.
- [X] T022 URL/query state sync (`replace: true`), restore on reload/back; invalid UUID → recoverable inline error with the filter cleared.
- [X] T023 Pagination controls rendered only when `meta.totalPages > 1`; logic unit-tested against a multi-page `meta`.
- [X] T024 Index states: skeleton geometry matching index rows · localized `#empty` copy (list page shows empty copy, does not self-omit) · inline error with accessible retry.
- [X] T025 Unit tests: card rendering, filter state, URL sync, pagination visibility, state branches.

## Phase 4 — Case study *(depends on Phase 2)*
- [X] T030 `app/pages/projects/[slug].vue` — page shell, title block, `setI18nParams` from the `slugs` map before the first await boundary.
- [X] T031 All eight FR-CNT-020 sections through `ContentProse`, each with a localized heading; an empty field renders nothing (no orphan heading).
- [X] T032 Technologies list with `<bdi>` isolation for Latin identifiers inside Arabic.
- [X] T033 `app/components/project/Links.vue` — all four `liveUrl`/`repoUrl` combinations; "neither" renders no region at all.
- [X] T034 `app/components/ui/Breadcrumbs.vue` — semantic nav, `aria-current="page"` on the last item, RTL-mirrored.
- [X] T035 Contact CTA — the canonical direct-email action **only**: `mailto:eslammuatemed@gmail.com`. **No `/contact` link is rendered in this slice** (owner decision 2026-07-27); a future Contact slice replaces the destination and keeps direct email as its fallback.
- [X] T036 404 + redirect resolution: on detail 404 call `useSlugRedirect` once → navigate to `toPath`, else throw the localized 404. Non-404 keeps its real status.
- [X] T037 Unit tests: section rendering + omission, link combinations, breadcrumb semantics, redirect branching, locale slug mapping.

## Phase 5 — Gallery *(depends on Phase 4)*
- [X] T040 ~~`nuxt.config.ts` — add the `image:` block for the remote media origin~~ **Done, then REVERTED as wrong (`59c5e64`).** Allowlisting a host in `@nuxt/image` *enables* IPX runtime transformation for it, rewriting every contract descriptor to `/_ipx/…`, which 404s and cost `best-practices` 4 points in CI. D23-15 prescribes no runtime transformation: the API pre-generates renditions and R2 serves them. The correct configuration is **no `image:` block**; `Gallery.vue` builds its srcset from the contract's own `variants`.
- [X] T041 `app/components/project/Gallery.vue` — ordered figures via `<NuxtImg>`; explicit `width`/`height`; `blurhash` placeholder; `variants[]` respected; lazy by default with an explicit `priority` prop for a genuine above-the-fold image only.
- [X] T042 Localized `alt` and `caption`; handle `alt === null` (no translation) and `alt === ""` (decorative) as **distinct** states.
- [X] T043 Empty gallery → region omitted entirely.
- [X] T044 Unit tests: ordering, empty/populated, descriptor + variant selection, both `alt` states, caption association.

## Phase 6 — SEO *(depends on Phases 3–4)*
- [X] T050 `useSeoMeta` with the `metaTitle → title` / `metaDescription → summary` fallback chain; OG/Twitter; graceful null `ogImage`.
- [X] T051 Canonical per locale; filtered index views canonicalize to `/projects`.
- [X] T052 hreflang EN↔AR + `x-default` → EN, driven by the `slugs` map (D22-3).
- [X] T053 `app/composables/useProjectSchema.ts` — `CreativeWork` + `BreadcrumbList` on detail; `BreadcrumbList` only on the index (doc 22 §4).
- [X] T054 Sitemap source for published project translations, per locale, with hreflang annotations. Projects only; the rest of the sitemap config untouched.
- [X] T055 Unit tests for metadata and schema generation.

## Phase 7 — Performance & i18n wiring *(depends on Phases 3–5)*
- [X] T060 `nuxt.config.ts` — `swr: 60` route rules for `/projects`, `/projects/**`, `/ar/projects`, `/ar/projects/**`.
- [X] T061 `i18n/locales/{en,ar}.json` — the `projects.*` block (titles, filter, empty copy, eight section headings, gallery, links, breadcrumbs). **Native Arabic review COMPLETE (owner, 2026-07-28):** nine owner-approved replacements applied verbatim (`projects.description`, `emptyBody`, `emptyFilteredBody`, `filter.clear`, `links.live`, `contact.title`, `contact.body`, `contact.action`, `seo.projects.description`); all other Arabic strings approved unchanged. EN/AR key parity verified at **153/153**, the only identical values being the locale self-names (`locale.en`/`locale.ar`, correct by design) — **no untranslated English fallback can render on `/ar`**. Affected e2e assertions and the Arabic module README updated. No repository-wide punctuation/diacritics cleanup was started (owner instruction).
- [X] T062 `lighthouserc.cjs` — append the four Projects URLs. **No threshold, budget, or release rule is edited** (HR-3).
- [X] T063 Confirm `check:bundle` still reports no dashboard/editor leak and `size:routes` stays within budget.

## Phase 8 — COMPLETE Projects e2e + axe coverage *(depends on Phases 3–7; built on the Phase 1 foundation)*
- [X] T071 ~~Web-owned `page.route()` fixtures~~ — **mechanism disproved and replaced on 2026-07-28.** Browser interception cannot reach these reads: a direct load is server-rendered so the API call happens inside Nitro (0 requests intercepted), and a client navigation fetches the `swr`-cached `_payload.json` instead (0 intercepted). `_payload.json` interception was **rejected** — it would assert against Nuxt's serialization format, not the application. Unit-only coverage was also rejected: these are SSR behaviours. **Approved replacement:** a test-only SSR scenario server (`scripts/e2e/scenario-server.ts`) run as a second Playwright project, `ssr-scenarios`, via `scripts/ci-preview.mjs --backend scenarios`. Prism stays the primary contract mock and keeps the whole normal journey in the `contract` project; the scenario server is limited to the deterministic cases Prism cannot express and must not become a general mock API. **No mock layer in application code** — nothing outside `scripts/e2e/**` and `e2e/**`.
- [X] T071a Scenario backend: deterministic **one URL ⇒ one scenario** selection from path/slug/`?locale=` only, no mutable state; RFC 7807 errors reusing the contract's `ProblemDetailsDto`; genuine socket-destroy connection failure alongside an upstream 503.
- [X] T071b Contract fidelity, both layers: fixtures typed with the OpenAPI-derived `app/types/api.d.ts` (enforced by `typecheck:e2e`), plus ajv validation of every served response against the committed `openapi/openapi.json` (`scripts/e2e/contract-fixtures.spec.ts`). OpenAPI and its examples **unchanged**.
- [X] T071c Scenario-server unit tests (`scripts/e2e/scenario-server.spec.ts`): route selection, locale selection (including no cross-locale fallback), redirect resolution, RFC 7807 shape, and shutdown/port-rebind. No snapshot-only tests.
- [X] T072 e2e: **F-P1** land → `/projects` → case study → Contact CTA.
- [X] T073 e2e: **F-P5** locale switch preserves the equivalent project route (EN slug → AR counterpart slug). Covered for **routing and metadata** (hreflang and the switcher both target the counterpart slug, both directions) and for a direct load of either locale. The **client-side** switch is blocked by finding **F-1** below and is recorded as an expected failure, not silently dropped.
- [X] T074 e2e: both locales + RTL smoke (`dir`, mirrored composition).
- [X] T075 e2e: unknown project (404) · redirect-resolved slug · empty list · unavailable API.
- [X] T076 axe scans on Projects index and Project detail, both locales; zero violations.
- [X] T077 Extend the Phase 1 e2e CI job to run the full Projects suite. **No threshold or budget touched.**
- [X] T078 e2e: technology-filter URL state · list-to-detail navigation · optional live/repo link combinations where practical · populated and empty gallery.

## Findings raised by the SSR scenario lane (2026-07-28)

Both were invisible to every previous gate for the same reason: Prism answers its single example for
any slug in any locale, so neither state could occur against the contract mock.

- **F-2 — FIXED in this slice.** The localized error page rendered without `dir`. A fatal error
  renders `error.vue` *instead of* `app.vue`, so app.vue's `htmlAttrs` never ran; i18n supplied `lang`
  on its own, so the Arabic 404 and 500 pages looked localized while laying out left-to-right. Fixed
  by setting `<html lang dir>` in `app/error.vue` as well. Covered by the unknown-slug scenario.

- **F-1 — FIXED under owner-approved Option B (docs PR #16, merge `741da9d`).**
  A client-side locale switch on a per-locale-slug route rendered the localized 404 instead of the
  counterpart document. Measured: `GET /projects/ssr-bilingual-ar?locale=en`, then
  `GET /redirects/resolve?locale=en&path=…` — the INCOMING slug with the OUTGOING language, which is
  a legitimate 404 because public slugs are per locale (D04-2). Cause: the `page-spread` transition
  (**D03-13**, not D03-14) defers the locale commit until the outgoing page is concealed, and the
  incoming page's `setup()` runs inside that window.
  **Fix (D06-6):** public content reads resolve their locale from the TARGET ROUTE.
  `app/utils/route-locale.ts` (pure, 8 unit tests) + `app/composables/useRouteLocale.ts` (4 unit
  tests); `useApi()` accepts an explicit `locale`; every public composable and the two per-locale-slug
  pages pass the route-resolved locale and use it in their `useAsyncData` keys. Dashboard, auth and
  mutation behaviour unchanged. Verified on **both** surfaces (Projects and Blog, both directions).
  A welcome side effect: the client `useAsyncData` key now matches the SSR payload key, so the switch
  makes **no** browser API request at all — one fewer round trip than before, not one more.
  Note: **D10-6 does not mandate reading the reactive i18n locale**; it governs the `?locale=`
  parameter itself. Doc 10 was not modified.

- **F-3 — RESOLVED via the owner's staged decision (docs PR #17, merge `7e98ce7`; D22-7).**

  *Stage A — upgrade first.* `@nuxtjs/i18n` 10.4.1 → 10.5.0, as an isolated commit. It did **not**
  fix the defect; its only SEO change concerns `differentDomains`. Measured after a client-side
  switch, against the head a direct load produces: `lang` ✓ and `hreflang` ✓, but `dir` stayed
  `ltr`, canonical kept the Arabic slug on the English path, and `og:locale` stayed `en_US`. The
  Projects **index** switch was correct in both directions — closing the earlier evidence gap and
  confirming `setI18nParams()` as the differentiator.

  *Stage B — docs-first strict SEO.* **D22-7** (doc 22 v1.2.0) gives `@nuxtjs/i18n` ownership of
  `<html lang dir>`, locale alternates, route-derived canonical, `og:locale`/`og:locale:alternate`/
  `og:url` and localized dynamic-route parameters, via `i18n.experimental.strictSeo`.
  `useLocaleHead()` was removed — the module throws on it in strict mode, which is the root of F-3:
  two writers for the same tags. `app.vue` keeps only the title template; `error.vue`'s `htmlAttrs`
  became duplication and were removed (F-2's behaviour is unchanged and still asserted — only its
  owner moved). Page/entity code keeps title, description, OG image, structured data and D22-6 metas.
  `skipSettingLocaleOnNavigate` (D03-13), D06-6, and the API contract are untouched.

  *Caught during Stage B.* The header language switcher's rendered `href` was the re-prefixed
  same-locale slug. Clicking worked — the router resolved the reactive target — so it was invisible
  to a mouse user and live for a crawler, a middle-click or a no-JS visitor. Cause: the header
  server-renders **before** the page calls `setI18nParams()`. Fixed with the module's own
  `<SwitchLocalePathLink>`, whose `href` the module rewrites on `app:rendered`, after the whole page
  has run. Both switchers now emit the counterpart slug in SSR, in both locales.

- **F-4 — FOUND AND FIXED while implementing D06-6; worth an owner note.**
  D06-6 says "public data composables default to a locale resolved from the route". Applied literally
  to `useSiteSettings` that is **wrong**, and measurably so: the footer lives in the persistent
  `default` layout, which the D03-13 page transition does **not** conceal, so its API-localized
  `availabilityStatus` flipped at navigation while the header still flipped at the locale commit —
  a visible Arabic-footer/English-header frame (`footerAR=true navAR=false`).
  The distinction that holds: **page content follows the route** (it is concealed during the
  transition, and it can 404 on a per-locale slug — the thing D06-6 exists to prevent); **persistent
  chrome follows the committed UI locale** (it has no slug, cannot 404 on a locale mismatch, and must
  commit in the same frame as the rest of the chrome per D03-13). Locked in by a regression test.
  If the owner wants doc 06 to say this explicitly, D06-6's wording is the place — flagged, not
  assumed.

## Phase 9 — Verification & Documentation gate (D16-8) *(closing gate — mandatory)*
- [X] T080 Gates green, thresholds unchanged: `typecheck` 0 · `lint` · `test` · `build` · `check:bundle` · `check:logical` · `size` · `size:routes` · `test:e2e` · axe.
- [X] T081 Visual matrix: EN/AR × light/dark × desktop/tablet/mobile for both routes; SSR no hydration mismatch, zero console errors. **24/24 cells captured and asserted** (status 200, `h1` visible, `dir` correct per locale, **zero console errors and zero page errors** in every cell). Captured with a one-off Playwright matrix run rather than a committed screenshot suite — snapshot-only tests are banned (§6.1) and the assertions it made are already covered by the two lanes.
- [X] T082 Lighthouse on the extended matrix. **A failure is a signal to fix the page, never to edit a threshold** (doc 20 §1). Green in CI on the four Projects URLs × 2 profiles: desktop performance 98–100, mobile 83–92, accessibility / best-practices / SEO **100** everywhere. No threshold edited.
- [X] T083 Arabic module docs (`app/components/README.md`, `app/pages/README.md`, `app/composables/README.md`) per doc 16 §8.1 — Arabic prose, English identifiers.
- [X] T084 Central doc sync: docs PR **#16** merged (`741da9d`) adding **D06-6** (doc 06 v1.1.0) and **D18-6** (doc 18 v1.1.0); docs 03 and 10 untouched, D03-13 and D18-3 preserved, no `D03-15`. Feature-map row `005` → implemented; any doc 04/13/22 updates the shipped behavior materially affects. `D10-12` untouched; **no `D10-13`**; no new decision unless something genuinely contradicts an approved doc — in which case revise the doc **first** (doc-first, D16-7).
- [X] T085 SpecKit closeout: this `tasks.md` fully checked, deferrals and accepted limitations recorded (F-1 fixed, F-2 fixed, **F-3 open**), `.specify/feature.json` accurate.
- [X] T086 **Documentation & Handoff Gate (D16-8)** — PASSED 2026-07-28, against Web head `315f3f4` with every CI check green (branch guard · Lint/Typecheck/Test/Build/Isolation incl. all budget gates and Lighthouse · E2E + Accessibility).
  1. **Arabic module docs** — `app/components/README.md` (Projects components: filter placeholder rule, gallery `variants`/`alt` semantics, link combinations, breadcrumb semantics), `app/pages/README.md` (index states, the 404→redirect branch, the per-locale-slug caution), `app/composables/README.md` (`useProjects`, `useSlugRedirect`, `useRouteLocale`/D06-6, and D22-7 head ownership). Arabic prose, English identifiers, no secrets.
  2. **SpecKit closeout** — `spec.md` unchanged (no observable requirement changed); `plan.md` records the two-lane harness, D06-6 and D22-7; this `tasks.md` fully checked with findings F-1…F-5 and their resolutions recorded; `.specify/feature.json` accurate. This gate is the final task.
  3. **Central source-of-truth sync** — docs PR **#16** (`741da9d`): D06-6 (doc 06 v1.1.0) + D18-6 (doc 18 v1.1.0); docs PR **#17** (`7e98ce7`): D22-7 (doc 22 v1.2.0). Docs 03 and 10 deliberately untouched; D03-13, D18-3, D22-3 and D01-3 preserved. **No OpenAPI or API change** — the committed contract is a fixed point of `api:types`, enforced in CI.
  4. **Project status + handoff** — feature-map row `005` → implemented, with the two lanes and the resolved findings. `PROJECT_GUIDE.md` untouched: the shipped baseline has not changed. The production baseline remains unchanged because PR #22 has not been promoted or deployed. Branch `005-public-pages`, PR #22 → `dev`, head `315f3f4`. No migrations. No duplicate status files.
  5. **Final consistency verification** — Arabic docs match the shipped code; every `D03-14` reference is selective glass or an explicit correction note; `git diff --check` clean; no secrets or `.env` content in the diff; no stale "planned / not started" wording for 005; working tree clean with zero stashes.

## Out of scope (do not do in this slice)
- `FR-PUB-034` prev/next navigation (priority `C`).
- `/experience`, `/about`, `/uses`, `/resume`, `/contact` pages.
- Any API change, API OpenAPI examples, or API deployment.
- The operational debt recorded in `spec.md` §10.1 (OD-1…OD-5).
- Production/test content editing, image upload, deployment, `dev → main` promotion, Feature 007 changes.
