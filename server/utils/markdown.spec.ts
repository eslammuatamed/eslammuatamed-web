import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

// The renderer is the engine ContentProse wraps (D12-4); these assert its three contracts:
// heading anchors, SSR-highlighted fences, and structural sanitization of hostile input.
describe('renderMarkdown', () => {
  it('gives headings slugified, de-duplicated ids', async () => {
    const html = await renderMarkdown('# Hello World\n\n## Hello World')
    expect(html).toContain('<h1 id="hello-world">')
    expect(html).toContain('<h2 id="hello-world-1">')
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
