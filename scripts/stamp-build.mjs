#!/usr/bin/env node
/**
 * Record build provenance for the output just produced (doc 20 §5.1, D20-25).
 *
 * Runs as part of `npm run build` so the artifact carries the identity of the sources that made it,
 * whoever built it. Writing the marker REQUIRES a clean tree — a marker that cannot state its
 * sources truthfully must not exist, because a wrong marker is worse than none.
 *
 * A dirty tree is therefore not a build failure: the build succeeds and simply gets no governed
 * marker, so ordinary local iteration is unaffected while governed measurement still refuses to
 * attribute numbers to a commit that cannot reproduce them.
 *
 * Deliberately a separate step rather than a Nuxt build hook: this must not touch the production
 * Nuxt configuration, and provenance is measurement bookkeeping, not shipped behaviour.
 */
import process from 'node:process'
import { MARKER_PATH, writeProvenance } from './lib/build-provenance.mjs'

try {
  const marker = writeProvenance()
  console.log(`[stamp-build] ${MARKER_PATH} → ${marker.head} tree ${marker.tree.slice(0, 12)} output ${marker.output.hash.slice(0, 12)} (${marker.output.fileCount} files)`)
} catch (error) {
  console.warn(`[stamp-build] no governed provenance marker written: ${error.message.split('\n')[0]}`)
  console.warn('[stamp-build] the build itself is fine; `npm run lighthouse:ci` will refuse until the tree is clean.')
}
process.exit(0)
