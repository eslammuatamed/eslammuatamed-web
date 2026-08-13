/**
 * Governed-population coverage for the Lighthouse median gate.
 *
 * The median gate asserts thresholds on whatever run configurations it FINDS. That is correct as
 * far as it goes — and it is exactly why it cannot, on its own, tell the difference between "every
 * governed configuration passed" and "the configurations that were collected passed". Those read
 * identically on a green exit.
 *
 * This is the bidirectional check the per-route size gate already applies to dashboard routes
 * (`assertGovernedRouteCoverage`, D20-29). Both directions are load-bearing and a forward-only
 * check misses the second:
 *
 *   MISSING  — a governed (profile, path) produced no runs. Collection was truncated, or a shard
 *              collected the wrong profile. Without this, a shard that measured 14 of 16 URLs, or a
 *              `desktop` shard that actually ran `mobile`, exits 0.
 *   UNGOVERNED — runs exist for a (profile, path) that is not in the governed population. Reports
 *              leaked in from an earlier run, a different branch, or a stale directory, and are
 *              being asserted as though they described this build.
 *
 * Path, not URL. The governed HTTP/2 frontend binds an ephemeral port, so `requestedUrl` carries a
 * different origin on every run and only the path is comparable across runs.
 *
 * This is an INFRASTRUCTURE assertion (exit 2), never a score verdict (exit 1). "The gate could not
 * measure the governed population" is not "the site regressed", and conflating them would let a
 * broken collection be triaged as a performance problem.
 */
import { GOVERNED_PATHS, PROFILES } from './lighthouse-governed-urls.cjs'

/** `https://127.0.0.1:46309/ar/projects` -> `/ar/projects`. Trailing slash normalised, except root. */
export function pathOf(url, source = '<report>') {
  let pathname
  try {
    pathname = new URL(url).pathname
  } catch {
    throw new Error(`${source}: requestedUrl "${url}" is not a valid URL — cannot determine which governed route it measured`)
  }
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

/**
 * Assert that the collected summaries cover exactly the governed population for `expectProfiles`.
 *
 * @param {Array<{formFactor: string, url: string}>} summaries grouped runs, as the median gate has them
 * @param {string[]} expectProfiles the profiles THIS invocation was supposed to have collected
 * @returns {{profile: string, paths: string[]}[]} the verified coverage, for logging
 * @throws {Error} listing every divergence in BOTH directions — not just the first
 */
export function assertGovernedUrlCoverage(summaries, expectProfiles = PROFILES) {
  const unknownProfile = expectProfiles.find(p => !PROFILES.includes(p))
  if (unknownProfile !== undefined) {
    throw new Error(
      `"${unknownProfile}" is not a governed Lighthouse profile (expected ${PROFILES.join(', ')}). `
      + 'Asserting coverage against a profile that is not collected would pass vacuously.'
    )
  }
  if (expectProfiles.length === 0) {
    throw new Error('no profiles to assert coverage for — an empty expectation is satisfied by an empty collection')
  }

  const governed = new Set(GOVERNED_PATHS)
  const collected = new Map(expectProfiles.map(p => [p, new Set()]))
  const problems = []

  for (const s of summaries) {
    const path = pathOf(s.url, `${s.formFactor} ${s.url}`)
    if (!collected.has(s.formFactor)) {
      problems.push(
        `UNEXPECTED PROFILE: reports for "${s.formFactor}" ${path} were collected, but this run was `
        + `only asserting ${expectProfiles.join(', ')}. Reports from another profile are present in `
        + 'the asserted directories.'
      )
      continue
    }
    if (!governed.has(path)) {
      problems.push(`UNGOVERNED: ${s.formFactor} ${path} has reports but is not in the governed URL population`)
      continue
    }
    collected.get(s.formFactor).add(path)
  }

  for (const profile of expectProfiles) {
    const seen = collected.get(profile)
    const missing = GOVERNED_PATHS.filter(p => !seen.has(p))
    if (missing.length > 0) {
      problems.push(
        `MISSING: ${profile} collected ${seen.size}/${GOVERNED_PATHS.length} governed URLs — `
        + `no runs for ${missing.join(', ')}`
      )
    }
  }

  if (problems.length > 0) {
    throw new Error(
      'the collected Lighthouse reports are not the governed population:\n'
      + problems.map(p => `   · ${p}`).join('\n')
      + '\n  The governed population is defined in scripts/lib/lighthouse-governed-urls.cjs and is '
      + 'collected by `npm run lighthouse:ci`.'
    )
  }

  return expectProfiles.map(profile => ({ profile, paths: [...collected.get(profile)].sort() }))
}

/** One line per profile, stating the count that was verified rather than merely that it passed. */
export function describeCoverage(covered) {
  return covered
    .map(({ profile, paths }) => `${profile}: all ${paths.length}/${GOVERNED_PATHS.length} governed URLs collected`)
    .join('; ')
}
