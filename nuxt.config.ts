// https://nuxt.com/docs/api/configuration/nuxt-config
import { bundleAnalysisPlugin } from './config/bundle-analysis'
import { siteUrlFromEnv } from './config/site-url'

/**
 * The one validated public origin (D23-8). Resolved ONCE here and fed to every absolute-URL
 * consumer below — i18n (canonical, og:url, hreflang), nuxt-site-config (sitemap, robots) and
 * `runtimeConfig.public` — so they can never disagree.
 *
 * Production-like builds throw when this is missing, malformed, relative, non-HTTPS or loopback.
 * The previous `process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'` fallback shipped a
 * staging build whose canonical was `http://localhost:3000`, with no error anywhere in the
 * pipeline; `config/site-url.ts` makes that a build failure instead. Validation lives in that
 * module rather than inline here because `nuxt.config.ts` cannot be unit-tested.
 */
const siteUrl = siteUrlFromEnv()

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

  // Opt-in bundle provenance for the doc 20 §1 JS budgets (`ANALYZE_BUNDLE=1` only, so ordinary
  // builds stay byte-identical — the plugin writes a sidecar file and transforms nothing; verified
  // by comparing all 27 built asset SHA256s with and without the flag). Emits Rollup's chunk→module
  // map, the only authoritative basis for splitting app code from framework/vendor code; filenames
  // are not. The plugin itself skips Nuxt's SSR Vite pass. Consumed by `npm run size:routes`.
  vite: {
    plugins: process.env.ANALYZE_BUNDLE === '1' ? [bundleAnalysisPlugin(import.meta.dirname)] : []
  },

  // Brand favicons, generated from the mark's normative geometry (brand-identity.md §3/§11,
  // v2.0.0) and copied from ../eslammuatamed-docs/content/brand/assets — never edited here.
  // One violet mark serves both themes — the accent clears the 3:1 non-text floor on light
  // and dark chrome alike (asset-production.md AP-7). The .ico is listed first so chrome
  // without SVG support resolves it.
  app: {
    // NOTE: the branded `page-spread` route transition is declared in `app.vue`, NOT here.
    // It carries an `onBeforeEnter` hook that finalizes the deferred locale switch, and a hook is a
    // FUNCTION — `nuxt.config` is serialized into the build, so it cannot hold one. Keeping a
    // partial copy here would silently win over nothing and drift from the real definition, so the
    // transition has exactly one source of truth in `app.vue` (its rationale travels with it).
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  // Env-driven at runtime (D23-8): NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_API_BASE map here.
  // Hosts never live in code — the values come from .env (doc 16 §1).
  // `siteUrl` carries the build-validated origin as its default; Nitro still lets the server's
  // own NUXT_PUBLIC_SITE_URL override it at runtime, so the deploy keeps a single source of truth
  // while the baked value is guaranteed valid rather than an empty string.
  runtimeConfig: {
    public: {
      siteUrl,
      apiBase: ''
    }
  },

  // nuxt-site-config (via @nuxtjs/seo) owns the sitemap index, the per-locale sitemaps and the
  // `Sitemap:` line in robots.txt. Pinning it to the same validated constant stops it inferring
  // an origin from request headers or a stale env guess.
  site: { url: siteUrl },

  // Two worlds (D06-1): the dashboard is a client-only SPA; public content is SSR + SWR at
  // the Nitro layer (doc 20 §2). `/ar/**` mirrors the public rules (i18n prefixes Arabic).
  routeRules: {
    '/dashboard/**': { ssr: false },
    // i18n `prefix_except_default` generates real `/ar/dashboard/**` routes; they must be client-only
    // too or the Arabic dashboard would SSR, breaking the two-worlds isolation (D06-1).
    '/ar/dashboard/**': { ssr: false },
    '/': { swr: 60 },
    '/blog/**': { swr: 60 },
    '/projects': { swr: 60 },
    '/projects/**': { swr: 60 },
    '/ar': { swr: 60 },
    '/ar/blog/**': { swr: 60 },
    '/ar/projects': { swr: 60 },
    '/ar/projects/**': { swr: 60 },
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
    baseUrl: siteUrl, // validated above — never a silent localhost fallback (D23-8)
    detectBrowserLanguage: false, // explicit routing only — no Accept-Language heuristic (D10-6)
    // Defer the locale commit until the outgoing page is concealed (D03-14).
    //
    // Without this, `locale` commits the moment i18n resolves the incoming route — BEFORE Vue's
    // `out-in` page transition starts its leave animation. Measured on the built preview: `<html dir>`
    // flipped to `rtl` at t+0 ms and the leave animation only began at t+60..84 ms, so for ~60-84 ms the
    // still-opaque ENGLISH page was painted mirrored, with the header already in Arabic. That is the
    // "two consecutive visual changes" the switch used to show.
    //
    // With this enabled, the module suspends the switch and hands over `finalizePendingLocaleChange()`,
    // which `app.vue` calls from the transition's `onBeforeEnter` — i.e. once the outgoing page is gone.
    // Locale, `<html lang/dir>`, chrome copy and the Nuxt UI locale pack then all commit in one frame,
    // while nothing of the old page is on screen.
    //
    // It is deliberately inert where it must be: the module skips suspension on the server and during
    // hydration (`runtime/context.js` — `import.meta.server || nuxt.isHydrating`), so a direct `/ar`
    // load or a refresh is still RTL in the first painted frame, with no client round trip.
    skipSettingLocaleOnNavigate: true,
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
  // renderer out of the M1 build. Robots stays at module defaults.
  ogImage: { enabled: false },

  // Published project translations come from the API at request time (doc 22 §sitemap). The handler
  // lives in Nitro because a sitemap cannot go through a component composable.
  sitemap: {
    sources: ['/api/__sitemap__/projects']
  },

  // NO `image.domains` for the media origin — deliberately. Allowlisting a host is what ENABLES
  // @nuxt/image's IPX runtime transformation for it, which is the opposite of D23-15: the API
  // pre-generates every rendition and R2 serves the static objects. Setting it rewrote remote
  // descriptors to `/_ipx/s_80x80/https://media…`, which 404s and drops Lighthouse best-practices to
  // 96 via `errors-in-console` on the home page. Left unset, <NuxtImg> emits the contract's absolute
  // URLs untouched, which is exactly what the pre-generated pipeline wants; the gallery additionally
  // builds its srcset from the contract's own `variants`.

  // Pre-compress public assets at build time (brotli + gzip), so the Nitro origin serves them the
  // way production already serves them to users.
  //
  // Production is Cloudflare → Caddy → Nitro (doc 23 §1), and the edge compresses: `curl -I` against
  // eslammuatamed.com returns `content-encoding: br` for the document and `gzip` for `entry.css`.
  // Nitro's own origin did NOT compress, which nothing noticed in production because Cloudflare
  // covers for it — but the Lighthouse gate measures the origin directly, with no edge in front.
  //
  // That made the lab measurement diverge from reality on the single most expensive resource on the
  // critical path. Same commit (c3a5215), same four routes:
  //
  //     entry.css over the wire   production 22,609 B (br)   CI preview 203,776 B (none)   ~9x
  //     Performance, desktop      production 100 x4          CI 89-93
  //     Performance, mobile       production 94/89/85/96     CI 58-60
  //
  // The gate was failing a render-blocking stylesheet that no user has ever downloaded uncompressed.
  // With this set, the same build measures desktop 99/99/99/100 and mobile 85/77/82/89 locally, and
  // desktop LCP lands at 653-891 ms — inside doc 20 §1's 1.2 s lab budget, which was unreachable
  // before only because of the serving layer.
  //
  // This is a serving-layer correction, not a Lighthouse one: throttling, device emulation, audit
  // weights, the route matrix, the run count and the median calculation are all untouched. It also
  // helps production on its own terms — the origin now ships compressed bytes to the edge instead of
  // relying on Cloudflare to compress on every cache miss.
  //
  // Still NOT compressed by this setting: the SSR HTML document (39,002 B on `/ar`), which Nitro
  // generates per request rather than serving from `.output/public`. Production brotlis it at the
  // edge; the preview cannot. That residual gap is why local mobile still reads below production.
  nitro: { compressPublicAssets: true },

  typescript: {
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true // doc 15 §1
      }
    }
  }
})
