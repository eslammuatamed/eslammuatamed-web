# `app/components` — مكوّنات العرض

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. مكوّنات `Nuxt` تُستورَد تلقائيًّا (auto-import) باسم مسبوق بمسار المجلد: `components/layout/Header.vue` → `<LayoutHeader>`، و`components/content/ArticleCard.vue` → `<ContentArticleCard>`، إلخ (`doc 12`).

## المسؤولية

المكوّنات المرئيّة للموقع العام، مبنيّة فوق `Nuxt UI` ورموز التصميم الدلالية (doc 14). **لا يوجد مجلد `dashboard/` على هذا الأساس** — مكوّنات لوحة التحكّم `Planned` (Feature web-002).

**إعادة تصميم الصفحة الرئيسية (Feature web-006).** أعيد تصميم الطبقة البصرية للصفحة الرئيسية لتنفيذ لغة العلامة التجارية «Mirror» (`content/brand/brand-identity.md`) تنفيذًا أقوى على مستوى التركيب: علامة **Monolith** بوصفها مرتكزًا معماريًّا (`UiBrandMark`)، وخطوط **datum** رفيعة يتصدّرها شاهد بنفسجي واحد لكل قسم (`UiDatumLabel`)، وإيقاع أقسام موحّد مع تمرير سطح واحد للتباين (`UiSection`)، وطباعة أوّلًا مع لون تمييز بنفسجي وحيد. لا تبعية جديدة، والحركة CSS أولًا وآمنة مع `prefers-reduced-motion`. القرارات موثّقة بأرقام `HR-n` في `.specify/specs/006-home-redesign/spec.md`.

## خريطة الملفّات

