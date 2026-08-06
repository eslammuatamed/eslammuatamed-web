import { describe, expect, it } from 'vitest'
import { resolveMockPort, resolvePreviewBase, resolvePreviewPort } from './preview-base.mjs'

/**
 * The defect these tests exist for is NOT "the default was wrong" — the default was right in the
 * default case, which is exactly why it survived. It was that the route-size gate STARTED a preview
 * on `CI_PREVIEW_PORT` and then MEASURED `http://127.0.0.1:3000`, two facts derived independently.
 * So the assertion that matters is the RELATIONSHIP: the base must follow the port the preview is
 * actually started on. A test that only pinned the default string would have passed throughout the
 * period the gate was unusable in every non-default worktree.
 */
describe('preview base resolution', () => {
  it('follows the port the preview is started on', () => {
    const env = { CI_PREVIEW_PORT: '6010' }
    expect(resolvePreviewBase(env)).toBe(`http://127.0.0.1:${resolvePreviewPort(env)}`)
    expect(resolvePreviewBase(env)).toBe('http://127.0.0.1:6010')
  })

  it('agrees with the port resolver for any port, which is the invariant that was broken', () => {
    for (const port of ['3000', '4000', '5000', '6010', '7777']) {
      const env = { CI_PREVIEW_PORT: port }
      expect(resolvePreviewBase(env)).toContain(`:${resolvePreviewPort(env)}`)
    }
  })

  it('defaults to 3000/3001 when nothing is set, so an unconfigured local run is unchanged', () => {
    expect(resolvePreviewPort({})).toBe('3000')
    expect(resolveMockPort({})).toBe('3001')
    expect(resolvePreviewBase({})).toBe('http://127.0.0.1:3000')
  })

  it('lets ROUTE_SIZE_BASE win, so the gate can still measure a server it did not start', () => {
    // The gate's own failure-path spec points it at a dead port this way; that must keep working,
    // and it must override rather than be overridden by the port.
    const env = { CI_PREVIEW_PORT: '6010', ROUTE_SIZE_BASE: 'http://127.0.0.1:1' }
    expect(resolvePreviewBase(env)).toBe('http://127.0.0.1:1')
  })

  it('reads the mock port independently of the web port', () => {
    expect(resolveMockPort({ CI_MOCK_PORT: '6011' })).toBe('6011')
    expect(resolveMockPort({ CI_PREVIEW_PORT: '6010' })).toBe('3001')
  })
})
