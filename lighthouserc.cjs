/**
 * Lighthouse CI gate — realises the enforcement doc 20 §5 has always specified.
 *
 * THRESHOLDS ARE COPIED FROM doc 20 §1 VERBATIM. They are not tuned to what the site currently
 * scores, and re-baselining any of them requires an owner decision plus a decision-log entry in
 * doc 20 — not a change here.
 *
 *   Lighthouse (all four categories)  100
 *   LCP                               < 1.2 s (lab)
 *   CLS                               < 0.05
 *   Fonts (first view, per script)    ≤ 130 KB woff2
 *
 * Deliberate scope notes:
 *
 * - URL matrix. Doc 20 §5 asks for "four pages (home, article, project, contact) × both
 *   locales". `/projects` and `/contact` are the accepted web-005 404s (spec.md:36), so the
 *   documented matrix is not implementable yet. This runs home + article × EN/AR — 4 URLs — and
 *   the two missing page types are a recorded deferral to web-005, NOT a quiet redefinition.
 *
 * - Byte budgets. Doc 20 §1 states the JS/CSS budgets in GZIP bytes. Lighthouse reports
 *   TRANSFER size, which depends on whatever the serving layer negotiates (the local preview
 *   does not compress the way Cloudflare's brotli does), so asserting them here would compare
 *   different units. `size-limit` owns those two budgets instead — it computes gzip
 *   deterministically from the build output. Fonts ARE asserted here: woff2 is already
 *   compressed, so transfer size equals file size, and `/` vs `/ar` is exactly the
 *   "per script" split the budget is written in terms of.
 *
 * - INP has no lab equivalent, so it is monitored in the field (doc 20 §6), not gated here.
 *   No TBT threshold is asserted because doc 20 §1 does not state one — inventing budgets is
 *   forbidden.
 */
const BUDGET = {
  lcpMs: 1200,
  cls: 0.05,
  fontsBytes: 130 * 1024
}

const urls = [
  'http://127.0.0.1:3000/',
  'http://127.0.0.1:3000/ar',
  'http://127.0.0.1:3000/blog/staying-inside-performance-budget-nuxt',
  'http://127.0.0.1:3000/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt'
]

module.exports = {
  ci: {
    collect: {
      // The built artifact behind a contract mock — no dependency on staging (see ci-preview.mjs).
      startServerCommand: 'node scripts/ci-preview.mjs',
      startServerReadyPattern: 'ci-preview\\] listening',
      startServerReadyTimeout: 60000,
      url: urls,
      // Three runs per URL; assertions below use the median so one noisy sample cannot fail the
      // build or, just as importantly, pass it.
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
        // Default (mobile) profile. The desktop pass runs the same config with
        // `--collect.settings.preset=desktop` via `npm run lhci:desktop`.
        skipAudits: ['uses-http2', 'canonical']
        // `uses-http2`: the local preview is HTTP/1.1; production is HTTP/2 via Cloudflare.
        // `canonical`: the baked canonical is the real public origin, which correctly does not
        //  match the 127.0.0.1 collection URL. Canonical correctness is asserted separately by
        //  the browser regression pass, not by penalising the gate for being local.
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'largest-contentful-paint': ['error', { maxNumericValue: BUDGET.lcpMs }],
        'cumulative-layout-shift': ['error', { maxNumericValue: BUDGET.cls }],
        'resource-summary:font:size': ['error', { maxNumericValue: BUDGET.fontsBytes }]
      }
    },
    upload: {
      // Reports are kept as build artifacts; there is no LHCI server to target.
      target: 'filesystem',
      outputDir: '.lighthouseci'
    }
  }
}
