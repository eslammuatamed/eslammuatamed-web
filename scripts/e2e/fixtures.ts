/**
 * Authored fixtures for the SSR scenario lane (web-005 Phase 8).
 *
 * TEST INFRASTRUCTURE ONLY. Nothing here is imported by `app/**`, `server/**`, or any runtime plugin;
 * the scenario server that serves it is spawned by `scripts/ci-preview.mjs --backend scenarios` and
 * exists only for the `ssr-scenarios` Playwright project.
 *
 * CONTRACT FIDELITY IS ENFORCED TWICE, on purpose:
 *   1. Compile time — every fixture is typed with the OpenAPI-DERIVED types generated into
 *      `app/types/api.d.ts` by `npm run api:types`. A missing or misnamed required field fails
 *      `npm run typecheck:e2e`. There is no second, handwritten DTO model here.
 *   2. Run time — `contract-fixtures.spec.ts` validates every one of these objects against the
 *      committed `openapi/openapi.json` schemas with ajv. That catches what types cannot: formats
 *      (`uuid`, `uri`), enums, and additional-property drift.
 * Error bodies use the contract's own RFC 7807 `ProblemDetailsDto` shape, not an invented one.
 *
 * WHY THE CONTENT IS AUTHORED RATHER THAN GENERATED. Prism replays the contract's single example for
 * every slug and every locale, so it cannot express "EN and AR differ" or "this gallery is empty".
 * These fixtures state those differences explicitly, which is the whole point of the lane. It is also
 * why the D06-6 locale-switch fix is provable here and nowhere else: against Prism, requesting the
 * Arabic slug with `?locale=en` succeeds, so the bug is invisible.
 */
import type { components } from '../../app/types/api'

type Schemas = components['schemas']

export type ArticleDetail = Schemas['PublicArticleDetailEntity']
export type ProjectDetail = Schemas['PublicProjectDetailEntity']
export type ProjectListItem = Schemas['PublicProjectListItemEntity']
export type GalleryItem = Schemas['PublicProjectGalleryItemEntity']
export type MediaImage = Schemas['PublicMediaImageDescriptor']
export type Skill = Schemas['PublicSkillEntity']
export type SiteSettings = Schemas['PublicSiteSettingsEntity']
export type PageMeta = Schemas['PageMeta']
export type RedirectResolve = Schemas['RedirectResolveEntity']
export type ProblemDetail = Schemas['ProblemDetailsDto']

/** The two locales the site serves. `useApi()` puts one of them on every GET (D10-6). */
export type Locale = 'en' | 'ar'

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ar'
}

/**
 * Technology UUIDs that double as INDEX SCENARIO SELECTORS.
 *
 * The projects index has exactly one query parameter that reaches the API unchanged (`technology`),
 * so it is the only deterministic way to give each index scenario its own URL — which is the
 * invariant the whole lane rests on (see `scenario-server.ts`). Each id is a real option in
 * `SKILLS`, so the filter renders and clears normally; the localized labels name the scenario, since
 * pretending they are ordinary technologies would make the harness harder to read, not easier.
 */
export const TECHNOLOGY = {
  /** Returns a well-formed, EMPTY page — the filtered empty state. */
  noMatches: '019f89b5-3050-7161-af37-000000000001',
  /** The upstream destroys the socket: a genuine connection failure inside Nitro. */
  unreachable: '019f89b5-3050-7161-af37-000000000002',
  /** The upstream answers RFC 7807 `503` — a different failure mode from the one above. */
  upstream503: '019f89b5-3050-7161-af37-000000000003'
} as const

/**
 * The SAME three scenarios addressed by their canonical slug. `?technology=` accepts both forms —
 * the slug is canonical and the uuid is backward-compatible only (D10-17) — so the harness carries
 * both and the scenario server resolves either to one scenario. Keeping the two lists side by side
 * is what lets a test assert the legacy form still works instead of assuming it.
 */
