# Implementation Plan — Profile Pages: Experience Slice (008)

**Feature**: `008-profile-experience` · **Slice of**: `web-005` Profile Pages umbrella (see `spec.md`)
**Branch**: `008-profile-experience` off Web `dev` `c1e698d`

---

## 1. Architectural position

This slice is **mostly a data-layer and semantics change, not a new visual system**. Feature 007
already shipped the primitives this page needs, and `ContentTimelineEntry` already renders a role on
the homepage summary. The page must therefore feel like the same product — it reuses the existing
page shell grammar from `/projects` (breadcrumbs → header with kicker/h1/description → `UiRequestState`
→ entries) rather than inventing a second template.

### What already exists and is reused

| Piece | Reuse |
| --- | --- |
| `ContentTimelineEntry` | The entry renderer — **extended**, not duplicated |
| `UiRequestState` | Pending / refreshing / error / empty orchestration |
| `UiBreadcrumbs` | Visible trail that `BreadcrumbList` mirrors (doc 22 §4) |
| `useRouteLocale()` | D06-6 route-resolved content locale |
| `useApi()` | The single API door |
| `formatExperiencePeriod()` | Existing period formatter (Western digits via Intl, D03-4) |
| `home.experience.employmentType.*` | Existing EN/AR employment-type labels |

### What is added

| Piece | Why |
| --- | --- |
| `app/pages/experience.vue` | The route. Both locales come from `prefix_except_default` |
| `useExperiences()` in `app/composables/useExperiences.ts` | Locale-keyed read, mirroring `useProjectsList` exactly |
| `Experience`/`ExperienceTechnology` model aliases | `ExperienceTechnology` is new in the contract |
| Technologies list inside `ContentTimelineEntry` | FR-PUB-021's missing element |
| `experience.*` + `seo.experience.*` i18n keys | Page-owned UI copy (EN + AR) |

**No new abstraction is introduced before duplication exists.** There is no `ExperienceList`
component: the page renders `<ol>` + `ContentTimelineEntry` directly, exactly as `/projects` renders
`ContentWorkEntry` directly. There is no `ExperienceEmpty`/`ExperienceError` component: those are
`UiRequestState` slots, following the `/projects` precedent.

## 2. Decision: technologies render on both surfaces

`ContentTimelineEntry` is shared with the **homepage** experience summary. Adding technologies
changes the homepage too.

**Decision: render technologies wherever the component is used, ungated.** Rationale:

- FR-PUB-021 names technologies as part of the Experience presentation, and the homepage timeline is
  a summary *of that same content* — showing a role without its stack on one surface and with it on
  another is an inconsistency a visitor can see.
- A `showTechnologies` prop would be an abstraction invented before duplication exists, contradicting
  the constitution's "no unnecessary abstractions" rule and this plan's §1.
- The addition is small and degrades cleanly: `technologies` is contract-required but may be `[]`,
  and the list renders nothing when empty.

This is a **visible change to an already-merged page** and is reported as such in the PR rather than
left to be discovered.

## 3. Data flow

```
route path  →  useRouteLocale()  →  locale
                                     ├── useAsyncData key `experiences:{locale}`
                                     └── api('/experiences', { locale })   ← same value, always
```

The key and the request use the **same** effective locale (D06-6): a payload can never be cached
under a key naming a different language than the request that produced it. `watch: [locale]` re-runs
on locale change. `await`ed in setup so SSR output is complete — **no client-only primary content**.

Order is the API's (spec §2). No client sort anywhere.

## 4. SEO plan

| Tag | Owner |
| --- | --- |
| title, description, `og:title`, `og:description` | This page |
| `BreadcrumbList` JSON-LD | This page (mirrors the visible trail) |
| canonical, hreflang, `x-default`, `og:locale`, `og:url`, `<html lang/dir>` | `@nuxtjs/i18n` strict SEO (D22-7) — **page writes none** |
| `twitter:card` | Global (`app.vue`) |
| `ProfilePage` / `Person` | **Not emitted** — `/about`'s, per D22-8 |
| `og:image` | **Not emitted** — no fallback asset exists (spec §8/F-1) |

## 5. Accessibility plan

- `<ol>` for the timeline: reverse-chronological order is *meaningful*, so an ordered list is the
  honest element and the structure survives with CSS off.
- Entry heading `h2` (page `h1` is the page title; no intervening section heading).
- `<time :datetime>` for machine-readable start/end.
- Technologies as `<ul>` with a visually-hidden label naming the role they belong to, so a
  screen-reader user reaching a bare list of technology names knows whose stack it is.
- Rail, markers and bullet dots `aria-hidden="true"`.
- Logical properties only (`ps-*`, `-ms-*`, `border-s`) — already how `ContentTimelineEntry` is built.

## 6. Test plan (D18-6)

| Lane | Covers |
| --- | --- |
| **Unit/component** | period formatting; technology rendering **and order preservation**; EN/AR labels; empty/error rendering; semantic structure; empty optional fields; no cross-locale fallback |
| **Contract e2e (Prism)** | direct EN load; direct AR load; populated rendering; entity shape; technologies; SSR metadata; locale switch both directions |
| **Scenario e2e** | empty state; error + retry; D03-13 atomic locale transition; no stale metadata after client navigation |
| **Accessibility** | unfiltered axe, EN + AR × desktop + mobile × light + dark |

Prism serves `/experiences` from the adopted contract. The scenario backend gains an experiences
handler only for the states Prism cannot express. `_payload.json` is never intercepted.

## 7. Budgets

`/experience` and `/ar/experience` are **added to the `ROUTES` list** in
`scripts/check-route-size.mjs`. That is adding routes to measurement — **no threshold is changed**.
If a new route exceeds a budget, the page is fixed, never the number.

## 8. Execution order

1. Contract adoption (**done** — `5f6282e`)
2. Model aliases + `useExperiences()`
3. `ContentTimelineEntry` technologies + unit tests
4. Page + i18n copy
5. Route-size ROUTES entry
6. Contract e2e, scenario e2e, axe
7. Full gate run + budgets
8. D16-8/D16-9 closeout docs
