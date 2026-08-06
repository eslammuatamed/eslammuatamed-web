#!/usr/bin/env node
/**
 * Locale-selecting front end for the Prism contract mock.
 *
 * WHY THIS EXISTS. Prism replays ONE response body per operation. Until the contract carried named
 * examples, `/settings/site` had only schema-level property examples — which are locale-blind — so
 * `?locale=ar` was answered with the English identity (`siteName: "Eslam Muatamed"`). Every Arabic
 * page in every gate therefore rendered a Latin `h1` under an Arabic font stack, and `/ar/resume`'s
 * mobile CLS budget failed on a FIXTURE defect wearing the costume of a product regression.
 *
 * The API contract now documents named `en` / `ar` response examples, and Prism selects between
 * them with `Prefer: example=<name>` (its documented mechanism). This process is the ONE place that
 * header is attached; the decision itself lives in `prism-locale-selection.mjs`.
 *
 * WHY A PROXY AND NOT APPLICATION CODE. The selection is a property of the MOCK, not of the
 * product: the real API resolves `?locale=` from its database and needs no such header. Putting it
 * in `useApi()` would ship a mock-only header to production and duplicate backend behaviour in the
 * client. Here it lives below Nitro, in a process that exists only in the harness — so "the header
 * cannot leak into production" holds BY CONSTRUCTION rather than by a test that could rot.
 *
 * WHY IT IS WIRED IN `ci-preview.mjs` AND NOT IN `playwright.config.ts`. The Lighthouse gate, the
 * per-route size gate and the Playwright `contract` project all reach Prism through
 * `ci-preview.mjs --backend prism`. A Playwright-only fixture would fix the e2e lane and leave the
 * failing CLS gate still measuring the English fixture.
 */
import { createServer, request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { readExampleIndex, selectExample } from './prism-locale-selection.mjs'

const [, , listenPortArg, upstreamPortArg, contractPathArg] = process.argv
const LISTEN_PORT = Number(listenPortArg)
const UPSTREAM_PORT = Number(upstreamPortArg)
const CONTRACT_PATH = contractPathArg ?? 'openapi/openapi.json'

if (!Number.isInteger(LISTEN_PORT) || !Number.isInteger(UPSTREAM_PORT)) {
  console.error(
    '[prism-locale-proxy] usage: prism-locale-proxy.mjs <listenPort> <upstreamPort> [contractPath]'
  )
  process.exit(1)
}

const EXAMPLE_INDEX = readExampleIndex(JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')))

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${LISTEN_PORT}`)
  const example = selectExample(EXAMPLE_INDEX, req.method ?? 'GET', url.pathname, url.searchParams)

  // `Prefer` is REPLACED, never appended to: a caller-supplied value would otherwise race with the
  // one derived here and Prism would honour whichever it parsed first.
  const headers = { ...req.headers, host: `127.0.0.1:${UPSTREAM_PORT}` }
  if (example) headers.prefer = `example=${example}`
  else delete headers.prefer

  const upstream = httpRequest(
    { host: '127.0.0.1', port: UPSTREAM_PORT, method: req.method, path: req.url, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    }
  )

  // A failed upstream hop must LOOK like a failed upstream hop. Returning anything that parses as a
  // valid payload would let a dead mock render as a healthy page and silently change what every
  // gate measures — the INF-A lesson, one process lower.
  upstream.on('error', (error) => {
    console.error(`[prism-locale-proxy] upstream error: ${error.message}`)
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/problem+json' })
    res.end(JSON.stringify({ title: 'Contract mock unreachable', status: 502 }))
  })

  req.pipe(upstream)
})

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(1000, () => done(false))
  })
}

/**
 * DO NOT BIND UNTIL PRISM IS LISTENING. `ci-preview.mjs` gates readiness on THIS port, and Nitro
 * starts serving as soon as that gate opens. Binding early would announce a backend that cannot yet
 * answer, and a page server-rendered in that window caches its ERROR state — precisely the failure
 * the readiness gate exists to prevent.
 */
const deadline = Date.now() + 90_000
let upstreamReady = false
while (Date.now() < deadline && !upstreamReady) {
  upstreamReady = await canConnect(UPSTREAM_PORT)
  if (!upstreamReady) await sleep(250)
}

if (!upstreamReady) {
  console.error(`[prism-locale-proxy] prism did not start listening on ${UPSTREAM_PORT}.`)
  process.exit(1)
}

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  const operations = [...EXAMPLE_INDEX.keys()].join(', ') || '(none)'
  console.log(
    `[prism-locale-proxy] ${LISTEN_PORT} → ${UPSTREAM_PORT}; locale-selectable: ${operations}`
  )
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
