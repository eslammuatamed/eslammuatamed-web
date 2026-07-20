// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/seo'
  ],

  css: ['~/assets/css/main.css'],

  // Brand favicons, generated from the mark's normative geometry (brand-identity.md §3/§11,
  // v2.0.0) and copied from ../eslammuatamed-docs/content/brand/assets — never edited here.
  // One violet mark serves both themes — the accent clears the 3:1 non-text floor on light
  // and dark chrome alike (asset-production.md AP-7). The .ico is listed first so chrome
  // without SVG support resolves it.
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  // Env-driven at runtime (D23-8): NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_API_BASE map here.
  // Hosts never live in code — the values come from .env (doc 16 §1).
  runtimeConfig: {
    public: {
      siteUrl: '',
      apiBase: ''
    }
  },

  // Two worlds (D06-1): the dashboard is a client-only SPA; public content is SSR + SWR at
  // the Nitro layer (doc 20 §2). `/ar/**` mirrors the public rules (i18n prefixes Arabic).
  routeRules: {
    '/dashboard/**': { ssr: false },
    // i18n `prefix_except_default` generates real `/ar/dashboard/**` routes; they must be client-only
    // too or the Arabic dashboard would SSR, breaking the two-worlds isolation (D06-1).
    '/ar/dashboard/**': { ssr: false },
    '/': { swr: 60 },
    '/blog/**': { swr: 60 },
    '/ar': { swr: 60 },
    '/ar/blog/**': { swr: 60 },
    // Draft-preview surface (D10-11): never index, never cache, never leak the token-bearing URL via
    // the Referer of any subresource. `robots` drives @nuxtjs/robots (noindex meta + X-Robots-Tag);
    // the explicit headers add no-store + no-referrer. Both locale paths need the header rule — Nitro
    // header rules are not i18n-prefix aware (unlike the robots module).
    '/preview/**': {
      robots: 'noindex, nofollow',
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }
    },
    '/ar/preview/**': {
      robots: 'noindex, nofollow',
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }
    }
  },

  i18n: {
    strategy: 'prefix_except_default', // en at root, ar under /ar (D01-3)
    defaultLocale: 'en',
    langDir: 'locales', // resolved under the i18n/ restructure dir → i18n/locales (v10 default)
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    detectBrowserLanguage: false, // explicit routing only — no Accept-Language heuristic (D10-6)
    locales: [
      { code: 'en', language: 'en-US', dir: 'ltr', name: 'English', file: 'en.json' },
      { code: 'ar', language: 'ar', dir: 'rtl', name: 'العربية', file: 'ar.json' }
    ]
  },

  // Class strategy, system default, no flash (D14-4). Nuxt UI bundles color-mode; classSuffix
  // '' yields the `.dark` class the token layer and Tailwind expect.
  colorMode: {
    preference: 'system',
    fallback: 'dark', // dark is the flagship aesthetic (doc 03 §1)
    classSuffix: ''
  },

  // OG-image/schema wiring is a later milestone (spec out-of-scope); keep the heavy OG-image
  // renderer out of the M1 build. Sitemap/robots stay at module defaults.
  ogImage: { enabled: false },

  typescript: {
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true // doc 15 §1
      }
    }
  }
})
