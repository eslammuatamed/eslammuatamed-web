# Feature 010 — Implementation Plan

**Branch:** `010-profile-resume` · **Base:** Web `dev` `999561bcccf012806d0314e123f0028755c62ffb`
**Contract:** API `origin/dev` `188e771833024d9a52521a5cdaad936b38961b9b`
**Docs:** `origin/main` `6ad6fda9c76e081c92ce0f92528a52ce4eabfc6d`

## 1. Contract adoption (doc 16 §3)

One atomic commit: `openapi/openapi.json` `3376ac58…` → `f6451878…`, `app/types/api.d.ts`
`56f7b714…` → `3ecd3b66…`. Generation run twice, byte-identical both times.

Drift is **purely descriptive**: `PublicMediaImageDescriptor`'s `url`/`width`/`height` gain
D10-14 wording and truthful examples from API PR #40. No schema, field, type or enum change,
and nothing on the résumé path. No adaptation was required, so the commit is contract + types.

## 2. Contract sufficiency — no API change

Verified against API source at `188e7718`, not only against the OpenAPI document:

| Requirement | Finding |
|---|---|
| Résumé descriptor on public settings | `resumeAsset: PublicMediaPdfDescriptor \| null` ✅ |
| Bare asset id public | **Deliberately absent** — admin-only (`AdminSiteSettingsEntity.resumeAssetId`) |
| Descriptor shape | `{ id, kind:'PDF', url, filename, sizeBytes }`, all required ✅ |
| `url` absolute | `storage.publicUrl(storageKey)` from `PUBLIC_MEDIA_URL` ✅ |
| `application/pdf` | `PDF_MIME_TYPE`, magic-byte validated on upload ✅ |
| `Content-Disposition: attachment` | written as **object metadata** at upload (`media.service.ts:234`, `r2-storage.adapter.ts:53`) ✅ |
| No image variants/alts for PDF | DB `CHECK` constraint: PDF ⇒ width/height/blurhash all null ✅ |
| `resumeAssetId = null` ⇒ `resume = null` | ternary in `getPublicSettings` + `kind` guard ✅ |
| Delete protection / usages | `USAGE_INCLUDE.resumeForSettings`, one query ✅ |
| No N+1 | `SETTINGS_INCLUDE.resumeAsset` loads with the singleton ✅ |
| Experience sufficiency | role, company, location, impact, employmentType, isCurrent, startDate, endDate, order, technologies ✅ |
| Skills sufficiency | id, label, group, order ✅ |

**Naming correction to the brief.** The public field is `resumeAsset`, not the
`resumeAssetId` + `resume` pair the brief sketched. This is not a gap — it is *stricter*, and
it is what makes the brief's own rule ("the unavailable state must not expose
`resumeAssetId`") true by construction rather than by care. Adding the bare id to the public
payload would have been a regression. **No API change made.**

## 3. Data flow (FR-PUB-024)

`useResumeData()` composes three reads and invents no fourth:

- **Experience** — calls `useExperiences()`, *the same composable* `/experience` uses. Not a
  copy: the same function, key, ordering and verbatim-render contract.
- **Skills** — `/skills` under `skills:{locale}`, matching the one-key-per-surface idiom the
  home page and `/projects` already use for this endpoint.
- **Settings** — shares the `settings:site:{locale}` key namespace with `useSiteSettings()`
  (chrome) and `useAboutContent()` (`/about`), so page and footer resolve from one request.

All three take the **route** locale (D06-6). Three separate `useAsyncData` calls so a failure
degrades one section (NFR-DEGRADE).

## 4. Components

| File | Role |
|---|---|
| `app/pages/resume.vue` | route, composition, SEO, schema, print stylesheet |
| `app/components/resume/Entry.vue` | one role, compact (no rail/marker/gutter) |
| `app/components/resume/Actions.vue` | download + print, and the honest unavailable state |
| `app/utils/resume.ts` | `groupSkills`, `resumeEmail`, `resumeLinks`, `formatFileSize`, `impactBullets` |
| `app/composables/useResumeData.ts` | the three reads |

`ContentTimelineEntry` is deliberately **not** reused: doc 04 §5 asks the résumé to be denser
than `/experience`, and adding a third display mode to a component that already carries a
`showTechnologies` opt-in would push it past what one component should decide. The two share
`impactBullets` so they can never disagree about what a bullet is.

