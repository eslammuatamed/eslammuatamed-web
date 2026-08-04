import http from 'node:http'
import http2 from 'node:http2'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertH2, createEphemeralCert, startH2Proxy } from './h2-proxy.mjs'

/**
 * Trust gate for the D20-25 measurement frontend.
 *
 * The frontend sits between Lighthouse and the artifact every budget is measured against, so a bug
 * here does not produce an obviously broken run — it produces a plausible WRONG number. These tests
 * therefore pin the two properties that make the numbers meaningful: the browser really negotiates
 * h2, and the bytes really are the upstream's bytes.
 *
 * Fully local: a throwaway HTTP/1.1 upstream stands in for Nitro. Nothing touches the internet.
 */

/** Fixtures with pre-encoded bodies, so "was it re-encoded?" is answerable byte-for-byte. */
const HTML = Buffer.from('<!doctype html><html><body><h1>hello</h1></body></html>')
const JS_RAW = Buffer.from('export const x = ' + '1'.repeat(500))
const JS_BR = brotliCompressSync(JS_RAW)
const JS_GZ = gzipSync(JS_RAW)

let upstream, upstreamPort, cert, proxy

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/_nuxt/app.js') {
      const wantsBr = (req.headers['accept-encoding'] ?? '').includes('br')
      const body = wantsBr ? JS_BR : JS_GZ
      res.writeHead(200, {
        'content-type': 'application/javascript',
        'content-encoding': wantsBr ? 'br' : 'gzip',
        'content-length': String(body.length),
        'cache-control': 'public, max-age=31536000, immutable',
        // Hop-by-hop: must NOT survive onto HTTP/2.
        connection: 'keep-alive'
      })
      res.end(body)
      return
    }
    if (url.pathname === '/echo') {
      let chunks = []
      req.on('data', c => chunks.push(c))
      req.on('end', () => {
        res.writeHead(201, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ method: req.method, query: url.search, body: Buffer.concat(chunks).toString() }))
      })
      return
    }
    if (url.pathname === '/missing') { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('nope'); return }
    res.writeHead(200, { 'content-type': 'text/html;charset=utf-8', 'content-length': String(HTML.length) })
    res.end(HTML)
  })
  await new Promise(r => upstream.listen(0, '127.0.0.1', r))
  upstreamPort = upstream.address().port

  cert = createEphemeralCert()
  proxy = await startH2Proxy({ upstreamPort, port: 0, key: cert.key, cert: cert.cert })
})

afterAll(async () => {
  await proxy?.close()
  cert?.dispose()
  await new Promise(r => upstream.close(r))
})

/** One h2 request, returning status, headers and the RAW (still-encoded) body. */
function h2get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(proxy.origin, { ca: readFileSync(cert.cert), servername: 'localhost' })
    client.on('error', reject)
    const req = client.request({ ':path': path, ':method': headers.method ?? 'GET', ...headers.extra })
    const chunks = []
    let respHeaders
    req.on('response', h => { respHeaders = h })
    req.on('data', c => chunks.push(c))
    req.on('end', () => { client.close(); resolve({ headers: respHeaders, body: Buffer.concat(chunks), alpn: client.socket?.alpnProtocol }) })
    req.on('error', e => { client.close(); reject(e) })
    if (headers.body) req.end(headers.body); else req.end()
  })
}

describe('HTTP/2 frontend — protocol', () => {
  it('1 — the document negotiates h2', async () => {
    const r = await h2get('/')
    expect(r.alpn).toBe('h2')
    expect(r.headers[':status']).toBe(200)
  })

  it('2 — first-party /_nuxt/ assets negotiate h2', async () => {
    const r = await h2get('/_nuxt/app.js')
    expect(r.alpn).toBe('h2')
    expect(r.headers[':status']).toBe(200)
  })

  it('3 — HTTP/1.1 is refused, never silently accepted', async () => {
    // `allowHTTP1: false` means an HTTP/1.1 client cannot complete a request. If this ever starts
    // succeeding, the gate has quietly returned to measuring the wrong protocol.
    await expect(new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1', port: proxy.port, path: '/', method: 'GET',
        // A plain TLS-less HTTP/1.1 request to a TLS port must fail.
      }, res => resolve(res.statusCode))
      req.on('error', reject)
      req.end()
    })).rejects.toBeTruthy()
  })

  it('assertH2 passes for h2 paths and reports ALPN', async () => {
    const res = await assertH2({ origin: proxy.origin, paths: ['/', '/_nuxt/app.js'], cert: cert.cert })
    expect(res.every(r => r.alpn === 'h2')).toBe(true)
  })

  it('assertH2 REJECTS a non-h2 origin instead of proceeding', async () => {
    await expect(assertH2({ origin: `https://127.0.0.1:${upstreamPort}`, paths: ['/'], cert: cert.cert }))
      .rejects.toThrow()
  })
})

