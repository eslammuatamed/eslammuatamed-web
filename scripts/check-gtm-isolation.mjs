#!/usr/bin/env node
/**
 * FE4-U2e2.1 bundle-boundary gate.
 *
 * This reads the Rollup sidecar produced by `ANALYZE_BUNDLE=1 npm run build`. It deliberately
 * follows graph edges rather than trusting chunk names: the GTM runtime must be owned by the
 * client-only public boundary, reached by a dynamic import, and absent from the static entry,
 * dashboard, and auth closures.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolveDashboardClosure } from './lib/dashboard-closure.mjs'

const META_PATH = '.bundle-analysis/client-chunks.json'
const PUBLIC_ROOT = '.output/public'
const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
const chunks = meta.chunks
assert(Array.isArray(chunks) && chunks.length > 0, `${META_PATH} has no chunk records`)

const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
const moduleIn = (chunk, pattern) => chunk.modules.some(module => pattern.test(module.id.replace(/\?.*$/, '')))
const runtimeChunks = chunks.filter(chunk => moduleIn(
  chunk,
  /^node_modules\/@nuxt\/scripts\/dist\/runtime\/registry\/google-tag-manager\.js$/
))
const boundaryChunks = chunks.filter(chunk => moduleIn(
  chunk,
  /^app\/components\/PublicGtmRuntime\.client\.vue$/
))

assert.equal(runtimeChunks.length, 1, `expected one GTM runtime chunk, found ${runtimeChunks.length}`)
assert.equal(boundaryChunks.length, 1, `expected one public GTM boundary chunk, found ${boundaryChunks.length}`)

const runtime = runtimeChunks[0]
const boundary = boundaryChunks[0]
assert.equal(runtime.fileName, boundary.fileName, 'the GTM runtime escaped the public boundary chunk')
assert.equal(runtime.isEntry, false, 'the GTM runtime chunk became an entry chunk')
assert.equal(runtime.isDynamicEntry, true, 'the GTM runtime is not a dynamic chunk')

const dynamicParents = chunks.filter(chunk => chunk.dynamicImports.includes(runtime.fileName))
assert(
  dynamicParents.some(chunk => moduleIn(chunk, /^app\/layouts\/default\.vue$/)),
  'the public default layout does not dynamically import the GTM boundary'
)

function staticClosure(seedFiles) {
  const files = new Set()
  const stack = [...seedFiles]
  while (stack.length > 0) {
    const file = stack.pop()
    if (!file || files.has(file)) continue
    files.add(file)
    for (const imported of byFile.get(file)?.imports ?? []) stack.push(imported)
  }
  return files
}

const entry = chunks.find(chunk => chunk.isEntry)
assert(entry, 'no client entry chunk found')
const defaultLayout = chunks.find(chunk => moduleIn(chunk, /^app\/layouts\/default\.vue$/))
const homePage = chunks.find(chunk => moduleIn(chunk, /^app\/pages\/index\.vue$/))
const initialPublicClosure = staticClosure([entry.fileName, defaultLayout?.fileName, homePage?.fileName])
assert(!initialPublicClosure.has(runtime.fileName), 'the GTM runtime is in the initial public closure')
assert(!initialPublicClosure.has(boundary.fileName), 'the GTM boundary is in the initial public closure')

const dashboardClosure = resolveDashboardClosure(chunks, 'app/pages/dashboard/login.vue')
assert.equal(dashboardClosure.missing.length, 0, `dashboard closure unresolved: ${dashboardClosure.missing.join(', ')}`)
assert(!dashboardClosure.files.includes(runtime.fileName), 'the GTM runtime is in the dashboard closure')
assert(!dashboardClosure.files.includes(boundary.fileName), 'the GTM boundary is in the dashboard closure')

const runtimePath = `${PUBLIC_ROOT}/${runtime.fileName}`
const gzipBytes = gzipSync(readFileSync(runtimePath)).length
const parentNames = dynamicParents.map(chunk => chunk.fileName).sort()

console.log(`GTM runtime chunk: ${runtime.fileName}`)
console.log(`GTM runtime gzip: ${gzipBytes} B`)
console.log(`GTM boundary dynamic parents: ${parentNames.join(', ')}`)
console.log('Initial public closure contains GTM: NO')
console.log('Dashboard closure contains GTM: NO')
console.log('Auth closure contains GTM: NO (dashboard/login closure)')
