# `server` — مسارات `Nitro` للبنية التحتية فقط

> اقرأ [`PROJECT_GUIDE.md`](../PROJECT_GUIDE.md) أولًا. القاعدة الحاكمة ([الوثيقة 08 §1](../../eslammuatamed-docs/docs/08-folder-structure.md)): **`server/` للبنية التحتية للعرض فقط، لا منطق عمل** — الـ NestJS API يملك بيانات العمل، ووضع نقطة عمل هنا يشقّ الـ backend ويخالف [الوثيقة 00 §3](../../eslammuatamed-docs/docs/00-engineering-principles.md).

## المسؤولية

طبقة `Nitro` (خادم Nuxt المدمج). على هذا الأساس مسؤوليتها الوحيدة: **عرض Markdown → HTML على الخادم**، كي يبقى `markdown-it` و`Shiki` (تلوين الشيفرة) خارج حزم العميل (`D20-3`).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `api/prose.post.ts` | نقطة `POST /api/prose`: تتحقّق من الجسم (zod، سقف 256 KiB) وتُرجِع `{ html }` |
| `utils/markdown.ts` | `renderMarkdown(source)` — `markdown-it` + `Shiki`، مع مرساة العناوين وروابط خارجية آمنة |

## خريطة الاتصال

- **وارد:** `components/content/Prose.vue` (`ContentProse`) هو **المستدعي الوحيد** لـ `/api/prose`.
- **صادر:** `markdown-it`, `@shikijs/markdown-it`.

## التدفّق

```
ContentProse (source) → useAsyncData → POST /api/prose { source }
  → readValidatedBody(zod: source ≤ 262144)      // 256 KiB، يطابق سقف حقل الـ API (doc 19 §5)
  → renderMarkdown(source)  →  { html }
  → ContentProse يعرضه عبر v-html
```

`renderMarkdown` يُنشئ العارض **مرّة واحدة** (memoized) ويعيد استخدامه؛ يحمّل مجموعة لغات مُنتقاة (~15) لا الحزمة الكاملة (~200) لتسريع أول عرض؛ ولغة غير مدرجة تسقط إلى نصّ عادي (`fallbackLanguage`) لا إلى خطأ.

## نقطة أمنية جوهرية (شرح لمطوّر مبتدئ)

`Prose.vue` يستخدم `v-html` — وهو عادةً خطر XSS. لماذا هو آمن هنا؟

- **`html: false`** في إعداد `markdown-it`: أي HTML خام في المصدر **يُهرَّب (escaped) لا يُفسَّر**. فسطر مثل `<script>alert(1)</script>` أو `<img onerror=…>` يظهر كنصّ خامل، لا كعنصر DOM. الـ HTML الوحيد في الخرج هو ما يولّده `markdown-it` من صياغة Markdown نفسها (عناوين، روابط، شيفرة) — بنية آمنة.
- **الروابط:** `markdown-it` يرفض بروتوكولات خطرة (`javascript:` وغيرها) في `validateLink` الافتراضي؛ والروابط الخارجية تُضاف لها `rel="noopener noreferrer"` و`target="_blank"` (`D19-5`).
- **مرساة العناوين:** الـ id مشتقّ من نصّ العنوان بعد `slugify` يزيل كل ما عدا الحروف/الأرقام/الفراغات/الشرطة — فلا حقن سمات.

النتيجة: منع بنيوي لوصول أي HTML خام من المصدر إلى الـ DOM، **دون مكتبة تعقيم في M1**.

## ⚠️ ملاحظة توافق مع الوثيقة الحاكمة (للمالك)

[الوثيقة 19 §5 (D19-5)](../../eslammuatamed-docs/docs/19-security.md) تصف العارض بأنه «مُعقِّم بقائمة سماح (allowlist sanitizer)». تنفيذ M1 يستخدم بدلًا منه `html: false` (تهريب لا تعقيم بمكتبة) — وهي الآلية الآمنة الافتراضية في `markdown-it`، فالتنفيذ `Compatible` مع توثيق `markdown-it`. **لكن الآلية تختلف عن وصف الوثيقة 19، والفرق ليس صفريًّا تمامًا:**

- **ما يحقّقه `html:false`:** منع وصول أي HTML خام من المصدر إلى الـ DOM (لا XSS عبر حقن عناصر/سمات)، مع رفض `markdown-it` لبروتوكولات الروابط الخطرة (`javascript:` وغيرها).
- **ما لا يحقّقه (بخلاف مُعقِّم قائمة السماح):** حماية من **DOM clobbering**. الدالّة `headingAnchors` تولّد `id` لكل عنوان من نصّه **دون بادئة**، ووثيقة أمان `markdown-it` تحذّر صراحةً من توليد `id` من مدخلات المستخدم بلا بادئة. `slugify` يمنع حقن السمات لكنه **لا** يمنع DOM clobbering — وهي حماية يوفّرها مُعقِّم الخرج (مثل `DOMPurify` الذي تصفه D19-5) افتراضيًّا. لذا فعبارة «نفس الخاصّية الأمنية» أعلاه دقيقة لمنع XSS، لكنها لا تشمل هذا الفرق.
- **قابلية الاستغلال الآن ≈ صفر:** الـ id يغذّي حاليًّا روابط `#hash` أصيلة فقط؛ والـ TOC الذي سيستهلكها لاحقًا هو `FR-PUB-043` (مستقبلي).

**توصيتان للمالك:** (1) إضافة بادئة لـ id المراسي (مثل اصطلاح GitHub `user-content-`) قبل وصول الـ TOC. (2) مصالحة doc-first: تحديث صياغة الوثيقة 19 §5 لتعكس نهج `html:false` في M1، أو إضافة مُعقِّم — القرار للمالك. وإن سُمِح مستقبلًا بـ HTML خام (`html: true`)، فمُعقِّم قائمة السماح يصبح إلزاميًّا.

## الاختبارات

`server/utils/markdown.spec.ts` (يثبت تهريب HTML الخام، مرساة العناوين، الروابط الخارجية، السقوط للنصّ العادي).

## أخطاء شائعة

- وضع نقطة **عمل** في `server/api` — البيانات من الـ NestJS API فقط (`doc 00 §3`).
- استيراد `markdown-it`/`Shiki` في مكوّن عميل — يكسر `D20-3` (يمنعه `check-forbidden-modules`).
- تفعيل `html: true` دون إضافة مُعقِّم — يفتح ثغرة XSS مخزّنة.

## المرجع الرسمي وحالة التوافق

- [Nitro server routes (Nuxt)](https://nuxt.com/docs/guide/directory-structure/server) · [markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md) · [Shiki](https://shiki.style/) · [zod](https://zod.dev/).

**حالة التوافق:** `Compatible` مع توثيق `markdown-it` (`html:false` هو الافتراضي الآمن الموصى به) و`Nitro`. انظر ملاحظة الوثيقة 19 أعلاه بخصوص اختلاف **الآلية** عن وصف الوثيقة الحاكمة (نفس الهدف الأمني). **لا انحراف غير مُفسَّر.**
