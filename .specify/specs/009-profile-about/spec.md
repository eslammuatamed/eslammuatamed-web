# Feature Specification: Profile Pages — About Slice (009)

**Feature Branch**: `009-profile-about` (off Web `dev` `f08be6d`)

**SpecKit ID**: `009-profile-about` · **Milestone**: M4 (Public Site) · **Repo**: `eslammuatamed-web`

**Created**: 2026-07-29

**Status**: In implementation. Merge blocked on the **D16-8 Documentation & Handoff Gate**, on
**owner review of the Arabic UI copy** (§7), and on the **real portrait upload + EN/AR alt approval**
(§5), which is a publication blocker rather than a merge blocker.

## Umbrella relationship — read first

This feature is a **vertical slice of the `web-005` Profile Pages roadmap umbrella**, not a
replacement for it.

| | |
| --- | --- |
| **Roadmap umbrella** | `web-005 public-pages` / Profile Pages (doc 24, D24-5) — remains **open** |
| **This slice** | `/about` + `/ar/about` only |
| **Prior slices** | Projects P1 journey (under `005-public-pages`, PR #22, merged); Experience (`008-profile-experience`, **complete**) |
| **Following slices** | Resume (**deferred**) → integrated Profile verification |

`005-public-pages` and `008-profile-experience` **must not be reopened or mutated.** Their task
histories are complete and closed. Completing this slice does not close the umbrella.

## 1. Scope

`/about` and `/ar/about` (FR-PUB-020): the localized About page and the primary `ProfilePage` route
(D22-8). Web-only — **no API change**. The contract adopted is the one already committed at
`openapi/openapi.json`, which the About content seed left byte-identical.

**Out of scope:** Contact, Resume, media upload, Prisma work, deployment, promotion to `main`.

## 2. Source of the content

The six governed About fields are seeded into `SiteSettingsTranslation` by API
`289c7ee0ac4e6fc800da805c5381239c2f091ab3` from the approved copy at
`eslammuatamed-docs@78bc945d…:content/profile/about-copy.md` (Approved v1.0.0, 2026-07-29).

The Web **renders the contract value verbatim**. It never rewraps, truncates, or re-authors the
governed prose — `about-copy.md` §4 makes every wording change an owner-review change, including one
motivated by a metadata budget or a layout constraint. Presentational segmentation is permitted; the
words are not the Web's to change.

## 3. Data reads

| Read | Composable | Locale source |
| --- | --- | --- |
| About prose, portrait, positioning | `useAboutContent()` | **ROUTE** (D06-6) |
| Footer chrome (availability, links) | `useSiteSettings()` (unchanged) | **UI** locale, deliberately |

Both use the `settings:site:{locale}` key namespace, so they **dedupe into one request** whenever the
two locales agree — every SSR render and every initial load. They diverge only during the D03-13
deferred locale commit, which is the point: page content must be in the incoming language while the
persistent chrome is still in the outgoing one, or a mixed-language frame becomes visible.

Reusing `useSiteSettings()` for page content was rejected: it follows the UI locale, which would put
the governed, locale-specific prose on the outgoing language mid-transition — the cross-locale bleed
D10-6 and D06-6 exist to prevent.

## 4. Publication readiness (the central decision of this slice)

The approved Profile contract gates publication on **complete localized About content AND a real
portrait carrying localized alt text**. D18-7 states it directly: *"A green API suite with
`portraitAssetId = null` proves the contract, not the page."*

`app/utils/about-readiness.ts` is the single decision point. Four states:

| State | Condition | Behaviour |
| --- | --- | --- |
| `ready` | prose complete, portrait present, localized alt non-empty | full published page |
| `portrait-missing` | no portrait configured — **the live API state today** | readiness notice |
| `portrait-alt-missing` | portrait present, `alt` null or blank for this locale | readiness notice |
| `content-missing` | any governed field null/blank | readiness notice |

`content-missing` is reported **before** the portrait blocker: naming the portrait when the page has
nothing to say would misdirect the fix.

### The readiness state is not a placeholder

It keeps the route valid and localized, states plainly that the page is still being finished,
preserves navigation to Experience and Projects, and links to **no Contact route** (which does not
exist). It exposes no technical vocabulary — `portraitAssetId` never reaches the copy.

**It does not render the governed prose behind a notice.** Publishing the body while calling the page
unfinished would be publishing an incomplete About page, which is exactly what the slice is required
not to do. The full layout is proven by the populated scenario and switches on automatically the
moment the API serves a portrait with localized alt — no code change.

> **Owner decision point.** Whether the interim state shows the prose is a product call, not a
> technical one, and it is a single conditional in `about.vue`. It is recorded here so the owner can
> reverse it deliberately rather than discover it.

### `alt` semantics are not collapsed

The contract distinguishes `alt: null` (*no translation for this locale*) from `alt: ""`
(*intentionally decorative*). The About portrait is **meaningful content**, so **neither** satisfies
readiness, and the other locale's alt is **never** borrowed — D10-6 forbids cross-locale fallback,
and the response for one locale structurally cannot contain the other's alt.

## 5. Blocker carried to publication

**The real portrait has not been uploaded and its EN/AR alt text has not been approved.** Until both
happen, `/about` renders the readiness state in production. This is a **publication** blocker; it does
not block merging this slice into `dev`.

No portrait is invented for any purpose: no stock imagery, no placeholder person, no favicon or
monogram standing in for a face.

## 6. SEO and structured data

`/about` is the primary `ProfilePage` (D22-8). Its `mainEntity` **references** the site-wide `Person`
by `@id` (`{host}#identity`) rather than nesting a second person; `Person.jobTitle` comes from the
Site Settings tagline, so positioning propagates as data. Exactly one `Person` node exists in the
page graph.

`knowsAbout` is deliberately omitted: D22-8 names the portrait, tagline, professional email and
profile links as this schema's sources, and fetching `/skills` purely to enrich the graph would add a
request and route weight for no stated requirement.

Canonical, hreflang/x-default, `og:locale` and `og:url` are **not** written by this page —
`@nuxtjs/i18n` owns every locale-derived head tag under strict SEO (D22-7).

**No `og:image`.** The repository still has no branded social-card fallback (`ogImage` disabled,
`public/` holds only favicons) and no new artwork is authorized. The unpublished portrait is **not**
substituted for one. Carried from the Experience slice as finding **F-1**.

## 7. Copy review gate

Every new EN/AR string is listed in `plan.md` §Copy inventory. **Merge is blocked until the owner
approves the complete Arabic UI inventory.** The governed body copy is out of scope for that review —
it is already approved and must stay byte-identical.

## 8. Test strategy

| Lane | Covers |
| --- | --- |
| Unit (`about-readiness.spec.ts`) | all four readiness branches, alt semantics, precedence |
| Component (`about.spec.ts`) | every state × both locales, section order, heading levels, Markdown routing, cache keys, no Contact link, no technical vocabulary |
| Contract e2e (Prism) | routing, SSR, locale head tags, ProfilePage/Person graph, unfiltered axe |
| Scenario e2e | the **published** page: portrait descriptor, variants, CLS, RTL, locale-transition atomicity, axe × light/dark |

### Recorded limitation

The scenario backend selects scenarios purely from path + slug + locale query. `/settings/site` has
**neither slug nor query**, and it must stay healthy for every other scenario's chrome, so that lane
can express **one settings variant per locale**. The published state is given to it, because portrait
rendering, RTL layout, CLS and axe are only observable in a browser. The readiness refusals are pure
render decisions and are proven exhaustively in the component and unit lanes instead.

Adding a dedicated `about-states` backend variant (a third Playwright project) would put the refusals
in a browser too. It is recorded as a **follow-up**, not silently skipped.