## 5. Print

`@media print` in an unscoped block on the page, gated by `body:has(.resume-page)`.

The gate is load-bearing: hiding the global header/footer needs selectors this page does not
own, and a page component's styles stay injected after a client-side navigation away. Without
the gate, printing `/about` after visiting `/resume` would silently lose its chrome. Asserted
by a test that navigates away and prints.

Paper size is **not** forced. No governing document fixes one, and `@page { size: A4 }` would
override the visitor's own paper choice. Margins are in `cm`, so they are physically identical
on A4 and Letter; the layout is fluid and fits both.

## 6. Test architecture

Prism stays primary (D18-6). Deterministic scenarios only for what Prism cannot express.

| Lane | Ports | Covers |
|---|---|---|
| `contract` (Prism) | 3000/3001 | routing, SSR, navigation, head, schema, print media, layout, axe |
| `ssr-scenarios` | 3100/3101 | **PDF-null (the real live state)**, Experience empty (EN), Experience 503 (AR), locale transition |
| `resume-pdf` *(new)* | 3300/3301 | PDF populated + **the object's real `Content-Type`/`Content-Disposition`** |

The new lane is a third process variant of the existing scenario server, on the same principle
as `about-readiness`: `/settings/site` carries no slug or query to select a variant on, so a
variant must be a property of the process — which keeps PDF-null (the real state) as what every
other lane renders. It also serves the PDF object itself, because the download contract lives in
object headers and cannot be proven from markup. The served bytes are a minimal placeholder PDF,
never the owner's résumé.

No `_payload.json` interception anywhere.

## 7. SEO

Localized title/description, OG + Twitter title/description. Canonical, hreflang, x-default,
`og:locale` and `<html lang/dir>` stay with @nuxtjs/i18n under strict SEO (D22-7). **No
`og:image`** — F-1 open. **No second `ProfilePage`, no second `Person`** — D22-8 names
`/resume` explicitly; schema.org has no résumé type, so WebPage + BreadcrumbList is retained
rather than inventing one.

## 8. Findings

- **F-1 (carried)** — no branded social-image fallback, so no `og:image` is emitted.
- **F-5 (new, pre-existing, not caused by this slice)** — the **document** overflows horizontally
  at a 320 px viewport on **every** public route in this build: `/` by 9 px and `/about`,
  `/experience`, `/projects` and `/resume` by 2 px each (measured: `scrollWidth` 329/322 vs
  `clientWidth` 320). The overflowing node is the **global header's trailing control cluster**
  (language toggle + theme toggle + menu trigger), which this slice does not touch. The résumé's
  own `<main>` is clean in both locales.

  This slice's layout gate therefore asserts **`<main>`**, not the document. Asserting the
  document would import a merged-007 chrome defect into a gate this slice cannot satisfy — it
  would either fail for something the slice did not cause, or be quietly loosened. Fixing the
  header is a site-wide change to already-merged chrome and belongs to its own change, not to a
  résumé slice.
- **R-1 (new, documentation-only)** — the canonical PDF's headline reads
  `Frontend Developer | Vue.js & Nuxt.js`, a variant of the *superseded* pre-v1.0.0 positioning;
  the governed public title is `JavaScript Product Engineer — …`. The HTML résumé renders the
  governed `tagline`, so the two artifacts disagree. Not a defect in this slice's code and not
  fixed here: the PDF's visible content may not be modified without a separate owner-approved
  correction.
- **R-2 (new, documentation-only)** — the PDF shows WaveX as `Mar 2026 – Present`; the
  authoritative Experience record has `endDate: 2026-07-31`, `isCurrent: false`. The corrected
  *start* month is verified right; the end state is not. The HTML résumé renders the contract,
  so it will show the range as ended.
- **R-3 (new, documentation-only)** — the PDF prints a personal Gmail and a phone number. The
  HTML résumé prints the governed `professionalEmail` and no phone.

R-1/R-2/R-3 are properties of an owner-maintained binary, block no route, threshold or release,
and are recorded for the owner rather than acted on.

## 9. Out of scope

PDF generation or rewriting; PDF-from-structured-data; production upload; production
`resumeAssetId`; Contact; Prisma 7; `og:image`; promotion to `main`; deployment.
