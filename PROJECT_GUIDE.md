# دليل المشروع — `eslammuatamed-web`

> **الحالة:** يصف الكود المُسلَّم على `origin/main` عند **`648aa467cd8bc7157cbcad2fd7c0e8981ee1f16c`** — الإصدار الحيّ في الإنتاج **`20260817T175534Z-648aa46`**.
> **آخر مراجعة:** 2026-08-17 (إغلاق Campaign 026 — تحديث المكدّس Nuxt 4.5.2).
> **لمن هذا الدليل:** مطوّر `Vue`/`Nuxt` يتعلّم بنية هذا المشروع تحديدًا. الشرح بالعربية، وكل مُعرّف تقني يبقى بالإنجليزية كما في الكود.
> **قاعدة الحالة:** يصف هذا الدليل **الكود المُسلَّم (Shipped) على `main` فقط**. ما ليس على `main` لا يُوصَف هنا كأنه موجود.
>
> ⚠ **ما تغيّر في مراجعة 2026-08-17، ولماذا يهمّ:** كانت النسخة السابقة مثبَّتة على أساس **M1** عند `156e11d` (2026-07-18)، وكانت تصف لوحة التحكّم ومعظم الصفحات العامّة بأنها `Planned` أو تُرجِع 404. **هذا لم يعد صحيحًا** — قياس دخان الإنتاج بعد النشر أعطى **16/16** من المسارات المحكومة بحالة 200. صُحِّحت هنا حالة الميزات (§3)، وإصدارات المكدّس (§4)، وبوابات الجودة (§9)، والمخاطر (§12).
>
> ⚠ **هذا الدليل ليس المنهج الدراسي (curriculum).** إعادة بنائه كمادّة تعلُّم موجَّهة — خرائط الدراسة، ترتيب القراءة المتدرّج، تتبّع ميزة حقيقية من أوّلها لآخرها — **مؤجَّلة عمدًا** إلى حملة `Web Learnability & Maintainability Pass` التي تبدأ **بعد اكتمال Frontend v1** (الوثيقة 24 §3.3، القرار D24-9). التأجيل **نقل مسجَّل، لا نسيان**.

---

## 1. الغرض من المستودع

`eslammuatamed-web` هو تطبيق `Nuxt 4` يقدّم عالمين في تطبيق واحد:

- **الموقع العام (public):** صفحات مُخدَّمة من الخادم (SSR) مع تخزين مؤقّت `SWR` على طبقة `Nitro`، ثنائية اللغة (إنجليزي LTR / عربي RTL)، تستهلك المحتوى من الـ API.
- **لوحة التحكّم (`/dashboard`):** تطبيق صفحة واحدة (SPA) **يعمل على العميل فقط** (`ssr: false`)، للمصادقة وإدارة المحتوى.

المصطلح `SSR` (Server-Side Rendering) يعني توليد HTML على الخادم قبل إرساله للمتصفّح (أفضل للـ SEO والأداء الأول). `SWR` (Stale-While-Revalidate) يعني تقديم نسخة مُخزَّنة فورًا مع تحديثها في الخلفية.

## 2. العلاقة بالمستودعات الأخرى

المنصّة ثلاثة مستودعات **مستقلّة تمامًا** (قيد دستوري، [الوثيقة 00 §3](../eslammuatamed-docs/docs/00-engineering-principles.md)):

| المستودع | الدور | التواصل |
|---|---|---|
| `eslammuatamed-web` (هنا) | الـ frontend: الموقع العام + لوحة التحكّم | يستهلك عقد الـ API |
| `eslammuatamed-api` | الـ backend: البيانات + المنطق + العقد | يُصدِّر `openapi.json` |
| `eslammuatamed-docs` | الوثائق الحاكمة (`00–24`) | لا كود |