export const TECHNOLOGY_SLUG = {
  /** Returns a well-formed, EMPTY page — the filtered empty state. */
  noMatches: 'scenario-no-matches',
  /** The upstream destroys the socket: a genuine connection failure inside Nitro. */
  unreachable: 'scenario-unreachable',
  /** The upstream answers RFC 7807 `503` — a different failure mode from the one above. */
  upstream503: 'scenario-upstream-503'
} as const

/** Slugs that select the DETAIL scenarios. One slug per scenario per locale; never reused. */
export const SLUG = {
  /** The canonical destination of the redirect scenario. */
  canonical: { en: 'ssr-canonical', ar: 'ssr-canonical-ar' },
  /** A renamed slug: 404 on the project read, resolvable through the redirect endpoint. */
  renamed: { en: 'ssr-old-slug', ar: 'ssr-old-slug-ar' },
  /** 404 on the project read AND 404 on redirect resolution — the real not-found. */
  unknown: { en: 'ssr-unknown-slug', ar: 'ssr-unknown-slug-ar' },
  /** RFC 7807 `503` on the project read; must never be rendered as a 404. */
  upstreamFailure: { en: 'ssr-upstream-failure', ar: 'ssr-upstream-failure-ar' },
  /** A valid project whose gallery is empty. */
  emptyGallery: { en: 'ssr-empty-gallery', ar: 'ssr-empty-gallery-ar' },
  /** Deliberately different EN and AR content, and a slug map that differs between them. */
  bilingual: { en: 'ssr-bilingual', ar: 'ssr-bilingual-ar' }
} as const

/**
 * Article slugs. Only the bilingual pair exists, and only because D06-6's fix has to be proven on
 * BOTH per-locale-slug surfaces — `blog/[slug].vue` carries the identical pattern to
 * `projects/[slug].vue`, so fixing one and testing one would leave the other unverified.
 * This is the whole of the blog surface the scenario backend serves; the blog index and every other
 * article behaviour stay with Prism in the `contract` lane.
 */
export const ARTICLE_SLUG = { bilingual: { en: 'ssr-article', ar: 'ssr-article-ar' } } as const

const MEDIA_ORIGIN = 'https://media.eslammuatamed.com/media'

/** Declared beside MEDIA_ORIGIN, above SITE_SETTINGS, because SITE_SETTINGS reads it at module init. */
const PORTRAIT_ID = '019f89b5-3050-7161-af37-0000000000f1'

