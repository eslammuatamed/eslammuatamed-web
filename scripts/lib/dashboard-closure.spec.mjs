import { describe, expect, it } from 'vitest'
import { resolveDashboardClosure, findPageChunk, indexChunksByFile, DASHBOARD_ROUTES } from './dashboard-closure.mjs'

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
      '_nuxt/public-home.js',
      '_nuxt/default-layout.js',
      '_nuxt/auth-layout.js',
      '_nuxt/preview-layout.js',
      '_nuxt/auth-mw.js',
      '_nuxt/preview-locale-mw.js'
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
    imports: ['_nuxt/ui-table.js', '_nuxt/shared-ui.js'],
    // Reached only when the reader opens a message — NOT first view.
    dynamicImports: ['_nuxt/interaction-only.js'],
    modules: [{ id: 'app/pages/dashboard/messages.vue?vue&type=script', renderedLength: 8_000 }]
  },
  5: { fileName: '_nuxt/ui-table.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'node_modules/@tanstack/table-core/index.js', renderedLength: 90_000 }] },
  6: { fileName: '_nuxt/auth.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/stores/auth.ts', renderedLength: 3_000 }] },
  // Public page chunks — reachable ONLY through the entry's dynamic route map.
  7: { fileName: '_nuxt/public-blog.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/blog/index.vue', renderedLength: 20_000 }] },
  8: { fileName: '_nuxt/public-projects.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/projects/index.vue', renderedLength: 20_000 }] },
  9: { fileName: '_nuxt/public-home.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/pages/index.vue', renderedLength: 20_000 }] },

  // ── The app shell the first seed omitted ────────────────────────────────────────────────────────
  // Nuxt compiles EVERY layout and EVERY named middleware into route-independent maps in the client
  // entry and declares the whole set as shell prefetch. None of these is the dashboard route's own
  // layout, and the old seed therefore missed all of them.
  20: {
    fileName: '_nuxt/default-layout.js',
    isEntry: false,
    isDynamicEntry: true,
    // The public chrome the default layout pulls in statically — counted transitively, not by name.
    imports: ['_nuxt/app-link.js', '_nuxt/brand-mark.js', '_nuxt/shared-ui.js'],
    dynamicImports: [],
    modules: [
      { id: 'app/layouts/default.vue?vue&type=script', renderedLength: 4_000 },
      { id: 'app/components/layout/Header.vue?vue&type=script', renderedLength: 3_000 },
      { id: 'app/components/layout/Footer.vue?vue&type=script', renderedLength: 2_000 }
    ]
  },
  21: { fileName: '_nuxt/auth-layout.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/layouts/auth.vue?vue&type=script', renderedLength: 400 }] },
  22: { fileName: '_nuxt/preview-layout.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/layouts/preview.vue?vue&type=script', renderedLength: 380 }] },
  23: { fileName: '_nuxt/auth-mw.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/middleware/auth.ts', renderedLength: 260 }] },
  24: { fileName: '_nuxt/preview-locale-mw.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/middleware/preview-locale.ts', renderedLength: 350 }] },
  25: { fileName: '_nuxt/app-link.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'app/components/AppLink.vue?vue&type=script', renderedLength: 600 }] },
  26: { fileName: '_nuxt/brand-mark.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'app/components/ui/BrandMark.vue?vue&type=script', renderedLength: 350 }] },

  // Imported STATICALLY by two different seed members (the page chunk and the default layout).
  // A sum would count it twice; the closure is a Set.
  27: { fileName: '_nuxt/shared-ui.js', isEntry: false, isDynamicEntry: false, imports: [], dynamicImports: [], modules: [{ id: 'app/composables/useSiteSettings.ts', renderedLength: 200 }] },

  // Reachable ONLY through the page chunk's dynamicImports — a later user interaction.
  28: { fileName: '_nuxt/interaction-only.js', isEntry: false, isDynamicEntry: true, imports: [], dynamicImports: [], modules: [{ id: 'app/components/dashboard/MessageDetail.vue', renderedLength: 5_000 }] }
})

