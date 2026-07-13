# Constitution — eslammuatamed-web

The canonical constitution is **`../eslammuatamed-docs/docs/00-engineering-principles.md`**
(16 principles + hard architectural constraints). It binds every decision in this
repository. The architecture governing this repo lives in
`../eslammuatamed-docs/docs/` — especially 03 (design system), 06 (frontend
architecture), 08 (folders), 11–14 (dashboard/components/patterns/tokens), 15/16
(standards), 18 (testing), 20–22 (performance/a11y/SEO). Decision IDs (`Dxx-N`) live
there.

## Repo-scoped binding rules

1. **Repository independence (doc 00 §3).** Nothing shared with `eslammuatamed-api`.
   API types are **generated** from the committed `openapi/openapi.json` (D06-2);
   handwritten duplicates are forbidden once the contract exists.
2. **Two worlds, one app (D06-1).** `/dashboard/**` is client-only (`ssr: false`) and
   fully segregated: `components|composables|stores|pages` `dashboard/` directories are
   the entire dashboard surface; public code importing from them is a lint error.
   Editor-weight deps (Tiptap) load only via lazy dashboard components (D06-5).
3. **One API door.** All API traffic goes through `useApi()` — base URL from
   `NUXT_PUBLIC_API_BASE`, RFC 7807 → one `ApiError`, single 401-refresh retry. Raw
   `$fetch` against the API elsewhere is a defect. No Axios, ever.
4. **Tokens only (D14-2).** Components consume semantic tokens (`--ui-*` namespace,
   doc 14); raw hex or primitive color utilities in components are defects. Logical
   properties only — physical `pl-*`/`ml-*`/`left-*` are banned (D15-3, RTL).
5. **Locale parity by construction (Pillar 3).** `prefix_except_default` (en root,
   `/ar`), `<html lang dir>` correct, content arrives localized from the API — the
   frontend never translates content. Both locales verified for every user-facing
   change.
6. **Quality gates are code (docs 20/21).** SSR for public content; images via
   `<NuxtImg>` only; one Markdown renderer (`ContentProse`, sanitizing — D19-5, Shiki
   SSR-only — D20-3); WCAG 2.2 AA behaviors designed in (skip link, focus management,
   44px targets).
7. **Detachable components.** `ui/` and `content/` components mount in isolation with
   props/slots only (doc 12 §6); composables are single-purpose, SSR-safe, and never
   fetch on import. Nuxt UI first — wrap only to add semantics (D12-2), restyle only
   via theme config.
8. **Readable, teachable code.** Strict TS, no `any`; `<script setup lang="ts">` only;
   comments are constraints citing decision IDs; if it needs a paragraph to explain,
   simplify it.
9. **Official docs over habit (doc 00, principle 16).** Every Nuxt / Vue / Nuxt UI /
   Pinia / i18n construct follows the _current_ official documentation
   (nuxt.com/docs, ui.nuxt.com, pinia.vuejs.org) — consult it before implementing;
   in agent sessions, load the `nuxt-development` and `nuxt-ui` skills. Superseded
   idioms are defects even when they work (e.g., casting `nuxtApp.$i18n` instead of
   `useI18n()`). **Nuxt UI built-ins first:** Tailwind v4, Iconify icons, color mode,
   and the `<UApp :locale>` i18n integration ship inside Nuxt UI — adding parallel
   modules or hand-rolling those capabilities is a defect. Latest stable APIs
   preferred; deviations need a decision-log entry.

## Execution model

Planning authored with Fable; implementation on Opus (executor agents or
`/speckit.implement`). Verification (lint, typecheck, tests, both locales in the
browser) precedes every commit; Conventional Commits on trunk `main` (doc 17).
