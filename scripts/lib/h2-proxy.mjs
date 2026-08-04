/**
 * Local TLS + HTTP/2 frontend for governed Lighthouse measurement (doc 20 §5.1, D20-25).
 *
 * WHY THIS EXISTS. The gate used to point Lighthouse straight at Nitro over **HTTP/1.1**, while
 * production serves HTTP/2 (Cloudflare → Caddy → Nitro). That is not a cosmetic difference: HTTP/1.1
 * caps a browser at six connections per origin, so the ~31 first-party requests a public route makes
 * serialise into queues that HTTP/2 multiplexes away. Measured at Web `9876279` — same build, same
 * machine, same Chrome, byte-identical Brotli assets, ONLY the browser-facing protocol changed —
 * `/ar` moved from a 4441 ms LCP median to 3389 ms and `/` from 3392 ms to 2636 ms. The old path was
 * therefore charging every route for a protocol artefact that no real visitor pays.
 *
 * WHAT THIS IS NOT. It is protocol-class parity, not CDN parity. Cloudflare, edge cache state and
 * real RTT are deliberately absent: they are exactly what makes a gate non-deterministic. Lighthouse
 * against the public domain stays diagnostic (D20-25).
 *
 * THE ONE RULE THIS FILE MUST NEVER BREAK: it may change how bytes are *carried*, never what they
 * are. Upstream bodies are piped through untouched — a Brotli asset stays Brotli, byte-for-byte, and
 * nothing is ever decompressed and recompressed. Only hop-by-hop headers, which are illegal on
 * HTTP/2, are stripped. If this file started re-encoding, the budget gates measured downstream would
 * silently begin measuring the proxy instead of the build.
 */
import http2 from 'node:http2'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Headers that are meaningless or illegal once the response leaves HTTP/1.1. `node:http2` throws on
 * `connection`, so this is correctness rather than tidiness.
 */
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'http2-settings'
])

/**
 * An ephemeral, localhost-scoped certificate.
 *
 * Generated per run into a temp directory, never written into the repository and never committed —
 * a checked-in private key would be a real credential leak for the sake of a test fixture. The SPKI
 * fingerprint is returned so Chrome can be told to trust EXACTLY this key and nothing else, instead
 * of disabling certificate validation wholesale.
 */
export function createEphemeralCert() {
  const dir = mkdtempSync(join(tmpdir(), 'lh-h2-cert-'))
  const key = join(dir, 'key.pem')
  const cert = join(dir, 'cert.pem')

  // A FAILED generation must not leave the directory behind. `openssl req` writes `key.pem` before
  // `cert.pem`, so a failure partway through leaves a real PRIVATE KEY on disk — and the caller has
  // no handle to dispose, because this function never returned one. Observed as empty
  // `lh-h2-cert-*` directories surviving a test run; the same path with openssl failing later would
  // have left key material instead.
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', cert,
      '-days', '1', '-nodes', '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'
    ], { stdio: 'pipe' })

    // Chrome's narrow allowance: trust this one public key, not "any bad certificate".
    const spki = execFileSync('bash', ['-c',
      `openssl x509 -in '${cert}' -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`
    ], { encoding: 'utf8' }).trim()

    return { dir, key, cert, spki, dispose: () => rmSync(dir, { recursive: true, force: true }) }
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}

/**
 * Start the HTTP/2 frontend.
 *
 * ALPN offers `h2` first, so any modern browser negotiates HTTP/2. The socket still accepts HTTP/1.1
 * because refusing it made Nitro's chunked responses hang mid-stream, and a frontend that hangs is a
 * worse failure than one that *could* be spoken to over HTTP/1.1 by something that is not the
 * browser. The real guarantee is `assertH2()`, which reads the negotiated ALPN of the actual
 * document and a real asset and refuses to measure unless both are `h2`.
 */
