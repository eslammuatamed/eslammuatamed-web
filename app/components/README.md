# `app/components` — مكوّنات العرض

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. مكوّنات `Nuxt` تُستورَد تلقائيًّا (auto-import) باسم مسبوق بمسار المجلد: `components/layout/Header.vue` → `<LayoutHeader>`، و`components/content/ArticleRow.vue` → `<ContentArticleRow>`، إلخ (`doc 12`).

## المسؤولية

المكوّنات المرئيّة للموقع العام، مبنيّة فوق `Nuxt UI` ورموز التصميم الدلالية (doc 14). **لا يوجد مجلد `dashboard/` على هذا الأساس** — مكوّنات لوحة التحكّم `Planned` (Feature web-002).

**إعادة تصميم شاملة للموقع (Feature web-007).** اتّجاه «Mirror» من إعادة تصميم 006 (Monolith + `UiDatumLabel`/`UiSection`) رُوجِع باعتباره غير أصيل بما يكفي، فجاءت 007 إعادة تصميم من الصفر وعلى مستوى الموقع كامله — نظام طباعي أوّلًا وثنائي اللغة: سجلّ خط عرض (display) بـ Space Grotesk (لاتيني) وCairo (عربي) يبلغ ذروته في لوحة الاسم الضخمة (`--text-mega`)، واستراتيجية سطح "حبر/ورق" (spread) تتناوب فيها الأقسام بين أرضيّة ورقيّة فاتحة وأقسام حبر داكنة كاملة العرض (`.on-ink`، يعيد توجيه الرموز الدلالية `--ui-*` لكامل الشجرة الفرعية)، وبدائيّة تسمية `.kicker` (eyebrow) موحّدة تتحوّل تلقائيًّا من مونو متباعد الأحرف في اللاتينية إلى خطّ عربي بلا تباعد تحت الجذر العربي، وترويسة/تذييل/تنقّل جوّال مُعاد تصميمها بالكامل، وتوقيع التصميم أنّ التركيب نفسه (لا مجرّد النص) ينعكس بحسب اتجاه القراءة لا يُترجَم فقط. البنفسجي والرمادي (`zinc`) محفوظان من نظام الألوان السابق. البدائل الجديدة `UiSpread` و`UiSectionHead` تحلّان محلّ `UiSection` و`UiSectionHeader`/`UiDatumLabel`/`UiBrandMark` المحذوفة بالكامل. القرارات موثّقة في `.specify/specs/007-site-redesign/` وفي المستندات الحاكمة D03-8/9/10 وD14-6/7.

**مرحلة القبول (تتابُع لاحق ضمن web-007).** أعادت مرحلة القبول العلامة القانونية (Monolith) إلى وسم الاسم في الترويسة/التذييل عبر مكوّن جديد `UiBrandMark` (`D03-11`، بعد حذفها بالكامل في المسودة الأولى أعلاه)، واعتمدت **Reem Kufi** وجهًا طباعيًّا للوحة الاسم العربية (`D03-12`)، وأضافت نظام أزرار/شريط-تمرير مؤلَّفًا (authored) + انتقال صفحة بالهوية البصرية + نظام حالة-بيانات بالهوية البصرية (`UiContentSkeleton`/`UiDataLoadingOverlay`/`UiRequestState`، `D03-13`)، ووطّنت `availabilityStatus` من جهة الـ API. مبدّل اللغة استُبدل بعنصر segmented جديد `LayoutLangToggle` محلّ `LocaleSwitcher` (القائمة المنسدلة السابقة).

## خريطة الملفّات

