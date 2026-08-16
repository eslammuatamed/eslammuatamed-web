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
  /**
   * PAYLOAD EXTRACTION — `'client'`, not the `true` this app was effectively defaulting to (OD-26-6).
   *
   * A `swr`/`cache` route rule flips Nitro's `_PAYLOAD_EXTRACTION`, and under the default the route's
   * OWN server-rendered HTML then carries `<link rel="preload" as="fetch" href="/_payload.json">`. The
   * HTML PARSER fetches that before hydration, and because these routes are never statically
   * prerendered, Nitro answers it with a SECOND FULL LIVE SSR RENDER — a second `/settings/site` read
   * for one page view, which is what `e2e/dedupe/settings-dedupe.spec.ts` exists to forbid.
   *
   * `'client'` keeps payload extraction ON for client-side navigation (`_payload.json` is still built
   * and served, and in-app navigation still consumes it) while inlining the initial payload, so no
   * pre-hydration fetch is emitted. Measured: one live render instead of two.
   *
   * NOT `false`. That also gives one render, but it removes payload support from client-side
   * navigation and deterministically breaks four AR -> EN locale-head-parity specs. `'client'` and
   * `false` emit byte-identical SERVER renderers; they differ only in client behaviour, which is
   * exactly the behaviour those specs assert.
   *
   * Cost, measured and deliberately NOT traded away by this decision: the initial document grows
   * ~1.9-2.6 KB on cache-ruled routes because the payload is inlined. Total first-load transfer still
   * falls (~200 B, one request fewer). The document growth is dispositioned separately; no budget is
   * raised or re-baselined here, and `size` is byte-identical across all three modes.
   */
  experimental: { payloadExtraction: 'client' },
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

  /**
   * Disable cssnano's `mergeRules` optimization (026 Phase 5, T5.C).
   *
   * WHY A MINIFIER OPTIMIZATION IS BEING TURNED OFF. `mergeRules` combines selectors that share a
   * declaration block (`.a{color:red}.b{color:red}` -> `.a,.b{color:red}`). That is a genuine RAW
   * byte win — measured -1,373 B raw here. But the doc 20 §1 budget is stated in **gzip** bytes, and
   * merging is actively counterproductive under gzip: gzip already encodes the repeated block almost
   * for free via back-references, while merging *destroys* the long repeated selector-prefix runs
   * that compress best. Net effect measured on this tree at cssnano 8.0.6: **raw -1,373 B, gz +87 B**.
   *
   * So this is not "disabling an optimization" — it is declining a raw-size optimization that makes
   * the metric we are actually governed by WORSE. The lesson generalizes only to gzip/brotli-served
   * CSS budgets; for an uncompressed budget the default is correct.
   *
   * This is a first-class supported Nuxt config key (`postcss.plugins.cssnano`, resolved in
   * @nuxt/schema; production default is `{}` = default preset). No vendor patching, no override, no
   * custom machinery - deliberately the cheapest tier of the Phase 5 preference order.
   */
  postcss: {
    plugins: {
      cssnano: { preset: ['default', { mergeRules: false }] }
    }
  },

  hooks: {
    /**
     * Drop Nuxt UI's `--color-old-neutral-*` palette from the public stylesheet (025).
     * Measured: **-103 B gz**, which is what brings the stylesheet back under the doc 20 §1
     * 30 KB gz budget. The budget itself is untouched.
     *
     * WHAT THESE ARE. Nuxt UI rebinds Tailwind's `neutral` colour name to its own semantic slot,
     * so it preserves Tailwind's original `neutral` ramp under the alias `old-neutral`. The block
     * is emitted UNCONDITIONALLY as `@theme static`, and `static` is precisely the directive that
     * tells Tailwind to emit every declaration whether or not anything uses it — so all 11 land in
     * the stylesheet on every public route regardless of the app's palette.
     *
     * WHY REMOVING THEM IS BEHAVIOUR-EQUIVALENT, checked three ways rather than assumed:
     *   1. The emitted CSS contains ZERO `var(--color-old-neutral-*)` references — nothing reads
     *      them. Removing a custom property that nothing reads cannot change a computed style,
     *      which is also why this carries no `/dashboard/**` exposure: there is no consumer to
     *      affect, on any route.
     *   2. The only occurrences of the string in the JS bundles are inside Nuxt UI's own runtime
     *      colour GENERATOR (`generateShades`), i.e. the template that would produce a reference —
     *      not a reference itself.
     *   3. That generator only reaches the alias for a colour literally named `neutral`; this app
     *      configures `primary: 'violet'` / `neutral: 'zinc'` (app.config.ts), so the branch is
     *      never taken. And even if it were, the generator emits
     *      `var(--color-old-neutral-N, <literal fallback>)` — the fallback is baked in, so the
     *      alias going missing degrades to the same colour rather than to nothing.
     *
     * THROWS RATHER THAN NO-OPS. A regex that silently stops matching after a Nuxt UI upgrade is
     * the failure mode that makes a hook like this a liability: the bytes would quietly return and
     * the next release would drift over budget. Both the template and the exact 11-declaration
     * shape are asserted, so an upgrade that changes either BREAKS THE BUILD and gets a decision.
     */
    'app:templates'(app) {
      const template = app.templates.find(t => t.filename === 'ui.css')
      if (!template?.getContents) {
        throw new Error(
          '[css-budget] Nuxt UI\'s `ui.css` template was not found. The `--color-old-neutral-*` '
          + 'strip in nuxt.config.ts is stale — re-check @nuxt/ui and re-measure `npm run size`.'
        )
      }

      const OLD_NEUTRAL_BLOCK = /@theme static \{\s*(?:--color-old-neutral-\d+:[^;]+;\s*){11}\}/

      const getContents = template.getContents
      template.getContents = async (data) => {
        const contents = await getContents(data)
        if (!OLD_NEUTRAL_BLOCK.test(contents)) {
          throw new Error(
            '[css-budget] the `--color-old-neutral-*` `@theme static` block no longer matches the '
            + 'expected 11-declaration shape. Nuxt UI has changed it: re-verify the tokens are '
            + 'still unreferenced, update the pattern, and re-measure `npm run size`.'
          )
        }
        return contents.replace(OLD_NEUTRAL_BLOCK, '')
      }
    }
  },

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

  // Two worlds (D06-1): the dashboard is a client-only SPA; public content is SSR, with Nitro SWR
  // on stable discovery routes (doc 20 §2). Project DETAIL is the deliberate exception: Dashboard
  // mutations must be visible on the very next request, so its two locale patterns disable Nitro's
  // response cache while retaining SSR. Exact index rules remain SWR because they are more specific
  // than the detail wildcards. `/ar/**` mirrors the public rules (i18n prefixes Arabic).
  routeRules: {
    '/dashboard/**': { ssr: false },
    // i18n `prefix_except_default` generates real `/ar/dashboard/**` routes; they must be client-only
    // too or the Arabic dashboard would SSR, breaking the two-worlds isolation (D06-1).
    '/ar/dashboard/**': { ssr: false },
    '/': { swr: 60 },
    '/blog/**': { swr: 60 },
    '/projects': { swr: 60 },
    '/projects/**': { headers: { 'cache-control': 'no-store' } },
    '/ar': { swr: 60 },
    '/ar/blog/**': { swr: 60 },
    '/ar/projects': { swr: 60 },
    '/ar/projects/**': { headers: { 'cache-control': 'no-store' } },
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
    // Defer the locale commit until the outgoing page is concealed (D03-13 — the branded
    // `page-spread` transition; D03-14 is selective glass and is unrelated).
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
    //
    // CONSEQUENCE, handled rather than absorbed: the incoming page's `setup()` runs INSIDE the
    // suspension window, so the reactive locale it reads is still the OUTGOING one. Public content
    // reads therefore take their locale from the ROUTE (D06-6, `useRouteLocale()`), not from this
    // reactive state — otherwise a locale switch requests the incoming per-locale slug (D04-2) in the
    // previous language and renders a 404 for content that exists.
    skipSettingLocaleOnNavigate: true,
    locales: [
      { code: 'en', language: 'en-US', dir: 'ltr', name: 'English', file: 'en.json' },
      { code: 'ar', language: 'ar', dir: 'rtl', name: 'العربية', file: 'ar.json' }
    ],
    /**
     * Strict SEO — the module owns every locale-derived head tag (D22-7, doc 22 §2).
     *
     * `<html lang>`/`<html dir>`, the locale alternates including `x-default` (D22-3), the
     * route-derived canonical, `og:locale`/`og:locale:alternate`/`og:url`, and the localized
     * dynamic-route parameters fed by `useSetI18nParams()` are all generated internally, as one
     * unit. `app.vue` therefore no longer calls `useLocaleHead()` — the module throws on it here,
     * because the two would be competing writers for the same tags.
     *
     * WHY (finding F-3). With the head split between the module and app-owned writers, a
     * client-side locale switch on a route that calls `setI18nParams()` left `dir` on `ltr` for an
     * Arabic page, `og:locale` on `en_US`, and the canonical carrying the Arabic slug on the English
     * path — while `lang` and `hreflang` updated correctly. Upgrading the module to 10.5.0 was tried
     * first and did not fix it; app-owned `htmlAttrs` lost the merge, and raising their priority
     * changed nothing. Fixing `dir` alone would have left the crawler-visible half broken.
     *
     * Page and entity code keeps title, description, entity OG image, structured data and the D22-6
     * global metas. `skipSettingLocaleOnNavigate` (D03-13) and route-resolved content locale (D06-6)
     * are untouched — this changes who writes the tags, not when the locale commits.
     */
    experimental: {
      strictSeo: true
    }
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
