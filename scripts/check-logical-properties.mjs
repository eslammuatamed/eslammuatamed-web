#!/usr/bin/env node
// Logical-properties gate (D15-3, RTL). Physical left/right utilities and CSS properties do not
// mirror in RTL; every direction-dependent style must use its logical equivalent (ps/pe, ms/me,
// start/end, border-s/e, *-inline-*). Vertical (top/bottom) styles are direction-neutral and
// allowed, as are deliberate `rtl:` / `ltr:` variants. Scans the app source (not build output).
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = 'app'

// Physical Tailwind utilities, matched only inside class strings (each has a logical counterpart).
const PHYSICAL_UTIL = [
  /\bp[lr]-/, //           pl-/pr-        → ps-/pe-
  /\bm[lr]-/, //           ml-/mr-        → ms-/me-
  /\b(?:left|right)-\d/, // left-/right-  → start-/end-
  /\btext-(?:left|right)\b/, //           → text-start/text-end
  /\bborder-[lr](?![a-z])/, // border-l/r → border-s/border-e (excludes border-radius)
  /\bfloat-(?:left|right)\b/
]

// Physical CSS properties in stylesheets.
const PHYSICAL_CSS = [
  /\b(?:padding|margin|border)-(?:left|right)\b/,
  /\btext-align:\s*(?:left|right)\b/,
  /(?:^|[;{]\s*)(?:left|right)\s*:/m
]

async function collect(dir, exts) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null)
  if (!entries) return []
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collect(full, exts)))
    else if (exts.some(ext => entry.name.endsWith(ext))) files.push(full)
  }
  return files
}

/**
 * Physical `side` LITERALS on overlay components (D11-8).
 *
 * A component prop is not a class, so nothing above can see it — and that is exactly how
 * `layouts/dashboard.vue` shipped a drawer hard-coded to `side="left"` while this gate reported the
 * whole tree clean. It was defensible then (the dashboard was English-only LTR by a governed
 * decision) and is a defect now that the dashboard is bilingual: a drawer entering from the
 * inline-END of an RTL page is precisely what logical semantics exist to prevent.
 *
 * `side` has no logical form — its values are literally `left`/`right` — so the rule is not "never
 * write left" but "never write it as a CONSTANT". A bound expression (`:side="…"`) can derive the
 * physical side from the active direction; a literal cannot. `top`/`bottom` are direction-neutral
 * and unrestricted.
 */
const PHYSICAL_SIDE_LITERAL = /\bside\s*=\s*(["'])(?:left|right)\1/

function classAttributes(source) {
  const out = []
  const re = /(?::class|\bclass)\s*=\s*("|')([\s\S]*?)\1/g
  let match
  while ((match = re.exec(source)) !== null) out.push(match[2])
  return out
}

const violations = new Set()

for (const file of await collect(ROOT, ['.vue'])) {
  const source = await readFile(file, 'utf8')
  if (PHYSICAL_SIDE_LITERAL.test(source)) {
    violations.add(`${file}: literal side="left|right" — bind it and derive the side from the active direction (D11-8)`)
  }
  for (const attr of classAttributes(source)) {
    // Drop `rtl:`/`ltr:`-prefixed tokens — those are intentional direction adjustments.
    const tokens = attr.split(/\s+/).filter(token => token && !/(?:^|:)(?:rtl|ltr):/.test(token))
    const joined = ` ${tokens.join(' ')} `
    if (PHYSICAL_UTIL.some(rule => rule.test(joined))) {
      violations.add(`${file}: physical utility in class="${attr.trim().slice(0, 60)}"`)
    }
  }
}

for (const file of await collect(ROOT, ['.css'])) {
  const source = await readFile(file, 'utf8')
  if (PHYSICAL_CSS.some(rule => rule.test(source))) {
    violations.add(`${file}: physical CSS property (use *-inline-* / logical value)`)
  }
}

if (violations.size > 0) {
  console.error('✗ Physical-direction styles found (use logical equivalents — D15-3):')
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log('✓ No physical-direction utilities or properties — logical only.')
