# دليل المشروع — `eslammuatamed-web`

> **الحالة:** أساس مستقرّ (Stable baseline) مُشتقّ من `origin/main` عند `156e11d`.
> **آخر مراجعة:** 2026-07-18.
> **لمن هذا الدليل:** مطوّر `Vue`/`Nuxt` يتعلّم بنية هذا المشروع تحديدًا. الشرح بالعربية، وكل مُعرّف تقني يبقى بالإنجليزية كما في الكود.
> **قاعدة الحالة:** يصف هذا الدليل **الكود المُسلَّم (Shipped) على `main` فقط** — وهو الهيكل الماشي لمرحلة M1 (Feature 001) مع تبنّي عقد الـ API `v0.1.1`. لوحة التحكّم الكاملة (CMS) ومعظم الصفحات العامّة `Planned`، ولا تُوصَف هنا كأنها موجودة.

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

**`Shipped` (على `main`، مُنشور — الهيكل الماشي M1 + تبنّي العقد):**
- **عام:** الصفحة الرئيسية (hero من `GET /settings/site`)، قائمة المدوّنة (`GET /articles` مع ترقيم)، صفحة المقال (`GET /articles/{slug}` + عرض Markdown)، تبديل اللغة (en/ar RTL)، تبديل السمة (light/dark)، صفحة الخطأ، ترويسات SEO الأساسية.
- **لوحة التحكّم:** هيكل عميل-فقط (تسجيل دخول + صفحة overview مبدئية)، مصادقة كاملة (login/refresh/logout، توكن في الذاكرة).
- **بنية تحتية:** باب الـ API الوحيد `useApi()`، الأنواع المولّدة من العقد، حدود ESLint (منع Axios / منع استيراد الـ dashboard من العام / منع `$fetch` الخام للـ API)، فحصا `check-forbidden-modules` و`check-logical-properties`، الـ CI.

**`Planned` (غير مبنيّة على `main`):**
- **لوحة التحكّم الكاملة (CMS)** — الشريط الجانبي، وحدات المحتوى، محرّر `Tiptap`، تبويبات الترجمة، مكتبة الوسائط، وحدة SEO، صندوق الرسائل، إدارة الأدوار (Feature web-002).
- **الصفحات العامّة المتبقّية** — `/projects`, `/experience`, `/about`, `/resume`, `/contact` (مرتبطة في الـ Header/Footer لكنها **تُرجِع 404 حتى تُبنَ**)، و`/uses` (مُخطَّطة، غير مرتبطة بعد)، التصميم الكامل، وصل SEO (JSON-LD، sitemap، RSS)، تدفّق التواصل (Feature web-003).
- **تصليب الإطلاق** — ميزانيات الأداء في الـ CI، مصفوفة a11y، تحليلات الحقل (Feature web-004).

**`Deferred` (مؤجّلة بقرار):**
- توليد صور OG (`ogImage: { enabled: false }` في `nuxt.config.ts` — خارج بناء M1).
- محرّر `Tiptap` — تبعياته **مُعلَنة مسبقًا (declared-ahead-of-use)** لكنها **غير مستورَدة في أي مكان على هذا الأساس**؛ يفرض `scripts/check-forbidden-modules.mjs` ألّا تتسرّب إلى أي حزمة عميل عامّة (`D06-5`).

> **ملاحظة تشبه نظير الـ API:** كما أن الـ API «schema-complete»، فإن `web` هنا «dependency-ahead» في نقطتين: تبعيات `Tiptap` موجودة قبل بناء المحرّر، والـ Header/Footer يربطان صفحات لم تُبنَ بعد. هذه سمات الهيكل الماشي، لا عيوب.

## 4. المكدّس والمكتبات المهمة (ولماذا)

`Node 24` (`.nvmrc`)، `TypeScript 5.9` صارم (`noUncheckedIndexedAccess`، doc 15 §1).

