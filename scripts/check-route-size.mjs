#!/usr/bin/env node
/**
 * Per-public-route transfer-size gate (doc 20 §1, doc 20 §5).
 *
 * doc 20 §1 budgets JS **"per public route"**, not per build. A static glob over
 * `.output/public/_nuxt/**\/*.js` cannot express that: it also sums the lazily-loaded dashboard SPA
 * chunks, which no public route ever fetches. That over-counts (measured 260.7 KB gz total vs
 * 222.8 KB gz actually referenced by `/`), so the number the budget is compared against has to come
 * from the route itself.
 *
 * Nuxt emits no import-graph manifest into `.output` that a purely static tool could resolve, so
 * this boots the real production preview (`ci-preview.mjs`, which already waits for genuine
 * readiness), reads each public route's rendered HTML, collects every `/_nuxt/*.js` and
 * `/_nuxt/*.css` it references (script tags AND modulepreload links — both are fetched on first
 * view), and gzips those exact files from the build output.
 *
 * gzip, not brotli: §1 states the budgets in `gz`. Cloudflare serves brotli, which is smaller, so
 * gzip is the conservative reading and the only one comparable to the documented number.
 *
 * BUDGETS ARE COPIED FROM doc 20 §1 VERBATIM. Re-baselining requires an owner decision plus a
 * decision-log entry in doc 20 — never an edit here.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import process from 'node:process'

const BUDGET = {
  jsBytesPerRoute: 90 * 1024, // doc 20 §1: JS transferred per public route ≤ 90 KB gz
  cssBytes: 30 * 1024 // doc 20 §1: CSS ≤ 30 KB gz
}

// The public surface. `/projects` and `/contact` from doc 20 §5's page list are the accepted
// web-005 404s (spec.md:36) and join this list with that feature.
const ROUTES = [
  '/',
  '/ar',
  '/blog',
  '/ar/blog',
  '/blog/staying-inside-performance-budget-nuxt',
  '/ar/blog/albaqaa-dimn-mizaniyat-ada-nuxt'
]

const BASE = process.env.ROUTE_SIZE_BASE ?? 'http://127.0.0.1:3000'
const PUBLIC_DIR = '.output/public'

const gzCache = new Map()
async function gzSize(assetPath) {
  if (gzCache.has(assetPath)) return gzCache.get(assetPath)
  const buf = await readFile(`${PUBLIC_DIR}${assetPath}`).catch(() => null)
  if (!buf) return null
  const size = gzipSync(buf, { level: 9 }).length
  gzCache.set(assetPath, size)
  return size
}

function collectAssets(html, ext) {
  // Both `<script src>` and `<link rel="modulepreload" href>` are fetched on first view, so the
  // union is what "transferred per route" means.
  const re = new RegExp(`/_nuxt/[A-Za-z0-9_.-]+\\.${ext}`, 'g')
  return [...new Set(html.match(re) ?? [])]
}

let preview = null
function startPreview() {
  return new Promise((resolve, reject) => {
    // `detached` makes the child a process-group leader so teardown can signal the WHOLE group
    // (prism + nitro are its own children). Killing only the direct child leaves those two holding
    // the ports and this script's piped stdout open, which is exactly how the first version hung.
    preview = spawn('node', ['scripts/ci-preview.mjs'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env }
    })
    let out = ''
    const timer = setTimeout(() => reject(new Error('preview did not become ready within 120s')), 120_000)
    const onData = (chunk) => {
      out += String(chunk)
      process.stdout.write(chunk)
      if (out.includes('[ci-preview] listening')) { clearTimeout(timer); resolve() }
    }
    preview.stdout.on('data', onData)
    preview.stderr.on('data', (chunk) => process.stderr.write(chunk))
    preview.on('exit', (code) => { clearTimeout(timer); reject(new Error(`preview exited early (code ${code})`)) })
    preview.on('error', reject)
  })
}

function stopPreview() {
  if (!preview || preview.exitCode !== null) return
  try {
    process.kill(-preview.pid, 'SIGTERM') // negative pid → the whole process group
  } catch {
    try { preview.kill('SIGTERM') } catch { /* already gone */ }
  }
}

let failed = false
try {
  await startPreview()
  console.log(`\nPer-route transfer budgets (doc 20 §1) — gzip, from ${PUBLIC_DIR}\n`)

  for (const route of ROUTES) {
    const res = await fetch(`${BASE}${route}`, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) {
      console.error(`✗ ${route} → HTTP ${res.status}; cannot measure.`)
      failed = true
      continue
    }
    const html = await res.text()

    const tally = async (ext) => {
      const assets = collectAssets(html, ext)
      let total = 0
      const missing = []
      for (const asset of assets) {
        const size = await gzSize(asset)
        if (size === null) missing.push(asset)
        else total += size
      }
      return { count: assets.length, total, missing }
    }

    const js = await tally('js')
    const css = await tally('css')
    const kb = (n) => `${(n / 1024).toFixed(1)} KB`

    for (const [label, got, budget, stat] of [
      ['JS ', js.total, BUDGET.jsBytesPerRoute, js],
      ['CSS', css.total, BUDGET.cssBytes, css]
    ]) {
      const ok = got <= budget
      if (!ok) failed = true
      console.log(
        `  ${ok ? '✓' : '✗'} ${route.padEnd(46)} ${label} ${kb(got).padStart(9)} gz`
        + ` / ${kb(budget)} budget  (${stat.count} assets)`
        + (ok ? '' : `  OVER by ${kb(got - budget)}`)
      )
      if (stat.missing.length) console.error(`      ! not found in build output: ${stat.missing.join(', ')}`)
    }
  }
} catch (error) {
  console.error(`\n✗ route-size check could not run: ${error.message}`)
  failed = true
} finally {
  stopPreview()
}

if (failed) {
  console.error(
    '\n✗ Per-route budget exceeded (doc 20 §1).\n'
    + '  These budgets are normative and are re-baselined ONLY by a decision-log entry in\n'
    + '  eslammuatamed-docs/docs/20-performance.md. Do not raise the numbers in this file.'
  )
  // Explicit exit: the torn-down preview's pipes may still hold handles open, and this script must
  // not hang CI waiting for the event loop to drain.
  process.exit(1)
}
console.log('\n✓ All public routes within the doc 20 §1 transfer budgets.')
process.exit(0)
