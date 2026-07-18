# `app/utils` — مساعدات نقيّة (Nuxt-free)

> اقرأ [`PROJECT_GUIDE.md`](../../PROJECT_GUIDE.md) أولًا. القاعدة ([الوثيقة 08](../../../eslammuatamed-docs/docs/08-folder-structure.md)): `utils/` **نقيّ** — لا يلمس سياق `Nuxt`؛ أي شيء يحتاج سياق التطبيق يذهب إلى `composables/`. فائدة النقاء: اختبار وحدة بلا تشغيل `Nuxt`.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `api-error.ts` | `ApiError` (من `RFC 7807`) + `toApiError` + `isUnauthorized` + `requestWithRefreshRetry` |
| `article-error.ts` | `articleErrorParams` — يحوّل فشل جلب المقال إلى `{ status, statusText }` |
| `format.ts` | `formatDate` عبر `Intl` (بلا مكتبة تواريخ) |

## خريطة الاتصال

- **وارد:** `composables/useApi.ts` (يستخدم `requestWithRefreshRetry`)، `pages/dashboard/login.vue` (`toApiError`)، `pages/blog/[slug].vue` (`articleErrorParams`)، بطاقات/صفحات المحتوى (`formatDate`).
- **صادر:** أنواع من `~/types/models` فقط. **لا استيراد من `Nuxt`.**

## التفاصيل

### `api-error.ts` — نموذج الخطأ الموحّد
- `ApiError`: صنف يحمل `status`/`type`/`detail`/`fieldErrors` من جسم `problem+json`، و`fieldErrorMap()` يحوّل أخطاء 422 إلى شكل حقول `UForm` (`doc 11 §4`).
- `toApiError(error)`: يُطبِّع أي قيمة مرميّة (`FetchError` من ofetch، أو `ApiError`، أو مجهول) إلى `ApiError`.
- `requestWithRefreshRetry(send, refresh, { retry })`: يشغّل `send`؛ عند 401 واحد يحاول `refresh` مرّة ثم يعيد التشغيل؛ أي فشل يهرب يُطبَّع إلى `ApiError`. **مفصول عن `useApi` كي يُختبَر قرار إعادة المحاولة بلا سياق `Nuxt`.**

### `article-error.ts` — سلامة SEO
`articleErrorParams`: 404 حقيقي يبقى 404، وأي فشل آخر (5xx/نقل) **يحتفظ بحالته الحقيقية** — كي لا يُقنَّع خطأ عابر كـ «غير موجود» فيُزال من الفهرسة (review MAJOR-1). `Nuxt` يلتقط رمي معالج `useAsyncData` في `error` (لا يُعيد رميه)، فتحوّله الصفحة صراحةً بعد الـ await.

### `format.ts`
`formatDate(value, locale)` عبر `Intl.DateTimeFormat` بنظام أرقام `latn` مثبّت حتى في `ar` (`D03-4`) — أرقام عربية غربية في اللغتين.

## الاختبارات وما تُثبته

`api-error.spec.ts` (تطبيع الأخطاء، منطق إعادة المحاولة) و`article-error.spec.ts` (خريطة 404 مقابل الحفاظ على الحالة) — كلاهما بلا سقالة صفحة، بفضل النقاء.

## أخطاء شائعة

- استيراد شيء من `Nuxt` هنا — انقله إلى `composables/`.
- تحويل كل فشل جلب إلى 404 — يزيل صفحات صالحة من الفهرسة.

## المرجع الرسمي وحالة التوافق

- [MDN `Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) · [Nuxt error handling](https://nuxt.com/docs/getting-started/error-handling) · [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807).

**حالة التوافق:** `Compatible`. مساعدات نقيّة + `Intl` (بلا مكتبة تواريخ) + تطبيع خطأ `RFC 7807` أنماط قياسية تخدم `principle 12/14`. **لا انحراف.**