/** Site settings — always healthy, in both locales: the page shell must not be part of any failure. */
export const SITE_SETTINGS: Record<Locale, SiteSettings> = {
  en: {
    siteName: 'Eslam Muatamed',
    // The approved public tagline (positioning-strategy v2.0.0 §2). Person.jobTitle derives from it
    // (D22-8), so the fixture must carry the real string — including the approved line break, which
    // is why it is written with an explicit \n rather than as two words on one line.
    tagline: 'Full-Stack JavaScript\nProduct Engineer',
    defaultMetaTitle: 'Eslam Muatamed',
    defaultMetaDescription: 'Portfolio, case studies, and writing.',
    profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' }],
    availabilityStatus: 'Open to select consulting engagements',
    careerStartYear: 2023,
    careerStartMonth: 11,
    googleSiteVerification: null,
    bingSiteVerification: null,
    customMetas: [],
    resumeAsset: null,
    // About content + portrait are POPULATED here on purpose: this is the only lane that can render
    // the published /about page in a real browser, which is where the portrait descriptor, RTL
    // layout, CLS and unfiltered axe are actually observable. The negative readiness states
    // (portrait absent, localized alt absent, prose absent) are pure render decisions and are proven
    // exhaustively in the component/unit lane instead — `/settings/site` carries no slug or query for
    // this backend to select a scenario on, and it must stay healthy for every other scenario's
    // chrome, so it cannot express more than one variant per locale.
    aboutBio: 'I build for the web, frontend first.\n\nMost of my work is Vue and Nuxt.',
    engineeringPhilosophy: 'I prefer maintainability over cleverness.\n\nBudgets that are not enforced are not budgets.',
    currentFocus: 'Building bilingual web products and developing this platform in the open.',
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    portraitAssetId: PORTRAIT_ID,
    portrait: portraitImage(PORTRAIT_ID, 'Eslam Muatamed, photographed against a plain wall'),
    availableLocales: ['en', 'ar']
  },
  ar: {
    siteName: 'إسلام معتمد',
    // Same English professional title on the Arabic site, by decision (positioning-strategy v2.0.0 §3).
    tagline: 'Full-Stack JavaScript\nProduct Engineer',
    defaultMetaTitle: 'إسلام معتمد',
    defaultMetaDescription: 'أعمال ودراسات حالة وكتابات.',
    profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' }],
    availabilityStatus: 'متاح لارتباطات استشارية مختارة',
    careerStartYear: 2023,
    careerStartMonth: 11,
    googleSiteVerification: null,
    bingSiteVerification: null,
    customMetas: [],
    resumeAsset: null,
    // The Arabic alt is authored SEPARATELY rather than reusing the English string: that is what makes
    // "no cross-locale alt fallback" (D10-6) observable here — if the page ever borrowed the other
    // locale's alt, this fixture would show it.
    aboutBio: 'أبني للويب، والواجهة الأمامية أولًا.\n\nمعظم عملي بـ Vue وNuxt.',
    engineeringPhilosophy: 'أُفضّل قابلية الصيانة على الاستعراض التقني.\n\nوالميزانية التي لا تُنفَّذ ليست ميزانية.',
    currentFocus: 'أبني منتجات ويب ثنائية اللغة، وأطوّر هذه المنصة بشكل مفتوح.',
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    portraitAssetId: PORTRAIT_ID,
    portrait: portraitImage(PORTRAIT_ID, 'إسلام معتمد، صورة أمام جدار سادة'),
    availableLocales: ['en', 'ar']
  }
}

/**
 * The REAL live API state for `/about` after the content seed: every governed About field populated,
 * **no portrait**. Served by the dedicated `about-readiness` backend configuration on its own port,
 * so `/settings/site` stays healthy and published for every other scenario — the readiness lane
 * cannot perturb an unrelated test, because it is a different process answering a different port.
 *
 * Derived from `SITE_SETTINGS` rather than retyped, so the two cannot drift in any field except the
 * one under test.
 */
export const ABOUT_READINESS_SETTINGS: Record<Locale, SiteSettings> = {
  en: { ...SITE_SETTINGS.en, portraitAssetId: null, portrait: null },
  ar: { ...SITE_SETTINGS.ar, portraitAssetId: null, portrait: null }
}

/** The résumé asset id and filename the PDF lane serves (010). Stable so tests can assert on them. */
export const RESUME_ASSET_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
export const RESUME_PDF_FILENAME = 'eslam-muatamed-resume.pdf'

/**
 * A minimal, structurally valid PDF — NOT the owner's résumé.
 *
 * The PDF lane exists to prove the DELIVERY contract: an absolute media-origin URL, an
 * `application/pdf` content type, and a `Content-Disposition: attachment` header that makes the
 * link download rather than navigate. None of that depends on what the document contains, and
 * committing a copy of the real CV into the test harness would put a second, drifting copy of a
 * governed asset in this repository. So the fixture is the smallest byte sequence that is honestly
 * a PDF: a header, one empty A4 page, and an EOF marker.
 */
export const RESUME_PDF_BYTES: Uint8Array = new TextEncoder().encode(
  '%PDF-1.4\n'
  + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n'
  + 'trailer<</Root 1 0 R/Size 4>>\n'
  + '%%EOF\n'
)

/**
 * `SITE_SETTINGS` with the résumé PDF slot POPULATED, for the `resume-pdf` lane.
 *
 * The descriptor's `url` is built from the media origin the scenario server is actually listening
 * on, so the browser downloads from a real absolute cross-origin URL — the same shape the API emits
 * from `PUBLIC_MEDIA_URL`, and the only way the attachment headers can be observed end to end.
 * Derived from `SITE_SETTINGS` rather than retyped, so the two cannot drift in any field except the
 * one under test.
 */
