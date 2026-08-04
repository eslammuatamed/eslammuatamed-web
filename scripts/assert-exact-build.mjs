#!/usr/bin/env node
/**
 * Refuse to run a NON-GOVERNED Lighthouse command against a build that is not the current head
 * (doc 20 §5.1, D20-25).
 *
 * The governed command (`npm run lighthouse:ci`) BUILDS what it needs. The low-level
 * `lhci:*-nongoverned` escape hatches deliberately do not — they exist to iterate quickly against a
 * build you already have — but "quickly" must not become "against last week's commit". This makes
 * the difference explicit: they still refuse, they simply refuse instead of rebuilding.
 */
import process from 'node:process'
import { assertBuildIsCurrent } from './lib/build-identity.mjs'

try {
  const state = assertBuildIsCurrent()
  console.log(`[assert-exact-build] .output/ matches source identity ${state.stamp.id}`)
} catch (error) {
  console.error(`\n✗ [assert-exact-build] ${error.message}`)
  process.exit(1)
}