| المجلد/الملف | الدور |
|---|---|
| `AppLink.vue` | رابط واعٍ باللغة: داخلي عبر `useLocalePath`، خارجي بـ `target=_blank` + `rel=noopener` (قائمة سماح مخطّطات `WD-5`) |
| `layout/Header.vue` | `<LayoutHeader>` — الترويسة، أُعيد بناؤها لـ007 وحُدِّثت في مرحلة القبول: علامة Monolith (`UiBrandMark`) بجوار وسم الاسم بخطّ العرض (`D03-11`) + تنقّل رئيسي بأربعة عناصر مع علامة نشاط بنفسجية + رابط Résumé دائم + زرّ تواصل بنفسجي + `LayoutLangToggle` + `LayoutThemeToggle` + درج جوّال (`USlideover`) بعرض ~70vw من الحافّة الأمامية (منطقيًّا حسب RTL) فوق تعتيم يُبقي الصفحة خلفه مرئية، بفخّ تركيز/Escape/قفل تمرير من Reka |
| `layout/Footer.vue` | `<LayoutFooter>` — التذييل، أُعيد بناؤه لـ007 بوصفه **colophon** وحُدِّث في مرحلة القبول: علامة Monolith (`UiBrandMark`) بجوار الاسم + سطر بناء (colophon) + تنقّل مكرّر + حالة التوفّر + روابط تواصل اجتماعي **أيقونية فقط** (الاسم المرئي أُسقط، الاسم المتاح لتقنية المساعدة عبر `aria-label`؛ مُرشَّحة بالمخطّط `WD-5`) + تنزيل السيرة الذاتية (من `SiteSettings` عبر `useSiteSettings`، مُتشارَك مع `HomeNameplate`) + `LayoutLangToggle`/`LayoutThemeToggle` + سطر الحقوق السنوي (`FR-PUB-003`) |
| `layout/LangToggle.vue` | `<LayoutLangToggle>` — **جديد (007، يحلّ محلّ `LocaleSwitcher`):** مبدّل لغة ثنائي (EN/AR) كعنصر segmented يعرض الخيارين معًا في آنٍ (لا قائمة منسدلة)؛ اللغة النشطة بسطح مملوء بنفسجي + `aria-current`، وكل خيار رابط `NuxtLink` إلى المسار المُحلَّل مسبقًا عبر `useSwitchLocalePath` |
| `layout/ThemeToggle.vue` | `<LayoutThemeToggle>` — تبديل السمة (`useColorMode`) داخل `ClientOnly` (بلا وميض) |
| `ui/BrandMark.vue` | `<UiBrandMark>` — **جديد (007، أُعيدت في مرحلة القبول، `D03-11`):** علامة Monolith الأساسية — شكل واحد متّصل بتناظر دوراني 180° يُقرأ متطابقًا في LTR وRTL؛ SVG مضمّن بتعبئة `currentColor` وحيدة، زخرفي/`aria-hidden` لأنّ الاسم المجاور هو الهوية المتاحة (`AP-9`)؛ تظهر بجوار الاسم في الترويسة والتذييل ودرج الجوّال وطبقة `UiDataLoadingOverlay` |
| `ui/Spread.vue` | `<UiSpread>` — **جديد (007):** غلاف الصفحة القابل لإعادة الاستخدام (`<section>` + `<UContainer>`)؛ الصفحة تُركَّب كسلسلة "spreads" كاملة العرض يتناوب سطحها: `tone='paper'` (أرضية الصفحة) \| `'lift'` (خطوة سطح واحدة بحدّ رفيع، `D03-3`) \| `'ink'` (قسم حبر داكن كامل العرض، يضيف صنف `.on-ink` الذي يعيد توجيه الرموز الدلالية فتبقى المكوّنات الفرعية غير واعية بالسمة). يحلّ محلّ `UiSection` |
| `ui/SectionHead.vue` | `<UiSectionHead>` — **جديد (007):** جهاز الترويسة المتكرّر الوحيد للأقسام: eyebrow بنمط `.kicker` فوق عنوان بخطّ العرض، مع إجراء ذيلي اختياري (رابط "عرض الكل") يقابل العنوان على الشاشات الواسعة؛ `title-id` يربط `aria-labelledby` بالمعلم المالك. يحلّ محلّ `UiDatumLabel`/`UiSectionHeader` |
| `ui/StateError.vue` | `<UiStateError>` — حالة فشل تحميل قسم: رسالة + إعادة محاولة (`emit retry`) — عزل الخطأ لكل قسم (`NFR-DEGRADE`)؛ منذ مرحلة القبول تُستهلَك افتراضيًّا (فتحة `#error`) من داخل `UiRequestState` بدل الاستدعاء المباشر من أقسام الرئيسية |
| `ui/ContentSkeleton.vue` | `<UiContentSkeleton>` — **جديد (007، مرحلة القبول، نظام حالة-البيانات):** هياكل تحميل أوّلي بهندسة تطابق تركيبة المحتوى الحقيقية (`capabilities`/`work`/`timeline`/`articles`/`quotes`/`rows`) بدل مؤشّر دوّار عام أو مربّع رمادي؛ `role=status` + إعلان مقروء واحد؛ يحلّ محلّ `SectionSkeleton` |
| `ui/DataLoadingOverlay.vue` | `<UiDataLoadingOverlay>` — **جديد (007، مرحلة القبول، نظام حالة-البيانات):** طبقة إعادة تحقّق (revalidation) فوق منطقة محتواها ظاهر بالفعل (بعد تبديل لغة أو إعادة محاولة) — لا شريط تقدّم وهميّ؛ علامة Monolith + نص حالة مترجم + مسح بنفسجي على مسار خطّ رفيع (ينعكس في RTL، ثابت تحت `prefers-reduced-motion`)؛ تُبقي المحتوى مقروءًا تحت سطح شبه شفّاف |
| `ui/RequestState.vue` | `<UiRequestState>` — **جديد (007، مرحلة القبول)، العقد الموحّد لحالات صفحات المحتوى:** يُوزِّع حالة الطلب على عرض واحد فقط في كلّ مرّة — تحميل أوّلي بلا محتوى → `UiContentSkeleton`، خطأ بلا محتوى → `UiStateError` مع إعادة محاولة، فارغ بعد التحميل → فتحة `#empty` (المستدعي يقرّر النص)، مُحمَّل → المحتوى مع `UiDataLoadingOverlay` فوقه أثناء `refreshing` |
| `ui/BackToTop.vue` | `<UiBackToTop>` — **جديد (007):** زر عائم للعودة إلى الأعلى (في `default.vue`)، يظهر فقط بعد تمرير هابط معتبر؛ تمرير سلس أو فوري تحت `prefers-reduced-motion`؛ موضع منطقي (`end`/`bottom`) يراعي `safe-area-inset-bottom`؛ اسم مُتاح مترجم |
| `home/Nameplate.vue` | `<HomeNameplate>` — قسم البطل (`FR-PUB-010`)، أُعيد بناؤه لـ007 بوصفه "الطباعة هي الأطروحة": لا صور بطل، فالاسم نفسه هو الرسم — بمقاس `--text-mega` الضخم؛ شارة توفّر بنفسجيّة (لوحة مصمتة لا نقطة)، سطر الدور، سطر قيمة، زرّا CTA، وسطر أساس (baseline) يقابل فيه دَيتم "سنوات العمل" (`careerStartYear`، لا رقم مختلق) وشريط الهويّة التقنيّة الستّة بخطّ `mono` (owner-profile §8). دخول CSS واحد (`animate-rise`) آمن مع reduced-motion |
| `home/Capabilities.vue` | `<HomeCapabilities>` — قسم التقنيات (`FR-PUB-011`)، أوّل قسم حبر (`UiSpread tone="ink"`) بعد البطل الورقي: مهارات مُجمّعة بحسب النوع في أربعة أعمدة قدرات، كل تقنية بنقطة لون هويّتها (`brandColor` من `GET /skills`، المكان الوحيد للألوان التقنية)؛ حالات التحميل/الخطأ/إعادة التحقّق عبر `UiRequestState` (`skeleton="capabilities"`) |
| `home/SelectedWork.vue` | `<HomeSelectedWork>` — مشاريع مميّزة (`FR-PUB-012`): `UiSpread` + `UiSectionHead`، أعلى 3 `featured` منشورة، صفوف `ContentWorkEntry` (من `GET /projects`)؛ حالات التحميل/الخطأ/إعادة التحقّق عبر `UiRequestState` (`skeleton="work"`) |
| `home/Timeline.vue` | `<HomeTimeline>` — الخبرة (`FR-PUB-013`): `UiSpread tone="lift"` + `UiSectionHead`، الدور الحالي يتصدّر دائمًا، عناصر `ContentTimelineEntry` (من `GET /experiences`)؛ حالات التحميل/الخطأ/إعادة التحقّق عبر `UiRequestState` (`skeleton="timeline"`) |
| `home/Writing.vue` | `<HomeWriting>` — أحدث 3 مقالات (`FR-PUB-015`): `UiSpread` + `UiSectionHead`، صفوف `ContentArticleRow` → `/blog/{slug}` (من `GET /articles`)؛ حالات التحميل/الخطأ/إعادة التحقّق عبر `UiRequestState` (`skeleton="articles"`) |
| `home/Voices.vue` | `<HomeVoices>` — التوصيات (`FR-PUB-016`): `UiSpread tone="lift"` + `UiSectionHead`، تخطيط شبكي بلا carousel، `ContentQuoteBlock` (من `GET /testimonials`)؛ حالات التحميل/الخطأ/إعادة التحقّق عبر `UiRequestState` (`skeleton="quotes"`) |
| `home/Contact.vue` | `<HomeContact>` — قسم التواصل (`FR-PUB-017`): قسم حبر ختامي (`UiSpread tone="ink"`) — verso لبطل الصفحة الورقي؛ رابط نموذج + بريد مباشر (رابط `mailto:` من `profileLinks`، `D05-4`) + صدى حالة التوفّر وروابط تواصل اجتماعي **أيقونية فقط** (aria-label)، مطابقةً لأسلوب التذييل |
| `content/WorkEntry.vue` | `<ContentWorkEntry>` — صفّ فهرس مشروع (لا بطاقة مؤطَّرة): سنة بخطّ `mono` في الهامش + عنوان بخطّ العرض الكبير + ملخّص + شريط تقنيات بخطّ `mono` (رابط ممتدّ واحد → `/projects/{slug}`) |
| `content/TimelineEntry.vue` | `<ContentTimelineEntry>` — عنصر جدول زمني: فترة (`Intl`) + نوع التوظيف + دور@شركة + نقاط الأثر (تُقسَّم من نص `impact`)؛ القضيب على الحافّة المنطقية (ينعكس RTL)، علامة بنفسجية للدور الحالي. **تحديث 008:** التواريخ في عنصري `<time datetime>`، وقائمة التقنيات (`<ul>` موسومة باسم الدور، بترتيب الـ API حسب `Skill.order` — `D02-9`)، و`headingLevel` (`h3` افتراضًا للرئيسية، و`h2` في `/experience` حتى لا يُتخطّى مستوى عنوان) |
| `content/ArticleRow.vue` | `<ContentArticleRow>` — صفّ فهرس مقال: سطر meta (فئة / تاريخ / زمن قراءة) + عنوان بخطّ العرض + مقتطف (رابط ممتدّ واحد → `/blog/{slug}`) |
| `content/QuoteBlock.vue` | `<ContentQuoteBlock>` — اقتباس تحريري بعلامة تنصيص بنفسجية بخطّ العرض؛ عزو بصورة (`<NuxtImg>`) أو حرف بديل (monogram) إن غابت الصورة |
| `content/Prose.vue` | `<ContentProse>` — سطح عرض Markdown الوحيد (يفوّض إلى `/api/prose`) |

