# Implementation Plan: Public Pages — Projects P1 Journey Slice (005)

**Branch**: `005-public-pages` (off Web `dev` `6898cf8`) · **Spec**: `./spec.md` · **Status**: Planned, not implemented

## Approach

Build the journey end-to-end before polishing any single surface: index → detail → contact exit, both
locales, against the Prism mock. Reuse the 007 primitives that were built for exactly this feature
rather than inventing parallel components. Prove the contract-driven states (loading / empty / error /
404 / redirect) early, because they are where the real complexity lives — the visual system already
exists.

Two things are genuinely new and carry the risk: the **Playwright + axe harness** (absent from the repo
entirely) and **`@nuxt/image` configuration for the remote media origin**. Both are sequenced so the
pages are independently verifiable before the harness lands.

## Sequencing (why this order) — revised by owner decision 2026-07-27

**The harness comes first, not last.** The original plan deferred Playwright + axe to a late phase. The
owner reversed that: it is the largest implementation uncertainty, so it is bootstrapped and *proven*
before substantial page work, against an already-stable public route. A harness that turns out to be
unworkable must surface on day one, not after the pages are written.

1. **Playwright + axe foundation** — config, Prism + Nitro orchestration, CI wiring, and a minimal EN/AR
   smoke plus one axe scan on an existing route. Proves the harness end-to-end while proving nothing
   about Projects.
2. **Data + routing skeleton** — composables and two pages rendering real contract shapes. Everything
   downstream depends on the shapes being right.
3. **States before styling** — `UiRequestState` wiring, 404, and redirect resolution. These break
   silently in SSR and are hardest to retrofit.
4. **Detail content, then gallery** — the FR-CNT-020 sections work without any media; the gallery is
   additive and verified against contract descriptors.
5. **SEO/schema after content is stable** — metadata derives from resolved content.
6. **Full Projects e2e + axe coverage** — completed once the pages exist, on the foundation from step 1.

## Harness architecture (reuse, don't reinvent)

`scripts/ci-preview.mjs` already orchestrates exactly what the e2e harness needs: Prism on the
**committed** contract, the built Nitro server pointed at it, deterministic TCP readiness gating for
*both* ports before announcing readiness, and SIGINT/SIGTERM teardown so no orphan mock survives. Its
header documents precisely why readiness gating matters — a page server-rendered before Prism is up
renders its error state and silently changes what the test measures.

Playwright's `webServer` therefore **reuses that script** rather than duplicating process
management. This keeps one source of truth for preview orchestration, shared with the Lighthouse gate.

### Revision, 2026-07-28 — browser interception disproved; two lanes instead

The original mechanism for the scenarios Prism cannot express was Playwright `page.route()`
interception (below, and T071). **It was tried and it does not work for these routes.** Measured, not
assumed:

- a direct load is **server-rendered**, so the API read happens inside Nitro and never reaches the
  browser — `page.route()` intercepted **0** requests;
- a client-side navigation does not help either, because `/projects**` carries `swr: 60` route rules,
  so Nuxt fetches the pre-rendered `_payload.json` instead of calling the API from the browser —
  again **0** intercepted.

Intercepting `_payload.json` was rejected: it would assert against Nuxt's serialization format rather
than the application's behaviour, and it would break on any Nuxt upgrade without the behaviour having
changed. Downgrading the six scenarios to unit-only coverage was also rejected — they are SSR
behaviours, and unit tests cannot observe SSR.

**Approved replacement: a test-only SSR scenario server.** The fixture moves from the browser to the
process boundary *below* Nitro, which is where the read actually happens. No application code is
involved either way.

- **Prism remains the primary contract mock.** It backs the Lighthouse gate, the per-route size gate,
  and the `contract` Playwright project, which keeps the whole normal journey (19 tests: journeys,
  ordering, filter, gallery, SEO, schema, locale, breadcrumbs, axe). It is **not** replaced globally.
- **`ssr-scenarios`** is a second Playwright project served by `scripts/e2e/scenario-server.ts` — a
  small deterministic Node server limited to the six states Prism cannot express, because Prism
  replays one example for every slug and every locale. Normal journey tests are **not** duplicated
  into it.
- **One orchestrator, not two.** `scripts/ci-preview.mjs` gains `--backend prism|scenarios`; the
  backend is the only thing that changes. Real `.output` execution, TCP readiness gating before any
  SSR request, `reuseExistingServer: false`, zero retries, observed SIGTERM→SIGKILL shutdown and the
  report upload are shared verbatim. Both ports are env-driven so the two lanes never collide.