| المجلد/الملف | الدور |
|---|---|
| `AppLink.vue` | رابط واعٍ باللغة: داخلي عبر `useLocalePath`، خارجي بـ `target=_blank` + `rel=noopener` |
| `layout/Header.vue` | الترويسة: تنقّل + Résumé + CTA تواصل + مُبدِّل لغة/سمة + قائمة جوّال (`USlideover`) |
| `layout/Footer.vue` | التذييل: تنقّل + **روابط تواصل اجتماعي (`profileLinks`) + حالة التوفّر + تنزيل السيرة الذاتية** (من `SiteSettings` عبر `useSiteSettings`) + حقوق السنة (`FR-PUB-003`) |
| `layout/LocaleSwitcher.vue` | تبديل اللغة مع حفظ المسار (`useSwitchLocalePath` + `locale:false`) |
| `layout/ThemeToggle.vue` | تبديل السمة (`useColorMode`) داخل `ClientOnly` (بلا وميض) |
| `home/Hero.vue` | قسم البطل (`FR-PUB-010`): تركيب هويّة — علامة `UiBrandMark` + شارة توفّر + اسم بمقاس `display` + سطر الدور + سطر قيمة (`home.hero.valueProp`) + زرّا CTA + شريط الهويّة التقنيّة الستّة (owner-profile §8، أحادي اللون، بخطّ `mono` للأسماء اللاتينية) + لوحة العلامة (`Monolith`). سطح LCP نصّي + SVG مضمّن. دخول CSS واحد آمن مع reduced-motion |
| `home/TechStack.vue` | قسم التقنيات (`FR-PUB-011`): مهارات مُجمّعة في تخطيط **datasheet** (`<dl>`: مجموعة \| تقنيات) مفصولة بخطوط رفيعة عبر `UiTechBadge` (من `GET /skills`) |
| `home/FeaturedProjects.vue` | مشاريع مميّزة (`FR-PUB-012`): `UiSection` + `UiDatumLabel`، أعلى 3 `featured` منشورة، بطاقات `ContentProjectCard` (من `GET /projects`) |
| `home/ExperienceSummary.vue` | ملخّص الخبرة (`FR-PUB-013`): `UiSection variant="elevated"` (شريط سطح مرتفع للإيقاع)، جدول زمني عكسي، `ContentExperienceItem` (من `GET /experiences`) |
| `home/LatestArticles.vue` | أحدث 3 مقالات (`FR-PUB-014`): `UiSection` + `UiDatumLabel`، بطاقات `ContentArticleCard` → `/blog/{slug}` (من `GET /articles`) |
| `home/Testimonials.vue` | التوصيات (`FR-PUB-016`): `UiSection` + `UiDatumLabel`، تخطيط خطّي بلا carousel، `ContentTestimonialCard` (من `GET /testimonials`) |
| `home/ContactCta.vue` | قسم التواصل (`FR-PUB-017`): **لوحة ختامية** بحدود + صدى لعلامة `UiBrandMark` + رابط نموذج + بريد مباشر (رابط `mailto:` من `profileLinks`، `D05-4`) |
| `content/ProjectCard.vue` | بطاقة مشروع: سنة بخطّ `mono` + سهم + عنوان + ملخّص + شريط تقنيات بخطّ `mono` أعلاه خطّ رفيع (رابط ممتدّ واحد → `/projects/{slug}`) |
| `content/ExperienceItem.vue` | عنصر جدول زمني: دور@شركة + فترة (`Intl`) + نوع التوظيف؛ القضيب على الحافّة المنطقية (ينعكس RTL) |
| `content/TestimonialCard.vue` | بطاقة توصية: اقتباس + مؤلّف + صورة اختيارية (`<NuxtImg>` أو حرف بديل) |
| `content/ArticleCard.vue` | بطاقة مقال: صفّ meta (فئة / تاريخ / زمن قراءة بفواصل `/`) + عنوان + مقتطف (رابط ممتدّ واحد). التاريخ/زمن القراءة يبقى بالخطّ الأساسي لا `mono` (لا محارف عربية في `JetBrains Mono`، HR-3) |
| `content/Prose.vue` | `ContentProse` — سطح عرض Markdown الوحيد (يفوّض إلى `/api/prose`) |
| `ui/BrandMark.vue` | **جديد (006):** علامة `Monolith` (brand §3) — SVG مضمّن من المسار المعياري `M2,6 H6 V2 H14 V10 H10 V14 H2 Z`، `currentColor`، مخفيّة عن قارئات الشاشة (`aria-hidden` — الهويّة الوصولة هي النصّ المجاور، AP-9). متطابقة في LTR/RTL بالبناء |
| `ui/DatumLabel.vue` | **جديد (006):** نمط ترويسة القسم (brand §5): eyebrow + عنوان بمستوى يتحكّم به المُستدعي فوق خطّ datum رفيع يتصدّره شاهد بنفسجي واحد. الـ eyebrow اللاتيني بأحرف كبيرة متباعدة، والعربي بلا تباعد (يكسر الخطّ المتّصل، doc 03 §3). يحلّ محلّ `SectionHeader` للصفحة الرئيسية |
| `ui/Section.vue` | **جديد (006):** غلاف إيقاع القسم (`<section>` + `<UContainer>`): `variant='base'\|'elevated'` (خطوة سطح + خطوط رفيعة للعمق بدل الظلال، `D03-3`) |
| `ui/SectionHeader.vue` | نمط ترويسة قسم قديم (eyebrow + عنوان + إجراء اختياري) — **مُستبدَل بـ `UiDatumLabel` في الصفحة الرئيسية**، مُبقى للتوافق |
| `ui/TechBadge.vue` | شارة تقنية: نقطة لون هوية (من `brandColor` بيانات الـ API، `D03-2` — لا خلفية نصّ)؛ الاسم اللاتيني LTR عبر `bdi` |
| `ui/StateError.vue` | حالة فشل تحميل قسم: رسالة + إعادة محاولة (`emit retry`) — عزل الخطأ لكل قسم |
| `ui/SectionSkeleton.vue` | هيكل تحميل (يطابق أبعاد الشبكة، CLS 0) — يظهر فقط عند إعادة جلب على العميل |

## خريطة الاتصال