## خريطة الاتصال

- **وارد:** التخطيطات (`LayoutHeader`/`LayoutFooter`/`UiBackToTop` في `default.vue`)، الصفحات (`HomeNameplate`, `HomeCapabilities`, `HomeSelectedWork`, `HomeTimeline`, `HomeWriting`, `HomeVoices`, `HomeContact`, `ContentArticleRow`, `ContentProse`، `UiSpread`، `UiSectionHead`، `UiRequestState`).
- **صادر:** مكوّنات `Nuxt UI`، `useI18n`/`useLocalePath`/`useSwitchLocalePath`/`useColorMode`، ومركّبات البيانات (`useSiteSettings`/`useHomeData`/`useSiteSchema`)، و`utils` (`formatDate`/`formatMonthYear`/`formatExperiencePeriod`)، وبدائيّات الواجهة الجديدة (`UiSpread`/`UiSectionHead`/`UiBrandMark`/`UiRequestState`/`LayoutLangToggle`).

### مكوّنات المشاريع (005)

- **`project/Filter.vue`** — مرشّح التقنيات من سجلّ المهارات لا من نصّ حرّ؛ القيمة المُرسَلة هي
  `UUID` القياسي (الشكل الوحيد الذي يقبله العقد)، والتسميات للعرض فقط. «كل التقنيات» **عنصر نائب**
  لا خيار في القائمة: `reka-ui` تحجز السلسلة الفارغة لمسح الاختيار وترفض عنصرًا قيمته `''`؛ فالمسح
  إجراء صريح يظهر فقط أثناء وجود مرشّح.
