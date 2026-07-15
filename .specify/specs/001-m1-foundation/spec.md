# Feature 001 — M1 Foundation (Web)

**Milestone:** M1 (doc 24 §2). **Governing docs:** 03, 06, 08, 12, 13, 14, 15, 18, 21.
**Requirements carried:** FR-PUB-001/002/003/004/007 (global shell), slices of
FR-PUB-010 (hero) and FR-PUB-040/042 (blog list + article), FR-DSH-001/002/004 (login,
session, isolation), NFR-002/003/004.

## Problem

The scaffold has modules installed but no architecture. M1 needs the frontend spine —
tokens, i18n/RTL, the API layer, layouts, and a thin rendered slice — built to the
constitution so every later feature lands on rails.

## Scope (what ships)

1. **Design tokens (doc 14)** — `@theme` + `--ui-*` overrides in `main.css`, both
   themes (doc 03 values incl. D03-2 accent split), brand tokens, radius/motion tokens;
   fonts self-hosted via `@fontsource-variable/geist` (Geist supersedes Inter — D03-6,
   doc 14 v1.0.1), `@fontsource/ibm-plex-sans-arabic` (400/600), `@fontsource/jetbrains-mono`;
   `html[lang="ar"]` family/tracking switch
   (D14-5); theme switching via color-mode, system default, no FOUC.
2. **Nuxt config** — routeRules (`/dashboard/**` ssr:false — D06-1; SWR for public),
   i18n `prefix_except_default` en/ar with `dir`, lazy locale JSONs, runtimeConfig
   (`NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_BASE`), app.config Nuxt UI colors
   (primary blue / neutral zinc).
3. **API layer (doc 06 §2)** — `useApi()` composable: `$fetch.create` wrapper, locale
   param on public reads, RFC 7807 → typed `ApiError`, 401 silent-refresh retry hook;
   Pinia `auth` store (memory access token only — D11-1). Bootstrap types in
   `app/types/models.ts` (documented as pre-contract placeholder, replaced by generated
   `api.d.ts` in T10).
4. **Shell** — `default` layout: header (nav, Resume link, Contact CTA, locale + theme
   switchers), footer, skip link (D21-1); `error.vue` locale-aware; `dashboard` layout
   shell + `auth` middleware (client-only world).
5. **Public slice** — `index.vue` hero fed by `GET /settings/site` (name, role,
   availability); `blog/index.vue` (paginated list) + `blog/[slug].vue` rendered
   through the single `ContentProse` component (markdown-it with `html:false` — raw
   HTML never parses, satisfying D19-5 structurally; Shiki highlighting SSR-only —
   D20-3; heading anchors for future TOC).
6. **Dashboard slice** — `/dashboard/login` (UForm + Zod), session boot via refresh,
   `/dashboard` placeholder index behind middleware; zero dashboard code in public
   chunks.
7. **Quality rails** — ESLint boundary rules (dashboard imports, physical-direction
   utilities, raw `$fetch`/axios ban), Vitest component tests (ContentProse rendering +
   sanitization, useApi error normalization, locale switcher), CI workflow
   (lint → typecheck → test), lint-staged, `.nvmrc`/engines.

## Acceptance criteria

- [ ] `/` renders the hero SSR from live API data in EN; `/ar` renders Arabic with
      `dir="rtl"`, mirrored layout, Arabic font stack, zero physical-direction CSS.
- [ ] Locale switcher preserves the current route (F-P5); theme toggles without flash.
- [ ] `/blog` lists published articles; `/blog/{slug}` renders Markdown with
      highlighted code blocks (SSR HTML — no highlighting JS shipped) and heading
      anchors; hostile Markdown (script/img-onerror) renders inert.
- [ ] `/dashboard/login` authenticates against the local API; reload restores the
      session silently; `/dashboard` unreachable logged-out (redirect to login).
- [ ] Public route JS contains no dashboard/Tiptap identifiers (`nuxt build` chunk
      inspection).
- [ ] Keyboard path: skip link first tab stop; visible focus everywhere; login form
      errors announced and focused (doc 21).
- [ ] `npm run lint`, `npx nuxt typecheck`, `npm test` green.

## Out of scope (features 002/003)

All other public pages, projects, dashboard modules, Tiptap editor, media library,
SEO module UI, sitemap/RSS/JSON-LD wiring, Playwright e2e, budget CI (feature 004).
