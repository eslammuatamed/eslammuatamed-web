# `app/composables` — باب الـ API الوحيد

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. هذا المجلد صغير لكنه **محوري**: كل حركة نحو الـ backend تمرّ من هنا.

## المسؤولية

`useApi()` هو **الباب الوحيد** للـ NestJS API (`D06-2`، `principle 12`). يوحّد: الأصل من البيئة، الـ bearer token من متجر الجلسة، إضافة `?locale=` على قراءات GET، شكل خطأ واحد (`RFC 7807`)، وإعادة محاولة تجديد صامتة واحدة عند 401.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `useApi.ts` | يبني عميل `$fetch` مُهيّأ ويُرجِع دالّة `apiFetch<T>` |

## خريطة الاتصال

- **وارد:** كل صفحة/متجر يستدعي `useApi()`. أمثلة: `stores/auth.ts` (login/refresh/logout)، `pages/index.vue` (`/settings/site`)، `pages/blog/**` (`/articles`).
- **صادر:** `useRuntimeConfig` (الأصل)، `useAuthStore` (التوكن)، `useNuxtApp().$i18n` (اللغة الحالية)، ومساعد `requestWithRefreshRetry` من `utils/api-error.ts`.
- **يُنفَّذ الحظر:** أي `$fetch`/`useFetch` خام نحو الـ API خطأ ESLint (`no-restricted-syntax` في `eslint.config.mjs`، doc 15 §2)؛ `useApi.ts` هو الاستثناء الوحيد على مستوى الإعداد. أمّا المسارات الداخلية لـ `Nitro` (مثل `/api/prose` الذي يستدعيه `ContentProse`) فمُعفاة عبر `eslint-disable` سطري موجَّه يستشهد بالاستثناء — لأنها ليست الـ backend API بل بنية تحتية داخلية.

## التدفّق

```
useApi() → $fetch.create({ baseURL: apiBase, credentials: 'include', onRequest })
  onRequest:
    - GET؟ → options.query = { locale: $i18n.locale.value, ...query }   // قراءات مُوطَّنة (D10-6)
    - auth.accessToken موجود؟ → Header: Authorization: Bearer <token>
  apiFetch<T>(request, options):
    - isAuthRoute = request.startsWith('/auth/')   // لا نُجدِّد على مسار التجديد نفسه
    → requestWithRefreshRetry(() => client<T>(...), () => auth.refresh(), { retry: !isAuthRoute })
```

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **لماذا `$i18n` من `useNuxtApp()` لا `useI18n()`؟** لأن `useApi()` يُستدعى أيضًا **خارج** سياق setup (من إجراءات المتجر ومن الـ middleware)، حيث يرمي `useI18n()` خطأ `MUST_BE_CALL_SETUP_TOP`. الوصول عبر `$i18n` هو النمط الموثّق الآمن لهذا السياق (`principle 16`).
- **`credentials: 'include'`** يُرسِل كوكي التجديد؛ same-site في كل بيئة (`D19-3`)، فإرساله على القراءات العامّة غير ضارّ ويُبقي إعداد العميل واحدًا.
- **`credentials`/التوكن معًا:** التوكن في ترويسة `Authorization` (وصول)، والكوكي httpOnly (تجديد) — فصل مقصود (`D11-1`).

## العقود والثوابت

- لا يُعيد `useApi` المحاولة على مسارات `/auth/*` (401 هناك = الجلسة انتهت فعلًا).
- الأنواع المُعادة تأتي من `~/types/models` (فوق العقد المولّد) — لا أشكال يدويّة.

## أخطاء شائعة

- استدعاء `$fetch`/`useFetch` للـ API مباشرةً — خطأ ESLint؛ استخدم `useApi()` داخل `useAsyncData`.
- استدعاء `useI18n()` داخل كود يعمل خارج setup — استخدم النمط القائم في `useApi`.

## المرجع الرسمي وحالة التوافق

- [Nuxt data fetching](https://nuxt.com/docs/getting-started/data-fetching) · [Nuxt `$fetch`/ofetch](https://nuxt.com/docs/api/utils/dollarfetch) · [Nuxt i18n `$i18n`](https://i18n.nuxtjs.org/docs/composables/use-i18n).

**حالة التوافق:** `Compatible`. `$fetch.create` مع `onRequest` هو النمط الرسمي لتخصيص عميل الطلبات؛ وتغليف كل ذلك في «باب واحد» اختيار مشروع مُوثّق (`D06-2`, `principle 12`) لا يخالف الإطار. **لا انحراف.**