- **`project/Gallery.vue`** — `srcset` مبني من `variants` الواردة في العقد نفسه، لا من تحويل وقت
  تشغيل (`D23-15`: الـ API يولّد النسخ وR2 يقدّمها ساكنة). `width`/`height` صريحان دائمًا — هما ما
  يُثبّت `CLS` عند الصفر. و**`alt === null` تختلف عن `alt === ''`**: الأولى تعني «لا ترجمة للنصّ
  البديل» فتُخفى الصورة من شجرة الإتاحة، والثانية تعني «زخرفيّة عن قصد».
- **`project/Links.vue`** — يعرض `liveUrl`/`repoUrl` بالتوليفات الأربع، ولا يعرض **أيّ** منطقة حين
  يكونان معًا `null`.
- **`ui/Breadcrumbs.vue`** — `nav` دلالي بقائمة مرتّبة، والعنصر الأخير يحمل `aria-current="page"`
  وليس رابطًا، وبخصائص CSS منطقيّة فينعكس المسار تلقائيًّا في RTL.

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **`AppLink` يملك تعقيد الروابط:** توطين المسار الداخلي والـ `rel=noopener` للخارجي في مكان واحد، فلا تبني الصفحات `localePath()` يدويًّا.
- **`LangToggle` و`NuxtLink` بدل `ULink`:** `to` هو المسار المُحلّل للّغة الهدف مسبقًا عبر `useSwitchLocalePath`. `ULink` في `Nuxt UI` يُعيد توطين `to` بلا بادئة للّغة **الحالية** ما لم يُمرَّر `locale:false` (فتُعاد بادئة `/ar` النشطة على هدف اللغة الافتراضية `/blog` ويعطّل تبديل ar→en — سلوك مُوثّق وكان حلّه في `LocaleSwitcher` السابق). `LangToggle` (007) يتجنّب الفخّ من الأساس باستخدام `<NuxtLink>` القياسي مباشرةً بدل `ULink`.
- **`ThemeToggle` داخل `ClientOnly`:** الوضع المُحلّل يُعرَف بعد الـ hydration فقط؛ رسمه على الخادم يُومِض الأيقونة الخطأ.
- **الاتجاه المنطقي (RTL):** قائمة الجوّال تحسب `menuSide` من اتجاه اللغة؛ والأيقونات الاتجاهية تنعكس بـ `rtl:-scale-x-100`. لا يسار/يمين فيزيائي (`D15-3`).
- **إمكانية الوصول (a11y):** صفوف المقال/المشروع روابط ممتدّة واحدة (تُعلَن رابطًا واحدًا لا عشًّا)؛ `UiSectionHead` يترك مستوى العنوان للمستدعي (`<h2>` ثابت حاليًّا؛ لا تخطّي مستويات؛ `<h1>` وحيد = لوحة الاسم).
- **أقسام الصفحة الرئيسية مكوّنات عرض بحتة:** تتلقّى `data`/`error`/`pending` عبر props وتُصدِر `retry`؛ الجلب يعيش في `useHomeData`/`useSiteSettings` (لا يجلب مكوّن عند الاستيراد، `doc 12`). قابلة للاختبار بالعزل.
- **التدهور الرشيق (graceful degradation, `NFR-DEGRADE`):** كل قسم يُخفي نفسه عند فراغ نتيجته، ويُظهر `UiStateError` مع إعادة محاولة عند الفشل؛ الأقسام تُجلَب بالتوازي وكلٌّ يعزل خطأه (`useAsyncData` لكل مفتاح) فلا يُفرِّغ قسمٌ ساقط الصفحةَ. `GET /settings/site` هو التبعية الصلبة الوحيدة (فشلها = حالة "المحتوى غير متاح").
- **ألوان التقنية (`WD-4`):** لون الهوية يأتي بيانات من الـ API (`brandColor`)، بلا مكوّن شارة مستقلّ بعد 007 — `HomeCapabilities` يُطبّقه كنقطة عبر `:style` مباشرة (استثناء doc 03 §2 لقاعدة عدم التلوين المضمّن في doc 14)، لا كخلفية نصّ.
- **قائمة سماح المخطّطات (`WD-5`, مراجعة أمنية):** روابط `profileLinks` في `HomeContact`/التذييل و`AppLink` الخارجي المُجبَر تُرشَّح لـ `https?:`/`mailto:` فقط — لأن `Vue` لا يُعقّم `:href`، فرابط `javascript:` (يُكتَب من سطح الإدارة فقط) لن يُعرَض.
- **بلا carousel (`D13-10`):** التوصيات (`HomeVoices`) تخطيط شبكي ثابت؛ المحتوى القصير لا يستحقّ تخطيطًا دوّارًا.
- **سطح "حبر/ورق" (`.on-ink`, 007):** أقسام الحبر (`UiSpread tone="ink"`) تعيد توجيه الرموز الدلالية `--ui-*` لكامل شجرتها الفرعية بدل أن تُلوَّن كلّ مكوّن يدويًّا، فتبقى `HomeCapabilities`/`HomeContact` غير واعيين بالسمة (يقرآن `text-default`/`bg-elevated` كالمعتاد) وتنعكس الألوان صحيحةً في الوضعين الفاتح والداكن.

