/**
 * Post-collection proof that CHROME actually spoke HTTP/2 (doc 20 §5.1, D20-25).
 *
 * WHY A SECOND CHECK. `assertH2()` in `h2-proxy.mjs` is a Node client asking the TLS layer what it
 * negotiated. That is necessary — it catches a frontend that is not serving h2 at all, before the
 * expensive matrix runs — but it is NOT sufficient, and the gap is not theoretical:
 *
 *   - the frontend keeps `allowHTTP1: true`, because refusing HTTP/1.1 made Nitro's chunked
 *     responses hang. The server will therefore happily serve h1 to anything that asks for it;
 *   - a Node `http2.connect()` client proves what NODE negotiated, not what CHROME negotiated;
 *   - the `uses-http2` Lighthouse audit is deliberately skipped, and "an audit we do not run said
 *     nothing" is not evidence.
 *
 * So the only thing that can prove the MEASUREMENT used h2 is the measurement's own record. This
 * reads `audits['network-requests']` out of each report Lighthouse wrote — Chrome's view of every
 * request it actually made — and refuses the run if the document or any required first-party asset
 * came over HTTP/1.1.
 *
 * FIRST-PARTY vs EVERYTHING ELSE. Only same-origin requests are gated. `data:` URIs have no protocol
 * to negotiate, and third-party origins are outside the frontend's control — gating on those would
 * fail the run for reasons that have nothing to do with the methodology. They are counted and
 * reported separately so the classification stays visible rather than implicit.
 */

/** Chrome reports HTTP/2 as `h2`. Anything else on a first-party request is a fallback. */
export const H2 = 'h2'

/** Requests with no protocol to negotiate — never gated, never counted as a fallback. */
const NON_NEGOTIATED = new Set(['data', 'blob', 'about', 'chrome-extension', 'filesystem'])

function originOf(url) {
  try { return new URL(url).origin } catch { return null }
}

/**
 * Classify every request in one Lighthouse report.
 *
 * @param lhr a parsed Lighthouse result object
 * @returns {{ url: string, formFactor: string, baseOrigin: string|null,
 *             firstParty: object[], thirdParty: object[], nonNegotiated: object[],
 *             violations: object[], required: { document: object|null, scripts: object[],
 *             styles: object[], fonts: object[] } }}
 */
export function classifyReport(lhr) {
  const items = lhr?.audits?.['network-requests']?.details?.items
  if (!Array.isArray(items)) {
    throw new Error(
      `report for ${lhr?.finalDisplayedUrl ?? lhr?.finalUrl ?? 'unknown URL'} has no `
      + '`network-requests` audit — cannot prove the browser-facing protocol. '
      + 'Governed Lighthouse requires this audit (doc 20 §5.1, D20-25).'
    )
  }

  const pageUrl = lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl
  const baseOrigin = originOf(pageUrl)

  const firstParty = []
  const thirdParty = []
  const nonNegotiated = []

  for (const item of items) {
    const protocol = item.protocol ?? ''
    if (NON_NEGOTIATED.has(protocol) || originOf(item.url) === null) {
      nonNegotiated.push(item)
      continue
    }
    if (baseOrigin !== null && originOf(item.url) === baseOrigin) firstParty.push(item)
    else thirdParty.push(item)
  }

  // A first-party request that never completed has no protocol to judge; it is a load failure, not
  // an HTTP/1.1 fallback, and is surfaced as its own problem rather than mislabelled as one.
  const attempted = firstParty.filter(i => i.protocol !== '')
  const violations = attempted.filter(i => i.protocol !== H2)

  const isNuxtScript = i => i.resourceType === 'Script' && new URL(i.url).pathname.startsWith('/_nuxt/')
  const required = {
    document: firstParty.find(i => i.resourceType === 'Document') ?? null,
    scripts: firstParty.filter(isNuxtScript),
    styles: firstParty.filter(i => i.resourceType === 'Stylesheet'),
    fonts: firstParty.filter(i => i.resourceType === 'Font')
  }

  return {
    url: pageUrl,
    formFactor: lhr?.configSettings?.formFactor ?? 'unknown',
    baseOrigin,
    firstParty,
    thirdParty,
    nonNegotiated,
    violations,
    required
  }
}

