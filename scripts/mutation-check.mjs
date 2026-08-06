#!/usr/bin/env node
/**
 * Mutation check for the two D09-22 guards.
 *
 * A passing test is not evidence that a guard works — only that the code and the test agree. This
 * deliberately BREAKS each guard in turn and asserts the suite goes RED, then restores the file
 * byte-for-byte. If a mutation leaves the suite green, the "protection" is decorative and the run
 * fails.
 *
 * Restoration is in a `finally` and verified by content, not assumed: a mutation left behind would
 * be far worse than no check at all.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const TARGET = 'app/utils/portrait-form.ts'
const SPECS = ['app/utils/portrait-form.spec.ts', 'app/pages/dashboard/profile.spec.ts']

const MUTATIONS = [
  {
    name: 'PREFILL FROM THE ASSET-LEVEL DEFAULT (the D09-22 trap)',
    // Reach for `portrait.alt` when the per-usage alt is absent — exactly what the contract forbids.
    find: `export function initialPortraitForm(settings: AdminSiteSettings | null): PortraitFormState {
  return {
    assetId: settings?.portraitAssetId ?? null,
    alt: {
      en: initialAltFor(settings?.translations, 'en'),
      ar: initialAltFor(settings?.translations, 'ar')
    }
  }
}`,
    replace: `export function initialPortraitForm(settings: AdminSiteSettings | null): PortraitFormState {
  return {
    assetId: settings?.portraitAssetId ?? null,
    alt: {
      en: initialAltFor(settings?.translations, 'en') || (settings?.portrait?.alt ?? ''),
      ar: initialAltFor(settings?.translations, 'ar') || (settings?.portrait?.alt ?? '')
    }
  }
}`
  },
  {
    name: 'REMOVE THE "both locales required" VALIDATION',
    find: `  if (state.assetId === null) return { missingAlt: [] }
  return { missingAlt: PORTRAIT_LOCALES.filter(locale => state.alt[locale].trim().length === 0) }`,
    replace: `  return { missingAlt: [] }`
  }
]

const original = readFileSync(TARGET, 'utf8')
let failures = 0

try {
  for (const mutation of MUTATIONS) {
    if (!original.includes(mutation.find)) {
      console.error(`✗ ${mutation.name}: the code this mutation targets was not found — the check is stale.`)
      failures += 1
      continue
    }
    writeFileSync(TARGET, original.replace(mutation.find, mutation.replace))

    let red = false
    let output = ''
    try {
      output = execFileSync('npx', ['vitest', 'run', ...SPECS], { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      red = true
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    }

    const failed = (output.match(/Tests\s+(\d+) failed/) ?? [])[1] ?? '0'
    if (red) {
      console.log(`✓ ${mutation.name}\n    suite went RED as required (${failed} test(s) failed).`)
    } else {
      console.error(`✗ ${mutation.name}\n    suite stayed GREEN — the guard is not actually protected.`)
      failures += 1
    }
  }
} finally {
  writeFileSync(TARGET, original)
  if (readFileSync(TARGET, 'utf8') !== original) {
    console.error('✗ FATAL: the mutated file was NOT restored. Restore it by hand before committing.')
    process.exit(2)
  }
  console.log(`\n${TARGET} restored byte-for-byte.`)
}

if (failures > 0) {
  console.error(`\n✗ ${failures} mutation(s) were not caught.`)
  process.exit(1)
}
console.log('✓ every mutation was caught.')
