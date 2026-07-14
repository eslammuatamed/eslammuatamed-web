# Tasks 001 — M1 Foundation (Web)

Executor: Opus. Each task cites its governing doc; check off only with its verification
done. `[P]` = parallelizable with siblings.

- [x] T1 — Dependencies + tooling baseline
  - Install plan.md set; `.nvmrc` (24) + `engines`; lint-staged (D15-1); scripts:
    `lint`, `typecheck`, `test`, `mock` (Prism), `api:types` (openapi-typescript).
  - **Verify:** scaffold still builds (`nuxt build`).
- [x] T2 — Tokens, fonts, themes (docs 14, 03)
  - `main.css` `@theme` + `--ui-*` per-theme overrides (D03-2 split), brand/radius/
    motion tokens, fluid type scale, `html[lang="ar"]` switch (D14-5); fontsource
    imports; app.config Nuxt UI colors; color-mode wired (system default, no FOUC).
  - **Verify:** manual theme/locale class inspection in dev; no raw hex outside main.css.
- [x] T3 — Nuxt config + i18n (docs 06 §1/§4)
  - routeRules (D06-1 + SWR), i18n en/ar `prefix_except_default` + `dir`, lazy locale
    JSONs (nav/footer/common/auth strings, both locales — native-quality Arabic),
    runtimeConfig; `<html lang dir>` correctness.
  - **Verify:** `/` vs `/ar` render with correct `lang`/`dir`.
- [x] T4 — Types bootstrap + useApi + auth store (doc 06 §2, D11-1)
  - `app/types/models.ts` (documented placeholder), `useApi()` ($fetch wrapper: base
    URL, locale param, ApiError from problem+json, single 401 refresh retry,
    credentials on auth/admin), Pinia `auth` store (memory token, login/logout/refresh
    actions). **Verify:** Vitest — error normalization + retry-once logic (mocked).
- [x] T5 — Shell (docs 04 §3, 13, 21)
  - `default` layout: header (nav, Resume, Contact CTA, `LayoutLocaleSwitcher`,
    `LayoutThemeToggle`), footer, skip link; `error.vue`; `UiSectionHeader`,
    `AppLink` (locale-aware). Logical properties only.
  - **Verify:** keyboard pass — skip link first, visible focus; RTL mirror check.
- [x] T6 [P] — Public slice: home hero + blog (docs 02, 12, 13)
  - `index.vue` hero from `GET /settings/site` (useAsyncData, locale-keyed);
    `blog/index.vue` paginated list (`ContentArticleCard`); `blog/[slug].vue` via
    `ContentProse` (markdown-it html:false + Shiki SSR-only + heading anchors);
    loading/empty/error states designed (D13-1); 404 for unknown slug.
  - **Verify:** Vitest — ContentProse: renders fences highlighted, strips/escapes
    hostile input, anchors generated.
- [x] T7 [P] — Dashboard slice (docs 11 §1, 08 boundaries)
  - `pages/dashboard/login.vue` (UForm+Zod), `pages/dashboard/index.vue` placeholder,
    `auth` middleware via definePageMeta, `dashboard` layout shell; session boot via
    silent refresh. **Verify:** logged-out redirect works in dev.
- [x] T8 — Lint boundaries + CI (docs 15, 17)
  - `@nuxt/eslint` flat config + no-restricted-imports (dashboard boundary), physical-
    utility ban, raw-`$fetch`/axios ban; GitHub Actions (lint→typecheck→test).
  - **Verify:** a deliberate boundary violation fails lint, then remove it.
- [x] T9 — Bundle isolation check (D06-1/D06-5, doc 20 §5)
  - `nuxt build` + script asserting no tiptap/prosemirror identifiers in public chunks
    (first version of the forbidden-module gate). **Verify:** check passes; add to CI.
- [x] T10 — Contract adoption (coordinator; after API contract export)
  - Copy `openapi.json` → `openapi/`; `npm run api:types`; replace models.ts internals
    with generated aliases; fix typecheck. **Verify:** typecheck green; D16-2 atomic.
  - Pass 2 (F-P5): adopted api@0e93d71 adding `slugs` to the article detail; article page
    registers per-locale slugs via `useSetI18nParams` so locale switch resolves the
    translated URL. Atomic commit `4d87701`.
- [ ] T11 — Walking-skeleton browser verification (coordinator, with API running)
  - `/`, `/ar`, `/blog`, article page, login flow, session reload — both locales.
- [x] T12 — Geist brand-face migration (post-hoc owner directive D03-6)
  - Doc 03 v1.1.0 supersedes Inter with Geist as the Latin sans face. Swap
    `@fontsource-variable/inter` → `@fontsource-variable/geist` (self-hosted, matches the
    existing fontsource pattern; Vercel's `geist` next/font package rejected), update the
    `wght.css` import, `--font-sans`, and the Latin fallback inside `--font-sans-arabic`;
    the D14-5 `html[lang="ar"]` direct-set mechanism preserved exactly.
  - **Verify:** lint, typecheck, test, build green; build bundles the Geist woff2 subsets
    with no Inter leftovers. Commit `a77feb7`.
