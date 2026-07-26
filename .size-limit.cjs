/**
 * Bundle-size gate — realises the `size-limit` step doc 20 §5 has always specified.
 *
 * BUDGETS ARE COPIED FROM doc 20 §1 VERBATIM (JS ≤ 90 KB gz per public route, CSS ≤ 30 KB gz).
 * They are not tuned to current output. Re-baselining requires an owner decision plus a
 * decision-log entry in doc 20 — never an edit here.
 *
 * Why gzip and not brotli: doc 20 §1 states the budgets in `gz`. Cloudflare actually serves
 * brotli (measurably smaller), so gzip is the CONSERVATIVE reading of the documented number and
 * the only one comparable to it.
 *
 * Scoping:
 *  - `.output/public/_nuxt` only — the client bundle. `.output/server` is server-only code that
 *    is never transferred to a browser and must not be counted.
 *  - `*.map` excluded — source maps are not shipped to users.
 *  - Fonts/images are excluded here; the per-script font budget is asserted per ROUTE by the
 *    Lighthouse gate (`resource-summary:font:size`), where "first view, per script" is
 *    meaningful. A static glob would sum subsets that unicode-range means no visitor downloads.
 *
 * KNOWN OVER-COUNT on the JS entry: this sums every client chunk, which is a strict UPPER BOUND
 * on any single public route (it also includes the lazily-loaded dashboard SPA chunks). Nuxt does
 * not emit an import-graph manifest into `.output` that would let a static tool resolve the exact
 * per-route closure. The bound is deliberately reported rather than approximated downward — the
 * measured per-route transfer for `/` is recorded in the verification notes, and Lighthouse
 * reports per-route script bytes on every run.
 */
module.exports = [
  {
    name: 'public client JS (gzip) — doc 20 §1: ≤ 90 KB gz per public route',
    path: ['.output/public/_nuxt/**/*.js', '!.output/public/_nuxt/**/*.map'],
    gzip: true,
    limit: '90 KB'
  },
  {
    name: 'public CSS (gzip) — doc 20 §1: ≤ 30 KB gz',
    path: ['.output/public/_nuxt/**/*.css', '!.output/public/_nuxt/**/*.map'],
    gzip: true,
    limit: '30 KB'
  }
]
