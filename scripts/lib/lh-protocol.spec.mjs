import { describe, expect, it } from 'vitest'
import { assertCollectionUsedH2, assertReportUsedH2, classifyReport, formatProtocolSummary } from './lh-protocol.mjs'

/**
 * Trust gate for the MEASURED-SESSION protocol proof (doc 20 §5.1, D20-25).
 *
 * The preflight in `h2-proxy.spec.mjs` proves the frontend can speak h2 to a Node client. These
 * tests cover the thing that actually gates the release: whether CHROME did, judged from the record
 * Lighthouse wrote. The fixture shapes below are taken from a real report produced by this repo's
 * own governed run — `audits['network-requests'].details.items[]`, with `protocol` reading `h2` for
 * negotiated requests, `data` for inline URIs, and `''` for a request that never completed.
 */

const ORIGIN = 'https://127.0.0.1:43609'

/** Build a report whose requests are exactly what the test cares about. */
function report(items, { url = `${ORIGIN}/ar`, formFactor = 'mobile' } = {}) {
  return {
    requestedUrl: url,
    finalDisplayedUrl: url,
    configSettings: { formFactor },
    audits: { 'network-requests': { details: { items } } }
  }
}

const doc = (protocol = 'h2') => ({ url: `${ORIGIN}/ar`, protocol, resourceType: 'Document', mimeType: 'text/html', statusCode: 200 })
const script = (protocol = 'h2', name = 'B1xBJ3t3') => ({ url: `${ORIGIN}/_nuxt/${name}.js`, protocol, resourceType: 'Script', mimeType: 'text/javascript', statusCode: 200 })
const style = (protocol = 'h2') => ({ url: `${ORIGIN}/_nuxt/entry.DourorVS.css`, protocol, resourceType: 'Stylesheet', mimeType: 'text/css', statusCode: 200 })
const font = (protocol = 'h2') => ({ url: `${ORIGIN}/_nuxt/cairo.woff2`, protocol, resourceType: 'Font', mimeType: 'font/woff2', statusCode: 200 })

/** A complete, healthy first-party trace. */
const healthy = () => [doc(), style(), script(), script('h2', 'DuGQD-Hs'), font()]

describe('measured-session protocol proof — the h2 requirement', () => {
  it('1 — accepts a run where the document and every first-party asset negotiated h2', () => {
    const c = assertReportUsedH2(report(healthy()))
    expect(c.required.document.protocol).toBe('h2')
    expect(c.required.scripts).toHaveLength(2)
    expect(c.violations).toHaveLength(0)
  })

  it('2 — REJECTS the run when the main document fell back to HTTP/1.1', () => {
    expect(() => assertReportUsedH2(report([doc('http/1.1'), style(), script()])))
      .toThrow(/main document served over "http\/1\.1"/)
  })

  it('3 — REJECTS the run when a /_nuxt/ script fell back, even though the document was h2', () => {
    // The exact defect the preflight cannot see: a document over h2 and assets over h1 would still
    // serialise the request queue and overstate LCP.
    expect(() => assertReportUsedH2(report([doc(), script('http/1.1')])))
      .toThrow(/first-party \/_nuxt\/ script served over "http\/1\.1"/)
  })

  it('4 — REJECTS the run when first-party CSS fell back', () => {
    expect(() => assertReportUsedH2(report([doc(), style('http/1.1'), script()])))
      .toThrow(/first-party stylesheet served over "http\/1\.1"/)
  })

  it('5 — REJECTS the run when a first-party font fell back', () => {
    expect(() => assertReportUsedH2(report([doc(), script(), font('http/1.1')])))
      .toThrow(/first-party font served over "http\/1\.1"/)
  })

  it('6 — REJECTS a trace with no first-party JavaScript, rather than passing it vacuously', () => {
    // Without this, a broken collection that fetched only the document would "prove" h2.
    expect(() => assertReportUsedH2(report([doc()])))
      .toThrow(/no first-party \/_nuxt\/ script/)
  })

  it('7 — REJECTS a trace with no document at all', () => {
    expect(() => assertReportUsedH2(report([script()])))
      .toThrow(/no first-party Document request/)
  })

  it('8 — REJECTS a report that has no network-requests audit, instead of assuming success', () => {
    expect(() => classifyReport({ finalDisplayedUrl: `${ORIGIN}/ar`, audits: {} }))
      .toThrow(/has no `network-requests` audit/)
  })

  it('9 — names every distinct fallback in one failure, not just the first', () => {
    let message = ''
    try { assertReportUsedH2(report([doc('http/1.1'), style('http/1.1'), script('http/1.1')])) } catch (e) { message = e.message }
    expect(message).toMatch(/main document served over/)
    expect(message).toMatch(/stylesheet served over/)
    expect(message).toMatch(/script served over/)
  })
})

