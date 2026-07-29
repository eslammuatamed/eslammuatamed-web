# Feature Specification: Profile Pages — Experience Slice (008)

**Feature Branch**: `008-profile-experience` (off Web `dev` `c1e698d`)

**SpecKit ID**: `008-profile-experience` · **Milestone**: M4 (Public Site) · **Repo**: `eslammuatamed-web`

**Created**: 2026-07-29

**Status**: In implementation. Merge blocked on the **D16-8 Documentation & Handoff Gate** and on
**owner review of the Arabic UI copy** (§7).

## Umbrella relationship — read first

This feature is a **vertical slice of the `web-005` Profile Pages roadmap umbrella**, not a
replacement for it.

| | |
| --- | --- |
| **Roadmap umbrella** | `web-005 public-pages` / Profile Pages (doc 24, D24-5) — remains open |
| **This slice** | `/experience` + `/ar/experience` only |
| **Prior slice** | Projects P1 journey, delivered under `005-public-pages` (PR #22, merged) |
| **Following slices** | About → Resume → integrated Profile verification |

`005-public-pages` **must not be reopened or mutated.** Its task history is complete and closed.

> **Recorded tension.** The `005-public-pages` spec states "No Feature 008 exists — this work is
> `web-005`." That was written to stop the *Projects* slice from being renumbered. The owner's
> 2026-07-29 directive supersedes it for *this* slice: subsequent Profile slices get their own
> slice-specific SpecKit identity while `web-005` stays the roadmap umbrella. This is an owner
> decision, recorded here rather than resolved silently.

## Scope

**In scope:** `/experience` and `/ar/experience` — populated, empty and error states; locale
switching; strict SEO; structured data; accessibility and RTL; the test lanes; budgets.

**Explicitly out of scope:** `/about` · `/resume` · Resume PDF · `/uses` · Contact · analytics/GTM ·
new social-card artwork · Prisma upgrades · API changes · deployment · branch promotion · adding the
governed About copy to API seeds · uploading the portrait.

---

## 1. Source of truth

| Input | Value |
| --- | --- |
| Web base | `origin/dev` `c1e698d795a58d11ea9f658779e11e3faacbee78` |
| API contract source | `origin/dev` `f3a8e9eb72a5e0cd6081364dfb50448aff2bce33` |
| `openapi.json` sha256 | `3376ac58d5038ca6eff4fc3d4259d60c8823161940ad4ffce5b4a41ea0ad8307` |
| Docs | `origin/main` `a1be740afc9f9fb02e91c959aa46ab6015b8059b` |

Requirement: **FR-PUB-021** — "Experience: reverse-chronological timeline; role, company, period,
employment type, impact bullets, technologies — technologies come from the Skill registry via
`ExperienceTechnology` (D02-9)."

## 2. Contract shape (adopted, not negotiated)

`GET /experiences?locale=` → `{ data: PublicExperienceEntity[] }`

```ts
technologies: Array<{ id: string, label: string }>
```

No slugs, no fallback labels, no Web-owned technology mapping. Labels arrive localized.

**Both orderings are the API's and are rendered verbatim — the client MUST NOT re-sort:**

- **Experiences**: `startDate desc`, tie-broken by `order asc` (API `compareExperiences`). This *is*
  the FR-PUB-021 reverse-chronological requirement, satisfied server-side.
- **Technologies**: sorted by `Skill.order` server-side; a skill without a translation in the
  requested locale is **dropped, never substituted from another locale** (D10-6).

This mirrors the rule `useProjects.ts` already documents. Client-side sorting would make the curated
order the owner controls in the CMS stop being what visitors see.

## 3. Observable behaviour — populated

- Localized page heading and introduction (page-owned UI copy, §7).
- Entries in the API's order (§2), each rendering: **company**, the **factual historical role title**,
  **employment type**, **date range**, **location**, approved **impact bullets**, and the localized
  **technology labels**.
- **Factual titles are preserved verbatim from the API.** The marketing positioning "JavaScript
  Product Engineer" is a Site-Settings/positioning concern and **must never rewrite an employment
  title**. No invented metrics, ownership, launch status or responsibilities.
- `location` and `impact` are contract-required but may be empty strings — rendering guards on
  emptiness, not on presence.

## 4. Observable behaviour — empty

- Real EN/AR empty copy, not a blank timeline and not a broken rail.
- **No fabricated experience entries.**
- One relevant navigation path onward — to `/projects`, which exists. **Not** `/contact` (Contact is
  out of scope and its route does not exist).

## 5. Observable behaviour — error

- Localized and direction-correct, following the `/projects` precedent: `UiRequestState` `#error`
  slot, `role="alert"`, retry via `refresh()`.
- **No leaked technical error text** — no status codes, URLs or stack content.

## 6. Locale switching

Both directions (EN→AR, AR→EN):

- Content, URL, `<html lang>`, `<html dir>`, canonical, `og:locale` and hreflang all correct.
- Persistent chrome follows the **committed** UI locale under **D03-13** (deferred commit released in
  `app.vue`'s `onBeforeEnter`) — **no mixed-language frame**.
- Public content locale comes from the **route** (**D06-6**) via `useRouteLocale()`, and the
  `useAsyncData` key uses the *same* effective locale that is sent to the API.
- **No unnecessary duplicate API request** on switch.

## 7. UI copy

Every new EN/AR string is page-owned UI chrome. API-provided experience content is **never**
modified, translated or reformatted by the Web.

Arabic is **native professional Arabic, not literal translation**, and **requires owner review before
merge** (blocking).

## 8. SEO

Page-owned (per **D22-7**, the locale owns the rest): localized **title**, localized **description**,
**Open Graph** title/description. Twitter/X inherits the global `summary_large_image` from `app.vue`.

**Not page-owned — do not write these:** canonical, hreflang, `x-default`, `og:locale`,
`og:locale:alternate`, `og:url`, `<html lang>`, `<html dir>`. `@nuxtjs/i18n` `experimental.strictSeo`
owns them; a second writer is exactly how finding F-3 happened.

**Structured data — `BreadcrumbList` only.** Doc 22 §4 and **D22-8** are explicit: `ProfilePage` is
`/about`'s, wrapping the site-wide `Person`; "`/experience` and `/resume` do **not** duplicate the
full ProfilePage identity unless a later Web specification identifies a standards-supported need."
This slice identifies no such need. Emitting a second `Person` here would create exactly the
duplicate-identity conflict D22-8 forbids.

**Social image — reported, not invented.** The Web repository has **no branded social-image
fallback**: `public/` holds only favicons, and `nuxt.config.ts` sets `ogImage: { enabled: false }`.
`/projects` therefore sets no `ogImage`, and this page does the same rather than emitting a URL that
does not resolve. Recorded as a **later Web SEO/launch requirement** (§11).

## 9. Accessibility & RTL

- Semantic headings, no skipped levels: page `h1`, entries `h2`.
- Timeline semantics understandable **without CSS** — an ordered structure of list items, not a
  visual rail carrying the meaning.
- Dates use `<time datetime>`.
- Technology lists use real list semantics.
- Decorative rail/markers/bullets `aria-hidden`.
- Logical properties only; RTL changes layout direction without mirroring text incorrectly.
- Unfiltered axe scans, EN + AR × desktop + mobile × light + dark.

## 10. Test lanes (D18-6)

- **Contract lane (Prism)** — the populated journey, both locales, from the committed contract.
- **Scenario lane** — only what Prism cannot express: empty response, controlled upstream error,
  SSR/SWR transitions.
- **Never intercept `_payload.json`.**

## 11. Findings to carry forward

| # | Finding | Disposition |
| --- | --- | --- |
| F-1 | No branded social-image fallback exists in the Web repo (`ogImage` disabled, `public/` has only favicons) | Later Web SEO/launch requirement — not fixed here, and no broken URL emitted |
| F-2 | `web-005` Profile umbrella stays open; only the Experience slice is complete | Do not mark the umbrella done |
