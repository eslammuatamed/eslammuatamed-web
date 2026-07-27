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

## Sequencing (why this order)

1. **Data + routing skeleton first** — a composable and two pages that render real contract shapes.
   Everything downstream depends on the shapes being right.
2. **States before styling** — `UiRequestState` wiring, 404, and redirect resolution. These are the
   behaviors that break silently in SSR and are hardest to retrofit.
3. **Detail content, then gallery** — the FR-CNT-020 sections work without any media; the gallery is
   additive and can be verified against mock descriptors.
4. **SEO/schema after content is stable** — metadata derives from resolved content, so it cannot be
   finalized earlier.
5. **Harness last, but not optional** — component tests run continuously from step 1; Playwright + axe
   land as their own phase so a long harness build cannot block page verification.

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
- **Playwright + axe** (new): `@playwright/test` + `@axe-core/playwright`, config running the built
  preview against `npm run mock` (Prism on the committed contract). Web-owned `page.route()`
  interception only for the four scenarios Prism cannot express (EN/AR differentiation, empty list,
  default unknown-slug 404, exact authored Markdown). CI job added to `.github/workflows/ci.yml`.

## Verification

Gates, all pre-existing and unchanged: `typecheck` (0) · `lint` · `test` · `build` · `check:bundle` ·
`check:logical` · `size` · `size:routes`. Plus the new `test:e2e` and axe scans. Visual matrix EN/AR ×
light/dark × desktop/tablet/mobile. SSR: no hydration mismatch, zero console errors.

Lighthouse runs are **not** part of this docs-only specification task and are executed during
implementation only.

## Explicitly not in this plan

API changes · OpenAPI examples · the other public pages · `FR-PUB-034` · the §10.1 operational debt ·
deployment · promotion · content or media authoring.