describe('measured-session protocol proof — classification', () => {
  it('10 — data: URIs are never gated; they have no protocol to negotiate', () => {
    const items = [...healthy(), { url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', protocol: 'data', resourceType: 'Image' }]
    const c = assertReportUsedH2(report(items))
    expect(c.nonNegotiated).toHaveLength(1)
    expect(c.firstParty.some(i => i.protocol === 'data')).toBe(false)
  })

  it('11 — third-party traffic is classified separately and does NOT fail the run', () => {
    // Real observed case: the media CDN is a third party and is outside the frontend's control.
    // Gating on it would fail honest runs for reasons unrelated to the methodology.
    const items = [...healthy(), { url: 'https://media.eslammuatamed.com/hero.webp', protocol: '', resourceType: 'Image' }]
    const c = assertReportUsedH2(report(items))
    expect(c.thirdParty).toHaveLength(1)
    expect(c.violations).toHaveLength(0)
  })

  it('12 — a third party served over HTTP/1.1 is reported but does not fail the run', () => {
    const items = [...healthy(), { url: 'https://cdn.example.com/a.js', protocol: 'http/1.1', resourceType: 'Script' }]
    const summary = assertCollectionUsedH2([report(items)])
    expect(summary.thirdPartyByProtocol['http/1.1']).toBe(1)
    expect(summary.firstPartyByProtocol.h2).toBe(5)
  })

  it('13 — a first-party request that never completed is not mislabelled as an HTTP/1.1 fallback', () => {
    const items = [...healthy(), { url: `${ORIGIN}/_nuxt/late.js`, protocol: '', resourceType: 'Script' }]
    const c = assertReportUsedH2(report(items))
    expect(c.violations).toHaveLength(0)
  })

  it('14 — an empty collection is a failure, not a vacuous pass', () => {
    expect(() => assertCollectionUsedH2([]))
      .toThrow(/no Lighthouse reports to verify the protocol against/)
  })

  it('15 — one bad report in a collection fails the whole collection', () => {
    expect(() => assertCollectionUsedH2([report(healthy()), report([doc('http/1.1'), script()])]))
      .toThrow(/did NOT measure/)
  })
})

describe('measured-session protocol proof — reporting', () => {
  it('16 — the summary counts both parties and lists third-party origins', () => {
    const items = [...healthy(), { url: 'https://cdn.example.com/a.js', protocol: 'http/1.1', resourceType: 'Script' }]
    const summary = assertCollectionUsedH2([report(items), report(healthy(), { url: `${ORIGIN}/`, formFactor: 'desktop' })])
    expect(summary.reports).toBe(2)
    expect(summary.routes).toBe(2)
    expect(summary.thirdPartyOrigins).toEqual(['https://cdn.example.com'])
  })

  it('17 — the log summary never leaks certificate or key material', () => {
    const summary = assertCollectionUsedH2([report(healthy())])
    const text = formatProtocolSummary(summary)
    expect(text).toMatch(/first-party: h2=5/)
    expect(text).not.toMatch(/BEGIN|PRIVATE KEY|CERTIFICATE|\.pem/)
  })
})