| المكتبة | لماذا هي موجودة |
|---|---|
| `nuxt` (4.4) | الإطار: توجيه ملفّي، SSR/Nitro، auto-imports، `runtimeConfig` |
| `@nuxt/ui` (4.9) | مكتبة مكوّنات فوق `Tailwind v4` — الأساس المرئي (`UApp`, `UForm`, `UButton`…) |
| `tailwindcss` (v4) | نظام الأنماط (رموز التصميم الدلالية، doc 14) |
| `@pinia/nuxt` + `pinia` | إدارة الحالة (متجر الجلسة `auth`) |
| `@nuxtjs/i18n` (v10) | التدويل: `prefix_except_default` (en في الجذر، ar تحت `/ar`)، RTL كبيانات |
| `@nuxt/image` | صور مُحسَّنة عبر `<NuxtImg>` (doc 06) — **مُهيّأ مسبقًا، غير مستخدَم على هذا الأساس** (كـ `Tiptap`) |
| `@nuxtjs/seo` | ترويسات SEO، hreflang، sitemap، robots |
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

عزل العالمين مفروض **آليًّا**: `routeRules` تجعل `/dashboard/**` و`/ar/dashboard/**` بـ `ssr:false`؛ وقاعدة ESLint تمنع الكود العام من استيراد أي وحدة `dashboard/**`؛ وفحص البناء `check-forbidden-modules` يمنع تسرّب المحرّر/العارض إلى حزم العميل العامّة.

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
- `app.vue` يضبط `<html lang dir>` لكل لغة (عبر `useLocaleHead` + `htmlAttrs`) ويمرّر حزمة لغة `Nuxt UI` (`<UApp :locale>`).
- `LocaleSwitcher` يستخدم `useSwitchLocalePath` مع `locale: false` على الـ `to` (وإلّا يُعيد `Nuxt UI` توطين المسار للّغة الحالية فيكسر تبديل ar→en).
- الأنماط تستخدم **الخصائص المنطقية (logical properties)** فقط (`ps/pe`, `ms/me`, `start/end`) ليعمل الانعكاس في RTL؛ يفرضها `scripts/check-logical-properties.mjs`.

### 6.4 عرض Markdown (SSR فقط)
جسم المقال يُعرَض عبر مكوّن واحد `ContentProse` (`components/content/Prose.vue`) الذي يفوّض إلى مسار `Nitro` داخلي `/api/prose`. هذا يُبقي `markdown-it` و`Shiki` (تلوين الشيفرة) **على الخادم فقط** فلا تصل JS التلوين إلى العميل (`D20-3`). الأمان: `html: false` — أي HTML خام في المصدر **يُهرَّب (escaped) لا يُفسَّر**، فلا يصل شيء خطير إلى الـ DOM (تفصيل في [`server/README.md`](server/README.md)).

### 6.5 نموذج الخطأ
كل حركة API تُطبَّع إلى `ApiError` واحد (من `RFC 7807 problem+json`). صفحات المحتوى تحوّل خطأ `useAsyncData` عبر `articleErrorParams` (404 حقيقي يبقى 404، وأي فشل آخر يحتفظ بحالته — لئلّا يُقنَّع 5xx كـ 404 غير مفهرس). التفاصيل في [`app/utils/README.md`](app/utils/README.md).

### 6.6 SEO
`useSeoMeta` لكل صفحة + `useLocaleHead` (hreflang/canonical) في `app.vue`. لوحة التحكّم وصفحات الخطأ `robots: noindex`.

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

**CI** (`.github/workflows/ci.yml`) يشغّل lint/typecheck/test، والبناء + فحوص العزل. **النشر:** `deploy.yml` على `Contabo VPS`. التفاصيل في [الوثيقة 23](../eslammuatamed-docs/docs/23-deployment.md).

## 10. قرارات عرضية

- **عالمان (`D06-1`):** الموقع العام SSR، لوحة التحكّم عميل-فقط ومعزولة بالكامل.
- **باب API وحيد (`D06-2`, `principle 12`):** كل حركة عبر `useApi()`؛ لا Axios، لا `$fetch` خام للـ API.
- **الأنواع مولّدة (`D06-2`):** من العقد، لا تُكتب يدويًّا.
- **رموز تصميم دلالية + خصائص منطقية (`D14`, `D15-3`):** لا ألوان خام، لا يسار/يمين فيزيائي.
- **Official Documentation Over Habit (`principle 16`):** يُنفَّذ من توثيق `Nuxt`/`Nuxt UI`/`Pinia` الحالي؛ مبني على `Nuxt UI` أوّلًا قبل أي بديل يدوي.