export function resumePdfSettings(mediaOrigin: string): Record<Locale, SiteSettings> {
  const asset = {
    id: RESUME_ASSET_ID,
    kind: 'PDF' as const,
    url: `${mediaOrigin}/media/${RESUME_PDF_FILENAME}`,
    filename: RESUME_PDF_FILENAME,
    sizeBytes: RESUME_PDF_BYTES.byteLength
  }
  return {
    en: { ...SITE_SETTINGS.en, resumeAsset: asset },
    ar: { ...SITE_SETTINGS.ar, resumeAsset: asset }
  }
}

/**
 * The technology filter's options. The three scenario ids are ordinary, selectable options — the
 * filter control and its clear action stay fully exercised in the empty and error scenarios, which
 * is exactly what "filters and recovery behavior remain accessible" has to mean to be worth testing.
 */
export const SKILLS: Record<Locale, Skill[]> = {
  en: [
    { id: TECHNOLOGY.noMatches, slug: TECHNOLOGY_SLUG.noMatches, label: 'Scenario — no matching projects', group: 'FRONTEND', order: 1, brandColor: null, availableLocales: ['en', 'ar'] },
    { id: TECHNOLOGY.unreachable, slug: TECHNOLOGY_SLUG.unreachable, label: 'Scenario — upstream unreachable', group: 'BACKEND', order: 2, brandColor: null, availableLocales: ['en', 'ar'] },
    { id: TECHNOLOGY.upstream503, slug: TECHNOLOGY_SLUG.upstream503, label: 'Scenario — upstream 503', group: 'BACKEND', order: 3, brandColor: null, availableLocales: ['en', 'ar'] }
  ],
  ar: [
    { id: TECHNOLOGY.noMatches, slug: TECHNOLOGY_SLUG.noMatches, label: 'سيناريو — لا مشاريع مطابقة', group: 'FRONTEND', order: 1, brandColor: null, availableLocales: ['en', 'ar'] },
    { id: TECHNOLOGY.unreachable, slug: TECHNOLOGY_SLUG.unreachable, label: 'سيناريو — تعذر الوصول للخادم', group: 'BACKEND', order: 2, brandColor: null, availableLocales: ['en', 'ar'] },
    { id: TECHNOLOGY.upstream503, slug: TECHNOLOGY_SLUG.upstream503, label: 'سيناريو — خطأ ٥٠٣ من الخادم', group: 'BACKEND', order: 3, brandColor: null, availableLocales: ['en', 'ar'] }
  ]
}

/** An empty page of projects. `total: 0` and `totalPages: 0` keep pagination correctly absent. */
export const EMPTY_PAGE: { data: ProjectListItem[], meta: PageMeta } = {
  data: [],
  meta: { page: 1, perPage: 12, total: 0, totalPages: 0 }
}

function image(id: string, alt: string | null): MediaImage {
  return {
    id,
    kind: 'IMAGE',
    url: `${MEDIA_ORIGIN}/${id}/1920-webp.webp`,
    width: 2400,
    height: 1350,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    alt,
    variants: [
      { format: 'WEBP', width: 1280, height: 720, url: `${MEDIA_ORIGIN}/${id}/1280-webp.webp` },
      { format: 'WEBP', width: 1920, height: 1080, url: `${MEDIA_ORIGIN}/${id}/1920-webp.webp` }
    ]
  }
}

/**
 * The About portrait (FR-PUB-020) — portrait-ORIENTED, unlike the landscape gallery images above, so
 * the page's `aspect-[4/5]` frame is exercised against a descriptor whose intrinsic ratio matches
 * rather than one it would have to crop aggressively.
 *
 * `alt` is a REQUIRED argument with no default: the About readiness gate treats a missing localized
 * alt as unpublishable, so a fixture that could silently omit it would let the very state under test
 * appear by accident.
 */
