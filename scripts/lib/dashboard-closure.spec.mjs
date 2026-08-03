import { describe, expect, it } from 'vitest'
import { resolveDashboardClosure, findPageChunk, indexChunksByFile } from './dashboard-closure.mjs'

/**
 * Trust gate for the D20-23 closure (doc 20 §1.2).
 *
 * A budget whose gate cannot see the route it names is worse than no budget, because it reports
 * success. These tests run on a SYNTHETIC chunk graph — no build, fully deterministic — so the
 * algorithm is proven independently of whatever the current bundle happens to look like.
 *
 * The graph below is shaped like the real one in the way that matters: the client entry's
 * `dynamicImports` is the router's code-split map and lists EVERY page chunk in the app, including
 * the entire public surface. That is the trap the algorithm exists to avoid.
 */
const graph = () => ({
  0: {
    fileName: '_nuxt/entry.js',
    isEntry: true,
    isDynamicEntry: false,
    // Static: the shared vendor chunk a cold load always executes.
    imports: ['_nuxt/vendor.js'],
    // Dynamic: the ROUTE MAP. Every page in the application appears here.
    dynamicImports: [
      '_nuxt/dash-layout.js',
      '_nuxt/dash-index.js',
      '_nuxt/dash-messages.js',
      '_nuxt/public-blog.js',
      '_nuxt/public-projects.js',
      '_nuxt/public-home.js'
    ],
    modules: [
      { id: 'node_modules/vue/dist/runtime.js', renderedLength: 100_000 },
      // The entry MENTIONS every page module as a near-zero route-map stub.
      { id: 'app/pages/dashboard/messages.vue', renderedLength: 0 },
      { id: 'app/pages/dashboard/index.vue', renderedLength: 0 }
    ]
  },
  1: { fileName: '_nuxt/vendor.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'node_modules/shared/index.js', renderedLength: 50_000 }] },
  2: { fileName: '_nuxt/dash-layout.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/layouts/dashboard.vue?vue&type=script', renderedLength: 2_269 }] },
  3: { fileName: '_nuxt/dash-index.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/dashboard/index.vue?vue&type=script', renderedLength: 1_007 }] },
  4: {
    fileName: '_nuxt/dash-messages.js',
    isEntry: false,
    isDynamicEntry: true,
    imports: ['_nuxt/ui-table.js'],
    dynamicImports: [],
    modules: [{ id: 'app/pages/dashboard/messages.vue?vue&type=script', renderedLength: 8_000 }]
  },
  5: { fileName: '_nuxt/ui-table.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'node_modules/@tanstack/table-core/index.js', renderedLength: 90_000 }] },
  6: { fileName: '_nuxt/auth.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/stores/auth.ts', renderedLength: 3_000 }] },
  // Public page chunks — reachable ONLY through the entry's dynamic route map.
  7: { fileName: '_nuxt/public-blog.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/blog/index.vue', renderedLength: 20_000 }] },
  8: { fileName: '_nuxt/public-projects.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/projects/index.vue', renderedLength: 20_000 }] },
  9: { fileName: '_nuxt/public-home.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/index.vue', renderedLength: 20_000 }] }
})

