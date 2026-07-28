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
- [X] T061 `i18n/locales/{en,ar}.json` — the `projects.*` block (titles, filter, empty copy, eight section headings, gallery, links, breadcrumbs). Arabic is author-written and **flagged for native owner review before closeout**; every key ships a real Arabic value — **no untranslated English fallback may render on `/ar`**.
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

- **F-1 — OPEN, needs an owner decision. Pre-existing and site-wide; not a Projects regression.**
  A **client-side** locale switch on a case study renders the localized 404 instead of the counterpart
  project. The URL is correct; the data read is not. Measured:
  `GET /api/v1/projects/ssr-bilingual-ar?locale=en`, then
  `GET /api/v1/redirects/resolve?locale=en&path=/projects/ssr-bilingual-ar` — the Arabic slug with the
  **English** locale, which is a legitimate 404 by contract.
  Cause: `skipSettingLocaleOnNavigate: true` (D03-14) defers the locale commit to the page
  transition's `onBeforeEnter`; the incoming page's `setup()`, and therefore `useApi()` reading the
  current locale (D10-6), runs before that commit. The page throws a fatal 404 before
  `useAsyncData`'s `watch: [locale]` can re-run. The same pattern exists in `blog/[slug].vue`.
  Every candidate fix trades against an approved decision — D03-14, D10-6, or reading i18n's
  `@internal` `__pendingLocale` (principle 16) — so per doc-first (D16-7) the doc is revised before
  the code. **Phase 9 / D16-8 cannot close until this is decided.**

## Phase 9 — Verification & Documentation gate (D16-8) *(closing gate — mandatory)*
- [ ] T080 Gates green, thresholds unchanged: `typecheck` 0 · `lint` · `test` · `build` · `check:bundle` · `check:logical` · `size` · `size:routes` · `test:e2e` · axe.
- [ ] T081 Visual matrix: EN/AR × light/dark × desktop/tablet/mobile for both routes; SSR no hydration mismatch, zero console errors.
- [ ] T082 Lighthouse on the extended matrix. **A failure is a signal to fix the page, never to edit a threshold** (doc 20 §1).
- [ ] T083 Arabic module docs (`app/components/README.md`, `app/pages/README.md`, `app/composables/README.md`) per doc 16 §8.1 — Arabic prose, English identifiers.
- [ ] T084 Central doc sync: feature-map row `005` → implemented; any doc 04/13/22 updates the shipped behavior materially affects. `D10-12` untouched; **no `D10-13`**; no new decision unless something genuinely contradicts an approved doc — in which case revise the doc **first** (doc-first, D16-7).
- [ ] T085 SpecKit closeout: this `tasks.md` fully checked, deferrals and accepted limitations recorded, `.specify/feature.json` accurate.
- [ ] T086 **Documentation & Handoff Gate (D16-8)** — the mandatory final task. Until it passes, the feature must not be pushed, PR'd, merged to `dev`, promoted, or deployed.

## Out of scope (do not do in this slice)
- `FR-PUB-034` prev/next navigation (priority `C`).
- `/experience`, `/about`, `/uses`, `/resume`, `/contact` pages.
- Any API change, API OpenAPI examples, or API deployment.
- The operational debt recorded in `spec.md` §10.1 (OD-1…OD-5).
- Production/test content editing, image upload, deployment, `dev → main` promotion, Feature 007 changes.