القاعدة الحديدية: **لا مشاركة كود/أنواع/إعدادات مع `eslammuatamed-api` إطلاقًا**. القناة الوحيدة هي عقد `OpenAPI`: يُنسَخ `openapi.json` المُصدَّر من الـ API إلى `openapi/`، ثم تُولَّد الأنواع منه بـ `npm run api:types` إلى `app/types/api.d.ts` (**لا تُكتب يدويًّا أبدًا**). الـ frontend لا يعرف شيئًا عن تنفيذ الـ backend؛ يبرمج ضدّ العقد.

## 3. حالة الميزات — `Shipped` / `Planned` / `Deferred`

> لا تعامل شيئًا خارج عمود `Shipped` كأنه موجود في هذا الأساس.

**`Shipped` (على `main`، حيّ في الإنتاج):**
- **الصفحات العامّة (كلّها بلغتين en/ar، SSR):** الرئيسية `/` · المدوّنة `/blog` وصفحة المقال `/blog/[slug]` · المشاريع `/projects` وصفحة المشروع `/projects/[slug]` · `/about` · `/experience` · `/resume` · `/contact` · صفحة الخطأ. إضافةً إلى مساري المعاينة `/preview/articles/[id]` و`/preview/projects/[id]`.
- **لوحة التحكّم (`/dashboard`، عميل-فقط):** الدخول `login` · نظرة عامّة `index` · إدارة المشاريع (`projects` قائمة/إنشاء/تحرير) · مكتبة الوسائط `media` · صندوق الرسائل `messages` · الملف الشخصي `profile`. مصادقة كاملة (login/refresh/logout، التوكن في الذاكرة فقط).
- **تبديل اللغة (en/ar RTL) وتبديل السمة (light/dark)**، وترويسات SEO كاملة: `hreflang`/canonical/`og:*` يملكها `@nuxtjs/i18n` في وضع `strictSeo`، وخريطة الموقع (sitemap) عبر `@nuxtjs/seo` مع مصدر Nitro للمشاريع المنشورة.
- **بنية تحتية:** باب الـ API الوحيد `useApi()` · الأنواع المولّدة من العقد · حدود ESLint (منع Axios / منع استيراد الـ dashboard من العام / منع `$fetch` الخام للـ API) · فحوص `check:bundle` و`check:logical` · ميزانيات الحجم `size` و`size:routes` · Playwright + axe · Lighthouse محكومة · النشر الآلي من `main`.

**`Planned` (غير مبنيّة على `main`):**
- **`/uses`** — مؤجَّلة صراحةً بقرار `D24-7`، وغير مرتبطة في أي تنقّل.
- **وحدة المقالات في لوحة التحكّم (CMS للمقالات)** — لا يوجد `app/pages/dashboard/articles`؛ المقالات تُقرأ عامًّا ولا تُحرَّر من اللوحة بعد. وحدات SEO وإدارة الأدوار في اللوحة كذلك غير مبنيّة.
- **RSS (`/rss.xml`)** — لا يوجد مسار له في هذا الأساس.

**`Deferred` (مؤجّلة بقرار):**
- توليد صور OG (`ogImage: { enabled: false }` في `nuxt.config.ts`) — ما يزال معطَّلًا.
- محرّر `Tiptap` — تبعياته **مُعلَنة مسبقًا (declared-ahead-of-use)** و**ما تزال غير مستورَدة في أي مكان**؛ محرّر المشاريع يستخدم حقولًا عادية، ويفرض `scripts/check-forbidden-modules.mjs` ألّا تتسرّب إلى أي حزمة عميل عامّة (`D06-5`). ⚠ تُحقِّق هذه العبارة بنفسك قبل الاعتماد عليها: `grep -ril tiptap app/`.

> **ملاحظة:** بقيت نقطة «dependency-ahead» واحدة من الأساس القديم — تبعيات `Tiptap` موجودة قبل بناء المحرّر. أمّا الروابط في الـ Header/Footer فلم تعد تشير إلى صفحات غير مبنيّة.

## 4. المكدّس والمكتبات المهمة (ولماذا)

`Node` **`>= 24.11.0`** (`engines`) و`.nvmrc` = **24**، `TypeScript 5.9` صارم (`noUncheckedIndexedAccess`، doc 15 §1).

