import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

// The renderer is the engine ContentProse wraps (D12-4); these assert its three contracts:
// heading anchors, SSR-highlighted fences, and structural sanitization of hostile input.
describe('renderMarkdown', () => {
  it('gives headings slugified, de-duplicated ids with the user-content- prefix (D19-5, DOM clobbering)', async () => {
    const html = await renderMarkdown('# Hello World\n\n## Hello World')
    expect(html).toContain('<h1 id="user-content-hello-world">')
    expect(html).toContain('<h2 id="user-content-hello-world-1">')
  })

  it('prefixes every generated heading id with user-content- (no un-prefixed id escapes)', async () => {
    // "children"/"querySelector" are exactly the names a DOM-clobbering attack would target; the
    // prefix guarantees a generated id can never equal a bare DOM/global property name.
    const html = await renderMarkdown('# Introduction\n\n## Children\n\n### querySelector')
    expect(html).toContain('id="user-content-introduction"')
    expect(html).toContain('id="user-content-children"')
    expect(html).toContain('id="user-content-queryselector"')
    // Fail if ANY heading carries an id that is not user-content--prefixed.
    expect(html).not.toMatch(/<h[1-6][^>]*\sid="(?!user-content-)/)
  })

  it('generates deterministic ids for identical input (same render twice)', async () => {
    const source = '# Repeatable Heading\n\n## Repeatable Heading'
    const first = await renderMarkdown(source)
    const second = await renderMarkdown(source)
    expect(first).toBe(second)
    expect(first).toContain('id="user-content-repeatable-heading"')
    expect(first).toContain('id="user-content-repeatable-heading-1"')
  })

  it('highlights fenced code blocks during render (Shiki, no client JS)', async () => {
    const html = await renderMarkdown('```ts\nconst answer = 42\n```')
    expect(html).toContain('class="shiki')
    expect(html).toContain('<pre')
  })

  it('renders hostile raw HTML inert — no live tags escape (D19-5)', async () => {
    const html = await renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('marks external links with target and rel="noopener"', async () => {
    const html = await renderMarkdown('[docs](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('leaves internal links as plain in-app navigation', async () => {
    const html = await renderMarkdown('[blog](/blog)')
    expect(html).not.toContain('target="_blank"')
  })
})