/**
 * REGRESSION GUARD for the undercount that let `/dashboard/messages` be reported as an unqualified
 * pass while an authenticated cold trace measured it inside the D20-24 warning band.
 *
 * The original seed took only the route's OWN layout plus the auth pair, and so omitted seven assets
 * (6,114 B gz): the other three layouts, the second named middleware, and the three shared chunks
 * those pull in statically. Every assertion below is written by CATEGORY — "layouts this route does
 * not declare", "middleware this route does not run" — never by chunk name. Naming the seven would
 * pass today and undercount again the moment an eighth is added.
 */
describe('closure covers the whole app shell, not just the route’s own layout', () => {
  const closure = () => resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue').files

  it('1 — includes every layout and middleware chunk, including those this route never renders', () => {
    const files = closure()
    // Layouts the messages route does NOT use, and the middleware it does NOT run. All were missed.
    expect(files).toContain('_nuxt/default-layout.js')
    expect(files).toContain('_nuxt/auth-layout.js')
    expect(files).toContain('_nuxt/preview-layout.js')
    expect(files).toContain('_nuxt/preview-locale-mw.js')
    // …and the shared chunks reached transitively THROUGH them — counted by the static walk, not
    // by being listed anywhere.
    expect(files).toContain('_nuxt/app-link.js')
    expect(files).toContain('_nuxt/brand-mark.js')
    expect(files).toContain('_nuxt/shared-ui.js')
  })

  it('1b — the rule is categorical: a NEWLY added layout is picked up with no edit to the seed', () => {
    const g = graph()
    g[99] = {
      fileName: '_nuxt/brand-new-layout.js',
      isEntry: false,
      isDynamicEntry: true,
      imports: [],
      dynamicImports: [],
      modules: [{ id: 'app/layouts/marketing.vue?vue&type=script', renderedLength: 900 }]
    }
    expect(resolveDashboardClosure(g, 'app/pages/dashboard/messages.vue').files)
      .toContain('_nuxt/brand-new-layout.js')
  })

  it('2 — idle prefetch of ANOTHER route is excluded', () => {
    // `dash-index.js` is `/dashboard`'s page chunk. The runtime prefetches it because the sidebar
    // link is on screen; it is absent from the shell prefetch set and the route is usable without
    // it, so it belongs to /dashboard's closure and not to this one.
    expect(closure()).not.toContain('_nuxt/dash-index.js')
    // The same protection that keeps the entire public surface out.
    expect(closure()).not.toContain('_nuxt/public-blog.js')
  })

  it('3 — an asset first loaded by a later interaction is excluded', () => {
    // Reachable only through the page chunk's own `dynamicImports`.
    expect(closure()).not.toContain('_nuxt/interaction-only.js')
  })

  it('4 — a chunk two seed members both import is counted exactly once', () => {
    const files = closure()
    // `shared-ui.js` is a static import of BOTH the page chunk and the default layout.
    expect(files.filter(f => f === '_nuxt/shared-ui.js')).toHaveLength(1)
    expect(new Set(files).size).toBe(files.length)
  })
})