⚠ **الإصدارات أدناه هي المُسلَّمة فعلًا** بعد تحديث المكدّس في Campaign 026 (2026-08-17). المرجع الحاكم للمعمارية والقرارات هو [الوثيقة 06 §1.1](../eslammuatamed-docs/docs/06-frontend-architecture.md).

| المكتبة | الإصدار المُسلَّم | لماذا هي موجودة |
|---|---|---|
| `nuxt` | **4.5.2** | الإطار: توجيه ملفّي، SSR/Nitro، auto-imports، `runtimeConfig` |
| `vue` · `vue-router` | **3.5.41** · **5.2.0** | نواة العرض والتوجيه |
| `@nuxt/ui` | **4.10.0** | مكتبة مكوّنات فوق `Tailwind v4` — الأساس المرئي (`UApp`, `UForm`, `UButton`…) |
| `tailwindcss` | **4.3.3** | نظام الأنماط (رموز التصميم الدلالية، doc 14) |
| `pinia` + `@pinia/nuxt` | **4.0.3** + **1.0.2** | إدارة الحالة (متجر الجلسة `auth`) |
| `@nuxtjs/i18n` | **10.6.0** | التدويل: `prefix_except_default` (en في الجذر، ar تحت `/ar`)، RTL كبيانات، ووضع `strictSeo` |
| `@nuxt/image` | **2.1.0** | صور مُحسَّنة عبر `<NuxtImg>` (doc 06) |
| `@nuxtjs/seo` | **5.3.12** | خريطة الموقع، robots، والبيانات المهيكلة |
| `zod` (v4) | تحقّق النماذج (Standard Schema مع `UForm`) |
| `markdown-it` + `@shikijs/markdown-it` | عرض Markdown على الخادم فقط (SSR)، مع تلوين الشيفرة |
| `@fontsource*` / `@iconify-json/lucide` | الخطوط (Geist/IBM Plex Sans Arabic/JetBrains Mono) والأيقونات |
| `@tiptap/*` | محرّر لوحة التحكّم — **مُعلَن مسبقًا، غير مستخدَم على هذا الأساس** (`Planned`) |

**أهم تبعيات التطوير:** `vitest` + `@nuxt/test-utils` + `@vue/test-utils` + `happy-dom` (الاختبار)، `openapi-typescript` (توليد الأنواع من العقد)، `@stoplight/prism-cli` (خادم mock على العقد)، `@nuxt/eslint` + `eslint`، `husky` + `lint-staged`.

سياسة إضافة أي تبعية صارمة، وتشمل **ميزانية الحزمة (bundle)** للموقع العام (`principle 5/14`، [الوثيقة 16 §4](../eslammuatamed-docs/docs/16-development-conventions.md)، [الوثيقة 20](../eslammuatamed-docs/docs/20-performance.md)).

## 5. نظرة عامة على المعمارية — «عالمان» (`D06-1`)

```
                          ┌─ الموقع العام (SSR + SWR) ──────────────┐
   المتصفّح ── Nuxt ──────┤  app/pages/**, layouts/default          │
                          │  يقرأ من الـ API عبر useApi()           │
                          └────────────────────────────────────────┘
                          ┌─ لوحة التحكّم (client-only SPA) ─────────┐
                          │  app/pages/dashboard/** (ssr:false)     │
                          │  متجر auth + حارس auth + layout dashboard│
                          └────────────────────────────────────────┘
        كلّ حركة API ──────────────► useApi() ──► NestJS API (العقد)
        عرض Markdown ─────────────► /api/prose (Nitro، SSR فقط)
```

عزل العالمين مفروض **آليًّا**: `routeRules` تجعل `/dashboard/**` بـ `ssr:false` (ولا وجود لـ `/ar/dashboard/**` — انظر D04-7)؛ وقاعدة ESLint تمنع الكود العام من استيراد أي وحدة `dashboard/**`؛ وفحص البناء `check-forbidden-modules` يمنع تسرّب المحرّر/العارض إلى حزم العميل العامّة.

