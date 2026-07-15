# Plan 001 — M1 Foundation (Web)

Technology and architecture are decided in the governing docs; this plan binds them.

## Bindings (decision IDs are law)

- Rendering: D06-1 (`ssr:false` dashboard, SWR public); state: D06-4 (no client cache
  lib; server data stays in `useAsyncData`, Pinia only for auth/UI).
- Tokens: doc 14 (D14-1…5) — Nuxt UI `--ui-*` namespace overridden with doc 03 §2
  values; the D03-2 accent split is mandatory (link color ≠ fill color in dark).
- Components: doc 12 — path-prefixed auto-imports (D12-1), wrap-for-semantics-only
  (D12-2), one Markdown renderer (D12-4).
- Markdown: `markdown-it` (`html:false`, `linkify`) + `@shikijs/markdown-it` running
  during SSR only (D20-3), heading anchors via slugified ids; sanitization posture per
  D19-5 — raw HTML disabled structurally in M1.
- i18n: D01-3/D04-1 URL strategy; UI strings in `i18n/locales/{en,ar}.json`; content
  pre-localized by the API (D10-6).
- Auth: D11-1 (memory token + httpOnly refresh cookie set by the API;
  `credentials:'include'` on auth+admin calls; localhost is same-site — D19-3).

## New dependencies (doc 16 §4, one-line justifications)

`@fontsource-variable/geist` (Geist supersedes Inter — D03-6, doc 14 v1.0.1) +
`@fontsource/ibm-plex-sans-arabic` + `@fontsource/jetbrains-mono` (self-hosted brand
typography — D03-1/D20-4) · `markdown-it` + `@shikijs/markdown-it` (single renderer, SSR
highlighting — D12-4/D20-3) · `@nuxtjs/seo` (canonical + hreflang alternates, sitemap/
robots — doc 16 §4) · `zod` (form validation — brief mandate) · dev: `@nuxt/eslint`,
`@nuxt/test-utils`, `vitest`, `@vue/test-utils`, `happy-dom`, `openapi-typescript`
(D06-2), `@stoplight/prism-cli` (D06-3), `husky` + `lint-staged` (pre-commit lint-staged
— D15-1). Nothing else without written
justification. `motion` and Tiptap packages stay installed but MUST NOT be imported in
this feature (Tiptap enters in feature 002 via lazy dashboard components only — D06-5).

## Build order

tokens/fonts/css → nuxt.config + i18n + app.config → types bootstrap + `useApi` +
auth store → layouts/shell components → public slice (home hero, blog) → dashboard
slice (login, middleware, placeholder) → lint boundaries + tests + CI.

## Structure

Per doc 08 §1 exactly (`app/` srcDir; `components/{ui,layout,content,home,dashboard}`;
`composables/`, `composables/dashboard/`; `stores/`; `types/`; `i18n/locales/`).
`openapi/openapi.json` lands in T10 (contract adoption — coordinator supplies the
exported artifact; then `npm run api:types` generates `app/types/api.d.ts` and
`app/types/models.ts` shrinks to view-model aliases of generated types).

## Verification

Lint + typecheck + Vitest green without the API running. Browser verification (both
locales, login flow) happens in the integration step against the local API stack.
