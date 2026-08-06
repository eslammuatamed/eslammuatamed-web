/**
 * Is a rendered Home document the COMPLETE page, or the D13-1 "API unavailable" state?
 *
 * ## Why this exists
 *
 * `/` and `/ar` carry `swr: 60` (`nuxt.config.ts` routeRules). Whichever render lands in the cache
 * first is frozen, and the governed Lighthouse matrix then takes all three of its readings from
 * that ONE render. So the first request to `/` after the preview starts is not a fetch — it decides
 * what the entire gate measures.
 *
 * That request used to be a bare `curl` in `scripts/lighthouse-ci.mjs` whose only purpose was
 * discovering a `/_nuxt/*.js` asset for the HTTP/2 preflight, and it validated nothing else.
 * `app/pages/index.vue` gates the whole page on `v-if="settings"` — `settings` is its single hard
 * dependency by design (D13-1) — so a failed settings read replaces the Home page with a ~924 px
 * stub that still returns **HTTP 200** and still carries `/_nuxt/*.js` script tags. Both the asset
 * discovery and the following `assertH2` status check accepted it.
 *
 * MEASURED, run 31061969098 (`push`, tree `9ade9604`): the priming render issued ZERO upstream API
 * calls, `settings` was null, and the stub was cached. All three mobile Home readings then measured
 * a 68-element / 924 px error page instead of the 240-element / 3989 px Home page. Because the
 * footer is 486 px tall, it occupied more than half of the 823 px viewport, and a 2–3 px font-swap
 * reflow scored ~0.05 CLS against a 0.05 budget. Run 31062033742 (`pull_request`) on the
 * BYTE-IDENTICAL tree primed a complete render and measured CLS 0/0/0. The gate was not failing on
 * a layout regression; it was failing on which page it happened to be pointed at.
 *
 * ## Why these markers and not the obvious ones
 *
 * The stub is not blank. It renders the header, the footer, and the tagline eyebrow from
 * `settings`-independent sources, so ANY marker drawn from the site chrome, the tagline, or the
 * i18n title fallbacks is satisfied by the failure state. `scripts/ci-preview.mjs` already
 * documents falling into exactly this trap once — it first asserted the Arabic site name, which
 * also lives in `i18n/locales/ar.json`, giving a readiness gate that could not fail.
 *
 * These are the `title-id`s of the section headings that `index.vue` renders INSIDE `v-if="settings"`
 * (`app/components/home/*.vue` via `UiSectionHead`). They cannot appear unless the settings read
 * succeeded and every Home section mounted, and they are ids rather than copy, so the same check
 * discriminates in both locales without depending on translated text.
 *
 * A section whose OWN endpoint failed still renders its heading — deliberately. Per-section failure
 * is the governed graceful-degradation path (NFR-DEGRADE) and is not what corrupts the measurement;
 * losing the entire page is.
 */
export const HOME_SECTION_MARKERS = Object.freeze([
  'capabilities-title',
  'work-title',
  'experience-title',
  'writing-title',
  'voices-title'
])

/**
 * @param {string} html
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function inspectHomeRender(html) {
  const missing = HOME_SECTION_MARKERS.filter(id => !html.includes(`id="${id}"`))
  return { complete: missing.length === 0, missing }
}

/**
 * A diagnostic that names the cause rather than the symptom.
 *
 * Deliberately reports the document SIZE and the outage-state signal alongside the missing markers:
 * "id=capabilities-title not found" on its own reads as a selector problem, which is the wrong
 * thing to go and investigate. The failure this detects is an upstream read failing during SSR.
 *
 * @param {string} path
 * @param {string} html
 * @param {string[]} missing
 */
export function describeIncompleteRender(path, html, missing) {
  return [
    `${path} did not render the complete Home page.`,
    `  missing section markers : ${missing.join(', ')}`,
    `  document bytes          : ${Buffer.byteLength(html)}`,
    `  D13-1 outage state      : ${html.includes('home.hero.unavailable') || /Content unavailable|المحتوى غير متاح/.test(html) ? 'PRESENT' : 'not detected'}`,
    '  This is the governed "API unavailable" state (app/pages/index.vue, v-if="settings"), which',
    '  returns HTTP 200. Because the route carries `swr: 60`, this render would be frozen and every',
    '  reading of the governed matrix would measure it instead of the Home page.'
  ].join('\n')
}
