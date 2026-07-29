# Implementation Plan — Profile Pages, About Slice (009)

**Branch**: `009-profile-about` · **Base**: Web `dev` `f08be6d797e42b2630db3605d37475f4bfb3ab13`

## 1. Contract adoption

| | |
| --- | --- |
| Source API SHA | `289c7ee0ac4e6fc800da805c5381239c2f091ab3` (API `dev`) |
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

## 3. Copy inventory — OWNER REVIEW GATE

**Merge is blocked until the owner approves the Arabic column.** The governed body copy
(`aboutBio`, `engineeringPhilosophy`, `currentFocus`) is **not** in this table: it is already approved
and comes from the API byte-identical.

### New strings

| Key | English | Arabic |
| --- | --- | --- |
| `about.title` | About | نبذة عني |
| `about.description` | How I work, what I specialize in, and what I am building right now. | كيف أعمل، وفيمَ أتخصص، وما الذي أبنيه الآن. |
| `about.breadcrumbLabel` | Breadcrumb | مسار التنقل |
| `about.bioHeading` | Background | خلفيتي |
| `about.philosophyHeading` | How I approach engineering | منهجي في الهندسة |
| `about.focusHeading` | What I am working on now | ما أعمل عليه الآن |
| `about.moreLabel` | More about my work | المزيد عن عملي |
| `about.experienceAction` | See my experience | اطّلع على خبرتي |
| `about.projectsAction` | Browse projects | تصفّح المشاريع |
| `about.readiness.title` | This page is still being finished | هذه الصفحة قيد الإنجاز |
| `about.readiness.portraitBody` | The written sections are ready, but this page is not published until it is complete. In the meantime, my experience and projects cover the same work in more depth. | الأقسام المكتوبة جاهزة، لكن الصفحة لا تُنشر قبل اكتمالها. في هذه الأثناء، تغطي صفحتا الخبرة والمشاريع العمل نفسه بتفصيل أوفى. |
| `about.readiness.contentBody` | This page is being prepared and is not published yet. My experience and projects already cover the same work in depth. | يجري إعداد هذه الصفحة ولم تُنشر بعد. تغطي صفحتا الخبرة والمشاريع العمل نفسه بتفصيل واضح. |
| `about.readiness.experienceAction` | See my experience | اطّلع على خبرتي |
| `about.readiness.projectsAction` | Browse projects | تصفّح المشاريع |
| `about.errorTitle` | This page could not be loaded | تعذّر تحميل هذه الصفحة |
| `about.errorBody` | The request did not complete. This is usually temporary. | لم يكتمل الطلب. عادةً ما تكون المشكلة مؤقتة. |
| `seo.about.title` | About | نبذة عني |
| `seo.about.description` | Eslam Muatamed is a JavaScript Product Engineer — frontend-led, with end-to-end product delivery experience in Vue.js and Nuxt.js. | إسلام معتمد مهندس برمجيات للمنتجات متخصص في الواجهات الأمامية، بخبرة تمتد عبر طبقات المنتج باستخدام Vue.js وNuxt.js. |

### Reused strings

`nav.home`, `nav.about`, `nav.experience`, `nav.projects`, `common.retry`, `brand.name`,
`brand.role` — all pre-existing and already owner-reviewed.

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
2. **`about-states` scenario backend variant** — would move the readiness refusals into a browser
   lane; currently proven at component level (§8 of `spec.md`).
3. **Branded social-card fallback** — finding F-1, carried from the Experience slice; until it
   exists, `og:image` stays omitted.