## العقود والثوابت

- محتوى API المُوطَّن (اسم/شعار/تصنيف) يُعرَض كما يأتي؛ نصوص chrome عبر `useI18n`.
- كل الأنماط رموز دلالية (`text-highlighted`, `text-muted`, `bg-elevated`…) لا ألوان خام.

## الاختبارات

`content/Prose.spec.ts`، `content/WorkEntry.spec.ts`، `content/TimelineEntry.spec.ts`، `content/ArticleRow.spec.ts`، `content/QuoteBlock.spec.ts`، `home/Nameplate.spec.ts`، `home/Capabilities.spec.ts`، `home/SelectedWork.spec.ts`، `home/Timeline.spec.ts`، `home/Writing.spec.ts`، `home/Voices.spec.ts`، `home/Contact.spec.ts`، `ui/Spread.spec.ts`، `ui/SectionHead.spec.ts`، `ui/ContentSkeleton.spec.ts`، `ui/DataLoadingOverlay.spec.ts`، `ui/RequestState.spec.ts`، `ui/BackToTop.spec.ts`، `layout/Footer.spec.ts` (يشمل إسقاط المخطّط غير الآمن `WD-5`)، `layout/LangToggle.spec.ts`. تُغطّى الحالات الثلاث (مملوء/فارغ/خطأ) وكلا اللغتين.

## أخطاء شائعة

- بناء `localePath()`/`rel=noopener` يدويًّا بدل `AppLink`.
- إسقاط `locale:false` عند تمرير مسار مُحلّل مسبقًا لـ `ULink` — يكسر تبديل اللغة.
- رسم مكوّن يعتمد على السمة بلا `ClientOnly` — وميض.

## المرجع الرسمي وحالة التوافق

- [Nuxt components auto-import](https://nuxt.com/docs/guide/directory-structure/components) · [Nuxt UI](https://ui.nuxt.com/) · [`ClientOnly`](https://nuxt.com/docs/api/components/client-only) · [Nuxt i18n `useSwitchLocalePath`](https://i18n.nuxtjs.org/docs/composables/use-switch-locale-path) · [Nuxt UI color mode](https://ui.nuxt.com/getting-started/color-mode/nuxt).

**حالة التوافق:** `Compatible`. الاستيراد التلقائي المسبوق بالمسار، `Nuxt UI`، `ClientOnly`، و`useSwitchLocalePath` أنماط رسمية حالية؛ و`locale:false` هو الحلّ الموثّق لسلوك إعادة التوطين. **لا انحراف.**
