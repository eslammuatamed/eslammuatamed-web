#!/usr/bin/env node
/**
 * Stamp `.output/` with the source state that produced it (doc 20 §5.1, D20-25).
 *
 * Runs as part of `npm run build` so EVERY build is attributable, including builds made by CI jobs
 * and contributors who never invoke the Lighthouse gate. Governed measurement then compares this
 * stamp against HEAD and rebuilds on a mismatch, instead of measuring whatever `.output/` happened
 * to be left behind by another commit.
 *
 * Deliberately a separate step rather than a Nuxt build hook: this must not touch the production
 * Nuxt configuration, and the stamp is measurement bookkeeping, not part of the shipped artifact's
 * behaviour.
 */
import process from 'node:process'
import { STAMP_PATH, writeBuildStamp } from './lib/build-identity.mjs'

const stamp = writeBuildStamp()
console.log(`[stamp-build] ${STAMP_PATH} → ${stamp.id}${stamp.dirty ? ' (working tree dirty)' : ''}`)
process.exit(0)