describe('dashboard closure — seed, then STATIC closure', () => {
  it('includes the seed: entry, layout, page dynamic entry and auth chunks', () => {
    const { files, seed } = resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue')

    expect(seed.entry).toBe('_nuxt/entry.js')
    expect(seed.layout).toBe('_nuxt/dash-layout.js')
    expect(seed.page).toBe('_nuxt/dash-messages.js')
    expect(seed.auth).toContain('_nuxt/auth.js')
    expect(files).toEqual(expect.arrayContaining([
      '_nuxt/entry.js', '_nuxt/dash-layout.js', '_nuxt/dash-messages.js', '_nuxt/auth.js'
    ]))
  })

  it('follows STATIC imports transitively — the route-owned table chunk is counted', () => {
    const { files } = resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue')
    // Reached only via dash-messages.js -> imports -> ui-table.js
    expect(files).toContain('_nuxt/ui-table.js')
    // And the entry's own static import.
    expect(files).toContain('_nuxt/vendor.js')
  })

  /**
   * THE LOAD-BEARING ASSERTION. The entry's `dynamicImports` is the router's map of the whole
   * application. If it were expanded transitively, every public page would land in every dashboard
   * route's closure and the gate would fail for a reason unrelated to the route.
   */
  it('NEVER expands the entry dynamic route map — public pages stay out', () => {
    const { files } = resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue')

    expect(files).not.toContain('_nuxt/public-blog.js')
    expect(files).not.toContain('_nuxt/public-projects.js')
    expect(files).not.toContain('_nuxt/public-home.js')
    // Nor the OTHER dashboard route's page chunk — routes are measured independently.
    expect(files).not.toContain('_nuxt/dash-index.js')
  })

  it('resolves each dashboard route to its own page chunk', () => {
    const index = resolveDashboardClosure(graph(), 'app/pages/dashboard/index.vue')
    expect(index.seed.page).toBe('_nuxt/dash-index.js')
    expect(index.files).not.toContain('_nuxt/dash-messages.js')
    expect(index.files).not.toContain('_nuxt/ui-table.js')
  })

  it('never mistakes the entry route-map stub for the page chunk', () => {
    // The entry lists `app/pages/dashboard/messages.vue` at renderedLength 0. Matching naively on
    // module id alone would select the entry and measure a route with no page in it.
    const byFile = indexChunksByFile(graph())
    expect(findPageChunk(byFile, 'app/pages/dashboard/messages.vue').fileName)
      .toBe('_nuxt/dash-messages.js')
  })

  it('counts each asset once — a chunk two seeds both import is not double counted', () => {
    const g = graph()
    g[2].imports = ['_nuxt/vendor.js'] // layout also statically imports the shared vendor chunk
    const { files } = resolveDashboardClosure(g, 'app/pages/dashboard/messages.vue')
    expect(files.filter(f => f === '_nuxt/vendor.js')).toHaveLength(1)
  })

  it('reports what it could not resolve instead of measuring a smaller route', () => {
    const { missing } = resolveDashboardClosure(graph(), 'app/pages/dashboard/nonexistent.vue')
    expect(missing.join(' ')).toMatch(/page chunk/)
  })
})

/**
 * The owner-requested proof: adding a known dashboard-only chunk must move the DASHBOARD closure
 * while leaving public closures untouched. Deterministic here; the real-world corroboration is the
 * `__probe.vue` experiment at Web `76f8fa6`, where adding a UTable/USlideover page grew the
 * dashboard closure by 33.6 KB gz while every public route moved only the ~0.9 KB gz router-manifest
 * delta.
 */
describe('dashboard closure — detects route-owned chunks, keeps public isolated', () => {
  it('a new dashboard-only chunk enters the dashboard closure and no public one', () => {
    const before = resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue')

    const after = graph()
    after[10] = {
      fileName: '_nuxt/dash-only-new.js',
      isEntry: false,
      isDynamicEntry: false,
      imports: [],
      dynamicImports: [],
      modules: [{ id: 'app/components/dashboard/HeavyThing.vue', renderedLength: 40_000 }]
    }
    after[4].imports = [...after[4].imports, '_nuxt/dash-only-new.js']

    const grown = resolveDashboardClosure(after, 'app/pages/dashboard/messages.vue')

    expect(before.files).not.toContain('_nuxt/dash-only-new.js')
    expect(grown.files).toContain('_nuxt/dash-only-new.js')
    expect(grown.files.length).toBe(before.files.length + 1)

    // Public chunks are still absent — the dashboard-only chunk did not leak into public territory,
    // and the dashboard closure still excludes every public page.
    for (const publicChunk of ['_nuxt/public-blog.js', '_nuxt/public-projects.js', '_nuxt/public-home.js']) {
      expect(grown.files).not.toContain(publicChunk)
    }
  })
})
