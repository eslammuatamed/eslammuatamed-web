#!/usr/bin/env node
/**
 * Gate the NON-GOVERNED Lighthouse commands on a provenance-verified build (doc 20 §5.1, D20-25).
 *
 * The governed command (`npm run lighthouse:ci`) owns the lifecycle and will build what it needs.
 * The low-level `lhci:*-nongoverned` escape hatches exist to iterate against a build you already
 * have — but "already have" must not quietly become "from another commit, or from sources that were
 * never committed at all".
 *
 * This only ever REFUSES. It never writes or regenerates a marker: manufacturing a governed identity
 * around whatever output happens to be lying about is exactly the mislabelling these checks exist to
 * prevent.
 */
import process from 'node:process'
import { validateProvenance } from './lib/build-provenance.mjs'

const result = validateProvenance()
if (result.valid) {
  console.log(`[assert-exact-build] provenance verified: ${result.marker.head} (tree ${result.marker.tree.slice(0, 12)})`)
  process.exit(0)
}

console.error('\n✗ [assert-exact-build] refusing to measure — build provenance is not verified:')
for (const failure of result.failures) console.error(`   · ${failure}`)
console.error('\nRun the canonical command instead, which owns the whole lifecycle:')
console.error('   npm run lighthouse:ci')
process.exit(1)