function portraitImage(id: string, alt: string | null): MediaImage {
  return {
    id,
    kind: 'IMAGE',
    // Transcribed from a real `/admin/media` upload of the approved 1086×1448 portrait through the
    // post-D20-20 pipeline, so this fixture is the shape the live API actually returns rather than a
    // plausible-looking invention. Three properties are load-bearing and were all wrong before:
    //
    //   • There is NO 1280 rendition. 1086 falls strictly between 640 and 1280, so the ladder stops at
    //     640 and D20-20 adds a terminal rendition at the source width. A fixture advertising 1280w
    //     described a file the API cannot produce for this source.
    //   • AVIF exists. Every width is emitted in both public formats, which is what makes the
    //     component's per-format `<source>` split observable at all.
    //   • Top-level url/width/height describe ONE file — the widest public WebP (D10-14) — not the
    //     private master. The master is 1086×1448 too, so `url` is asserted alongside the numbers.
    url: `${MEDIA_ORIGIN}/${id}/1086-webp.webp`,
    width: 1086,
    height: 1448,
    blurhash: 'LA8:bcoL0LR+^NoL9uWC0zaz}@oL',
    alt,
    variants: [
      { format: 'AVIF', width: 640, height: 853, url: `${MEDIA_ORIGIN}/${id}/640-avif.avif` },
      { format: 'WEBP', width: 640, height: 853, url: `${MEDIA_ORIGIN}/${id}/640-webp.webp` },
      { format: 'AVIF', width: 1086, height: 1448, url: `${MEDIA_ORIGIN}/${id}/1086-avif.avif` },
      { format: 'WEBP', width: 1086, height: 1448, url: `${MEDIA_ORIGIN}/${id}/1086-webp.webp` }
    ]
  }
}

function galleryItem(id: string, order: number, alt: string | null, caption: string | null): GalleryItem {
  return { mediaAssetId: id, mediaAsset: image(id, alt), order, caption }
}

const TECHNOLOGIES_EN = [
  { id: '019f89b5-3050-7161-af37-0000000000a1', slug: 'nuxt', label: 'Nuxt' },
  { id: '019f89b5-3050-7161-af37-0000000000a2', slug: 'postgresql', label: 'PostgreSQL' }
]
const TECHNOLOGIES_AR = [
  { id: '019f89b5-3050-7161-af37-0000000000a1', slug: 'nuxt', label: 'نكست' },
  { id: '019f89b5-3050-7161-af37-0000000000a2', slug: 'postgresql', label: 'بوستجريس' }
]

/**
 * The eight FR-CNT-020 long-form fields. Every one is non-empty so the detail page renders all eight
 * headings — an empty field renders nothing at all, which would silently weaken the empty-gallery
 * assertion that "the rest of FR-CNT-020 remains visible".
 */
function sections(prefix: string) {
  return {
    overview: `${prefix} overview paragraph.`,
    businessProblem: `${prefix} business problem paragraph.`,
    solution: `${prefix} solution paragraph.`,
    role: `${prefix} role paragraph.`,
    architecture: `${prefix} architecture paragraph.`,
    challenges: `${prefix} challenges paragraph.`,
    features: `${prefix} features paragraph.`,
    lessonsLearned: `${prefix} lessons paragraph.`
  }
}

/** The same eight fields in authored Arabic — never a transliteration of the English above. */
function sectionsAr(prefix: string) {
  return {
    overview: `${prefix} — فقرة النظرة العامة بالعربية.`,
    businessProblem: `${prefix} — فقرة المشكلة التجارية بالعربية.`,
    solution: `${prefix} — فقرة الحل بالعربية.`,
    role: `${prefix} — فقرة الدور بالعربية.`,
    architecture: `${prefix} — فقرة البنية بالعربية.`,
    challenges: `${prefix} — فقرة التحديات بالعربية.`,
    features: `${prefix} — فقرة المزايا بالعربية.`,
    lessonsLearned: `${prefix} — فقرة الدروس المستفادة بالعربية.`
  }
}