- **وارد:** التخطيطات (`LayoutHeader`/`LayoutFooter` في `default.vue`)، الصفحات (`HomeHero`, `ContentArticleCard`, `ContentProse`, `UiSection`, `UiDatumLabel`, `UiBrandMark`).
- **صادر:** مكوّنات `Nuxt UI`، `useI18n`/`useLocalePath`/`useSwitchLocalePath`/`useColorMode`، ومركّبات البيانات (`useSiteSettings`/`useHomeData`/`useSiteSchema`)، و`utils` (`formatDate`/`formatMonthYear`/`formatExperiencePeriod`)، وبدائيّات الواجهة الجديدة (`UiSection`/`UiDatumLabel`/`UiBrandMark`).

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **`AppLink` يملك تعقيد الروابط:** توطين المسار الداخلي والـ `rel=noopener` للخارجي في مكان واحد، فلا تبني الصفحات `localePath()` يدويًّا.
- **`LocaleSwitcher` و`locale:false`:** `to` هو المسار المُحلّل للّغة الهدف مسبقًا؛ و`ULink` في `Nuxt UI` يُعيد توطين `to` بلا بادئة للّغة **الحالية**، فتُعاد بادئة `/ar` النشطة على هدف اللغة الافتراضية (`/blog`) ويعطّل تبديل ar→en. `locale:false` يوقف ذلك (سلوك مُوثّق).
- **`ThemeToggle` داخل `ClientOnly`:** الوضع المُحلّل يُعرَف بعد الـ hydration فقط؛ رسمه على الخادم يُومِض الأيقونة الخطأ.
- **الاتجاه المنطقي (RTL):** قائمة الجوّال تحسب `menuSide` من اتجاه اللغة؛ والأيقونات الاتجاهية تنعكس بـ `rtl:-scale-x-100`. لا يسار/يمين فيزيائي (`D15-3`).
- **إمكانية الوصول (a11y):** بطاقات المقال/المشروع/التوصية روابط ممتدّة واحدة (تُعلَن رابطًا واحدًا لا عشًّا)؛ `SectionHeader` يترك مستوى العنوان للمستدعي (لا تخطّي مستويات؛ `<h1>` وحيد = البطل).
- **أقسام الصفحة الرئيسية مكوّنات عرض بحتة:** تتلقّى `data`/`error`/`pending` عبر props وتُصدِر `retry`؛ الجلب يعيش في `useHomeData`/`useSiteSettings` (لا يجلب مكوّن عند الاستيراد، `doc 12`). قابلة للاختبار بالعزل.
- **التدهور الرشيق (graceful degradation, `NFR-DEGRADE`):** كل قسم يُخفي نفسه عند فراغ نتيجته، ويُظهر `UiStateError` مع إعادة محاولة عند الفشل؛ الأقسام تُجلَب بالتوازي وكلٌّ يعزل خطأه (`useAsyncData` لكل مفتاح) فلا يُفرِّغ قسمٌ ساقط الصفحةَ. `GET /settings/site` هو التبعية الصلبة الوحيدة (فشلها = حالة "المحتوى غير متاح").
- **ألوان التقنية (`UiTechBadge`, `WD-4`):** لون الهوية يأتي بيانات من الـ API (`brandColor`) — يُطبَّق كنقطة عبر `:style` (استثناء doc 03 §2 لقاعدة عدم التلوين المضمّن في doc 14)، لا كخلفية نصّ.
- **قائمة سماح المخطّطات (`WD-5`, مراجعة أمنية):** روابط `profileLinks` في التذييل و`AppLink` الخارجي المُجبَر تُرشَّح لـ `https?:`/`mailto:` فقط — لأن `Vue` لا يُعقّم `:href`، فرابط `javascript:` (يُكتَب من سطح الإدارة فقط) لن يُعرَض.
- **بلا carousel (`D13-10`):** التوصيات تخطيط خطّي؛ المحتوى الخطّي يستحقّ تخطيطًا خطّيًّا.

## العقود والثوابت

- محتوى API المُوطَّن (اسم/شعار/تصنيف) يُعرَض كما يأتي؛ نصوص chrome عبر `useI18n`.
- كل الأنماط رموز دلالية (`text-highlighted`, `text-muted`, `bg-elevated`…) لا ألوان خام.

## الاختبارات

`content/Prose.spec.ts`، `content/ProjectCard.spec.ts`، `content/ExperienceItem.spec.ts`، `home/Hero.spec.ts`، `home/TechStack.spec.ts`، `home/FeaturedProjects.spec.ts`، `home/Testimonials.spec.ts`، `home/ContactCta.spec.ts`، `layout/Footer.spec.ts` (يشمل إسقاط المخطّط غير الآمن `WD-5`)، `layout/LocaleSwitcher.spec.ts` + `LocaleSwitcher.i18n.spec.ts`. تُغطّى الحالات الثلاث (مملوء/فارغ/خطأ) وكلا اللغتين.

## أخطاء شائعة

- بناء `localePath()`/`rel=noopener` يدويًّا بدل `AppLink`.
- إسقاط `locale:false` عند تمرير مسار مُحلّل مسبقًا لـ `ULink` — يكسر تبديل اللغة.
- رسم مكوّن يعتمد على السمة بلا `ClientOnly` — وميض.

## المرجع الرسمي وحالة التوافق

- [Nuxt components auto-import](https://nuxt.com/docs/guide/directory-structure/components) · [Nuxt UI](https://ui.nuxt.com/) · [`ClientOnly`](https://nuxt.com/docs/api/components/client-only) · [Nuxt i18n `useSwitchLocalePath`](https://i18n.nuxtjs.org/docs/composables/use-switch-locale-path) · [Nuxt UI color mode](https://ui.nuxt.com/getting-started/color-mode/nuxt).

**حالة التوافق:** `Compatible`. الاستيراد التلقائي المسبوق بالمسار، `Nuxt UI`، `ClientOnly`، و`useSwitchLocalePath` أنماط رسمية حالية؛ و`locale:false` هو الحلّ الموثّق لسلوك إعادة التوطين. **لا انحراف.**
