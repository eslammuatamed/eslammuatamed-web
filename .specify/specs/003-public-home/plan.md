# Implementation Plan: Public Home Page

**Branch**: `feat/003-public-home` (off Web `dev` `a7106f8`) | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

## Summary

Build the complete designed public **home page** (`app/pages/index.vue`) as a composition of
section components under `components/home/`, each consuming an already-public API endpoint via
`useApi()`, fetched in parallel with per-section error isolation and full loading/empty/error
states. Reuse the existing brand primitives (`UiSectionHeader`, `UiTechBadge`, `AppLink`) and the
in-place design-token layer (violet already adopted). Add view-model aliases, bilingual i18n
keys, `Person` + `WebSite` structured data, and wire the stubbed footer (social links,
availability, resume). **No API/contract/DB change.** A separate API dev/demo seed PR is the
data prerequisite; a Docs PR records the M4-split and Philosophy-deferral decisions.

## Technical Context

**Language/Version**: TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Node 24 (`.nvmrc`).

**Primary Dependencies**: Nuxt 4.4, Nuxt UI 4.9 (Tailwind v4), `@pinia/nuxt`, `@nuxtjs/i18n` v10
(`prefix_except_default`), `@nuxt/image` (`<NuxtImg>` — configured, first real use here),
`@nuxtjs/seo` (`useSchemaOrg`, `useSeoMeta`, hreflang), `zod`. **No new runtime dependency** —
`motion` (already a transitive option) permitted **hero-only** if orchestration is needed;
otherwise CSS transitions.

**Storage**: none (frontend). Data via `useApi()` → NestJS public reads.

**Testing**: Vitest + `@nuxt/test-utils` + `@vue/test-utils` + happy-dom (component isolation);
Prism mock for shape; **real dev API + demo seed** for integration; axe-core + Lighthouse in CI.

**Target Platform**: SSR (Nitro node-server) + SWR; evergreen browsers, last 2 versions.

**Project Type**: Web frontend (public SSR world; dashboard world untouched).

**Performance Goals**: LCP < 1.8 s field / < 1.2 s lab; INP < 200 ms; CLS → 0; JS ≤ 90 KB gz
(≤ 35 KB app-code) per route; CSS ≤ 30 KB gz; Lighthouse 100 × EN/AR.

**Constraints**: WCAG 2.2 AA release-blocking; both locales + full RTL; semantic tokens +
logical properties only; `<NuxtImg>` only; single Markdown renderer untouched; no dashboard code
in the public bundle; Release Freeze (dev-only delivery).

**Scale/Scope**: one page, ~7 section components + ~3 content cards + footer wiring + SEO
composable + model aliases + i18n keys, both locales.

## Constitution Check

*GATE: passes. Canonical constitution = `../eslammuatamed-docs/docs/00-engineering-principles.md`
+ the 9 repo-scoped rules (`.specify/memory/constitution.md`).*

| Rule | Compliance |
|---|---|
| 1 Repo independence / generated types | No shared code; consumes committed contract; adds view-model aliases over generated types only. **No handwritten API types.** ✅ |
| 2 Two worlds | Public SSR only; dashboard untouched; `check:bundle` guards leakage. ✅ |
| 3 One API door | All fetches via `useApi()`; no raw `$fetch`/Axios. ✅ |
| 4 Tokens + logical props | Semantic `--ui-*` + `--brand-*` only; `ps/pe/ms/me/start/end`; `check:logical` guards. ✅ |
| 5 Locale parity | `/` + `/ar`, `<html lang dir>`, content localized by API; both locales verified. ✅ |
| 6 Quality gates as code | SSR content; `<NuxtImg>` only; skip link/focus/44px/contrast/reduced-motion designed in. ✅ |
| 7 Detachable components | `home/`, `content/`, `ui/` components mount in isolation (props/slots); SSR-safe composables; Nuxt UI first, wrap only for semantics. ✅ |
| 8 Readable TS | Strict, no `any`; `<script setup lang="ts">`; comments cite decision IDs. ✅ |
| 9 Official docs over habit | Nuxt/Nuxt UI/i18n/SEO current idioms (`nuxt-development` + `nuxt-ui` skills loaded). ✅ |

**No constitution violations → Complexity Tracking empty.**

## Cross-repo & Ownership Separation

- **Web (this feature)** — home page + footer wiring + model aliases + i18n + SEO. → PR to Web `dev`.
- **API (prerequisite, separate PR)** — **dev/demo seed** (`prisma/seed.dev.ts` + `db:seed:dev`)
  producing relational fixtures (≥3 published+featured projects, experiences, skills across all
  groups, ≥3 published articles, ≥2 visible testimonials) in **both locales**. Idempotent;
  additive dev tooling; **production `seed.ts` untouched** (WD-2). Run only vs the **test** DB via
  an external temp env — the real `.env` is never read/written ([never-touch-real-env]). → PR to API `dev`.
- **Docs (separate PR)** — doc 24 decisions **D24-5** (M4 slice split) + **D24-6** (Philosophy
  deferral, doc 02 §7); update Web feature-map (split row 003). → PR to Docs `main` (not frozen).
