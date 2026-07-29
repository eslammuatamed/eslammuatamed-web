# Implementation Plan — Profile Pages, About Slice (009)

**Branch**: `009-profile-about` · **Base**: Web `dev` `f08be6d797e42b2630db3605d37475f4bfb3ab13`

## 1. Contract adoption

| | |
| --- | --- |
| Source API SHA | `254f6cd0062ffab81186a2bdaedf1d6893e49001` (API `dev`, after the tagline alignment) |
| OpenAPI hash | `3376ac58d5038ca6eff4fc3d4259d60c8823161940ad4ffce5b4a41ea0ad8307` |
| Generated type hash | `56f7b714598a7ae24b6d8541e2e0e9cb249279904c8364991524fc520f77bc3b` |
| Two consecutive generations | byte-identical |
| Drift vs committed artifact | none |

The About content seed changed **no endpoint and no schema**, so the committed
`openapi/openapi.json` was already byte-identical to the API's export. **No adoption commit is
required** by doc 16 §3, because there is nothing to adopt. Types were regenerated only to prove it.
Generated types are never hand-edited.

## 2. Files

| File | Role |
| --- | --- |
| `app/utils/about-readiness.ts` | the single readiness decision (4 states) |
| `app/composables/useAboutContent.ts` | route-locale-scoped `/settings/site` read |
| `app/composables/useAboutSchema.ts` | `ProfilePage` + referenced `Person` + `BreadcrumbList` |
| `app/components/about/Portrait.vue` | portrait descriptor → `<NuxtImg>` with variants + blurhash |
| `app/pages/about.vue` | the page: readiness state and published layout |
| `i18n/locales/{en,ar}.json` | `about.*` and `seo.about.*` (additions only) |
| `scripts/e2e/fixtures.ts` | populated About settings + portrait fixture |

## 3. Copy inventory — OWNER APPROVED 2026-07-29

**Approved.** The governed body copy
(`aboutBio`, `engineeringPhilosophy`, `currentFocus`) is **not** in this table: it is already approved
and comes from the API byte-identical.

### New strings

| Key | English | Arabic |
| --- | --- | --- |
| `about.title` | About | نبذة عني |
| `about.description` | How I work, what I specialize in, and what I am building right now. | كيف أعمل، وفيمَ أتخصص، وما الذي أبنيه الآن. |
| `about.breadcrumbLabel` | Breadcrumb | مسار التنقّل |
| `about.bioHeading` | Background | خلفيتي |
| `about.philosophyHeading` | How I approach engineering | منهجي في الهندسة |
| `about.focusHeading` | What I am working on now | ما أعمل عليه الآن |
| `about.moreLabel` | More about my work | المزيد عن عملي |
| `about.experienceAction` | See my experience | اطّلع على خبرتي |
| `about.projectsAction` | Browse projects | تصفّح المشاريع |
| `about.readiness.title` | This page is still being finished | هذه الصفحة قيد الإنجاز |
| `about.readiness.portraitBody` | The written sections are ready, but this page is not published until it is complete. In the meantime, my experience and projects cover the same work in more depth. | المحتوى المكتوب جاهز، لكنني أنتظر اكتمال الصفحة قبل عرضها كاملة. في الوقت الحالي، يمكنك الاطّلاع على خبرتي ومشاريعي لمزيد من التفاصيل عن عملي. |
| `about.readiness.contentBody` | This page is being prepared and is not published yet. My experience and projects already cover the same work in depth. | ما زال محتوى هذه الصفحة قيد الإعداد. في الوقت الحالي، يمكنك الاطّلاع على خبرتي ومشاريعي لمزيد من التفاصيل عن عملي. |
| `about.readiness.experienceAction` | See my experience | اطّلع على خبرتي |
| `about.readiness.projectsAction` | Browse projects | تصفّح المشاريع |
| `about.errorTitle` | This page could not be loaded | تعذّر تحميل هذه الصفحة |
| `about.errorBody` | The request did not complete. This is usually temporary. | تعذّر إكمال الطلب، وعادةً ما تكون هذه مشكلة مؤقتة. |
| `seo.about.title` | About | نبذة عني |
| `seo.about.description` | Eslam Muatamed is a JavaScript Product Engineer — frontend-led, with end-to-end product delivery experience in Vue.js and Nuxt.js. | إسلام معتمد مهندس برمجيات للمنتجات، متخصص في هندسة الواجهات الأمامية باستخدام Vue.js وNuxt.js، ولديه خبرة في تسليم منتجات الويب من البداية إلى النهاية. |

