#!/usr/bin/env node
/**
 * THE canonical governed Lighthouse entry point (doc 20 §5.1, D20-25).
 *
 * `npm run lighthouse:ci` is the single command local developers, PR CI, dev-push CI and the
 * dev→main promotion all run. There is deliberately no second governed path: two launch routes mean
 * two methodologies, and the whole reason this file exists is that the gate was silently measuring a
 * protocol production does not serve.
 *
 * It owns the entire lifecycle so nobody has to remember steps:
 *   build check → contract mock + Nitro preview → ephemeral localhost cert → HTTP/2 frontend →
 *   PROTOCOL ASSERTION → mobile matrix → desktop matrix → median assertions → teardown.
 *
 * Teardown runs on success, on failure, and on SIGINT/SIGTERM. Ports and certificates are released
 * either way — a half-cleaned run poisons the next one, and a leaked private key is worse than a
 * failed build.
 *
 * The protocol assertion runs BEFORE the matrix on purpose. The matrix costs minutes; discovering
 * afterwards that the frontend fell back to HTTP/1.1 would mean throwing all of it away, and worse,
 * someone might not notice and would ship the wrong numbers.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { assertH2, createEphemeralCert, startH2Proxy } from './lib/h2-proxy.mjs'

const WEB_PORT = Number(process.env.CI_PREVIEW_PORT ?? 3000)
const API_PORT = Number(process.env.CI_MOCK_PORT ?? 3001)
// 0 lets the OS pick a free port, so parallel jobs and local runs cannot collide.
const H2_PORT = Number(process.env.LH_H2_PORT ?? 0)

/** Everything we own, torn down in reverse order exactly once. */
const owned = { preview: null, proxy: null, cert: null }
let cleanedUp = false

async function cleanup(reason) {
  if (cleanedUp) return
  cleanedUp = true
  if (reason) console.log(`\n[lighthouse:ci] cleanup (${reason})`)
  try { if (owned.proxy) await owned.proxy.close() } catch { /* best effort */ }
  if (owned.preview) {
    // The preview owns a process GROUP (Nitro + Prism); signalling the leader alone orphans children.
    try { process.kill(-owned.preview.pid, 'SIGTERM') } catch { /* already gone */ }
  }
  for (const port of [WEB_PORT, API_PORT]) {
    try {
      const pid = execFileSync('bash', ['-c',
        `ss -ltnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\\K[0-9]+' | head -1`
      ], { encoding: 'utf8' }).trim()
      if (pid) execFileSync('kill', ['-TERM', pid], { stdio: 'ignore' })
    } catch { /* nothing listening */ }
  }
  // The private key goes last and unconditionally.
  try { owned.cert?.dispose() } catch { /* best effort */ }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await cleanup(sig); process.exit(130) })
}

/**
 * Run a child command WITHOUT blocking this process's event loop.
 *
 * This is load-bearing, not style. The HTTP/2 frontend runs inside THIS process, so a synchronous
 * child (`execFileSync`) would freeze the event loop for the whole matrix — the frontend would stop
 * answering, and Lighthouse would record `NO_FCP` on every route while looking like a product
 * failure. Observed exactly that before this was made async.
 */
function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('error', reject)
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))))
  })
}

async function waitForPort(port, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await new Promise((res, rej) => {
        const c = spawn('curl', ['-sf', '-o', '/dev/null', `http://127.0.0.1:${port}/`])
        c.on('exit', code => (code === 0 ? res() : rej(new Error('not up'))))
        c.on('error', rej)
      })
      return true
    } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  throw new Error(`${label} did not start listening on ${port} within ${timeoutMs} ms`)
}

async function main() {
  if (!existsSync('.output/server/index.mjs')) {
    throw new Error('no production build — run `npm run build` first (governed Lighthouse measures the real .output)')
  }

  console.log('[lighthouse:ci] starting Nitro preview + contract mock…')
  owned.preview = spawn('node', ['scripts/ci-preview.mjs'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
    env: { ...process.env, CI_PREVIEW_PORT: String(WEB_PORT), CI_MOCK_PORT: String(API_PORT) }
  })
  await waitForPort(WEB_PORT, 'nitro preview')

  console.log('[lighthouse:ci] generating ephemeral localhost certificate…')
  owned.cert = createEphemeralCert()

  console.log('[lighthouse:ci] starting HTTP/2 frontend…')
  owned.proxy = await startH2Proxy({
    upstreamPort: WEB_PORT, port: H2_PORT, key: owned.cert.key, cert: owned.cert.cert
  })
  const origin = owned.proxy.origin
  console.log(`[lighthouse:ci] HTTP/2 frontend: ${origin} -> http://127.0.0.1:${WEB_PORT}`)

  // A real first-party asset, discovered from the document rather than guessed at.
  const html = execFileSync('curl', ['-s', `http://127.0.0.1:${WEB_PORT}/`], { encoding: 'utf8' })
  const asset = html.match(/\/_nuxt\/[A-Za-z0-9_.-]+\.js/)?.[0]
  if (!asset) throw new Error('could not discover a first-party /_nuxt/ asset to assert the protocol against')

  console.log('[lighthouse:ci] asserting browser-facing protocol BEFORE the matrix…')
  const proto = await assertH2({ origin, paths: ['/', '/ar', asset], cert: owned.cert.cert })
  for (const r of proto) console.log(`  ✓ ${r.path}  ALPN=${r.alpn}  status=${r.status}`)
  console.log('[lighthouse:ci] protocol assertion PASSED — browser-facing path is HTTP/2 (D20-25)')

  // Chrome trusts exactly this key. Narrower than `--ignore-certificate-errors`, which would accept
  // any bad certificate for the whole run.
  const chromeFlags = `--no-sandbox --headless=new --ignore-certificate-errors-spki-list=${owned.cert.spki}`
  const lhEnv = { LH_BASE_URL: origin, LH_CHROME_FLAGS: chromeFlags }

  console.log('\n[lighthouse:ci] collecting MOBILE matrix over HTTP/2…')
  await run('npx', ['lhci', 'autorun'], { ...lhEnv, LHCI_PROFILE: 'mobile' })

  console.log('\n[lighthouse:ci] collecting DESKTOP matrix over HTTP/2…')
  await run('npx', ['lhci', 'autorun', '--collect.settings.preset=desktop'], { ...lhEnv, LHCI_PROFILE: 'desktop' })

  console.log('\n[lighthouse:ci] asserting medians (thresholds unchanged)…')
  await run('node', ['scripts/check-lighthouse-medians.mjs'])
}

main()
  .then(async () => { await cleanup('success'); console.log('\n✓ governed Lighthouse complete over HTTP/2'); process.exit(0) })
  .catch(async (err) => {
    console.error(`\n✗ [lighthouse:ci] ${err.message ?? err}`)
    await cleanup('failure')
    process.exit(1)
  })
