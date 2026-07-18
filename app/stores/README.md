# `app/stores` — حالة الجلسة والمصادقة (Pinia)

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) و[`app/composables/README.md`](../composables/README.md) أولًا. التصميم الحاكم في [الوثيقة 11 (Dashboard Architecture)](../../../eslammuatamed-docs/docs/11-dashboard-architecture.md).

## المسؤولية

متجر `Pinia` واحد (`auth`) يحمل حالة جلسة لوحة التحكّم (عميل-فقط). يغطّي هذا الدليل أيضًا **تدفّق المصادقة** الذي يمسّ الحارس `middleware/auth.ts`.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `auth.ts` | متجر `auth` بنمط setup: `accessToken`, `user`, `isAuthenticated`, و`login`/`refresh`/`logout` |

ملفّ متّصل خارج المجلد: `app/middleware/auth.ts` — حارس المسار لكل صفحة dashboard.

## خريطة الاتصال

- **وارد:** `pages/dashboard/login.vue` (`login`)، `layouts/dashboard.vue` (`logout`, `user`)، `middleware/auth.ts` (`isAuthenticated`, `refresh`)، و`useApi` يقرأ `accessToken` ويستدعي `refresh` عند 401.
- **صادر:** `useApi` (نداءات `/auth/*`)، وأنواع من `~/types/models`.

## التدفّق: الجلسة والتجديد الصامت (F-D1)

```
login(credentials) → POST /auth/login → setSession({ accessToken, user })
refresh()          → POST /auth/refresh → يضبط accessToken فقط (لا user) ؛ يُرجِع نجاحًا/فشلًا، لا يرمي
logout()           → POST /auth/logout (finally: clearSession)

middleware/auth (client-only، per-page عبر definePageMeta):
  !isAuthenticated؟ → await refresh()   // محاولة استعادة صامتة عند إعادة التحميل
  ما زال غير مُصادَق؟ → navigateTo('/dashboard/login')
```

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **التوكن في الذاكرة فقط (`D11-1`):** `accessToken` في `ref` — لا `localStorage` ولا كوكي قابلة للقراءة. فحتى لو وقع XSS لا يجد توكنًا مُخزَّنًا يسرقه. إعادة تحميل الصفحة تفقد التوكن، فتستعيده جولة `refresh()` صامتة واحدة (الكوكي httpOnly يملكها الـ API).
- **`refresh()` لا يرمي:** يُرجِع boolean ويُنظّف الجلسة عند الفشل — كي يستطيع الحارس والـ `useApi` التفرّع عليه بلا try/catch متكرّر.
- **الحارس على العميل تجربة استخدام لا أمان (`D11-2`):** المُفوِّض الحقيقي هو الـ API؛ الحارس يمنع وميض محتوى محمي فقط. لذا هو per-page (عبر `definePageMeta`) لا عام — فلا يتسرّب منطق لوحة التحكّم إلى المسارات العامّة.
- **`refresh` لا يحمل `user`:** عقد التجديد يدوّر التوكن فقط (خلافًا لـ login)، فنحتفظ بالـ `user` القائم.

## العقود والثوابت

- `isAuthenticated = accessToken !== null`.
- كل نداءات `/auth/*` عبر `useApi()` (لا تُجدَّد تلقائيًّا — انظر باب الـ API).

## الاختبارات

المتجر مغطّى عبر اختبارات المكوّنات المستهلِكة له (login) واختبارات `utils/api-error` (منطق إعادة المحاولة).

## أخطاء شائعة

- تخزين التوكن في `localStorage` — يكسر `D11-1`.
- جعل الحارس عامًّا — يسرّب منطق لوحة التحكّم للعام (`D06-1`).

## المرجع الرسمي وحالة التوافق

- [Pinia setup stores](https://pinia.vuejs.org/core-concepts/#setup-stores) · [Nuxt route middleware](https://nuxt.com/docs/guide/directory-structure/middleware) · [definePageMeta](https://nuxt.com/docs/api/utils/define-page-meta).

**حالة التوافق:** `Compatible`. متجر `Pinia` بنمط setup + `defineNuxtRouteMiddleware` per-page عبر `definePageMeta` أنماط رسمية حالية. توكن-في-الذاكرة اختيار أمني مُوثّق (`D11-1`). **لا انحراف.**