/** The canonical project a renamed slug redirects to. Populated gallery: the ordinary case. */
const CANONICAL_EN: ProjectDetail = {
  id: '019f89b5-3050-7161-af37-0000000000b1',
  slug: SLUG.canonical.en,
  title: 'Canonical scenario project',
  summary: 'The current home of a project whose slug was renamed.',
  featured: true,
  year: 2026,
  technologies: TECHNOLOGIES_EN,
  availableLocales: ['en', 'ar'],
  slugs: { en: SLUG.canonical.en, ar: SLUG.canonical.ar },
  liveUrl: 'https://example.com/canonical',
  repoUrl: 'https://github.com/eslammuatamed/canonical',
  ...sections('Canonical'),
  gallery: [galleryItem('019f89b5-3050-7161-af37-0000000000c1', 1, 'Canonical scenario screenshot', 'Canonical caption')],
  metaTitle: null,
  metaDescription: null,
  ogImageId: null,
  ogImage: null,
  canonicalUrl: null
}

const CANONICAL_AR: ProjectDetail = {
  ...CANONICAL_EN,
  slug: SLUG.canonical.ar,
  title: 'مشروع السيناريو الأساسي',
  summary: 'الموطن الحالي لمشروع تغيّر معرّفه.',
  technologies: TECHNOLOGIES_AR,
  ...sectionsAr('الأساسي'),
  gallery: [galleryItem('019f89b5-3050-7161-af37-0000000000c1', 1, 'لقطة شاشة للسيناريو الأساسي', 'تعليق أساسي')]
}

/** A valid project with NO gallery — the empty-gallery scenario. Everything else stays present. */
const EMPTY_GALLERY_EN: ProjectDetail = {
  ...CANONICAL_EN,
  id: '019f89b5-3050-7161-af37-0000000000b2',
  slug: SLUG.emptyGallery.en,
  title: 'Project without gallery media',
  summary: 'A published case study whose owner has not attached any media yet.',
  slugs: { en: SLUG.emptyGallery.en, ar: SLUG.emptyGallery.ar },
  ...sections('Empty gallery'),
  gallery: []
}

const EMPTY_GALLERY_AR: ProjectDetail = {
  ...EMPTY_GALLERY_EN,
  slug: SLUG.emptyGallery.ar,
  title: 'مشروع بلا وسائط في المعرض',
  summary: 'دراسة حالة منشورة لم يُرفق بها المالك أي وسائط بعد.',
  technologies: TECHNOLOGIES_AR,
  ...sectionsAr('المعرض الفارغ')
}

/**
 * The EN/AR differentiation pair. Titles, summaries, all eight sections, the technology labels, the
 * gallery caption and the image `alt` are authored separately per locale, and the `slugs` map differs
 * — so a fallback to English anywhere on the Arabic page is visible rather than plausible.
 */
const BILINGUAL_EN: ProjectDetail = {
  id: '019f89b5-3050-7161-af37-0000000000b3',
  slug: SLUG.bilingual.en,
  title: 'Bilingual differentiation study',
  summary: 'This English summary has no Arabic words in it whatsoever.',
  featured: false,
  year: 2025,
  technologies: TECHNOLOGIES_EN,
  availableLocales: ['en', 'ar'],
  slugs: { en: SLUG.bilingual.en, ar: SLUG.bilingual.ar },
  liveUrl: null,
  repoUrl: null,
  ...sections('Bilingual English'),
  gallery: [galleryItem('019f89b5-3050-7161-af37-0000000000c3', 1, 'English alternative text', 'English gallery caption')],
  metaTitle: null,
  metaDescription: null,
  ogImageId: null,
  ogImage: null,
  canonicalUrl: null
}

const BILINGUAL_AR: ProjectDetail = {
  ...BILINGUAL_EN,
  slug: SLUG.bilingual.ar,
  title: 'دراسة تمايز اللغتين',
  summary: 'هذا الملخص العربي لا يحتوي على أي كلمة إنجليزية إطلاقًا.',
  technologies: TECHNOLOGIES_AR,
  ...sectionsAr('ثنائي اللغة'),
  gallery: [galleryItem('019f89b5-3050-7161-af37-0000000000c3', 1, 'نص بديل بالعربية', 'تعليق المعرض بالعربية')]
}