- **Production release** — DEFERRED/owner-gated; see §Production-release next action.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/003-public-home/
├── spec.md          # done
├── plan.md          # this file
└── tasks.md         # /speckit-tasks output
```

### Source Code (eslammuatamed-web)

```text
app/
├── pages/
│   └── index.vue                      # MODIFY — orchestrate sections, parallel isolated fetch, SEO
├── components/
│   ├── home/                          # NEW section components → <Home*>
│   │   ├── Hero.vue                    # MODIFY — richer hero (role, availability dot, CTAs, LCP)
│   │   ├── TechStack.vue              # NEW — FR-PUB-011, grouped skills, UiTechBadge
│   │   ├── FeaturedProjects.vue       # NEW — FR-PUB-012, top-3 featured
│   │   ├── ExperienceSummary.vue      # NEW — FR-PUB-013, timeline summary
│   │   ├── LatestArticles.vue         # NEW — FR-PUB-014, latest 3
│   │   ├── Testimonials.vue           # NEW — FR-PUB-016, linear
│   │   └── ContactCta.vue            # NEW — FR-PUB-017, email + form link
│   ├── content/                       # NEW reusable cards → <Content*> (reused by later pages)
│   │   ├── ProjectCard.vue            # NEW — single-accessible-link card
│   │   ├── ArticleCard.vue            # NEW — cover via <NuxtImg>, single-link
│   │   ├── TestimonialCard.vue        # NEW
│   │   └── ExperienceItem.vue         # NEW — timeline item (mirrored flow RTL)
│   ├── ui/
│   │   ├── SectionHeader.vue           # REUSE (eyebrow + heading + optional view-all)
│   │   ├── TechBadge.vue              # REUSE/verify (brand-color rules)
│   │   └── StateEmpty.vue / StateError.vue / SectionSkeleton.vue  # NEW small state primitives (if not present)
│   └── layout/
│       └── Footer.vue                 # MODIFY — social links, availability, resume (unstub)
├── composables/
│   ├── useApi.ts                       # REUSE (unchanged)
│   ├── useHomeData.ts                 # NEW — parallel per-section isolated fetch (SSR-safe)
│   └── useSiteSchema.ts               # NEW — Person + WebSite JSON-LD via useSchemaOrg
├── types/
│   └── models.ts                       # MODIFY — add ProjectListItem, Skill, Experience, Testimonial, Media aliases
├── utils/
│   └── format.ts                       # MODIFY/ADD — Intl date/period + employmentType label mapping
└── i18n/locales/
    ├── en.json                         # MODIFY — home.* section keys + labels
    └── ar.json                         # MODIFY — parallel Arabic (native register)
```

**Structure Decision**: Sections live in `components/home/` (auto-prefixed `<Home*>`, doc 12);
reusable cards in `components/content/` (`<Content*>`) so the follow-on `/projects`, `/blog`,
`/experience` pages reuse them (rule-of-three respected — cards have ≥2 near-term call sites).
State primitives live in `ui/`. No new top-level directories; dashboard world untouched.

## Design & Data-Fetch Approach

- **Fetch strategy**: `useHomeData()` runs one `useAsyncData` per section keyed by locale,
  invoked in parallel; each wrapped so a rejection yields a per-section `{ data:null, error }`
  rather than failing the page (NFR-DEGRADE). `GET /settings/site` is the one hard dependency —
  its failure shows the existing designed API-unavailable state. Public reads are locale-injected
  by `useApi` already. SWR/caching is the API/Nitro concern (unchanged).
- **States**: SSR first paint is content-complete; skeletons apply only to any client-side
  refetch. Empty result → section omitted. Error → inline retry within the section only.
- **Cards**: image-top (where applicable), meta row, title, excerpt; **entire card is one
  accessible link** (no nested links); hover elevates via border/surface step (no shadow jump).
- **Tech stack**: skills grouped by `group`; each rendered via `UiTechBadge` using `--brand-*`
  when `brandColor` present; brand color is an accent only.
- **Experience**: reverse-chron; period formatted via `Intl`; `employmentType` mapped to a
  localized label (no per-record translated labels); timeline flow mirrors in RTL.
- **Motion**: hero entrance only (CSS-first; `motion` allowed hero-only); every other reveal is a
  CSS transition; all gated by `prefers-reduced-motion`.
- **SEO** (`useSiteSchema` + `index.vue`): `Person` (name, jobTitle from tagline, `sameAs` from
  `profileLinks`, `knowsAbout` from skills) + `WebSite`, via `useSchemaOrg` from API data;
  standalone home title; self-canonical + hreflang EN↔AR + `x-default`→EN (central composable);
  OG + Twitter `summary_large_image` (branded static template); settings verification/custom metas.

## Testing Approach

- **Component (Vitest)**: each `home/*` + `content/*` mounts in isolation with props + i18n/color
  plugins; asserts populated / empty / error rendering, single-accessible-link, RTL class
  behavior, `<NuxtImg>` usage. `useHomeData` isolation logic unit-tested (one section failure
  doesn't reject the whole).
- **Gates**: `lint`, `typecheck`, `test`, `build`, `check:bundle`, `check:logical`,
  `git diff --check`.
- **Integration (real dev API + demo seed, test DB, external temp env)**: load `/` + `/ar` —
  hydration clean, media-descriptor `<NuxtImg>` origin URLs resolve, per-locale shapes correct,
  RTL, axe clean, loading/empty/error, responsive desktop/tablet/mobile, no token/secret leak.
- **CI**: existing web CI (lint/typecheck/test + build + bundle-isolation + RTL); Lighthouse-CI
  home × EN/AR is the launch gate (runs in CI where configured).

## Production-release next action (owner-gated — headline)

This feature delivers to **`dev` only**. Before public promotion the owner must decide, and at
minimum the **projects index + one case-study detail** (and ideally the contact page) should
exist so the F-P1 routing-hub journey is not a wall of 404s. Then unlock the freeze in order:
first `dev → main` promotion → production `PUBLIC_WEB_URL` provisioning → deploy + smoke
(doc 17 D17-5 / doc 23 D23-18). Nothing here promotes or deploys.

## Complexity Tracking

*No constitution violations — not applicable.*