describe('dashboard closure — seed, then STATIC closure', () => {
  it('includes the seed: entry, layout, page dynamic entry and auth chunks', () => {
    const { files, seed } = resolveDashboardClosure(graph(), 'app/pages/dashboard/messages.vue')

    expect(seed.entry).toBe('_nuxt/entry.js')
    expect(seed.layout).toContain('_nuxt/dash-layout.js')
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

/**
 * Regressions found by review of the first implementation. Both were cases where the gate would
 * report a number it could not justify — the exact failure mode its design rejects.
 */
describe('dashboard closure — governed routes must always be measurable', () => {
  // This assertion is deliberately exact rather than a `toContain`, and it earned that: it is what
  // catches a dashboard route being ADDED without being registered for measurement, which is how a
  // route ships with no budget at all. Extending the list is the correct response to it failing —
  // loosening it would remove the only thing that notices.
  it('names exactly the routes D20-23 governs', () => {
    expect(DASHBOARD_ROUTES.map(r => r.route)).toEqual([
      '/dashboard/login', '/dashboard', '/dashboard/messages',
      '/dashboard/media', '/dashboard/profile',
      // The Articles module (D20-33). Its editor routes are governed by the same decision and are
      // registered here when they exist — this gate fetches what it governs.
      '/dashboard/articles', '/dashboard/articles/new',
      '/dashboard/articles/00000000-0000-0000-0000-000000000000',
      // The Experiences module (FE-3 module 1). D20-34 governs the collection; D20-35 governs the
      // two editor routes, which were registered when `M1·U3` created them and which derive their
      // OWN caps (120,832 B / 121,856 B) rather than inheriting the collection's — the correction
      // D20-33 had to make retroactively for Articles, made prospectively here.
      '/dashboard/experiences',
      '/dashboard/experiences/new',
      '/dashboard/experiences/00000000-0000-0000-0000-000000000000',
      // The Skills module (FE-3 module 2). D20-36 governs all three routes as one batched decision;
      // the collection was registered at M2·U2 deliberately ungoverned and the editors joined when
      // `M2·U3` created them — caps derived from their OWN baselines, none inherited.
      '/dashboard/skills', '/dashboard/skills/new',
      '/dashboard/skills/00000000-0000-0000-0000-000000000000',
      // The Testimonials module (FE-3 module 3). The collection was registered at T·U2 deliberately
      // ungoverned and is now governed (D20-37); the editor's two routes joined when `T·U3` created
      // them — measured but deliberately ungoverned until the owner derives their caps from their
      // OWN baselines, none inherited.
      '/dashboard/testimonials',
      '/dashboard/testimonials/new',
      '/dashboard/testimonials/00000000-0000-0000-0000-000000000000',
      // The Taxonomy destination (FE-3 Categories + Tags, U2): ONE route for BOTH collections,
      // first registered measured-but-ungoverned like every FE-3 collection, now governed as
      // D20-39 from its own baseline.
      '/dashboard/taxonomy',
      // The Projects module. The editor is registered under a concrete id because the gate fetches
      // the route; `/dashboard/**` is `ssr: false`, so which id is used cannot change the shell.
      '/dashboard/projects', '/dashboard/projects/new',
      '/dashboard/projects/00000000-0000-0000-0000-000000000000'
    ])
  })

  it('resolves a page module for every governed route, with no duplicates', () => {
    const routes = DASHBOARD_ROUTES.map(r => r.route)
    expect(new Set(routes).size).toBe(routes.length)
    for (const { route, pageModule } of DASHBOARD_ROUTES) {
      expect(pageModule, `${route} must name a page module`).toMatch(/^app\/pages\/dashboard\/.+\.vue$/)
    }
  })

  /**
   * `missing` is the signal the caller turns into an exit-2 infrastructure failure. It must be
   * populated whenever a governed route's page chunk cannot be resolved — a chunking change that
   * hides the page chunk has to FAIL, not quietly drop the route from the report while the gate
   * still exits 0.
   */
  it('reports a missing page chunk rather than returning a smaller closure', () => {
    const g = graph()
    delete g[4] // the /dashboard/messages page chunk disappears, as a chunking change could cause
    const { missing, seed } = resolveDashboardClosure(g, 'app/pages/dashboard/messages.vue')
    expect(seed.page).toBeNull()
    expect(missing.join(' ')).toMatch(/page chunk/)
  })

  it('reports a missing client entry too', () => {
    const g = graph()
    g[0] = { ...g[0], isEntry: false }
    const { missing } = resolveDashboardClosure(g, 'app/pages/dashboard/messages.vue')
    expect(missing.join(' ')).toMatch(/client entry/)
  })
})