خريطة المجلدات المعنيّة (لكلٍّ `README.md` مفصّل):

| المجلد | المسؤولية | دليله |
|---|---|---|
| `app/composables` | باب الـ API الوحيد `useApi()` | [`app/composables/README.md`](app/composables/README.md) |
| `app/stores` | حالة الجلسة (`auth`) + تدفّق المصادقة على العميل | [`app/stores/README.md`](app/stores/README.md) |
| `app/components` | مكوّنات العرض (layout/content/home/ui) | [`app/components/README.md`](app/components/README.md) |
| `app/pages` | التوجيه + التخطيطات (layouts) + التدويل | [`app/pages/README.md`](app/pages/README.md) |
| `app/utils` | مساعدات نقيّة (نموذج الخطأ، التنسيق) | [`app/utils/README.md`](app/utils/README.md) |
| `server` | مسارات `Nitro` للبنية التحتية فقط (عرض Markdown) | [`server/README.md`](server/README.md) |

`app/middleware/auth.ts` و`app/types/` و`i18n/locales/` صغيرة وتُشرح ضمن الأدلّة أعلاه وهذا الدليل (تفاديًا للتكرار).

## 6. مسارات التشغيل الرئيسية

### 6.1 جلب البيانات (SSR)
النمط الموحّد: `useAsyncData(key, () => useApi()(...))`. مثال (`pages/index.vue`):
```ts
const { data } = await useAsyncData(`settings:site:${locale.value}`,
  () => api<Envelope<SiteSettings>>('/settings/site').then(r => r.data))
```
المفتاح (key) يتضمّن اللغة فيتخزّن كل عرض للّغة على حدة. **يُمنَع `useFetch`/`$fetch` الخام للـ API** — كل شيء عبر `useApi()` (قاعدة ESLint).

### 6.2 المصادقة والجلسة (على العميل)
- **الدخول:** `pages/dashboard/login.vue` → `auth.login()` → `POST /auth/login` → توكن في الذاكرة فقط (`D11-1`)، والكوكي httpOnly يملكها الـ API.
- **الحارس:** `middleware/auth.ts` (per-page عبر `definePageMeta`) يحاول تجديدًا صامتًا واحدًا عند غياب التوكن، وإلّا يوجّه إلى صفحة الدخول.
- **التجديد الصامت:** `useApi` يُعيد المحاولة مرّة واحدة عند 401 عبر `auth.refresh()`.
- **الأمان:** توكن الوصول في الذاكرة فقط (لا localStorage)، فلا يستطيع XSS سرقته أثناء الراحة. **الـ API هو المُفوِّض الحقيقي** — الحرّاس على العميل تجربة استخدام فقط (`D11-2`).

### 6.3 التدويل والاتجاه (i18n / RTL)
- `strategy: prefix_except_default` (en في الجذر، ar تحت `/ar`).
- ⚠ **`app.vue` لم يعد يكتب ترويسات اللغة بنفسه.** في وضع `i18n.experimental.strictSeo` (القرار `D22-7`) تملك وحدة `@nuxtjs/i18n` توليد `<html lang>`/`<html dir>` والبدائل اللغوية و`canonical` و`og:locale`/`og:url` **كوحدة واحدة**، و`useLocaleHead()` **مُزال** (الوحدة ترمي استثناءً عليه في هذا الوضع). يبقى `app.vue` مالكًا لحزمة لغة `Nuxt UI` (`<UApp :locale>`) وللوسوم الاجتماعية، ويبقى `useSetI18nParams()` مصدر خرائط الـ slug لكل لغة.
- `LocaleSwitcher` يستخدم `useSwitchLocalePath` مع `locale: false` على الـ `to` (وإلّا يُعيد `Nuxt UI` توطين المسار للّغة الحالية فيكسر تبديل ar→en).
- الأنماط تستخدم **الخصائص المنطقية (logical properties)** فقط (`ps/pe`, `ms/me`, `start/end`) ليعمل الانعكاس في RTL؛ يفرضها `scripts/check-logical-properties.mjs`.

