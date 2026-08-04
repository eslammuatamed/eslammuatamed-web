# Tasks — Profile Pages, About Slice (009)

**Branch**: `009-profile-about` · **PR**: [#26](https://github.com/eslammuatamed/eslammuatamed-web/pull/26) (open, **must not merge** until the gates in §6 clear)

Legend: `[x]` done · `[ ]` outstanding.

## 1. Contract adoption

- [x] **T001** Verify the OpenAPI artifact at API `dev` `254f6cd0` — hash `3376ac58…`, unchanged from the committed `openapi/openapi.json`.
- [x] **T002** Regenerate types; confirm two consecutive generations are byte-identical (`56f7b714…`) and that nothing drifted. No hand edits.
- [x] **T003** Record that **no adoption commit is required** under doc 16 §3: the About content seed changed no endpoint and no schema, so there is nothing to adopt.

## 2. Readiness model

- [x] **T010** `app/utils/about-readiness.ts` — the single decision point; four states.
- [x] **T011** Order the checks so `content-missing` is reported before a portrait blocker.
- [x] **T012** Keep `alt: null` (untranslated) and `alt: ""` (decorative) distinct; neither satisfies readiness.
- [x] **T013** Prove no cross-locale alt borrowing is structurally possible (readiness is decided per response).

## 3. Page and components

- [x] **T020** `useAboutContent()` — route-locale-scoped read, sharing the `settings:site:{locale}` key namespace so it dedupes with the chrome read.
- [x] **T021** `app/pages/about.vue` — readiness state and published layout; sections in FR-PUB-020 order; `h2` under the page `h1`.
- [x] **T022** `AboutPortrait.vue` — descriptor → `<NuxtImg>` with contract `variants`, intrinsic `width`/`height`, blurhash background.
- [x] **T023** Route `aboutBio` / `engineeringPhilosophy` through `ContentProse` (the single renderer); keep `currentFocus` plain text.
- [x] **T024** Key the Markdown render cache on the **route** locale. *(Fixed a real defect: the UI locale would file Arabic HTML under an English key mid-switch.)*
- [x] **T025** No Contact CTA in page content — the route does not exist yet.

## 4. SEO and structured data

- [x] **T030** `useAboutSchema()` — `ProfilePage` + referenced `Person` + `BreadcrumbList`.
- [x] **T031** Reference the site-wide `Person` by `@id`, never nest a second one (D22-8).
- [x] **T032** Fix the `@id` to `{host}/#identity`. *(Fixed a real defect: `{host}#identity` is a different IRI, leaving `mainEntity` dangling.)*
- [x] **T033** Leave canonical / hreflang / `og:locale` / `og:url` to `@nuxtjs/i18n` under strict SEO (D22-7).
- [x] **T034** Emit no `og:image`; do not substitute the unpublished portrait (finding F-1).

## 5. Copy and tests

- [x] **T040** Add `about.*` and `seo.about.*` to both locale files — additions only, no reformatting.
- [x] **T041** Remove the unused `about.portraitAlt` key: the alt is API-owned per locale.
- [x] **T042** `about-readiness.spec.ts` — 10 tests, every branch.
- [x] **T043** `about.spec.ts` — 13 tests, every state × both locales.
- [x] **T044** `e2e/about.spec.ts` — contract lane: routing, SSR, locale head, schema graph, unfiltered axe.
- [x] **T045** `e2e/scenarios/about-published.spec.ts` — published page: portrait, variants, CLS, RTL, locale-transition atomicity, axe × light/dark. **16/16.**
- [x] **T048** `e2e/readiness/about-portrait-null.spec.ts` + the `about-readiness` Playwright project and `ci-preview --backend about-readiness` configuration (ports 3200/3201) — browser coverage for the REAL portrait-null state. **21/21.** Supersedes the earlier component-only limitation.
- [x] **T046** Populate the scenario fixtures with About content + a portrait-oriented descriptor with per-locale alt; ajv-validated against the committed contract.
- [x] **T047** Navigate via `domcontentloaded` in the About e2e specs, with the reason recorded: the eager LCP portrait points at a media origin that does not exist in test.

## 6. Gates

- [x] **T050** lint · typecheck · e2e typecheck · build.
- [x] **T051** Unit/component suite — 52 files / 536 tests.
- [x] **T052** Add `/about` + `/ar/about` to the route-size matrix; confirm all budgets pass and Home/Experience are unchanged.
- [x] **T053** Add `/about` + `/ar/about` to the Lighthouse collection matrix (thresholds untouched).
- [x] **T054** **Docs D20-19** governing T053 — written into doc 20 (v1.12.0), open as **docs PR #24**. *B12 requires the doc first; PR #26 must not merge before #24 lands.*
- [x] **T055** Lighthouse median collection — both routes × both profiles × 3 runs. Desktop **99/99** perf, LCP **739/817 ms**, CLS **0.0000/0.0024**; mobile **91/91** perf, LCP **2790/2793 ms**, CLS **0.0000/0.0041**; A11y/BP/SEO **100** in all four. Inside every threshold with margin.
- [x] **T056** Flake check — `--repeat-each=3 --workers=2` (CI concurrency), **480 passed, zero failures, zero flaky**.
- [x] **T057** Owner approval of the Arabic UI inventory — granted 2026-07-29 with five exact Arabic replacements, applied verbatim.
- [x] **T059** Apply the owner's `brand.role` fallback change (EN `JavaScript Product Engineer`, AR `مهندس برمجيات للمنتجات`) so the null-tagline fallback no longer publishes the superseded identity.
- [x] **T060b** Update the scenario and readiness fixtures to the approved API tagline; assert `Person.jobTitle` emits it exactly.
- [x] **T058** Feature-map entry for 009.

## 7. Blockers carried to publication (not merge)

- [ ] **T060** Upload the real portrait.
- [ ] **T061** Owner approval of the EN/AR portrait alt text.

Until both, `/about` renders the readiness state. No portrait is invented for any purpose.

## 8. Findings and follow-ups

- **F-1 — no branded social-card fallback.** Carried from the Experience slice; until one exists, `og:image` stays omitted rather than pointing at a URL that does not resolve.
- **F-2 — governed prose in the hydration payload.** The About prose appears once in the Nuxt payload on `/about` (never rendered), because `/settings/site` is one object the persistent footer chrome serializes on every route. `/experience` carries it identically and shipped first, so this is pre-existing behaviour of the shared settings read. Pinned by assertion so a change is visible. Removing it is a separate cross-route decision.
- **F-3 — RESOLVED.** The seeded `settings.tagline` held the pre-positioning title. Governed Docs-first (positioning-strategy v1.1.0 §2/§3, PR #25 → `64a0f075`) and corrected in the API seed (PR #39 → `254f6cd0`). `Person.jobTitle` now emits the approved tagline, still sourced from `settings.tagline` with no hard-coded title anywhere.
- **Resolved:** the `about-states` backend variant recorded earlier as a follow-up is now implemented as T048.