- **Design invariant: one URL ⇒ one scenario.** Every scenario is selected purely from the request
  path, slug and `?locale=`. There is no mutable scenario state, so the lane runs fully parallel with
  no reset hook, and Nitro's `swr: 60` cache is safe — its key is a hash of the full path including
  the query string, so no two scenarios can share an entry and no stale success can mask a failure.
- **Contract fidelity, twice.** Fixtures are typed with the OpenAPI-derived types generated into
  `app/types/api.d.ts` (compile time, `typecheck:e2e`), and every served response is validated against
  the committed `openapi/openapi.json` with ajv (run time,
  `scripts/e2e/contract-fixtures.spec.ts`). Errors use the contract's own RFC 7807
  `ProblemDetailsDto`. No second handwritten DTO model exists, and the contract is read, never
  written.

The scenario server lives entirely in `scripts/e2e/**`. It is not in `app/**`, not a Nitro business
route, not a runtime plugin, not a composable, and not a component — and it must not grow into a
general mock API.

### Revision, 2026-07-28 — D06-6, effective locale from the route

Owner-approved (docs PR #16, merge `741da9d`) after the scenario lane surfaced finding **F-1**.

Public content reads take their locale from the **target route**, not from the reactive UI locale.
The two agree in normal rendering and diverge only inside the `page-spread` transition (**D03-13** —
not D03-14, which is selective glass), which defers the locale commit until the outgoing page is
concealed. The incoming page's `setup()` runs inside that window, so a read using reactive state asks
for the incoming per-locale slug (D04-2) in the outgoing language — a legitimate contract 404.

- `app/utils/route-locale.ts` — pure resolver over the configured codes, default locale and the
  `prefix_except_default` strategy. Nothing hard-coded to `en`/`ar`; adding a locale needs no change.
- `app/composables/useRouteLocale.ts` — the composable form, reading `$i18n` (safe outside setup, the
  same reason `useApi()` documents) rather than the setup-only `useI18n()`.
- `useApi()` gains an optional explicit `locale`; public composables and both per-locale-slug pages
  pass the route-resolved value and use it in their `useAsyncData` keys. Dashboard, auth and mutation
  paths are untouched.

**Doc 10 is unchanged.** D10-6 governs the `?locale=` parameter and its semantics, not how the
frontend derives the value. Rejected alternatives (i18n's `@internal` `__pendingLocale`; disabling
`skipSettingLocaleOnNavigate`; suppressing the 404) are recorded in D06-6.

### Revision, 2026-07-28 — D22-7, locale-owned head metadata (strict SEO)

Owner-approved staged resolution of finding F-3 (docs PR #17, merge `741da9d` → `7e98ce7`).

Stage A upgraded `@nuxtjs/i18n` 10.4.1 → 10.5.0 as an isolated commit and **did not** fix it.
Stage B adopted the module's official `experimental.strictSeo`, so `@nuxtjs/i18n` owns
`<html lang dir>`, the locale alternates (D22-3), the route-derived canonical,
`og:locale`/`og:locale:alternate`/`og:url`, and the localized dynamic-route parameters fed by
`setI18nParams()`. `useLocaleHead()` is removed — the module throws on it, and two competing writers
for the same tags is precisely what F-3 was.

Consequences in this repo:

- `app.vue` keeps the title template only; `error.vue` no longer sets `htmlAttrs` (module-owned now).
- `LangToggle.vue` uses the module's `<SwitchLocalePathLink>` rather than a pre-resolved
  `switchLocalePath()`, because the header renders before the page calls `setI18nParams()` and was
  therefore emitting the same-locale slug in its `href`.
- Page/entity code is unchanged: title, description, OG image, structured data and the D22-6 global
  metas stay where they were.

`prefix_except_default` (D01-3), the deferred locale commit (D03-13), route-resolved content locale
(D06-6) and the API contract are all untouched. No OpenAPI change.

## Data layer

- `app/composables/useProjects.ts` — two functions over `useApi()`:
  - list: `useAsyncData` keyed `projects:{locale}:{page}:{technology}`, `watch: [locale, page, technology]`,
    returning `Paginated<ProjectListItem>`.
  - detail: `useAsyncData` keyed `project:{slug}:{locale}` returning `ProjectDetail`.
  Follows the `useHomeData` idiom (per-request error capture, no page-level rejection) and the
  `blog/[slug].vue` idiom (explicit post-await error mapping).
- `app/composables/useSlugRedirect.ts` — single-shot `GET /redirects/resolve?path=…`; returns `toPath` on
  200, `null` on 404. Never retries, never swallows a non-404.
- `app/utils/project-error.ts` — mirrors `article-error.ts`: 404 → localized not-found; any other status
  preserved. Pure, Nuxt-free, unit-testable.

Locale is injected by `useApi()` (D10-6) — never passed manually.

## Pages

- `app/pages/projects/index.vue` — `UiSpread` + `UiSectionHead` frame; `UiRequestState` around a list of
  `ContentWorkEntry`; technology filter control; pagination rendered only when `meta.totalPages > 1`.
  Filter state lives in the URL via `useRoute`/`navigateTo` with `replace: true`.
- `app/pages/projects/[slug].vue` — breadcrumbs, title block, technologies, optional links, the eight
  `ContentProse` sections, gallery, Contact CTA. `setI18nParams` fed from `slugs` before the first await
  boundary, matching `blog/[slug].vue:35-43`.

## Components

- `app/components/project/Filter.vue` — technology filter; native `<select>` or Nuxt UI equivalent,
  keyboard-operable, labelled, clearable.
- `app/components/project/Gallery.vue` — ordered figures; `<NuxtImg>` with `width`/`height`,
  `placeholder` from `blurhash`, `loading="lazy"` except an explicit `priority` prop for the first image
  when it is genuinely above the fold; `<figcaption>` when `caption` is present; the `alt === null` vs
  `alt === ""` distinction handled explicitly.
- `app/components/project/Links.vue` — renders `liveUrl`/`repoUrl`; renders **nothing** when both null.
- `app/components/ui/Breadcrumbs.vue` — semantic `<nav aria-label>` + ordered list; last item
  `aria-current="page"`, not a link; logical properties so it mirrors in RTL.

All are detachable (props/slots only, doc 12 §6) and consume semantic tokens only (D14-2).

## SEO

- `app/composables/useProjectSchema.ts` — `CreativeWork` + `BreadcrumbList` via `useSchemaOrg`,
  alongside the existing `useSiteSchema` pattern. Index emits `BreadcrumbList` only.
- `useSeoMeta` for title/description/OG/Twitter with the `metaTitle → title` /
  `metaDescription → summary` fallback chain.
- Sitemap: a Nitro-side source for published project translations per locale. `@nuxtjs/sitemap` is
  already present via `@nuxtjs/seo`; this adds a dynamic source for Projects only and leaves the rest of
  the sitemap configuration untouched.

## Configuration

- `nuxt.config.ts` — add `swr: 60` route rules for `/projects`, `/projects/**`, `/ar/projects`,
  `/ar/projects/**`, matching the existing `/blog/**` entries. Add an `image:` block configuring the
  remote media origin (`media.eslammuatamed.com`) so `<NuxtImg>` accepts contract-supplied descriptors —
  currently no `image:` block exists, so remote URLs are unconfigured.
- `i18n/locales/{en,ar}.json` — a `projects.*` block: index title/eyebrow, filter label and clear action,
  empty copy, section headings for all eight FR-CNT-020 fields, gallery label, link labels, breadcrumb
  labels. Arabic is author-written and flagged for owner native review (carried limitation).
- `lighthouserc.cjs` — append the four Projects URLs. **Thresholds untouched.**

## Testing

- **Vitest** alongside each component/composable, per §6.1 of the spec. No snapshot-only tests.
- **Playwright + axe** (new, **Phase 1 — first**): `@playwright/test` + `@axe-core/playwright`, with
  `webServer` delegating to `scripts/ci-preview.mjs`. Two projects: `contract` (Prism, the normal
  journey) and `ssr-scenarios` (the test-only SSR scenario server, for the scenarios Prism cannot
  express deterministically — EN/AR content differentiation, empty list, unknown-slug 404, redirect
  resolution, unavailable API, empty gallery). CI job added to `.github/workflows/ci.yml` **without
  touching any existing threshold or the Lighthouse job**.

  ~~Web-owned `page.route()` interception~~ — superseded on 2026-07-28; see “browser interception
  disproved” above. Browser interception cannot observe an SSR read, and `_payload.json` interception
  was rejected rather than adopted.

## Verification

Gates, all pre-existing and unchanged: `typecheck` (0) · `lint` · `test` · `build` · `check:bundle` ·
`check:logical` · `size` · `size:routes`. Plus the new `test:e2e` and axe scans. Visual matrix EN/AR ×
light/dark × desktop/tablet/mobile. SSR: no hydration mismatch, zero console errors.

Lighthouse runs are **not** part of this docs-only specification task and are executed during
implementation only.

## Explicitly not in this plan

API changes · OpenAPI examples · the other public pages · `FR-PUB-034` · the §10.1 operational debt ·
deployment · promotion · content or media authoring.
