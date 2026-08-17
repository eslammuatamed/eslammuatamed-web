# eslammuatamed-web

تطبيق `Nuxt 4` + `Nuxt UI 4` + `Tailwind v4`: الموقع العام (SSR) + لوحة تحكّم `/dashboard` (SPA عميل-فقط) لمنصّة `eslammuatamed`.

هذا الملف مرجع تشغيل سريع فقط. **لفهم المعمارية والتدفّقات ومراجعة التوافق ابدأ من [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md)**، ثم ملفات `README.md` داخل مجلدات `app/` و`server/`.

الوثائق الحاكمة في `../eslammuatamed-docs/docs/` — خاصّةً `00` (الدستور) و`03`/`06`/`11–14` (معمارية هذا المستودع). ملزِم أيضًا: `.specify/memory/constitution.md`.

## المتطلّبات

- `Node 24` (مثبّت في `.nvmrc`).
- الـ API متاحًا على `NUXT_PUBLIC_API_BASE`، **أو** خادم mock عبر `npm run mock` (يعمل على العقد المُلتزَم بلا API حيّ).

## التشغيل السريع

```bash
npm ci
cp .env.example .env          # NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_API_BASE (مُتحقَّق عند الإقلاع)
npm run dev                   # http://localhost:3000
```

للتطوير بلا API حيّ، في نافذة ثانية:

```bash
npm run mock                  # خادم Prism على openapi/openapi.json (المنفذ 3001)
```

## البوابات وأوامر الجودة

```bash
npm run lint                  # eslint (حدود العالمين + منع Axios/$fetch الخام للـ API)
npm run typecheck             # nuxt typecheck (vue-tsc)
npm test                      # vitest
npm run api:types             # إعادة توليد app/types/api.d.ts من العقد (لا يُحرَّر يدويًّا)
npm run build && npm run check:bundle    # يمنع تسرّب Tiptap/Shiki إلى حزم العميل العامّة
npm run check:logical                     # يمنع الأنماط الفيزيائية (خصائص منطقية فقط — RTL)
ANALYZE_BUNDLE=1 npm run build            # مطلوب قبل size:routes
npm run size                              # ميزانية CSS العامّة (سقف 30,000 B gz)
npm run size:routes                       # ميزانيات JS لكل مسار (D20-31 / D20-32)
npm run test:e2e                          # Playwright + axe (a11y، en/ar/RTL، SSR)
```

المكدّس المُسلَّم: `nuxt` **4.5.2** · `@nuxt/ui` **4.10.0** · `vue` **3.5.41** · `@nuxtjs/i18n` **10.6.0** · `tailwindcss` **4.3.3**. التفاصيل في [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) §4.

## انضباط التغيير

Doc-first: عمل يناقض وثيقة معتمدة ← نقّح الوثيقة في `../eslammuatamed-docs` أولًا. Conventional Commits عبر PR. تبنّي العقد = commit ذرّي واحد (العقد + الأنواع المولّدة + التكيّف، [الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md)). كل تغيير واجهة يُتحقَّق في **اللغتين** (en/ar) وسلوك a11y.

## النشر

`.github/workflows/deploy.yml` على `Contabo VPS`. التفاصيل في [الوثيقة 23](../eslammuatamed-docs/docs/23-deployment.md) و[توثيق نشر Nuxt](https://nuxt.com/docs/getting-started/deployment).
