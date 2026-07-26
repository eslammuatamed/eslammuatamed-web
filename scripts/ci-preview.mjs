#!/usr/bin/env node
/**
 * Deterministic production-like preview for the Lighthouse CI gate (doc 20 §5).
 *
 * Serves the real `.output` Nitro build behind a Prism mock of the COMMITTED contract
 * (`openapi/openapi.json`) rather than the hosted staging API, so the gate:
 *   - never depends on mutable staging data or staging uptime;
 *   - gives article/blog routes stable content, so LCP and CLS are reproducible run to run;
 *   - measures the same artifact the deploy ships.
 *
 * `NUXT_PUBLIC_SITE_URL` is intentionally the real public origin, not localhost: canonical,
 * og:url, hreflang and the sitemap are baked at build time, and the gate asserts they are
 * correct. Only the LISTENING address is local.
 *
 * Exits non-zero if either process dies, and tears both down on SIGINT/SIGTERM so Lighthouse CI
 * never leaves an orphaned mock behind.
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const WEB_PORT = process.env.CI_PREVIEW_PORT ?? '3000'
const API_PORT = process.env.CI_MOCK_PORT ?? '3001'

const children = []
let shuttingDown = false

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
  // Give children a moment to exit on their own before the parent goes away.
  setTimeout(() => process.exit(code), 300)
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...env }
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    console.error(`[ci-preview] ${name} exited unexpectedly (code=${code} signal=${signal}).`)
    shutdown(code ?? 1)
  })
  child.on('error', (error) => {
    console.error(`[ci-preview] failed to start ${name}: ${error.message}`)
    shutdown(1)
  })
  children.push(child)
  return child
}

// 1. Contract mock first — the Nitro server fetches it during SSR.
start('prism', 'npx', ['prism', 'mock', 'openapi/openapi.json', '--port', API_PORT])

// 2. The built Nitro server. Its runtime API base points at the mock.
start('nitro', 'node', ['.output/server/index.mjs'], {
  PORT: WEB_PORT,
  HOST: '127.0.0.1',
  NUXT_PUBLIC_API_BASE: `http://127.0.0.1:${API_PORT}/api/v1`
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0))

// Printed last so Lighthouse CI's readiness pattern only matches once both are spawned.
console.log(`[ci-preview] listening on http://127.0.0.1:${WEB_PORT} (contract mock on ${API_PORT})`)