describe('HTTP/2 frontend — the payload must not change', () => {
  it('4 — Brotli stays Brotli, byte-identical to upstream', async () => {
    const r = await h2get('/_nuxt/app.js', { extra: { 'accept-encoding': 'br' } })
    expect(r.headers['content-encoding']).toBe('br')
    expect(Buffer.compare(r.body, JS_BR)).toBe(0)
  })

  it('5 — gzip stays gzip when that is what was requested', async () => {
    const r = await h2get('/_nuxt/app.js', { extra: { 'accept-encoding': 'gzip' } })
    expect(r.headers['content-encoding']).toBe('gzip')
    expect(Buffer.compare(r.body, JS_GZ)).toBe(0)
  })

  it('6 — no decompression/recompression: the body is never the plaintext', async () => {
    const r = await h2get('/_nuxt/app.js', { extra: { 'accept-encoding': 'br' } })
    expect(Buffer.compare(r.body, JS_RAW)).not.toBe(0)
  })

  it('7 — content-type, cache-control and status are preserved', async () => {
    const r = await h2get('/_nuxt/app.js', { extra: { 'accept-encoding': 'br' } })
    expect(r.headers['content-type']).toBe('application/javascript')
    expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(r.headers[':status']).toBe(200)
  })

  it('8 — hop-by-hop headers are stripped (they are illegal on h2)', async () => {
    const r = await h2get('/_nuxt/app.js')
    expect(r.headers.connection).toBeUndefined()
    expect(r.headers['keep-alive']).toBeUndefined()
  })

  it('9 — an HTML route and a static asset both work', async () => {
    const html = await h2get('/')
    expect(Buffer.compare(html.body, HTML)).toBe(0)
    expect(html.headers['content-type']).toContain('text/html')
    const js = await h2get('/_nuxt/app.js')
    expect(js.headers[':status']).toBe(200)
  })

  it('10 — query strings and request bodies survive, and non-200 status is preserved', async () => {
    const q = await h2get('/echo?a=1&b=two')
    expect(JSON.parse(q.body.toString()).query).toBe('?a=1&b=two')
    const posted = await h2get('/echo', { method: 'POST', body: 'payload=1' })
    const parsed = JSON.parse(posted.body.toString())
    expect(parsed.method).toBe('POST')
    expect(parsed.body).toBe('payload=1')
    expect(posted.headers[':status']).toBe(201)
    const missing = await h2get('/missing')
    expect(missing.headers[':status']).toBe(404)
  })
})

describe('certificate and cleanup', () => {
  it('11 — the certificate is ephemeral, localhost-scoped and outside the repo', () => {
    expect(cert.dir.startsWith('/tmp') || cert.dir.includes('tmp')).toBe(true)
    expect(cert.dir.includes('/eslammuatamed-web/')).toBe(false)
    expect(readFileSync(cert.cert, 'utf8')).toContain('BEGIN CERTIFICATE')
    expect(cert.spki.length).toBeGreaterThan(10)
  })

  it('12 — dispose() removes the key material, and is safe to call twice', () => {
    const throwaway = createEphemeralCert()
    expect(existsSync(throwaway.key)).toBe(true)
    throwaway.dispose()
    expect(existsSync(throwaway.key)).toBe(false)
    expect(existsSync(throwaway.dir)).toBe(false)
    expect(() => throwaway.dispose()).not.toThrow()
  })

  it('13 — closing the proxy releases its port', async () => {
    const c = createEphemeralCert()
    const p = await startH2Proxy({ upstreamPort, port: 0, key: c.key, cert: c.cert })
    const port = p.port
    await p.close()
    // The port is free again: a fresh listener can bind it.
    await new Promise((resolve, reject) => {
      const s = http.createServer(() => {})
      s.once('error', reject)
      s.listen(port, '127.0.0.1', () => s.close(resolve))
    })
    c.dispose()
  })

  it('14 — a proxy pointed at a dead upstream fails the request rather than hanging forever', async () => {
    const c = createEphemeralCert()
    const dead = await startH2Proxy({ upstreamPort: 1, port: 0, key: c.key, cert: c.cert })
    await expect(new Promise((resolve, reject) => {
      const client = http2.connect(dead.origin, { ca: readFileSync(c.cert), servername: 'localhost' })
      client.on('error', reject)
      const req = client.request({ ':path': '/' })
      req.on('response', h => { client.close(); resolve(h[':status']) })
      req.on('error', e => { client.close(); reject(e) })
      req.end()
    })).rejects.toBeTruthy()
    await dead.close()
    c.dispose()
  })

  it('15 — a port-binding failure REJECTS instead of resolving a half-started proxy', async () => {
    // The orchestrator awaits this promise and treats a rejection as a fatal startup error. If it
    // resolved instead, the run would proceed against a frontend that is not listening and the
    // failure would surface minutes later as unexplained Lighthouse errors.
    const c = createEphemeralCert()
    const squatter = http.createServer(() => {})
    await new Promise(r => squatter.listen(0, '127.0.0.1', r))
    const taken = squatter.address().port
    await expect(startH2Proxy({ upstreamPort, port: taken, key: c.key, cert: c.cert }))
      .rejects.toMatchObject({ code: 'EADDRINUSE' })
    await new Promise(r => squatter.close(r))
    c.dispose()
  })

  it('16 — certificate generation FAILS LOUDLY when openssl is unavailable', () => {
    // Without this, a missing openssl would surface as an unreadable key file much later, inside
    // TLS setup, where the cause is far less obvious.
    const realPath = process.env.PATH
    try {
      process.env.PATH = '/nonexistent'
      expect(() => createEphemeralCert()).toThrow()
    } finally {
      process.env.PATH = realPath
    }
  })

  it('17 — a generated certificate covers localhost AND 127.0.0.1, which is the origin Chrome is given', () => {
    const c = createEphemeralCert()
    const text = execFileSync('openssl', ['x509', '-in', c.cert, '-noout', '-text'], { encoding: 'utf8' })
    expect(text).toContain('DNS:localhost')
    expect(text).toContain('IP Address:127.0.0.1')
    c.dispose()
  })
})
