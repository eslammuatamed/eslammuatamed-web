// @vitest-environment nuxt
import type { NuxtApp } from '#app'
import { describe, expect, it, vi } from 'vitest'
import type { SiteSettings } from '~/types/models'
import { sharedSettingsRequest } from './settings-request'

/**
 * BLK-2. The invariant is "one `/settings/site` operation per key per request, whatever its outcome".
 *
 * The end-to-end proof is the request-COUNTING backend in the `settings-dedupe` Playwright lane —
 * this file cannot replace it, and the reason is on the record: the pre-existing unit assertion for
 * the ORIGINAL dedupe invariant mocked `useApi`, so it passed for eight features while the real
 * behaviour diverged. What these tests own is the part a request count cannot localize: WHICH
 * outcomes are shared, whether a rejection reaches every caller intact, and the scoping rules that
 * keep one visitor's settings out of another's render.
 */

/** A stand-in for the per-request `NuxtApp`. Only its IDENTITY matters — it is a WeakMap key. */
const fakeNuxtApp = () => ({}) as NuxtApp

const SETTINGS = { siteName: 'x' } as unknown as SiteSettings

describe('sharedSettingsRequest', () => {
  it('runs one operation for concurrent callers of the same key and gives them all the value', async () => {
    const app = fakeNuxtApp()
    const fetcher = vi.fn(() => Promise.resolve(SETTINGS))

    const results = await Promise.all([
      sharedSettingsRequest(app, 'settings:site:en', fetcher),
      sharedSettingsRequest(app, 'settings:site:en', fetcher),
      sharedSettingsRequest(app, 'settings:site:en', fetcher)
    ])

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(results).toEqual([SETTINGS, SETTINGS, SETTINGS])
  })

  it('shares a FAILURE, and every caller receives the same error', async () => {
    // The whole point of sharing the promise rather than the value: `payload.data[key]` is written
    // only on success, so the outage path had nothing to share and each reader refetched. A rejection
    // reaching every caller is also what preserves the governed D13-1 state, because the reader that
    // renders it (`index.vue`) is the LAST to run.
    const app = fakeNuxtApp()
    const failure = new Error('503')
    const fetcher = vi.fn(() => Promise.reject(failure))

    const settled = await Promise.allSettled([
      sharedSettingsRequest(app, 'settings:site:en', fetcher),
      sharedSettingsRequest(app, 'settings:site:en', fetcher),
      sharedSettingsRequest(app, 'settings:site:en', fetcher)
    ])

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(settled.map(r => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
    // The SAME error object, not merely an equal one: callers must observe the real failure, never a
    // substitute the sharing layer invented, and never `null` with no error at all.
    for (const result of settled) {
      expect((result as PromiseRejectedResult).reason).toBe(failure)
    }
  })

  it('does not share across locales — each key is its own operation', async () => {
    const app = fakeNuxtApp()
    const fetcher = vi.fn(() => Promise.resolve(SETTINGS))

    await Promise.all([
      sharedSettingsRequest(app, 'settings:site:en', fetcher),
      sharedSettingsRequest(app, 'settings:site:ar', fetcher)
    ])

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not share across requests, so one visitor cannot receive another visitor settings', async () => {
    // This is why the map is a WeakMap keyed by NuxtApp and not a module-level Map: on the server a
    // module-level Map is shared by every concurrent request, and would serve one visitor's settings
    // — or one visitor's OUTAGE — to another.
    //
    // The two calls are CONCURRENT on purpose. Awaiting the first before making the second would
    // make this test pass with a module-level `Map` too, because the client branch releases the
    // entry on settle — so the fetcher would be called twice either way and the assertion would
    // prove nothing about scoping. Overlapping them is what makes a shared map observable: under one
    // the second caller would join the first request; under per-request scoping it cannot.
    const deferred: Array<(value: SiteSettings) => void> = []
    const fetcher = vi.fn(() => new Promise<SiteSettings>(resolve => deferred.push(resolve)))

    const first = sharedSettingsRequest(fakeNuxtApp(), 'settings:site:en', fetcher)
    const second = sharedSettingsRequest(fakeNuxtApp(), 'settings:site:en', fetcher)

    expect(fetcher, 'a second request must not join the first visitor request').toHaveBeenCalledTimes(2)

    for (const resolve of deferred) resolve(SETTINGS)
    await Promise.all([first, second])
  })

  it('releases a settled failure on the client, so a retry is a real request and never a cached null', async () => {
    // Under `@vitest-environment nuxt`, `import.meta.client` is true — the branch under test. A
    // failure pinned for the session would make the D13-1 "Try again" button inert and would leave a
    // recovered API undetected; the SSR branch deliberately keeps its entry instead, because SSR
    // readers await in sequence and would otherwise share nothing at all.
    const app = fakeNuxtApp()
    const fetcher = vi.fn(() => Promise.reject(new Error('503')))

    await expect(sharedSettingsRequest(app, 'settings:site:en', fetcher)).rejects.toThrow('503')
    await expect(sharedSettingsRequest(app, 'settings:site:en', fetcher)).rejects.toThrow('503')

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
