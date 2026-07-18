# `app/components` — مكوّنات العرض

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. مكوّنات `Nuxt` تُستورَد تلقائيًّا (auto-import) باسم مسبوق بمسار المجلد: `components/layout/Header.vue` → `<LayoutHeader>`، و`components/content/ArticleCard.vue` → `<ContentArticleCard>`، إلخ (`doc 12`).

## المسؤولية

المكوّنات المرئيّة للموقع العام، مبنيّة فوق `Nuxt UI` ورموز التصميم الدلالية (doc 14). **لا يوجد مجلد `dashboard/` على هذا الأساس** — مكوّنات لوحة التحكّم `Planned` (Feature web-002).

## خريطة الملفّات

| المجلد/الملف | الدور |
|---|---|
| `AppLink.vue` | رابط واعٍ باللغة: داخلي عبر `useLocalePath`، خارجي بـ `target=_blank` + `rel=noopener` |
| `layout/Header.vue` | الترويسة: تنقّل + Résumé + CTA تواصل + مُبدِّل لغة/سمة + قائمة جوّال (`USlideover`) |
| `layout/Footer.vue` | التذييل: يكرّر أهداف التنقّل + حقوق السنة |
| `layout/LocaleSwitcher.vue` | تبديل اللغة مع حفظ المسار (`useSwitchLocalePath` + `locale:false`) |
| `layout/ThemeToggle.vue` | تبديل السمة (`useColorMode`) داخل `ClientOnly` (بلا وميض) |
| `home/Hero.vue` | قسم البطل: اسم/شعار/توفّر + أزرار (من `SiteSettings`) |
| `content/ArticleCard.vue` | بطاقة مقال: صفّ meta + عنوان + مقتطف (رابط ممتدّ واحد) |
| `content/Prose.vue` | `ContentProse` — سطح عرض Markdown الوحيد (يفوّض إلى `/api/prose`) |
| `ui/SectionHeader.vue` | نمط ترويسة قسم واحد (eyebrow + عنوان + إجراء اختياري) |

## خريطة الاتصال

- **وارد:** التخطيطات (`LayoutHeader`/`LayoutFooter` في `default.vue`)، الصفحات (`HomeHero`, `ContentArticleCard`, `ContentProse`, `UiSectionHeader`).
- **صادر:** مكوّنات `Nuxt UI`، `useI18n`/`useLocalePath`/`useSwitchLocalePath`/`useColorMode`، و`utils` (`formatDate`).

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **`AppLink` يملك تعقيد الروابط:** توطين المسار الداخلي والـ `rel=noopener` للخارجي في مكان واحد، فلا تبني الصفحات `localePath()` يدويًّا.
- **`LocaleSwitcher` و`locale:false`:** `to` هو المسار المُحلّل للّغة الهدف مسبقًا؛ و`ULink` في `Nuxt UI` يُعيد توطين `to` بلا بادئة للّغة **الحالية**، فتُعاد بادئة `/ar` النشطة على هدف اللغة الافتراضية (`/blog`) ويعطّل تبديل ar→en. `locale:false` يوقف ذلك (سلوك مُوثّق).
- **`ThemeToggle` داخل `ClientOnly`:** الوضع المُحلّل يُعرَف بعد الـ hydration فقط؛ رسمه على الخادم يُومِض الأيقونة الخطأ.
- **الاتجاه المنطقي (RTL):** قائمة الجوّال تحسب `menuSide` من اتجاه اللغة؛ والأيقونات الاتجاهية تنعكس بـ `rtl:-scale-x-100`. لا يسار/يمين فيزيائي (`D15-3`).
- **إمكانية الوصول (a11y):** بطاقة المقال رابط ممتدّ واحد (يُعلَن رابطًا واحدًا لا عشًّا)؛ `SectionHeader` يترك مستوى العنوان للمستدعي (لا تخطّي مستويات).

## العقود والثوابت

- محتوى API المُوطَّن (اسم/شعار/تصنيف) يُعرَض كما يأتي؛ نصوص chrome عبر `useI18n`.
- كل الأنماط رموز دلالية (`text-highlighted`, `text-muted`, `bg-elevated`…) لا ألوان خام.

## الاختبارات

`content/Prose.spec.ts`، `layout/LocaleSwitcher.spec.ts` + `LocaleSwitcher.i18n.spec.ts`.

## أخطاء شائعة

- بناء `localePath()`/`rel=noopener` يدويًّا بدل `AppLink`.
- إسقاط `locale:false` عند تمرير مسار مُحلّل مسبقًا لـ `ULink` — يكسر تبديل اللغة.
- رسم مكوّن يعتمد على السمة بلا `ClientOnly` — وميض.

## المرجع الرسمي وحالة التوافق

- [Nuxt components auto-import](https://nuxt.com/docs/guide/directory-structure/components) · [Nuxt UI](https://ui.nuxt.com/) · [`ClientOnly`](https://nuxt.com/docs/api/components/client-only) · [Nuxt i18n `useSwitchLocalePath`](https://i18n.nuxtjs.org/docs/composables/use-switch-locale-path) · [Nuxt UI color mode](https://ui.nuxt.com/getting-started/color-mode/nuxt).

**حالة التوافق:** `Compatible`. الاستيراد التلقائي المسبوق بالمسار، `Nuxt UI`، `ClientOnly`، و`useSwitchLocalePath` أنماط رسمية حالية؛ و`locale:false` هو الحلّ الموثّق لسلوك إعادة التوطين. **لا انحراف.**