### 6.4 عرض Markdown (SSR فقط)
جسم المقال يُعرَض عبر مكوّن واحد `ContentProse` (`components/content/Prose.vue`) الذي يفوّض إلى مسار `Nitro` داخلي `/api/prose`. هذا يُبقي `markdown-it` و`Shiki` (تلوين الشيفرة) **على الخادم فقط** فلا تصل JS التلوين إلى العميل (`D20-3`). الأمان: `html: false` — أي HTML خام في المصدر **يُهرَّب (escaped) لا يُفسَّر**، فلا يصل شيء خطير إلى الـ DOM (تفصيل في [`server/README.md`](server/README.md)).

### 6.5 نموذج الخطأ
كل حركة API تُطبَّع إلى `ApiError` واحد (من `RFC 7807 problem+json`). صفحات المحتوى تحوّل خطأ `useAsyncData` عبر `articleErrorParams` (404 حقيقي يبقى 404، وأي فشل آخر يحتفظ بحالته — لئلّا يُقنَّع 5xx كـ 404 غير مفهرس). التفاصيل في [`app/utils/README.md`](app/utils/README.md).

### 6.6 SEO
`useSeoMeta` لكل صفحة للعنوان والوصف والصورة والبيانات المهيكلة. أمّا `hreflang`/`canonical`/`og:locale`/`og:url` فتُولَّد داخليًّا بوحدة i18n في وضع `strictSeo` (`D22-7`) — **لا يُستدعى `useLocaleHead()`**. لوحة التحكّم وصفحات الخطأ `robots: noindex`.

## 7. عقد الواجهة ↔ الـ API (استهلاك العقد)

```
openapi/openapi.json (منسوخ من إصدار الـ API)
      → npm run api:types (openapi-typescript)
      → app/types/api.d.ts (مولّد — لا يُحرَّر يدويًّا)
      → app/types/models.ts (أسماء view-model مستقرّة فوق المولّد)
      → الصفحات/المكوّنات تستورد الأسماء المستقرّة
```

تبنّي أي تحديث للعقد هو **commit ذرّي واحد**: العقد + الأنواع المولّدة + التكيّف ([الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md)). أثناء التطوير بلا API حيّ: `npm run mock` (خادم `Prism` على العقد).

## 8. البيئة والإعداد

قيمتان عامّتان فقط، مُتحقَّق منهما عند الإقلاع عبر `runtimeConfig.public` (`.env.example`):
- `NUXT_PUBLIC_SITE_URL` — الأصل الرسمي للموقع (canonicals/hreflang/sitemap).
- `NUXT_PUBLIC_API_BASE` — أصل الـ API مع بادئة الإصدار (`…/api/v1`).

المضيفون **لا يعيشون في الكود** (env-driven، `D23-8`، [الوثيقة 16 §1](../eslammuatamed-docs/docs/16-development-conventions.md)). لا أسرار في `NUXT_PUBLIC_*`.

## 9. التطوير والاختبار · بوابات الجودة · النشر

```bash
npm run dev          # المنفذ 3000
npm run lint         # eslint (يشمل حدود العالمين + منع $fetch الخام)
npm run typecheck    # nuxt typecheck (vue-tsc)
npm test             # vitest
npm run mock         # خادم Prism على openapi/openapi.json (تطوير بلا API)
npm run api:types    # إعادة توليد الأنواع من العقد
npm run build && npm run check:bundle   # يمنع تسرّب المحرّر/العارض لحزم العميل
npm run check:logical                    # يمنع الأنماط الفيزيائية (RTL)
```

البوابات الأثقل (تحتاج بناءً أو متصفّحًا):

