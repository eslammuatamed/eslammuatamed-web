#!/usr/bin/env node
// Bundle-isolation gate (D06-1 / D06-5, doc 20 §5) — the first version of the forbidden-module
// check (M1 task T9). Editor-weight dependencies (Tiptap and its ProseMirror core) must never reach
// a public client chunk; in M1 they are not imported anywhere, so the ENTIRE client build must be
// free of their identifiers. Run this after `nuxt build`; it is wired into CI after the build step.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// `nuxt build` emits the client assets under the Nitro output's public directory.
const CLIENT_DIR = '.output/public'

// Case-insensitive substrings that must not appear in any public client chunk. Tiptap/ProseMirror
// are the dashboard editor (D06-5); shiki/markdown-it are the Markdown renderer, which is SSR-only
// via /api/prose — no highlighting JS may ship to the client (D20-3). Only `.js` files are scanned,
// so the `.shiki` CSS class (emitted by the server-rendered HTML) never trips this. `prosemirror` is
// distinct from the allowed `prose` tokens (ContentProse, the `content-prose` class).
const FORBIDDEN = ['tiptap', 'prosemirror', 'shiki', 'markdown-it']

async function collectJs(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null)
  if (!entries) return []
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collectJs(full)))
    else if (entry.name.endsWith('.js')) files.push(full)
  }
  return files
}

const files = await collectJs(CLIENT_DIR)
if (files.length === 0) {
  console.error(`✗ No client build found in ${CLIENT_DIR}. Run \`nuxt build\` first.`)
  process.exit(1)
}

const violations = []
for (const file of files) {
  const content = (await readFile(file, 'utf8')).toLowerCase()
  for (const token of FORBIDDEN) {
    if (content.includes(token)) violations.push(`${token} → ${file}`)
  }
}

if (violations.length > 0) {
  console.error('✗ Forbidden editor modules leaked into public client chunks:')
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(`✓ ${files.length} public chunks scanned — no ${FORBIDDEN.join('/')} identifiers.`)
