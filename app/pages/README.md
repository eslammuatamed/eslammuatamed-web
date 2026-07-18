# `app/pages` — التوجيه والتخطيطات والتدويل

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. يغطّي هذا الدليل الصفحات و`app/layouts/` و`app/middleware/` معًا (متلازمة التوجيه).

## المسؤولية

توجيه ملفّي (`Nuxt`) يقسم إلى العالمين: صفحات عامّة (SSR) وصفحات لوحة تحكّم (`ssr:false`). كل صفحة تجلب بياناتها عبر `useAsyncData(useApi())` وتضبط SEO عبر `useSeoMeta`.

## خريطة الملفّات

| الملف | الدور | العالم |
|---|---|---|
| `index.vue` | الرئيسية: hero من `GET /settings/site` + حالة «الـ API غير متاح» مُصمَّمة (`D13-1`) | عام |
| `blog/index.vue` | قائمة المدوّنة المُرقَّمة (`GET /articles`)، حالة الصفحة في الـ URL query | عام |
| `blog/[slug].vue` | صفحة المقال (`GET /articles/{slug}`) + عرض `ContentProse` + `setI18nParams` | عام |
| `dashboard/login.vue` | تسجيل الدخول (`UForm` + zod)، بلا حارس، layout `auth` | لوحة (عميل) |
| `dashboard/index.vue` | overview مبدئية خلف الحارس (`middleware: 'auth'`, layout `dashboard`) | لوحة (عميل) |

التخطيطات (`app/layouts/`): `default.vue` (شِل عام: skip link + معالم + إدارة تركيز)، `dashboard.vue` (شِل عميل-فقط: topbar + خروج)، `auth.vue` (بطاقة موسّطة بلا chrome).

الحارس (`app/middleware/auth.ts`): per-page، عميل-فقط، تجديد صامت ثم توجيه للدخول — موصوف في [`app/stores/README.md`](../stores/README.md).

## التدفّقات

### القراءة العامّة (SSR)
```
useAsyncData(`key:${locale}`, () => api<Envelope<T>>('/path').then(r => r.data))
  → SSR: HTML مكتمل من أول رسمة (D13-2)
  → تبديل اللغة = تغيير مسار يعيد تركيب الصفحة بمفتاح جديد
```

### الترقيم (blog/index)
حالة الصفحة في `route.query.page` (قابلة للربط وواضحة لـ SEO، `D13-4`)؛ `useAsyncData` بـ `watch: [page]` يعيد الجلب عند التغيير؛ `UPagination` يربط الأرقام بـ query.

### المقال + سلاگات اللغات (blog/[slug])
بعد جلب المقال، `setI18nParams` يسجّل slug كل لغة كمعامل مسارها (F-P5): سلاگا EN وAR يختلفان، فبدون هذا يعيد المُبدِّل و`hreflang` استخدام slug اللغة الحالية فيعطّل (404). ثم `ContentProse` يعرض الجسم.

### حماية لوحة التحكّم
`login.vue` **بلا** حارس (كي يصلها الخارج) و`robots:noindex`؛ `index.vue` بـ `middleware:'auth'`. عزل SSR: `routeRules` في `nuxt.config.ts` تجعل `/dashboard/**` و`/ar/dashboard/**` بـ `ssr:false`.

## العقود والثوابت

- كل قراءة عامّة مُوطَّنة (`?locale=` يضيفه `useApi`)؛ المفتاح يتضمّن اللغة.
- خطأ الجلب يُحوَّل عبر `articleErrorParams` (404 يبقى 404؛ غيره يحتفظ بحالته).
- صفحات لوحة التحكّم والخطأ `noindex`.

## الاختبارات

`components/layout/LocaleSwitcher.*.spec.ts` (تبديل اللغة)، و`Prose.spec.ts`. سلوك الصفحات مغطّى مبدئيًّا؛ اختبارات e2e (Playwright) مجدولة لمراحل لاحقة ([الوثيقة 18](../../../eslammuatamed-docs/docs/18-testing-strategy.md)).

## أخطاء شائعة (شرح لمطوّر مبتدئ)

- **جعل الحارس عامًّا** بدل per-page — يسرّب منطق لوحة التحكّم للعام (`D06-1`).
- **نسيان `setI18nParams`** في صفحة بـ slug مُترجَم — يكسر تبديل اللغة و`hreflang`.
- **استدعاء `useI18n()`/`useSetI18nParams()` بعد الـ await** — استدعِها قبله لتعمل في سياق `Nuxt` صالح.
- **بناء صفحة dashboard بـ SSR** — يجب أن تبقى `ssr:false`.

## المرجع الرسمي وحالة التوافق

- [Nuxt pages/routing](https://nuxt.com/docs/guide/directory-structure/pages) · [Nuxt layouts](https://nuxt.com/docs/guide/directory-structure/layouts) · [`useAsyncData`](https://nuxt.com/docs/api/composables/use-async-data) · [`routeRules`](https://nuxt.com/docs/guide/concepts/rendering#route-rules) · [Nuxt i18n `setI18nParams`](https://i18n.nuxtjs.org/docs/composables/use-set-i18n-params) · [`useSeoMeta`](https://nuxt.com/docs/api/composables/use-seo-meta).

**حالة التوافق:** `Compatible`. التوجيه الملفّي، `definePageMeta`، `routeRules` لعزل SSR، و`useAsyncData` أنماط `Nuxt` رسمية حالية؛ و`setI18nParams`/`useSeoMeta` هي الـ APIs الحالية. **لا انحراف.**