```bash
ANALYZE_BUNDLE=1 npm run build   # مطلوب قبل size:routes وإلّا خرج بالرمز 2 — فشل قياس، لا تجاوز ميزانية
npm run size                      # ميزانية الـ CSS العامّة (السقف 30,000 B gz، غير مرفوع)
npm run size:routes               # ميزانيات الـ JS لكل مسار (D20-31 عام · D20-32 للوحة التحكّم)
npm run test:e2e                  # Playwright + axe عبر 4 شظايا متتالية (≤4 أزواج معاينة/خلفية) — الافتراضي منذ إغلاق R14
npm run test:e2e:unsharded        # التشغيل القديم عالي التزامن (15 زوجًا دفعة واحدة) — للتشخيص وإعادة إنتاج R15 فقط، ليس المسار الموصى به
npm run typecheck:e2e             # أنواع مجموعة e2e
```

**CI** (`.github/workflows/ci.yml`) يشغّل: تثبيت الاعتماديات → التحقّق أنّ `api:types` نقطة ثابتة → lint → typecheck → typecheck:e2e → الاختبارات → البناء → `size` و`size:routes` → `check:bundle` → `check:logical` → Lighthouse المحكومة (16 مسارًا، ملفّا mobile وdesktop)، ثم مهمّة Playwright + axe منفصلة.

**النشر:** `deploy.yml` على `Contabo VPS`، آليًّا من `main`. ⚠ مهمّة `verify` في مسار النشر **ليست نسخة من `ci.yml`**: هي تشغّل `size` و`size:routes` على البناء المتّجه للإنتاج (بلا `continue-on-error`)، لكنها **لا** تشغّل Lighthouse ولا مجموعة e2e — هاتان بوّابتان تُفرَضان عند الدخول إلى `main` لا عند الخروج منه. التفاصيل في [الوثيقة 23](../eslammuatamed-docs/docs/23-deployment.md).

## 10. قرارات عرضية

- **عالمان (`D06-1`):** الموقع العام SSR، لوحة التحكّم عميل-فقط ومعزولة بالكامل.
- **باب API وحيد (`D06-2`, `principle 12`):** كل حركة عبر `useApi()`؛ لا Axios، لا `$fetch` خام للـ API.
- **الأنواع مولّدة (`D06-2`):** من العقد، لا تُكتب يدويًّا.
- **رموز تصميم دلالية + خصائص منطقية (`D14`, `D15-3`):** لا ألوان خام، لا يسار/يمين فيزيائي.
- **Official Documentation Over Habit (`principle 16`):** يُنفَّذ من توثيق `Nuxt`/`Nuxt UI`/`Pinia` الحالي؛ مبني على `Nuxt UI` أوّلًا قبل أي بديل يدوي.

## 11. ملخّص مراجعة التوافق

قِيس كل نمط ضدّ التوثيق الرسمي بالإصدار المُثبَّت. التصنيفات: `Compatible` / `Intentional documented deviation` / `Unexplained deviation`. **لم يُرصَد أي انحراف غير مُفسَّر.**

⚠ **آخر مراجعة توافق شاملة جرت على مكدّس M1 (`nuxt` 4.4.x).** حُدِّثت الصفوف التي أبطلها تحديث Campaign 026 فقط؛ **الجدول ككل لم يُعَد قياسه بندًا ببند على `nuxt` 4.5.2**. إعادة المراجعة الشاملة جزء من حملة `Web Learnability & Maintainability Pass` المؤجَّلة، لا ادّعاء قائم هنا.

