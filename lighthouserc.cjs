/**
 * Lighthouse CI gate — realises the enforcement doc 20 §5 has always specified.
 *
 * THIS FILE NOW ONLY COLLECTS. Assertion moved to `scripts/check-lighthouse-medians.mjs`
 * (`npm run lhci:assert`) when D20-13 replaced the flat "Performance 100" gate with median-based
 * thresholds. The approved semantics — exactly three comparable runs per configuration, grouped by
 * run configuration rather than filename, where FEWER than three is an infrastructure failure and
 * not a low score — are project-specific requirements that a threshold list cannot express. The
 * thresholds themselves were not loosened to fit the tool; they live in
 * `scripts/lib/lighthouse-medians.mjs`, copied from doc 20 §1 verbatim:
 *
 *   Performance (median of 3)         ≥ 95 desktop · ≥ 60 mobile   (D20-13)
 *   A11y / Best Practices / SEO       100                          (unchanged)
 *   LCP (lab)                         ≤ 1200 ms desktop · ≤ 4000 ms mobile   (D20-14, device-scoped)
 *   CLS                               < 0.05                       (unchanged)
 *   Fonts, Arabic script on /ar**     ≤ 130 KB woff2               (D20-15 — value unchanged, scope
 *                                                                   corrected; the combined
 *                                                                   per-route total is a diagnostic)
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
// Each profile writes to its OWN directory. A shared directory would let the assertion step read
// desktop and mobile reports as one pool — and while the medians are grouped by each report's own
// `configSettings.formFactor` and could never actually be averaged together, a second `autorun`
// into the same directory would overwrite the first profile's reports and silently halve the
// evidence. Separate directories make that impossible rather than merely unlikely.
const profile = process.env.LHCI_PROFILE === 'desktop' ? 'desktop' : 'mobile'

const urls = [
  'http://127.0.0.1:3000/',
  'http://127.0.0.1:3000/ar',
  'http://127.0.0.1:3000/blog/staying-inside-performance-budget-nuxt',
  'http://127.0.0.1:3000/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt',
  // web-005 Projects. Doc 20 §5's matrix is "four pages (home, article, project, contact) x both
  // locales"; the project pages now exist, so D20-8's deferral is closed for them. Slugs are the
  // Prism contract examples, which the mock serves for ANY slug — the gate must not depend on
  // staging data.
  'http://127.0.0.1:3000/projects',
  'http://127.0.0.1:3000/ar/projects',
  'http://127.0.0.1:3000/projects/content-platform-api',
  'http://127.0.0.1:3000/ar/projects/content-platform-api',
  // web-005 Profile, Experience slice (008). Adding URLs to the COLLECTION only — every threshold
  // stays exactly as `npm run lhci:assert` defines it (D20-13). A new public route that is never
  // measured is a budget that silently does not apply to it.
  'http://127.0.0.1:3000/experience',
  'http://127.0.0.1:3000/ar/experience',
  // web-005 Profile, About slice (009). Added to the COLLECTION only — every threshold stays exactly
  // as `npm run lhci:assert` defines it (D20-13). Governed by D20-19, recorded in doc 20 first.
  'http://127.0.0.1:3000/about',
  'http://127.0.0.1:3000/ar/about',
  // web-005 Profile, Resume slice (010). Added to the COLLECTION only — every threshold stays
  // exactly as `npm run lhci:assert` defines it (D20-13). Governed by D20-21, recorded in doc 20
  // first.
  'http://127.0.0.1:3000/resume',
  'http://127.0.0.1:3000/ar/resume',
  // web-005 Contact slice (011). Added to the COLLECTION only — every threshold stays exactly as
  // `npm run lhci:assert` defines it (D20-13). Governed by D20-22, recorded in doc 20 first. With
  // these two URLs, §5's four-page matrix (home, article, project, contact x both locales) is
  // COMPLETE and D20-8's deferral is fully closed.
  'http://127.0.0.1:3000/contact',
  'http://127.0.0.1:3000/ar/contact'
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
        // `--collect.settings.preset=desktop` via `npm run lhci:desktop`. The assertion step reads
        // the profile back from each report's own `configSettings.formFactor`, so this flag can
        // never disagree with how the runs are grouped.
        skipAudits: ['uses-http2', 'canonical']
        // `uses-http2`: the local preview is HTTP/1.1; production is HTTP/2 via Cloudflare.
        // `canonical`: the baked canonical is the real public origin, which correctly does not
        //  match the 127.0.0.1 collection URL. Canonical correctness is asserted separately by
        //  the browser regression pass, not by penalising the gate for being local.
      }
    },
    // No `assert` block: `npm run lhci:assert` owns every threshold (D20-13). Leaving the old
    // per-run `categories:performance: minScore 1` here would fail `autorun` before the median gate
    // ever ran — asserting the superseded requirement in a step that only collects evidence.
    upload: {
      // Reports are kept as build artifacts; there is no LHCI server to target.
      target: 'filesystem',
      outputDir: `.lighthouseci/${profile}`
    }
  }
}
