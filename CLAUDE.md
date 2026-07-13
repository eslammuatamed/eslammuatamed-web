# eslammuatamed-web

Nuxt 4 + Nuxt UI 4 + Tailwind v4 app: public website (SSR) + `/dashboard` CMS
(client-only SPA) for the eslammuatamed platform.
**Read before coding:** `.specify/memory/constitution.md` (binding), then the governing
documentation in `../eslammuatamed-docs/docs/` (00 = constitution, 03/06/11–14 = this
repo's architecture). Current work is tracked in `.specify/specs/` (feature-map in
`.specify/memory/feature-map.md`).

## Hard rules (full text in the constitution)

- Never share code/types/config with `eslammuatamed-api`. Types are generated from the
  committed `openapi/openapi.json` (`npm run api:types`) — never handwritten.
- `/dashboard/**` is client-only and fully segregated (dashboard directories +
  lint-enforced import boundary). Tiptap only via lazy dashboard components.
- All API traffic through `useApi()`; no Axios; no raw `$fetch` to the API.
- Semantic design tokens only (doc 14); logical CSS properties only (RTL); images via
  `<NuxtImg>`; one Markdown renderer (`ContentProse` — sanitizing, Shiki SSR-only).
- Both locales (en LTR / ar RTL) verified for every user-facing change; WCAG 2.2 AA
  behaviors are release-blocking.
- **Official docs over habit (principle 16):** implement from the current Nuxt / Nuxt UI /
  Pinia docs (load the `nuxt-development` + `nuxt-ui` skills); superseded idioms are
  defects. Nuxt UI built-ins (Tailwind v4, icons, color mode, `<UApp :locale>`) before
  any parallel module or hand-rolled equivalent.

## Commands

`npm run dev` (port 3000) · `lint` · `typecheck` · `test` (Vitest) · `mock` (Prism on
the committed contract) · `api:types` (regenerate types from contract). Env: copy
`.env.example` → `.env` (`NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_BASE` — the domain is
deliberately env-driven, D23-8).

## Change discipline

Doc-first: work contradicting an approved doc → revise the doc in
`../eslammuatamed-docs` first. Conventional Commits on `main`. Contract adoption is one
atomic commit: contract + generated types + adaptation (doc 16 §3).