### Reused strings

`nav.home`, `nav.about`, `nav.experience`, `nav.projects`, `common.retry`, `brand.name` —
pre-existing and already owner-reviewed.

`brand.role` was **changed** by owner decision (2026-07-29) so the null-tagline fallback stops
publishing the superseded primary identity: EN `JavaScript Product Engineer`, AR
`مهندس برمجيات للمنتجات`. It is a fallback only — the full CMS tagline is never copied into the
Web locale files, because the tagline is API-owned (positioning-strategy v1.1.0 §8).

### Owner copy approval (2026-07-29)

All English strings approved unchanged. All Arabic approved unchanged except five exact
replacements, applied verbatim above: `about.breadcrumbLabel`, `about.readiness.portraitBody`,
`about.readiness.contentBody`, `about.errorBody`, `seo.about.description`.

### Portrait accessibility text

**Not in this table and not a Web string.** The portrait `alt` is API-owned and per-locale
(D10-6). It is authored in the CMS with the portrait upload, and its EN/AR values need owner approval
**before publication** — see §5 of `spec.md`. The Web never supplies a fallback alt.

### Positioning check

`seo.about.description` uses the approved identity — *JavaScript Product Engineer*, **frontend-led**,
*end-to-end product delivery experience*. It does not claim equal-depth backend specialization,
seniority, team leadership, metrics, or business outcomes. It mirrors the governed `aboutBio` opening
rather than re-authoring it, and is a separately approved short field, not a truncation
(`about-copy.md` §4 forbids a shortened SEO variant of the governed blocks).

## 4. Decisions taken in this slice

| # | Decision | Rejected alternative |
| --- | --- | --- |
| A1 | Page content reads the **route** locale via a new composable | reusing `useSiteSettings()` (UI locale) — would put governed prose on the outgoing language mid-transition |
| A2 | Same `settings:site:{locale}` key namespace | a distinct key — would double the request on every SSR render |
| A3 | Markdown cache key uses the **route** locale | `$i18n.locale` — caught by test: would file Arabic HTML under an English key |
| A4 | Readiness state does **not** render the governed prose | showing prose behind a notice — publishes an incomplete page while calling it unfinished |
| A5 | `alt: ""` also fails readiness | treating decorative as sufficient — the slot is meaningful content |
| A6 | `ProfilePage.mainEntity` is an `@id` reference | nesting a Person object — a duplicate identity, forbidden by D22-8 |
| A7 | `knowsAbout` omitted | fetching `/skills` — a request and route weight for no stated requirement |
| A8 | No `og:image` | using the portrait — unpublished; or new artwork — unauthorized |

## 5. Follow-ups recorded, not silently skipped

1. **Real portrait upload + EN/AR alt approval** — publication blocker (§5 of `spec.md`).
2. **Branded social-card fallback** — finding F-1, carried from the Experience slice; until it
   exists, `og:image` stays omitted.
3. **F-2 — chrome serializes the whole settings object** into the hydration payload on every route.
   Non-blocking for this slice (the About prose is public-intended content), but it causes
   cross-route over-fetching and payload growth, and **hidden content is not confidential merely
   because it is not rendered**. Any future private, draft, or publication-gated field must never
   rely on UI hiding for confidentiality. A later architecture review should consider separating
   chrome settings from Profile content without introducing duplicate requests. **Not redesigned in
   this PR** by owner instruction.

**Resolved during this slice:** the `about-states` scenario backend variant is implemented as the
`about-readiness` lane (T048); F-3 is closed by Docs PR #25 and API PR #39.