/**
 * Assert one report proves an h2 session.
 *
 * Three independent failure modes, each reported distinctly so a failure says what broke:
 *   1. a required first-party resource class is missing entirely (the trace is not what we think);
 *   2. the document, a `/_nuxt/` script, or first-party CSS/fonts came over something other than h2;
 *   3. any other first-party request fell back.
 */
export function assertReportUsedH2(lhr) {
  const c = classifyReport(lhr)
  const problems = []

  if (!c.required.document) {
    problems.push('no first-party Document request in the trace')
  } else if (c.required.document.protocol !== H2) {
    problems.push(`main document served over "${c.required.document.protocol}" (expected ${H2}): ${c.required.document.url}`)
  }

  if (c.required.scripts.length === 0) {
    problems.push('no first-party /_nuxt/ script in the trace — the page did not load its own JavaScript')
  }

  // CSS and fonts are asserted WHEN PRESENT: a route legitimately may ship no separate font file,
  // and inventing a requirement the build does not have would fail honest runs.
  for (const [label, list] of [['/_nuxt/ script', c.required.scripts], ['stylesheet', c.required.styles], ['font', c.required.fonts]]) {
    for (const item of list) {
      if (item.protocol !== H2 && item.protocol !== '') {
        problems.push(`first-party ${label} served over "${item.protocol}" (expected ${H2}): ${item.url}`)
      }
    }
  }

  for (const v of c.violations) {
    problems.push(`first-party request served over "${v.protocol}" (expected ${H2}): ${v.url}`)
  }

  if (problems.length > 0) {
    throw new Error(
      `Chrome did NOT measure ${c.url} over HTTP/2 — refusing to report these numbers.\n`
      + [...new Set(problems)].map(p => `  · ${p}`).join('\n')
      + '\nGoverned Lighthouse measures the protocol production serves (doc 20 §5.1, D20-25).'
      + '\nMeasuring over HTTP/1.1 serialises first-party requests and overstates LCP.'
    )
  }

  return c
}

/**
 * Assert an entire collection, and summarise it.
 *
 * The summary deliberately contains no certificate material — only origins, counts and protocols.
 */
export function assertCollectionUsedH2(reports) {
  if (reports.length === 0) {
    throw new Error('no Lighthouse reports to verify the protocol against — the collection produced nothing')
  }

  const classified = reports.map(assertReportUsedH2)

  const firstPartyByProtocol = {}
  const thirdPartyByProtocol = {}
  let nonNegotiated = 0
  for (const c of classified) {
    for (const i of c.firstParty) firstPartyByProtocol[i.protocol || '(no response)'] = (firstPartyByProtocol[i.protocol || '(no response)'] ?? 0) + 1
    for (const i of c.thirdParty) thirdPartyByProtocol[i.protocol || '(no response)'] = (thirdPartyByProtocol[i.protocol || '(no response)'] ?? 0) + 1
    nonNegotiated += c.nonNegotiated.length
  }

  return {
    reports: classified.length,
    routes: [...new Set(classified.map(c => c.url))].length,
    firstPartyByProtocol,
    thirdPartyByProtocol,
    nonNegotiated,
    thirdPartyOrigins: [...new Set(classified.flatMap(c => c.thirdParty.map(i => {
      try { return new URL(i.url).origin } catch { return 'unparseable' }
    })))]
  }
}

/** One-line-per-fact summary for CI logs. Contains no key material. */
export function formatProtocolSummary(summary) {
  const fmt = obj => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'
  return [
    `[protocol] reports=${summary.reports} routes=${summary.routes}`,
    `[protocol] first-party: ${fmt(summary.firstPartyByProtocol)}`,
    `[protocol] third-party: ${fmt(summary.thirdPartyByProtocol)}${summary.thirdPartyOrigins.length ? ` (${summary.thirdPartyOrigins.join(', ')})` : ''}`,
    `[protocol] non-negotiated (data:/blob:) requests: ${summary.nonNegotiated}`
  ].join('\n')
}
