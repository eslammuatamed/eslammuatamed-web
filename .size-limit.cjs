/**
 * Static build-output size gate (doc 20 §5).
 *
 * BUDGET COPIED FROM doc 20 §1 VERBATIM (CSS ≤ 30 KB gz). Not tuned to current output.
 * Re-baselining requires an owner decision plus a decision-log entry in doc 20 — never an edit here.
 *
 * Why gzip and not brotli: §1 states the budget in `gz`. Cloudflare actually serves brotli
 * (measurably smaller), so gzip is the conservative reading and the only unit comparable to the
 * documented number.
 *
 * SCOPE — CSS only, deliberately. §1's other byte budget is "JS transferred **per public route**",
 * which a static glob cannot express: it also sums the lazily-loaded dashboard SPA chunks that no
 * public route ever fetches (measured 260.7 KB gz for the whole bundle vs 223.7 KB gz actually
 * referenced by `/`). Reporting the inflated number would mean the gate's figure did not mean what
 * the budget means. That budget is therefore owned by `npm run size:routes`
 * (scripts/check-route-size.mjs), which reads each rendered route's real asset set. No second,
 * looser JS ceiling is defined here — inventing a threshold is not permitted, and a duplicate
 * failing gate would report one problem twice.
 *
 * CSS needs no per-route treatment: the build emits a single global stylesheet shared by every
 * route, so the glob total IS the per-route figure.
 *   - `.output/server` excluded: server-only, never transferred to a browser.
 *   - `*.map` excluded: not shipped to users.
 *   - Fonts excluded: asserted per route by Lighthouse (`resource-summary:font:size`), where
 *     "first view, per script" is meaningful — a static glob would sum subsets that unicode-range
 *     means no visitor downloads.
 */
module.exports = [
  {
    name: 'public CSS (gzip) — doc 20 §1: ≤ 30 KB gz',
    path: ['.output/public/_nuxt/**/*.css', '!.output/public/_nuxt/**/*.map'],
    gzip: true,
    limit: '30 KB'
  }
]