## 11. ملخّص مراجعة التوافق

قِيس كل نمط ضدّ التوثيق الرسمي بالإصدار المُثبَّت. التصنيفات: `Compatible` / `Intentional documented deviation` / `Unexplained deviation`. **لم يُرصَد أي انحراف غير مُفسَّر.**

| النمط | الملفات | التصنيف | المرجع الرسمي |
|---|---|---|---|
| جلب البيانات: `useAsyncData` يلفّ `useApi` | `pages/**`, `composables/useApi.ts` | `Compatible` (باب-واحد اتفاقية مشروع `D06-2`) | [Nuxt data fetching](https://nuxt.com/docs/getting-started/data-fetching) |
| متجر `Pinia` بنمط setup | `stores/auth.ts` | `Compatible` | [Pinia setup stores](https://pinia.vuejs.org/core-concepts/#setup-stores) |
| `@nuxtjs/i18n` v10 (`prefix_except_default`, `useSwitchLocalePath`, `useSetI18nParams`, `useLocaleHead`) | `nuxt.config.ts`, `app.vue`, `components/layout/*`, `pages/blog/[slug].vue` | `Compatible` | [Nuxt i18n](https://i18n.nuxtjs.org/) |
| `Nuxt UI 4` (`UApp :locale`, `UForm` + zod Standard Schema) | `app.vue`, `pages/dashboard/login.vue` | `Compatible` | [Nuxt UI](https://ui.nuxt.com/) |
| `useColorMode` + `ClientOnly` (بلا وميض) | `components/layout/ThemeToggle.vue` | `Compatible` | [Nuxt UI color mode](https://ui.nuxt.com/getting-started/color-mode/nuxt) |
| SEO: `useSeoMeta` + `useLocaleHead` | `app.vue`, `pages/**` | `Compatible` | [Nuxt SEO](https://nuxtseo.com/) |
| عرض Markdown: `markdown-it` `html:false` + `Shiki` عبر `Nitro` | `server/**`, `components/content/Prose.vue` | `Compatible` (بديل markdown-it الآمن الافتراضي) — انظر ملاحظة أدناه | [markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md) |
| `runtimeConfig` مدفوع بالبيئة | `nuxt.config.ts` | `Compatible` | [Nuxt runtimeConfig](https://nuxt.com/docs/guide/going-further/runtime-config) |
| أنواع مولّدة من العقد | `app/types/*` | `Compatible` | [openapi-typescript](https://openapi-ts.dev/) |

**ملاحظة أمنية للمالك:** يصف [الوثيقة 19 §5 (D19-5)](../eslammuatamed-docs/docs/19-security.md) عرض Markdown بأنه «مُعقِّم بقائمة سماح (allowlist sanitizer)»، بينما تنفيذ M1 يحقّق الخصائص الأمنية عبر `html: false` (منع XSS) + **بادئة `user-content-` الثابتة على مراسي العناوين** (منع DOM clobbering، مطبَّقة في `markdown.ts`) — **دون** مكتبة تعقيم. الآلية تختلف عن صياغة الوثيقة 19 §5 فتستحقّ مصالحة doc-first لتلك الصياغة (القرار للمالك). **القاعدة المستقبلية:** إن سُمِح يومًا بـ HTML خام (`html: true`)، فمُعقِّم بقائمة سماح يصبح إلزاميًّا. التفصيل في [`server/README.md`](server/README.md).

## 12. مخاطر معلومة وعمل مؤجَّل

- **روابط لصفحات غير مبنيّة:** الـ Header/Footer يربطان `/projects`, `/experience`, `/about`, `/resume`, `/contact` — تُرجِع 404 حتى تُبنَ (Feature web-003). (`/uses` مُخطَّطة أيضًا لكنها غير مرتبطة بعد.)
- **`Tiptap` مُعلَن ولا يُستخدَم:** تبعيات المحرّر حاضرة؛ فحص البناء يمنع تسرّبها للعميل.
- **RSS (`/rss.xml`) يُرجِع 404** حتى ميزة الموقع العام.
- **صور OG معطّلة** في M1 (`ogImage.enabled=false`).

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