| النمط | الملفات | التصنيف | المرجع الرسمي |
|---|---|---|---|
| جلب البيانات: `useAsyncData` يلفّ `useApi` | `pages/**`, `composables/useApi.ts` | `Compatible` (باب-واحد اتفاقية مشروع `D06-2`) | [Nuxt data fetching](https://nuxt.com/docs/getting-started/data-fetching) |
| متجر `Pinia` بنمط setup | `stores/auth.ts` | `Compatible` | [Pinia setup stores](https://pinia.vuejs.org/core-concepts/#setup-stores) |
| `@nuxtjs/i18n` **10.6.0** (`prefix_except_default`, `useSwitchLocalePath`, `useSetI18nParams`, و`experimental.strictSeo`) | `nuxt.config.ts`, `app.vue`, `components/layout/*`, `pages/blog/[slug].vue` | `Intentional documented deviation` (علَم تجريبي مقبول عمدًا، `D22-7`) | [Nuxt i18n](https://i18n.nuxtjs.org/) |
| استخراج الحمولة: `experimental.payloadExtraction: 'client'` | `nuxt.config.ts` | `Intentional documented deviation` (`D06-8` — اختير للصحّة لا للأداء) | [Nuxt experimental features](https://nuxt.com/docs/guide/going-further/experimental-features) |
| `Nuxt UI` **4.10.0** (`UApp :locale`, `UForm` + zod Standard Schema) | `app.vue`, `pages/dashboard/login.vue` | `Compatible` | [Nuxt UI](https://ui.nuxt.com/) |
| `useColorMode` + `ClientOnly` (بلا وميض) | `components/layout/ThemeToggle.vue` | `Compatible` | [Nuxt UI color mode](https://ui.nuxt.com/getting-started/color-mode/nuxt) |
| SEO: `useSeoMeta` (العنوان/الوصف/الصورة/البيانات المهيكلة) + ترويسات اللغة المولَّدة بـ `strictSeo` | `app.vue`, `pages/**` | `Compatible` | [Nuxt SEO](https://nuxtseo.com/) |
| عرض Markdown: `markdown-it` `html:false` + `Shiki` عبر `Nitro` | `server/**`, `components/content/Prose.vue` | `Compatible` (بديل markdown-it الآمن الافتراضي) — انظر ملاحظة أدناه | [markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md) |
| `runtimeConfig` مدفوع بالبيئة | `nuxt.config.ts` | `Compatible` | [Nuxt runtimeConfig](https://nuxt.com/docs/guide/going-further/runtime-config) |
| أنواع مولّدة من العقد | `app/types/*` | `Compatible` | [openapi-typescript](https://openapi-ts.dev/) |

**ملاحظة أمنية للمالك:** يصف [الوثيقة 19 §5 (D19-5)](../eslammuatamed-docs/docs/19-security.md) عرض Markdown بأنه «مُعقِّم بقائمة سماح (allowlist sanitizer)»، بينما تنفيذ M1 يحقّق الخصائص الأمنية عبر `html: false` (منع XSS) + **بادئة `user-content-` الثابتة على مراسي العناوين** (منع DOM clobbering، مطبَّقة في `markdown.ts`) — **دون** مكتبة تعقيم. الآلية تختلف عن صياغة الوثيقة 19 §5 فتستحقّ مصالحة doc-first لتلك الصياغة (القرار للمالك). **القاعدة المستقبلية:** إن سُمِح يومًا بـ HTML خام (`html: true`)، فمُعقِّم بقائمة سماح يصبح إلزاميًّا. التفصيل في [`server/README.md`](server/README.md).

## 12. مخاطر معلومة وعمل مؤجَّل

⚠ **صُحِّح في 2026-08-17.** كانت هذه القائمة تصف روابط Header/Footer تُرجِع 404 و`/rss.xml` مفقودًا كـ«مخاطر»؛ الصفحات الأربع بُنيت ونُشرت منذ ذلك الحين. ما يلي هو الحالة المقيسة الآن.

- **`/projects/content-platform-api` وتوأمه `/ar` يُرجِعان 404 في الإنتاج.** ⚠ **فجوة محتوى سابقة للحملة، وليست انحدارًا**: مطابقة لخطّ الأساس قبل النشر — أمر `content:sync` لم يُشغَّل قطّ.
- **`Tiptap` مُعلَن ولا يُستخدَم:** تبعيات المحرّر حاضرة؛ `check:bundle` يمنع تسرّبها إلى أي حزمة عميل عامّة.
- **صور OG معطّلة** (`ogImage.enabled=false`).
- **`/uses` مؤجَّلة بقرار `D24-7`**، ووحدة المقالات في لوحة التحكّم و`/rss.xml` غير مبنيّتين (§3).
- **العطل المعروف رقم 30** — `test:e2e:repeat` أحمر بحكم التصميم بسبب خلل ترطيب (hydration) سابق. **خارج نطاق Campaign 026 صراحةً**، ولا يُكتَم ولا يُكرَّر.
- **ميزانية الـ CSS ضيّقة:** انتهت الحملة عند **29.08 kB gz** مقابل سقف **30,000 B** لم يُرفَع. أي عمل بصري جديد يجب أن يُقاس قبل الالتزام به.
- **ازدواج `@unhead/vue` v2/v3 — ملك المنبع (upstream)، لا عيب في التطبيق.** `nuxt` 4.5.2 انتقل إلى v3 بينما `@nuxt/ui` 4.10.0 ما يزال يثبّت `^2.1.15`، فيُشحَن الإصداران معًا (~52 KB قبل التصغير). لا إصدار منشور من `@nuxt/ui` يحلّها، والحلّ الوحيد المتاح محليًّا (`overrides` لفرض إصدار رئيسي) **ممنوع بالسياسة**. **لا تنسب هذه البايتات إلى أي صفحة.**
- ⚠ **لا تقتبس أي عدد ثغرات من سجلّات الحملة على أنه الحالة الأمنية الحاليّة.** يجب إعادة العدّ من واجهة Dependabot المُصفَّحة **مع** `npm audit`، مع الإبلاغ عن الفارق بين الأداتين ([الوثيقة 19 §7d](../eslammuatamed-docs/docs/19-security.md)).

## 13. مسار تعديل آمن + ترتيب قراءة مقترح

**عند التعديل:** (1) إن ناقض العمل وثيقة حاكمة، نقّح الوثيقة أولًا. (2) فرع `feat/…`/`fix/…`. (3) شغّل `lint`/`typecheck`/`test` + `check:bundle`/`check:logical` عند الأنماط. (4) تحقّق من **اللغتين** (en/ar) وسلوك a11y لأي تغيير واجهة. (5) commit ذرّي عبر PR ([الوثيقة 17](../eslammuatamed-docs/docs/17-git-workflow.md)).

**ترتيب القراءة للمطوّر الجديد:**
1. هذا الدليل.
2. [`app/composables/README.md`](app/composables/README.md) (باب الـ API) → [`app/stores/README.md`](app/stores/README.md) (الجلسة).
3. [`app/pages/README.md`](app/pages/README.md) (التوجيه + التخطيطات + i18n) → [`app/components/README.md`](app/components/README.md).
4. [`server/README.md`](server/README.md) (عرض Markdown) → [`app/utils/README.md`](app/utils/README.md).

## 14. روابط التوثيق الرسمي

- [Nuxt](https://nuxt.com/docs) · [Nuxt UI](https://ui.nuxt.com/) · [Tailwind CSS v4](https://tailwindcss.com/docs) · [Vue](https://vuejs.org/) · [Pinia](https://pinia.vuejs.org/) · [Nuxt i18n](https://i18n.nuxtjs.org/) · [Nuxt SEO](https://nuxtseo.com/) · [Nuxt Image](https://image.nuxt.com/) · [zod](https://zod.dev/) · [markdown-it](https://github.com/markdown-it/markdown-it) · [Shiki](https://shiki.style/)
- الوثائق الحاكمة: [00](../eslammuatamed-docs/docs/00-engineering-principles.md) · [06](../eslammuatamed-docs/docs/06-frontend-architecture.md) · [08](../eslammuatamed-docs/docs/08-folder-structure.md) · [11](../eslammuatamed-docs/docs/11-dashboard-architecture.md) · [14](../eslammuatamed-docs/docs/14-design-tokens.md) · [16](../eslammuatamed-docs/docs/16-development-conventions.md) · [19](../eslammuatamed-docs/docs/19-security.md) · [20](../eslammuatamed-docs/docs/20-performance.md) · [24](../eslammuatamed-docs/docs/24-roadmap.md)
