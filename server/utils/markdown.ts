import MarkdownIt from 'markdown-it'
import Shiki from '@shikijs/markdown-it'
import type { BuiltinLanguage } from 'shiki'

// The languages the highlighter loads. Loading the full bundle (~200 grammars, the library default)
// costs seconds on first render; this curated set covers the blog's stack and initializes fast.
// Fences in any other language degrade to plain text via `fallbackLanguage` below (never a 500).
const HIGHLIGHT_LANGS: BuiltinLanguage[] = [
  'typescript', 'javascript', 'vue', 'html', 'css', 'scss', 'json',
  'yaml', 'bash', 'markdown', 'sql', 'diff', 'docker', 'graphql', 'python'
]

/**
 * The single Markdown renderer that backs `ContentProse` (D12-4). It lives in the Nitro layer
 * and is reached only through `/api/prose`, so markdown-it and Shiki never enter a public client
 * chunk (D20-3) — highlighting runs on the server for both SSR and client navigation, and code
 * arrives as static HTML.
 *
 * Safety posture (D19-5): `html: false` means raw HTML in the source is escaped, not parsed —
 * `<script>` and `<img onerror>` render as inert text with no sanitizer library needed in M1.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Give every heading a stable id (drives the future TOC, FR-PUB-043) plus a keyboard-reachable
    permalink. Slugs are de-duplicated within a document. */
function headingAnchors(md: MarkdownIt): void {
  const seen = new Map<string, number>()

  md.core.ruler.push('heading_anchors', (state) => {
    seen.clear()
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i]
      if (open?.type !== 'heading_open') continue
      const inline = tokens[i + 1]
      if (!inline) continue

      let slug = slugify(inline.content) || 'section'
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      if (count > 0) slug = `${slug}-${count}`

      open.attrSet('id', slug)
    }
  })
}

/** External links open in a new tab and carry rel="noopener" (D19-5). */
function externalLinks(md: MarkdownIt): void {
  const defaultRender
    = md.renderer.rules.link_open
      ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const href = token?.attrGet('href') ?? ''
    if (/^https?:\/\//.test(href)) {
      token?.attrSet('target', '_blank')
      token?.attrSet('rel', 'noopener noreferrer')
    }
    return defaultRender(tokens, idx, options, env, self)
  }
}

let rendererPromise: Promise<MarkdownIt> | null = null

async function createRenderer(): Promise<MarkdownIt> {
  const md = new MarkdownIt({
    html: false, // raw HTML never parses — structural XSS defense (D19-5)
    linkify: true,
    breaks: false
  })

  // Dual-theme highlighting; the highlighter is created once (memoized below) and lives only in the
  // Nitro layer, so no highlighting JS ships to the client (D20-3). The engine is the library
  // default — `@shikijs/markdown-it` owns the highlighter and ignores a custom `engine`.
  md.use(
    await Shiki({
      themes: { light: 'github-light', dark: 'github-dark' },
      langs: HIGHLIGHT_LANGS,
      // `text` is Shiki's built-in plaintext id — not part of the grammar-language union (hence the
      // annotation); an unlisted fence falls back to it and renders inert instead of throwing.
      fallbackLanguage: 'text' as BuiltinLanguage
    })
  )

  headingAnchors(md)
  externalLinks(md)
  return md
}

export async function renderMarkdown(source: string): Promise<string> {
  rendererPromise ??= createRenderer()
  const md = await rendererPromise
  return md.render(source)
}