/** Every project the scenario server can serve, keyed by the slug that selects it, per locale. */
export const PROJECTS: Record<Locale, Record<string, ProjectDetail>> = {
  en: {
    [SLUG.canonical.en]: CANONICAL_EN,
    [SLUG.emptyGallery.en]: EMPTY_GALLERY_EN,
    [SLUG.bilingual.en]: BILINGUAL_EN
  },
  ar: {
    [SLUG.canonical.ar]: CANONICAL_AR,
    [SLUG.emptyGallery.ar]: EMPTY_GALLERY_AR,
    [SLUG.bilingual.ar]: BILINGUAL_AR
  }
}

/**
 * The bilingual ARTICLE pair — the blog counterpart of the project pair above, and for the same
 * reason: article slugs are per locale (D04-2), so a locale switch that requested the incoming slug
 * in the outgoing language would 404. Authored separately per locale so an English fallback on the
 * Arabic page is visible rather than plausible.
 */
const ARTICLE_EN: ArticleDetail = {
  id: '019f89b5-3050-7161-af37-0000000000d1',
  title: 'Bilingual article differentiation study',
  slug: ARTICLE_SLUG.bilingual.en,
  excerpt: 'This English excerpt contains no Arabic whatsoever.',
  readingTimeMin: 6,
  publishAt: '2026-05-01T09:00:00.000Z',
  coverImageId: null,
  coverImage: null,
  category: { id: '019f89b5-3050-7161-af37-0000000000e1', name: 'Engineering', slug: 'engineering' },
  tags: [{ id: '019f89b5-3050-7161-af37-0000000000e2', name: 'Nuxt', slug: 'nuxt' }],
  availableLocales: ['en', 'ar'],
  slugs: { en: ARTICLE_SLUG.bilingual.en, ar: ARTICLE_SLUG.bilingual.ar },
  body: 'The English article body, written only in English.',
  metaTitle: null,
  metaDescription: null,
  ogImageId: null,
  ogImage: null,
  canonicalUrl: null
}

const ARTICLE_AR: ArticleDetail = {
  ...ARTICLE_EN,
  title: 'دراسة تمايز المقالات بين اللغتين',
  slug: ARTICLE_SLUG.bilingual.ar,
  excerpt: 'هذا المقتطف العربي لا يحتوي على أي إنجليزية.',
  category: { id: '019f89b5-3050-7161-af37-0000000000e1', name: 'الهندسة', slug: 'engineering' },
  tags: [{ id: '019f89b5-3050-7161-af37-0000000000e2', name: 'نكست', slug: 'nuxt' }],
  body: 'متن المقال بالعربية، مكتوب بالعربية وحدها.'
}

export const ARTICLES: Record<Locale, Record<string, ArticleDetail>> = {
  en: { [ARTICLE_SLUG.bilingual.en]: ARTICLE_EN },
  ar: { [ARTICLE_SLUG.bilingual.ar]: ARTICLE_AR }
}

/**
 * The redirect table, keyed by the SECTION-RELATIVE path the resolver is called with and the locale
 * `useApi()` appends. Locale matters: the destination is that locale's canonical slug, which is what
 * makes the redirect land on a real page instead of a second 404.
 */
export const REDIRECTS: Record<Locale, Record<string, string>> = {
  en: { [`/projects/${SLUG.renamed.en}`]: `/projects/${SLUG.canonical.en}` },
  ar: { [`/projects/${SLUG.renamed.ar}`]: `/projects/${SLUG.canonical.ar}` }
}

/** RFC 7807 problem detail — the contract's own error shape, never a second invented one. */
export function problem(status: number, title: string, detail: string, instance: string): ProblemDetail {
  return { type: 'about:blank', title, status, detail, instance }
}
