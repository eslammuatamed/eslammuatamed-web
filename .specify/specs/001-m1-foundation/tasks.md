# Tasks 001 — M1 Foundation (Web)

Executor: Opus. Each task cites its governing doc; check off only with its verification
done. `[P]` = parallelizable with siblings.

- [ ] T1 — Dependencies + tooling baseline
  - Install plan.md set; `.nvmrc` (24) + `engines`; lint-staged (D15-1); scripts:
    `lint`, `typecheck`, `test`, `mock` (Prism), `api:types` (openapi-typescript).
  - **Verify:** scaffold still builds (`nuxt build`).
- [ ] T2 — Tokens, fonts, themes (docs 14, 03)
  - `main.css` `@theme` + `--ui-*` per-theme overrides (D03-2 split), brand/radius/
    motion tokens, fluid type scale, `html[lang="ar"]` switch (D14-5); fontsource
    imports; app.config Nuxt UI colors; color-mode wired (system default, no FOUC).
  - **Verify:** manual theme/locale class inspection in dev; no raw hex outside main.css.
- [ ] T3 — Nuxt config + i18n (docs 06 §1/§4)
  - routeRules (D06-1 + SWR), i18n en/ar `prefix_except_default` + `dir`, lazy locale
    JSONs (nav/footer/common/auth strings, both locales — native-quality Arabic),
    runtimeConfig; `<html lang dir>` correctness.
  - **Verify:** `/` vs `/ar` render with correct `lang`/`dir`.
- [ ] T4 — Types bootstrap + useApi + auth store (doc 06 §2, D11-1)
  - `app/types/models.ts` (documented placeholder), `useApi()` ($fetch wrapper: base
    URL, locale param, ApiError from problem+json, single 401 refresh retry,
    credentials on auth/admin), Pinia `auth` store (memory token, login/logout/refresh
    actions). **Verify:** Vitest — error normalization + retry-once logic (mocked).
- [ ] T5 — Shell (docs 04 §3, 13, 21)
  - `default` layout: header (nav, Resume, Contact CTA, `LayoutLocaleSwitcher`,
    `LayoutThemeToggle`), footer, skip link; `error.vue`; `UiSectionHeader`,
    `AppLink` (locale-aware). Logical properties only.
  - **Verify:** keyboard pass — skip link first, visible focus; RTL mirror check.
- [ ] T6 [P] — Public slice: home hero + blog (docs 02, 12, 13)
  - `index.vue` hero from `GET /settings/site` (useAsyncData, locale-keyed);
    `blog/index.vue` paginated list (`ContentArticleCard`); `blog/[slug].vue` via
    `ContentProse` (markdown-it html:false + Shiki SSR-only + heading anchors);
    loading/empty/error states designed (D13-1); 404 for unknown slug.
  - **Verify:** Vitest — ContentProse: renders fences highlighted, strips/escapes
    hostile input, anchors generated.
- [ ] T7 [P] — Dashboard slice (docs 11 §1, 08 boundaries)
  - `pages/dashboard/login.vue` (UForm+Zod), `pages/dashboard/index.vue` placeholder,
    `auth` middleware via definePageMeta, `dashboard` layout shell; session boot via
    silent refresh. **Verify:** logged-out redirect works in dev.
- [ ] T8 — Lint boundaries + CI (docs 15, 17)
  - `@nuxt/eslint` flat config + no-restricted-imports (dashboard boundary), physical-
    utility ban, raw-`$fetch`/axios ban; GitHub Actions (lint→typecheck→test).
  - **Verify:** a deliberate boundary violation fails lint, then remove it.
- [ ] T9 — Bundle isolation check (D06-1/D06-5, doc 20 §5)
  - `nuxt build` + script asserting no tiptap/prosemirror identifiers in public chunks
    (first version of the forbidden-module gate). **Verify:** check passes; add to CI.
- [ ] T10 — Contract adoption (coordinator; after API contract export)
  - Copy `openapi.json` → `openapi/`; `npm run api:types`; replace models.ts internals
    with generated aliases; fix typecheck. **Verify:** typecheck green; D16-2 atomic.
- [ ] T11 — Walking-skeleton browser verification (coordinator, with API running)
  - `/`, `/ar`, `/blog`, article page, login flow, session reload — both locales.
