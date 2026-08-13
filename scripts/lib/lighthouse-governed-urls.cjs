/**
 * The governed Lighthouse URL population and profile set — ONE definition, two consumers.
 *
 * `lighthouserc.cjs` builds the collection list from this; `check-lighthouse-medians.mjs` asserts
 * that exactly this population was collected. Before Stage 2B the list lived only in
 * `lighthouserc.cjs`, which was sufficient while one process collected both profiles into one
 * directory tree and immediately asserted it. It is NOT sufficient once collection is sharded
 * across runners: nothing downstream would notice a shard that collected a smaller matrix, because
 * the median gate only ever grouped whatever reports it happened to find.
 *
 * CJS on purpose. `lighthouserc.cjs` is loaded by the `lhci` binary as CommonJS and cannot `require`
 * an ESM module synchronously; ESM consumers import this file through Node's CJS interop. Making
 * this file ESM would force the URL list to be duplicated, which is the exact failure it prevents.
 *
 * Adding a public route here adds it to the COLLECTION only. Every threshold continues to live in
 * `scripts/lib/lighthouse-medians.mjs`, copied from doc 20 §1 verbatim, and is re-baselined only by
 * a decision-log entry in doc 20 — never by editing this file.
 */

/**
 * Doc 20 §5's matrix: home, article, project and contact x both locales, plus the web-005 profile
 * slices. Paths, not absolute URLs: the governed frontend binds an EPHEMERAL port (LH_H2_PORT=0),
 * so the origin differs on every run and only the path is stable enough to assert coverage against.
 */
const GOVERNED_PATHS = [
  '/',
  '/ar',
  '/blog/staying-inside-performance-budget-nuxt',
  '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt',
  // web-005 Projects (D20-8's deferral closed for them). Slugs are the Prism contract examples,
  // which the mock serves for ANY slug — the gate must not depend on staging data.
  '/projects',
  '/ar/projects',
  '/projects/content-platform-api',
  '/ar/projects/content-platform-api',
  // web-005 Profile: Experience (008), About (009, D20-19), Resume (010, D20-21).
  '/experience',
  '/ar/experience',
  '/about',
  '/ar/about',
  '/resume',
  '/ar/resume',
  // web-005 Contact (011, D20-22). With these two, §5's four-page matrix is COMPLETE.
  '/contact',
  '/ar/contact'
]

/** The two governed run configurations. Each is collected separately and asserted separately. */
const PROFILES = ['mobile', 'desktop']

/**
 * Resolve a profile name, or THROW.
 *
 * There is deliberately no default. The superseded expression was
 * `process.env.LHCI_PROFILE === 'desktop' ? 'desktop' : 'mobile'`, which silently mapped every
 * unrecognised value — a typo, an empty string, an unset variable — onto `mobile`. That was
 * harmless while one process collected both profiles in a fixed order and could not misname either.
 * Under sharded collection it is the sharpest failure mode available: a `desktop` shard whose
 * profile silently resolved to `mobile` would collect a second mobile matrix, write it to
 * `.lighthouseci/desktop/`, and pass — because the median gate reads each report's OWN
 * `configSettings.formFactor` and would correctly apply mobile thresholds to it. Both shards green,
 * desktop never measured, no signal anywhere.
 *
 * Throwing surfaces as exit 2 (infrastructure) rather than exit 1 (a score verdict), which is the
 * same distinction `check-route-size.mjs` maintains: "the gate could not measure" must never be
 * reported as "the site is within budget".
 */
function resolveProfile(value) {
  if (PROFILES.includes(value)) return value
  throw new Error(
    `LHCI_PROFILE is ${value === undefined ? 'not set' : `"${value}"`} — expected exactly one of `
    + `${PROFILES.map(p => `"${p}"`).join(' or ')}. Governed collection runs through `
    + '`npm run lighthouse:ci`, which sets it per profile. There is no default: an unrecognised '
    + 'profile silently collecting the wrong matrix is how a run configuration goes unmeasured '
    + 'while its gate reports green.'
  )
}

module.exports = { GOVERNED_PATHS, PROFILES, resolveProfile }