export function startH2Proxy({ upstreamPort, port, key, cert, onError }) {
  const server = http2.createSecureServer({
    key: readFileSync(key),
    cert: readFileSync(cert),
    // ALPN offers h2 FIRST, so any modern browser negotiates it. HTTP/1.1 is still accepted at the
    // socket because refusing it made Nitro's chunked responses hang mid-stream — and a frontend that
    // hangs is worse than one that could theoretically be spoken to over HTTP/1.1. The guarantee that
    // the measurement really used h2 comes from `assertH2()`, which inspects the negotiated ALPN of
    // the actual document and a real asset before the matrix is allowed to run.
    allowHTTP1: true,
    ALPNProtocols: ['h2', 'http/1.1']
  })

  server.on('stream', (stream, headers) => {
    const method = headers[':method'] ?? 'GET'
    // `:path` carries the query string already; forwarding it verbatim preserves it.
    const path = headers[':path'] ?? '/'

    const outHeaders = {}
    for (const [k, v] of Object.entries(headers)) {
      if (k.startsWith(':') || HOP_BY_HOP.has(k)) continue
      outHeaders[k] = v
    }
    outHeaders.host = `127.0.0.1:${upstreamPort}`

    const req = http.request(
      { host: '127.0.0.1', port: upstreamPort, path, method, headers: outHeaders },
      (res) => {
        const respHeaders = { ':status': res.statusCode }
        for (const [k, v] of Object.entries(res.headers)) {
          if (HOP_BY_HOP.has(k.toLowerCase())) continue
          respHeaders[k] = v
        }
        try { stream.respond(respHeaders) } catch { return }
        // Pipe, never transform: `content-encoding` and the compressed bytes both survive intact.
        res.pipe(stream)
      }
    )
    req.on('error', () => { try { stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR) } catch { /* already gone */ } })
    stream.on('error', () => { try { req.destroy() } catch { /* already gone */ } })

    if (method === 'GET' || method === 'HEAD') req.end()
    else stream.pipe(req)
  })

  if (onError) server.on('error', onError)

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        port: server.address().port,
        origin: `https://127.0.0.1:${server.address().port}`,
        close: () => new Promise(done => server.close(() => done()))
      })
    })
  })
}

/**
 * Assert the BROWSER-FACING protocol, before the expensive matrix runs.
 *
 * Deliberately not the `uses-http2` Lighthouse audit: that audit is skipped in `lighthouserc.cjs`,
 * and "an audit we do not run said nothing" is not evidence. This asks the TLS/ALPN layer directly,
 * for both a document and a first-party `/_nuxt/` asset, because a frontend could conceivably serve
 * one over h2 and fall back for the other.
 */
export async function assertH2({ origin, paths, cert }) {
  const results = []
  // TLS verification stays ON. We trust exactly the ephemeral certificate this run generated, by
  // passing it as the CA — never `rejectUnauthorized: false`, which would accept any certificate and
  // make the check meaningless as a check.
  const ca = readFileSync(cert)
  for (const p of paths) {
    const url = new URL(p, origin)
    const alpn = await new Promise((resolve, reject) => {
      const client = http2.connect(origin, { ca, servername: 'localhost' }, () => {
        const proto = client.socket?.alpnProtocol ?? null
        const req = client.request({ ':path': url.pathname + url.search, ':method': 'GET' })
        let status = null
        req.on('response', h => { status = h[':status'] })
        req.on('data', () => {})
        req.on('end', () => { client.close(); resolve({ proto, status }) })
        req.on('error', e => { client.close(); reject(e) })
        req.end()
      })
      client.on('error', reject)
    })
    results.push({ path: p, alpn: alpn.proto, status: alpn.status })
  }
  const bad = results.filter(r => r.alpn !== 'h2')
  if (bad.length > 0) {
    throw new Error(
      'Browser-facing protocol is NOT HTTP/2 — refusing to measure.\n'
      + bad.map(r => `  ${r.path}: alpn=${r.alpn ?? 'none'} status=${r.status}`).join('\n')
      + '\nGoverned Lighthouse requires h2 (doc 20 §5.1, D20-25). Measuring over HTTP/1.1 overstates LCP.'
    )
  }
  return results
}
